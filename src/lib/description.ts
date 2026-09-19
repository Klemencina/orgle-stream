// Convert supported breaks to text; React still escapes all other markup.
export function formatDescription(description: string): string {
  return description.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n?/g, '\n').trim();
}
