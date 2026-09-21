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
        <ReportForm onLogged={() => navigate('/my/reports')} />
      </div>
    </div>
  )
}
