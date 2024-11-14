import React from 'react';
import { useGithubStore } from '../store/useGithubStore';
import { GraphContainer } from './DependencyGraph/GraphContainer';
import { GraphControls } from './DependencyGraph/GraphControls';
import { GraphHeader } from './DependencyGraph/GraphHeader';

export function DependencyGraph() {
  const { graphData } = useGithubStore();

  if (!graphData.nodes.length) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      <GraphHeader />
      <div className="flex-1 flex flex-col p-4 space-y-4">
        <GraphControls />
        <div className="flex-1 bg-gradient-to-br from-slate-50 to-white rounded-lg overflow-hidden shadow-lg border border-slate-200">
          <GraphContainer />
        </div>
      </div>
    </div>
  );
}