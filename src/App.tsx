import React, { useEffect } from 'react';
import { ConfigForm } from './components/ConfigForm';
import { Graph } from './components/Graph';
import { useGithubStore } from './store/useGithubStore';
import { GitGraph } from 'lucide-react';

export default function App() {
  const { error, graphData, token, fetchOrganizations } = useGithubStore();

  useEffect(() => {
    if (token) {
      fetchOrganizations();
    }
  }, [token, fetchOrganizations]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {!graphData?.nodes?.length ? (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GitGraph className="h-12 w-12 text-indigo-500" />
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-emerald-500">
                PHP Dependencies Visualizer
              </h1>
            </div>
            <p className="text-lg text-slate-600">
              Analyze and visualize PHP package dependencies across your GitHub organization
            </p>
          </div>

          <div className="flex flex-col items-center space-y-8">
            <ConfigForm />

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-md shadow-sm border border-red-100">
                {error}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Graph />
      )}
    </div>
  );
}