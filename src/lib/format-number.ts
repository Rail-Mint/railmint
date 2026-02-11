function parseNumberish(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numericToken = trimmed.match(/-?\d+(?:\.\d+)?/);
    if (!numericToken) return null;

    const parsed = Number(numericToken[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = parseNumberish(value);
  return parsed ?? fallback;
}

export function formatFixed(value: unknown, digits = 2, fallback = '0.0'): string {
  const parsed = parseNumberish(value);
  if (parsed === null) return fallback;
  return parsed.toFixed(digits);
}

export function normalizeTokenUnit(unit?: string | null): string {
  if (!unit) return 'tBNB';
  const normalized = unit.trim();
  if (!normalized) return 'tBNB';
  return normalized.toUpperCase() === 'BNB' ? 'tBNB' : normalized;
}

export function formatTokenBalance(value: unknown, unit = 'tBNB', digits = 4): string {
  return `${formatFixed(value, digits, '0.0')} ${normalizeTokenUnit(unit)}`;
}
