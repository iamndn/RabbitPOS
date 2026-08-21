/**
 * CSV Export Utility with UTF-8 BOM encoding for Microsoft Excel compatibility
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (item: T) => string | number | null | undefined;
}

export function exportToCsv<T>(filename: string, data: T[], columns: CsvColumn<T>[]) {
  if (!data || data.length === 0) {
    console.warn('exportToCsv: No data available to export.');
    return;
  }

  // 1. Build Header Row
  const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(',');

  // 2. Build Data Rows
  const rows = data.map((item) =>
    columns
      .map((col) => {
        const val = col.accessor(item);
        const strVal = val === null || val === undefined ? '' : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  // 3. Prepend UTF-8 BOM (\uFEFF) for Excel Vietnamese diacritics support
  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');

  // 4. Trigger Browser File Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
