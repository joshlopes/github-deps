import React, { useState } from 'react';
import { useGithubStore } from '../store/useGithubStore';
import { CheckSquare, Square, CheckSquare2, Search } from 'lucide-react';

export function RepositoryList() {
  const { repositories, toggleRepository, selectAllRepositories, deselectAllRepositories } = useGithubStore();
  const [filter, setFilter] = useState('');
  
  const filteredRepositories = repositories.filter(repo => 
    repo.name.toLowerCase().includes(filter.toLowerCase())
  );
  const selectedCount = repositories.filter(repo => repo.selected).length;
  const allSelected = selectedCount === repositories.length;
  const someSelected = selectedCount > 0 && selectedCount < repositories.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Repositories ({selectedCount} selected)
        </h3>
        <button
          type="button"
          onClick={() => allSelected ? deselectAllRepositories() : selectAllRepositories()}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-500"
        >
          {allSelected ? (
            <CheckSquare className="h-4 w-4" />
          ) : someSelected ? (
            <CheckSquare2 className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter repositories..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 max-h-60 overflow-y-auto">
        {filteredRepositories.map((repo) => (
          <div
            key={repo.name}
            className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
            onClick={() => toggleRepository(repo.name)}
          >
            {repo.selected ? (
              <CheckSquare className="h-4 w-4 text-indigo-600 mr-3" />
            ) : (
              <Square className="h-4 w-4 text-gray-400 mr-3" />
            )}
            <span className="text-sm text-gray-900">{repo.name}</span>
          </div>
        ))}
        {filteredRepositories.length === 0 && (
          <div className="px-4 py-2 text-sm text-gray-500">
            No repositories found
          </div>
        )}
      </div>
    </div>
  );
}