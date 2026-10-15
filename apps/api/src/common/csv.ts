/**
 * Minimal safe CSV builder.
 * - quotes fields containing comma, quote or newline
 * - neutralises spreadsheet formula injection (cells starting with = + - @)
 * - UTF-8 BOM so Excel opens Swahili/accents correctly
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map((r) => r.map(cell).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
