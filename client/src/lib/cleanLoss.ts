const CLEAN_LOSS_ALIASES = new Set([
  "normal model loss",
  "a+ loss",
  "a plus loss",
]);

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\+/g, " plus ");
}

export function isCleanLossTag(mistake: string): boolean {
  return CLEAN_LOSS_ALIASES.has(normalizeLabel(mistake));
}
