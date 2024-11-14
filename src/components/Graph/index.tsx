import React, { useState } from 'react';
import { GraphHeader } from './GraphHeader';
import { GraphView } from './GraphView';
import { useGithubStore } from '../../store/useGithubStore';

export function Graph() {
  const { graphData } = useGithubStore();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  if (!graphData.nodes.length) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      <GraphHeader selectedNode={selectedNode} onNodeSelect={setSelectedNode} />
      <div className="flex-1 p-4">
        <div className="h-full bg-gradient-to-br from-slate-50 to-white rounded-lg overflow-hidden shadow-lg border border-slate-200">
          <GraphView selectedNode={selectedNode} onNodeSelect={setSelectedNode} />
        </div>
      </div>
    </div>
  );
}