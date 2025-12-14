export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6"
          data-testid="card-tomorrows-gaps"
        >
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Tomorrow&apos;s Gaps
          </h2>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            --
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Skill gaps requiring attention
          </p>
        </div>

        <div
          className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6"
          data-testid="card-certification-status"
        >
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Certification Status
          </h2>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            --
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Certifications expiring soon
          </p>
        </div>

        <div
          className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6"
          data-testid="card-critical-lines"
        >
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Critical Lines
          </h2>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            --
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Production lines at risk
          </p>
        </div>
      </div>
    </div>
  );
}
