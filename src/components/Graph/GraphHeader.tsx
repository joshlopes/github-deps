import React from 'react';
import { GitGraph, ArrowLeft } from 'lucide-react';
import { useGithubStore } from '../../store/useGithubStore';
import { GraphSearch } from './GraphSearch';

interface GraphHeaderProps {
  selectedNode: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

export function GraphHeader({ selectedNode, onNodeSelect }: GraphHeaderProps) {
  const { reset } = useGithubStore();

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2">
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <GitGraph className="h-6 w-6 text-indigo-500" />
          <h1 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-emerald-500">
            PHP Dependencies Visualizer
          </h1>
        </div>
        <div className="flex-1 max-w-xl">
          <GraphSearch onNodeSelect={onNodeSelect} selectedNode={selectedNode} />
        </div>
      </div>
    </div>
  );
}