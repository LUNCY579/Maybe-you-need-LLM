/**
 * Exporting the numbers.
 *
 * A research laboratory that cannot hand you its data is a picture of a
 * laboratory. Every table in this application can be downloaded as CSV, so a
 * student can check a claim in a spreadsheet, plot it differently, or include it
 * in their own write-up. The file contains exactly the numbers that were on
 * screen, with the settings that produced them in the header.
 */

export type CsvRow = Array<string | number | null | undefined>;

/** Quote a field for CSV: commas, quotes and newlines must be escaped. */
function quote(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Build a CSV string from a header row and a body. */
export function toCsv(header: CsvRow, rows: CsvRow[]): string {
  const lines = [header.map((v) => quote(String(v ?? ''))).join(',')];
  for (const row of rows) {
    lines.push(row.map((v) => quote(String(v ?? ''))).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * A CSV with a provenance preamble: the settings that produced the numbers, as
 * comment lines, so a downloaded file is self-describing.
 */
export function toProvenanceCsv(meta: Record<string, string | number>, header: CsvRow, rows: CsvRow[]): string {
  const preamble = Object.entries(meta).map(([k, v]) => `# ${k}: ${v}`);
  return preamble.join('\r\n') + '\r\n' + toCsv(header, rows);
}

/** Trigger a download of a text file in the browser. */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // give the browser a tick to start the download before revoking the URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
