"use client";

import { useState, useRef } from "react";
import { importEmployeesFromCsv } from "./actions";

export default function ImportForm() {
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await importEmployeesFromCsv(formData);
      setResult(response);
      if (response.success) {
        formRef.current?.reset();
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="csv-file"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          CSV File
        </label>
        <input
          type="file"
          id="csv-file"
          name="file"
          accept=".csv"
          required
          className="block w-full text-sm text-gray-900 dark:text-gray-100 
            file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 
            file:text-sm file:font-medium file:bg-gray-100 dark:file:bg-gray-700 
            file:text-gray-700 dark:file:text-gray-200 
            hover:file:bg-gray-200 dark:hover:file:bg-gray-600 
            file:cursor-pointer cursor-pointer"
          data-testid="input-csv-file"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium 
          hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed 
          transition-colors"
        data-testid="button-upload-import"
      >
        {isLoading ? "Importing..." : "Upload and import"}
      </button>

      {result && (
        <div
          className={`p-4 rounded-md text-sm ${
            result.success
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
          data-testid={result.success ? "message-success" : "message-error"}
        >
          {result.message}
        </div>
      )}
    </form>
  );
}
