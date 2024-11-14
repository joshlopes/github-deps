import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useGithubStore } from '../../store/useGithubStore';

interface GraphSearchProps {
  onNodeSelect: (nodeId: string | null) => void;
  selectedNode: string | null;
}

export function GraphSearch({ onNodeSelect, selectedNode }: GraphSearchProps) {
  const { graphData } = useGithubStore();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredNodes = search
    ? graphData.nodes.filter(node =>
        node.id.toLowerCase().includes(search.toLowerCase()) ||
        node.name.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setIsOpen(true);
  };

  const handleNodeSelect = (nodeId: string) => {
    onNodeSelect(nodeId);
    setSearch(nodeId);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearch('');
    onNodeSelect(null);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative rounded-md shadow-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          onFocus={() => setIsOpen(true)}
          className="block w-full pl-10 pr-10 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Search repositories..."
        />
        {search && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {isOpen && filteredNodes.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-96 overflow-auto">
          <ul className="py-1">
            {filteredNodes.map((node) => (
              <li
                key={node.id}
                onClick={() => handleNodeSelect(node.id)}
                className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                  selectedNode === node.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{node.id}</div>
                <div className="text-sm text-gray-500">v{node.version}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}