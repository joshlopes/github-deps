import React from 'react';
import { useGithubStore } from '../store/useGithubStore';
import { PackageSearch, GitFork, GitBranch, Loader2 } from 'lucide-react';

export function ProgressIndicator() {
  const { progress } = useGithubStore();

  if (!progress) return null;

  const percentage = Math.round((progress.current / progress.total) * 100);

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between text-sm text-gray-600">
        <span>Analyzing repositories...</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <PackageSearch className="h-5 w-5 text-indigo-600" />
          <span className="font-medium text-gray-900">{progress.currentRepo}</span>
          <span className={`text-sm px-2 py-0.5 rounded ${
            progress.isPhp 
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {progress.isPhp ? 'PHP Project' : 'Non-PHP Project'}
          </span>
        </div>
        {progress.isPhp && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                <Loader2 className="h-3.5 w-3.5 inline mr-1 animate-spin" />
                Fetching latest tags...
              </span>
            </div>
            {progress.dependencies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GitFork className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Internal Dependencies:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {progress.dependencies.map((dep) => (
                    <span
                      key={dep}
                      className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full"
                    >
                      {dep.split('/')[1]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}