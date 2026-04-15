import { toPng } from 'html-to-image';
import Papa from 'papaparse';

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
