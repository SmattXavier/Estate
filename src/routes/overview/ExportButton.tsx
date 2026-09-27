import { useMutation } from '@tanstack/react-query'
import { ErrorNote } from '../../components/States'
import { supabase } from '../../lib/supabase'
import { download, exportFilename, toCsv } from '../../lib/csv'

export default function ExportButton() {
  const run = useMutation({
    mutationFn: async (): Promise<number> => {
      // Fetched on press, not on every visit to the page.
      const { data, error } = await supabase.from('issue_export').select('*')
      if (error) throw error
      const rows = (data ?? []) as Record<string, unknown>[]
      if (rows.length === 0) return 0
      // The three numeric columns go out bare so a spreadsheet can total
      // and average them; everything else stays quoted.
      download(
        exportFilename(),
        toCsv(rows, ['Minutes to assign', 'Target minutes', 'Cost (NGN)']),
      )
      return rows.length
    },
  })

  return (
    <div>
      <button
        type="button"
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="min-h-11 rounded-sm border border-subtle bg-card px-4 py-2.5 text-sm hover:border-primary hover:text-primary disabled:opacity-60"
      >
        {run.isPending ? 'Preparing…' : 'Export the record'}
      </button>

      <p className="mt-2 max-w-prose text-sm text-foreground-muted">
        Every fault on the estate, with what was needed to put it right, as a
        spreadsheet.
      </p>

      {run.isError && (
        <div className="mt-3">
          <ErrorNote error={run.error} what="We could not build the export." />
        </div>
      )}

      {/* No rows means no headers either, so there is nothing to hand over
          — better to say so than to download an empty file. */}
      {run.isSuccess && run.data === 0 && (
        <p className="mt-3 text-sm text-foreground-muted">
          Nothing to export yet.
        </p>
      )}

      {run.isSuccess && run.data > 0 && (
        <p className="mt-3 text-sm text-foreground-muted">
          <span className="num">{run.data}</span>
          {run.data === 1 ? ' fault exported.' : ' faults exported.'}
        </p>
      )}
    </div>
  )
}
