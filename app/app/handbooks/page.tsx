"use client";

import { useEffect, useState } from "react";
import { BookOpen, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Document } from "@/types/domain";

export default function HandbooksPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHandbooks() {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .in("type", ["employee_handbook", "manager_handbook", "handbook"])
        .order("title");

      if (!error && data) {
        setDocuments(
          data.map((row) => ({
            id: row.id,
            employeeId: row.employee_id,
            title: row.title,
            type: row.type,
            url: row.url,
            createdAt: row.created_at,
            validTo: row.valid_to,
          }))
        );
      }
      setLoading(false);
    }
    loadHandbooks();
  }, []);

  const employeeHandbooks = documents.filter((d) => d.type === "employee_handbook" || (d.type === "handbook" && d.title.toLowerCase().includes("employee")));
  const managerHandbooks = documents.filter((d) => d.type === "manager_handbook" || (d.type === "handbook" && d.title.toLowerCase().includes("manager")));
  const otherHandbooks = documents.filter((d) => !employeeHandbooks.includes(d) && !managerHandbooks.includes(d));

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Digital Handbooks
        </h1>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No handbooks available</p>
        </div>
      ) : (
        <div className="space-y-8">
          {employeeHandbooks.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Employee Handbooks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employeeHandbooks.map((doc) => (
                  <HandbookCard key={doc.id} document={doc} />
                ))}
              </div>
            </section>
          )}

          {managerHandbooks.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Manager Handbooks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {managerHandbooks.map((doc) => (
                  <HandbookCard key={doc.id} document={doc} />
                ))}
              </div>
            </section>
          )}

          {otherHandbooks.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Other Handbooks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherHandbooks.map((doc) => (
                  <HandbookCard key={doc.id} document={doc} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function HandbookCard({ document }: { document: Document }) {
  return (
    <a
      href={document.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
      data-testid={`link-handbook-${document.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {document.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Added {new Date(document.createdAt).toLocaleDateString()}
          </p>
        </div>
        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </div>
    </a>
  );
}
