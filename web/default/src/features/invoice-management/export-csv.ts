/**
 * Build a CSV document from a header row + data rows and trigger a browser
 * download. A UTF-8 BOM is prepended so Excel / WPS open it with the correct
 * encoding (Chinese text otherwise shows as mojibake). Every field is quoted
 * and internal quotes are doubled, so commas / quotes / newlines in values are
 * safe. No third-party dependency is used.
 */
function csvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(','))
  const csv = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
