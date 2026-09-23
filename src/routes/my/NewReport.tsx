import { useNavigate } from 'react-router-dom'
import ReportForm from './ReportForm'

/** The form alone, as a page. ReportForm owns its own units query. */
export default function NewReport() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl">Report a fault</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Tell the estate office what is wrong and someone will be sent to you.
      </p>

      <div className="mt-5 rounded-sm border border-subtle bg-card">
        {/* The id rides in location state rather than the URL: a highlight
            is a reaction to what you just did, not something to link someone
            to. Note that React Router keeps this in history.state, so it DOES
            survive a reload — MyReports bounds it by the report's age. */}
        <ReportForm
          onLogged={(issueId) =>
            navigate('/my/reports', { state: { highlight: issueId } })
          }
        />
      </div>
    </div>
  )
}
