import { execute } from "./db";

export type SyncedUser = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: Date;
};
export async function upsertUser(user: SyncedUser) {
  await execute(
    `INSERT INTO users (id, email, name, image_url, created_at)
    VALUES (@id, @email, @name, @imageUrl, @createdAt)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name,
      image_url = EXCLUDED.image_url, created_at = EXCLUDED.created_at, updated_at = NOW()`,
    user,
  );
}
