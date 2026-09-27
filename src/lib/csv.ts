/**
 * CSV for spreadsheets, not for machines.
 *
 * Every field is quoted and embedded quotes are doubled, so a comma in a
 * description or an apostrophe in a name cannot shift a column. The headers
 * are whatever keys the rows arrive with, in that order — issue_export
 * already names its columns for people, and renaming them here would mean
 * two places to keep in step.
 */
export function toCsv(
  rows: Record<string, unknown>[],
  /**
   * Columns to emit bare when the value is a plain number, so a spreadsheet
   * reads them as numbers and SUM works. A quoted number arrives as text.
   * Named by the caller: this file should not know what a view contains.
   */
  numeric: string[] = [],
): string {
  if (rows.length === 0) return ''

  const headers = Object.keys(rows[0])
  const bare = new Set(numeric)
  const plainNumber = /^-?\d+(\.\d+)?$/

  const quote = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }

  const cell = (header: string, value: unknown) => {
    if (bare.has(header) && value !== null && value !== undefined) {
      const text = String(value)
      // Only a plain number goes bare. Anything else — a blank, a dash, a
      // value that grew a comma — is quoted, because an unquoted surprise
      // is what shifts a column.
      if (plainNumber.test(text)) return text
    }
    return quote(value)
  }

  const lines = [
    // Headers are always quoted; only values can be bare.
    headers.map(quote).join(','),
    ...rows.map((row) =>
      headers.map((header) => cell(header, row[header])).join(','),
    ),
  ]

  // CRLF: RFC 4180, and what Excel on Windows expects.
  return lines.join('\r\n')
}

/**
 * Hand the file to the browser. The BOM is what makes Excel read the file
 * as UTF-8 — without it the naira sign arrives as mojibake.
 */
export function download(filename: string, text: string) {
  const blob = new Blob(['﻿' + text], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** The estate's day, not UTC's — they differ either side of midnight. */
export function exportFilename(now: Date = new Date()): string {
  const day = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
  return `wuse-ii-maintenance-${day}.csv`
}
