import { useNavigate } from 'react-router-dom'
import ReportForm from './ReportForm'
import { WHAT_HAPPENS_NEXT } from './language'

/** The form alone, as a page. ReportForm owns its own units query. */
export default function NewReport() {
  const navigate = useNavigate()

  return (
    <div className="w-full px-4 py-6 sm:px-6 xl:px-8">
      <h1 className="text-xl">Report a fault</h1>
      <p className="mt-1 max-w-prose text-sm text-foreground-muted">
        Tell the estate office what is wrong and someone will be sent to you.
      </p>

      {/* A 1200px-wide input is worse than a 640px one, so the form is
          capped and sits left; the space that frees up carries context
          rather than nothing. */}
      <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="w-full xl:max-w-[40rem] xl:shrink-0">
          <div className="rounded-sm border border-subtle bg-card">
            {/* The id rides in location state rather than the URL: a highlight
                is a reaction to what you just did, not something to link
                someone to. Note that React Router keeps this in history.state,
                so it DOES survive a reload — MyReports bounds it by the
                report's age. */}
            <ReportForm
              onLogged={(issueId) =>
                navigate('/my/reports', { state: { highlight: issueId } })
              }
            />
          </div>
        </div>

        <aside className="hidden rounded-sm border border-subtle bg-surface-2 p-5 xl:block xl:w-[22rem]">
          <h2 className="text-base">What happens next</h2>
          <ul className="mt-3 space-y-3 text-sm text-foreground-muted">
            {WHAT_HAPPENS_NEXT.map((line) => (
              <li key={line} className="max-w-prose">
                {line}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
