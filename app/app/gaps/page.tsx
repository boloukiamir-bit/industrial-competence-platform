import { getTomorrowsGaps } from "@/services/competenceService";

export const dynamic = "force-dynamic";

export default async function GapsPage() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  const formattedDate = targetDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const gaps = await getTomorrowsGaps();

  return (
    <div>
      <h1
        className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
        data-testid="heading-tomorrows-gaps"
      >
        Tomorrow's Gaps
      </h1>
      <p
        className="text-sm text-gray-500 dark:text-gray-400 mb-6"
        data-testid="text-target-date"
      >
        Target date: {formattedDate}
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="gaps-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Line
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Team
                </th>
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Skill
                </th>
                <th className="text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Required Level
                </th>
                <th className="text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Required
                </th>
                <th className="text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Actual
                </th>
                <th className="text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Missing
                </th>
              </tr>
            </thead>
            <tbody>
              {gaps.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-gray-500 dark:text-gray-400"
                    data-testid="no-gaps-message"
                  >
                    No competence gaps found for tomorrow.
                  </td>
                </tr>
              ) : (
                gaps.map((gap, index) => (
                  <tr
                    key={`${gap.line}-${gap.team}-${gap.skillCode}-${index}`}
                    className={`${
                      index < gaps.length - 1
                        ? "border-b border-gray-200 dark:border-gray-700"
                        : ""
                    } ${
                      gap.missingHeadcount > 0
                        ? "bg-red-50 dark:bg-red-900/20"
                        : ""
                    }`}
                    data-testid={`row-gap-${index}`}
                  >
                    <td className="p-3 text-sm text-gray-900 dark:text-white">
                      {gap.line}
                    </td>
                    <td className="p-3 text-sm text-gray-900 dark:text-white">
                      {gap.team}
                    </td>
                    <td className="p-3 text-sm">
                      <div className="text-gray-900 dark:text-white">
                        {gap.skillCode}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {gap.skillName}
                      </div>
                    </td>
                    <td className="p-3 text-sm text-center text-gray-900 dark:text-white">
                      {gap.requiredLevel}
                    </td>
                    <td className="p-3 text-sm text-center text-gray-900 dark:text-white">
                      {gap.requiredHeadcount}
                    </td>
                    <td className="p-3 text-sm text-center text-gray-900 dark:text-white">
                      {gap.actualHeadcount}
                    </td>
                    <td className="p-3 text-sm text-center font-medium text-red-600 dark:text-red-400">
                      {gap.missingHeadcount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
