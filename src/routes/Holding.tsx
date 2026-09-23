import { useAuth } from '../auth/context'

/**
 * A real landing place for a role whose screens are not built yet. Without
 * it, HOME has no entry for that role and RequireRole renders
 * <Navigate to={undefined}> — or worse, a redirect loop between "/" and a
 * route that does not exist.
 */
export default function Holding({ what }: { what: string }) {
  const { profile, signOut } = useAuth()

  return (
    <div className="w-full px-4 py-10 sm:px-6">
      <div className="max-w-prose">
        <h1 className="text-xl">Nothing here yet</h1>
        <p className="mt-2 text-base text-foreground-muted">
          {what}
        </p>
        <p className="mt-2 text-sm text-foreground-faint">
          Signed in as {profile?.full_name}.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 min-h-11 rounded-sm border border-subtle px-4 py-2.5 text-sm hover:border-primary hover:text-primary"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
