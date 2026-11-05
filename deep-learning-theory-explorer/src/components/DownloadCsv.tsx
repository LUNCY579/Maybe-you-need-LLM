import { Button } from './ui';
import { downloadText, toProvenanceCsv, type CsvRow } from '../lib/export';

/**
 * A "download the numbers" button.
 *
 * The file carries the settings that produced it, so a downloaded table is
 * self-describing: a reader can tell which seed, which depth and which width
 * the numbers came from without having to ask.
 */
export function DownloadCsv({
  filename,
  meta,
  header,
  rows,
  label = 'download CSV',
  title,
}: {
  filename: string;
  meta: Record<string, string | number>;
  header: CsvRow;
  rows: CsvRow[];
  label?: string;
  title?: string;
}) {
  return (
    <Button
      variant="ghost"
      title={title ?? 'Download these numbers as a CSV file, with the settings that produced them'}
      onClick={() => {
        if (rows.length === 0) return;
        downloadText(filename, toProvenanceCsv(meta, header, rows));
      }}
    >
      {label}
    </Button>
  );
}
