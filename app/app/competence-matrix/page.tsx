import type { CompetenceLevel } from "@/types/domain";
import { seedDemoDataIfEmpty, getEmployeesWithSkills } from "@/services/competenceService";

export const dynamic = "force-dynamic";

const competenceLevels: CompetenceLevel[] = [
  { value: 0, label: "None", description: "No experience or training" },
  { value: 1, label: "Basic", description: "Theoretical knowledge, needs supervision" },
  { value: 2, label: "Intermediate", description: "Can perform with occasional guidance" },
  { value: 3, label: "Advanced", description: "Fully independent, can train others" },
  { value: 4, label: "Expert", description: "Subject matter expert, defines standards" },
];

function getLevelColor(level: CompetenceLevel["value"]): string {
  switch (level) {
    case 0:
      return "bg-gray-200 dark:bg-gray-600";
    case 1:
      return "bg-red-400 dark:bg-red-600";
    case 2:
      return "bg-yellow-400 dark:bg-yellow-500";
    case 3:
      return "bg-green-300 dark:bg-green-500";
    case 4:
      return "bg-green-600 dark:bg-green-700";
    default:
      return "bg-gray-200 dark:bg-gray-600";
  }
}

export default async function CompetenceMatrixPage() {
  await seedDemoDataIfEmpty();
  const { employees, skills, employeeSkills } = await getEmployeesWithSkills();

  function getSkillLevel(employeeId: string, skillId: string): CompetenceLevel["value"] {
    const found = employeeSkills.find(
      (es) => es.employeeId === employeeId && es.skillId === skillId
    );
    return found ? found.level : 0;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Competence Matrix
      </h1>

      <div className="mb-6 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Legend
        </h2>
        <div className="flex flex-wrap gap-4">
          {competenceLevels.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded ${getLevelColor(level.value)}`}
                data-testid={`legend-level-${level.value}`}
              />
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">
                  {level.value} - {level.label}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  ({level.description})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="competence-matrix-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
                  Employee
                </th>
                {skills.map((skill) => (
                  <th
                    key={skill.id}
                    className="text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 min-w-[100px]"
                  >
                    <div>{skill.code}</div>
                    <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      {skill.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, index) => (
                <tr
                  key={employee.id}
                  className={
                    index < employees.length - 1
                      ? "border-b border-gray-200 dark:border-gray-700"
                      : ""
                  }
                  data-testid={`row-employee-${employee.id}`}
                >
                  <td className="p-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {employee.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {employee.role} - {employee.team}
                    </div>
                  </td>
                  {skills.map((skill) => {
                    const level = getSkillLevel(employee.id, skill.id);
                    return (
                      <td key={skill.id} className="p-3 text-center">
                        <div
                          className={`inline-flex items-center justify-center w-8 h-8 rounded text-sm font-medium text-gray-900 dark:text-white ${getLevelColor(level)}`}
                          data-testid={`cell-${employee.id}-${skill.id}`}
                        >
                          {level}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
