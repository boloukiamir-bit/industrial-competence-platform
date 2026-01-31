import ImportForm from "./ImportForm";

export default function ImportEmployeesPage() {
  return (
    <div>
      <h1
        className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
        data-testid="heading-import-employees"
      >
        Import Employees
      </h1>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Upload a CSV with required columns: <strong>name</strong> (or employee_name, namn) and <strong>employee_number</strong> (or employee_id). Optional: role, line (or source_sheet, area), team, is_active.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6 max-w-xl">
        <ImportForm />
      </div>
    </div>
  );
}
