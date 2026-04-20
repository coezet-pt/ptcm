import { toPng } from 'html-to-image';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function exportPNG(element: HTMLElement, filename: string): Promise<void> {
  try {
    const dataUrl = await toPng(element, { cacheBust: true, pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (e) {
    console.error('PNG export failed:', e);
  }
}

export function exportCSV(
  data: Record<string, unknown>[],
  filename: string,
): void {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportXLSX(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Data',
): void {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns based on header + values
  const keys = Object.keys(data[0]);
  worksheet['!cols'] = keys.map(k => {
    const maxLen = Math.max(
      k.length,
      ...data.map(row => {
        const v = row[k];
        return v == null ? 0 : String(v).length;
      }),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
