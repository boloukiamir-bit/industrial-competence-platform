import Link from "next/link";

export function FooterMinimal() {
  return (
    <footer id="request-brief" className="border-t border-[var(--border)] py-10 px-6 sm:px-8 lg:px-12">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[var(--text-3)]">
          Governance infrastructure for industrial execution. Audit-ready legitimacy.
        </p>
        <nav className="flex items-center gap-6 text-sm" aria-label="Footer">
          <Link
            href="/2030#request-brief"
            className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
          >
            Executive Brief
          </Link>
          <Link
            href="/app/cockpit"
            className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
          >
            Command View
          </Link>
          <Link
            href="/login"
            className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
