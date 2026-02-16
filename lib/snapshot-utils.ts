export function extractUrlsFromMarkdown(markdown: string) {
  const markdownLinks = [...markdown.matchAll(/\[[^\]]*?\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1]);
  const bareUrls = [...markdown.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((match) => match[0]);
  const unique = new Set<string>();

  for (const rawUrl of [...markdownLinks, ...bareUrls]) {
    try {
      const normalized = new URL(rawUrl).toString();
      unique.add(normalized);
    } catch {
      // Skip malformed URLs.
    }
  }

  return [...unique].slice(0, 100);
}

export function extractDescriptionFromMarkdown(markdown: string) {
  const withoutLinks = markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");
  const lines = withoutLinks
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("- "))
    .filter((line) => !line.startsWith("* "))
    .filter((line) => !line.startsWith(">"))
    .filter((line) => !/^https?:\/\//.test(line));

  const chunks: string[] = [];
  let buffer = "";
  for (const line of lines) {
    const next = buffer ? `${buffer} ${line}` : line;
    if (next.length > 320) {
      if (buffer) {
        chunks.push(buffer);
      }
      buffer = line;
    } else {
      buffer = next;
    }
    if (chunks.length >= 2) {
      break;
    }
  }

  if (buffer && chunks.length < 2) {
    chunks.push(buffer);
  }

  return chunks.join("\n\n");
}
