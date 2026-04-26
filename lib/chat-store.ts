import { initializeDatabase, query, queryOne, execute } from "./db";
import { getOpenAiClient } from "./openai";

export type ChatThreadSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ChatThreadDetail = {
  id: string;
  title: string | null;
  uiSnapshot: Record<string, unknown> | null;
  messagesJson: unknown[];
  updatedAt: string;
  createdAt: string;
};

export async function listThreads(userId: string): Promise<ChatThreadSummary[]> {
  await initializeDatabase();
  const rows = await query<{
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT id, title, created_at, updated_at
      FROM chat_threads
      WHERE user_id = @user_id
      ORDER BY updated_at DESC
      LIMIT 50
    `,
    { user_id: userId },
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createThread(userId: string): Promise<ChatThreadSummary> {
  await initializeDatabase();
  const row = await queryOne<{
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      INSERT INTO chat_threads (user_id)
      VALUES (@user_id)
      RETURNING id, title, created_at, updated_at
    `,
    { user_id: userId },
  );
  if (!row) {
    throw new Error("Failed to create thread");
  }
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteThread(userId: string, threadId: string): Promise<boolean> {
  await initializeDatabase();
  const affected = await execute(
    `DELETE FROM chat_threads WHERE id = @id AND user_id = @user_id`,
    { id: threadId, user_id: userId },
  );
  return affected > 0;
}

export async function loadThread(
  userId: string,
  threadId: string,
): Promise<ChatThreadDetail | null> {
  await initializeDatabase();
  const thread = await queryOne<{
    id: string;
    title: string | null;
    ui_snapshot: unknown;
    messages_json: unknown;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT id, title, ui_snapshot, messages_json, created_at, updated_at
      FROM chat_threads
      WHERE id = @id AND user_id = @user_id
    `,
    { id: threadId, user_id: userId },
  );
  if (!thread) return null;

  return {
    id: thread.id,
    title: thread.title,
    uiSnapshot: (thread.ui_snapshot as Record<string, unknown> | null) ?? null,
    messagesJson: Array.isArray(thread.messages_json) ? thread.messages_json : [],
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  };
}

export async function saveThreadSnapshot(
  userId: string,
  threadId: string,
  data: {
    messages: unknown[];
    uiSnapshot?: Record<string, unknown> | null;
  },
): Promise<void> {
  await initializeDatabase();
  const owned = await queryOne<{ id: string }>(
    `
      UPDATE chat_threads
      SET
        messages_json = @messages_json::jsonb,
        ui_snapshot = COALESCE(@ui_snapshot::jsonb, ui_snapshot),
        updated_at = NOW()
      WHERE id = @id AND user_id = @user_id
      RETURNING id
    `,
    {
      id: threadId,
      user_id: userId,
      messages_json: JSON.stringify(data.messages),
      ui_snapshot: data.uiSnapshot === undefined ? null : JSON.stringify(data.uiSnapshot),
    },
  );
  if (!owned) {
    throw new Error("Thread not found or not owned by user");
  }
}

export async function setThreadTitle(
  userId: string,
  threadId: string,
  title: string,
): Promise<void> {
  await initializeDatabase();
  await execute(
    `
      UPDATE chat_threads
      SET title = @title, updated_at = NOW()
      WHERE id = @id AND user_id = @user_id
    `,
    { id: threadId, user_id: userId, title: title.slice(0, 200) },
  );
}

export async function summarizeThreadTitle(
  firstUserMessage: string,
): Promise<string> {
  const trimmed = firstUserMessage.trim().slice(0, 600);
  if (!trimmed) return "New conversation";

  try {
    const openai = getOpenAiClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Summarize the user's question or task in 4-7 words for a chat-thread title. " +
            "Lowercase, no punctuation at the end. No quotes.",
        },
        { role: "user", content: trimmed },
      ],
      max_tokens: 30,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    return raw.replace(/[."'`]+$/g, "").slice(0, 80) || "New conversation";
  } catch {
    return trimmed.slice(0, 60);
  }
}
