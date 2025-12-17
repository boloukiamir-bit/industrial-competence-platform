'use client';

import { Shield, Key, Lock, Eye } from 'lucide-react';

export default function SecuritySettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white" data-testid="text-page-title">
          Security Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure authentication and access control policies
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Key className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Password Policy</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Set minimum password requirements and expiration rules
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Lock className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Require 2FA for all users or specific roles
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Shield className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Session Management</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure session timeout and concurrent login settings
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Eye className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Access Logs</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                View login attempts and security events
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Security settings are managed through Supabase. Advanced configuration coming soon.
        </p>
      </div>
    </div>
  );
}
