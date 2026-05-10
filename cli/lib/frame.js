/**
 * MATRIYA-LITE — presentation layer.
 *
 * One job: show where to look without pretending to know what it means. Every
 * line printed through here is an *indicator*, never a verdict — no "good"/"bad",
 * no "you should", no strategic call. Like medical imaging: it points; the
 * reader interprets. נראות בלי סמכות מדומה.
 */

/** Short marker for a finding. The tag is descriptive only — it carries no judgement. */
export function signal(tag, text) {
  return `  [${tag}] ${text}`;
}

export function heading(title) {
  return `${title}\n${'─'.repeat(Math.max(3, Math.min(String(title).length, 64)))}`;
}

export function bullet(text) {
  return `  • ${text}`;
}

/** Short, stable id for display (research sessions are UUIDs). */
export function shortId(id) {
  if (id == null) return '—';
  const s = String(id);
  return s.length > 8 ? s.slice(0, 8) : s;
}

export function ageFrom(date, now = new Date()) {
  if (!date) return 'unknown';
  const ms = now - new Date(date);
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms < 60000) return 'just now';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 60) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/** Minimal fixed-width table. headers: string[], rows: (string|number)[][]. */
export function table(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(String(h).length, 1, ...rows.map((r) => String(r[i] ?? '').length))
  );
  const fmt = (cells) =>
    ('  ' + cells.map((c, i) => String(c ?? '').padEnd(widths[i] ?? 0)).join('  ')).replace(/\s+$/, '');
  const sep = '  ' + widths.map((w) => '─'.repeat(w)).join('  ');
  return [fmt(headers), sep, ...rows.map(fmt)].join('\n');
}

const INDICATOR_NOTE = [
  '── indicator, not a verdict ' + '─'.repeat(36),
  'MATRIYA-LITE shows you where to look. It does not decide whether something',
  'is good or bad, what it means in human terms, or what the right move is.',
  'נראות בלי סמכות מדומה — visibility without false authority. The reading is yours.'
].join('\n');

/** Join blocks with blank lines and append the standing disclaimer. */
export function render(blocks) {
  const body = blocks.filter((b) => b != null && b !== '').join('\n\n');
  return `${body}\n\n${INDICATOR_NOTE}\n`;
}
