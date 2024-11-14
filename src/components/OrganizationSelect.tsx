import React, { useState, useRef, useEffect } from 'react';
import { GithubIcon, Loader2, Search, LogOut, XCircle, RefreshCw } from 'lucide-react';
import { useGithubStore } from '../store/useGithubStore';
import { ProgressIndicator } from './ProgressIndicator';

export function OrganizationSelect() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    organizations,
    organization,
    setOrganization,
    fetchDependencies,
    isLoadingOrgs,
    isLoading,
    reset,
    clearError,
    clearCache,
    error,
    hasAttemptedFetch,
  } = useGithubStore();

  const selectedOrg = organizations.find(org => org.login === organization);
  const [search, setSearch] = useState(selectedOrg?.login || '');

  const filteredOrgs = organizations.filter((org) =>
    org.login.toLowerCase().includes(search.toLowerCase()) ||
    (org.name && org.name.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    if (selectedOrg) {
      setSearch(selectedOrg.login);
    }
  }, [selectedOrg]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (organization) {
      clearError();
      await fetchDependencies();
    }
  };

  const handleOrganizationSelect = (orgLogin: string) => {
    setOrganization(orgLogin);
    setSearch(orgLogin);
    setIsOpen(false);
  };

  const handleClearSearch = () => {
    setSearch('');
    setOrganization('');
    setIsOpen(true);
  };

  const handleForceAnalyze = async () => {
    if (organization) {
      clearCache(organization);
      clearError();
      await fetchDependencies();
    }
  };

  const isAnalyzeDisabled = isLoading || !organization || (hasAttemptedFetch && isLoading);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="relative" ref={dropdownRef}>
            <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
              Organization
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isLoadingOrgs ? (
                  <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                ) : (
                  <GithubIcon className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <input
                type="text"
                id="organization"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Search organizations..."
                disabled={isLoadingOrgs || isLoading}
                autoComplete="off"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {search ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                ) : (
                  <Search className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {isOpen && filteredOrgs.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg">
                <ul className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                  {filteredOrgs.map((org) => (
                    <li
                      key={org.login}
                      className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50 ${
                        org.login === organization ? 'bg-indigo-50' : ''
                      }`}
                      onClick={() => handleOrganizationSelect(org.login)}
                    >
                      <div className="flex items-center">
                        <GithubIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">{org.login}</span>
                        {org.name && (
                          <span className="ml-2 text-sm text-gray-500">({org.name})</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="p-2 text-gray-400 hover:text-gray-600 mt-6 ml-4"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm">
          {error}
        </div>
      )}

      {isLoading && <ProgressIndicator />}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isAnalyzeDisabled}
          className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze Dependencies'
          )}
        </button>
        {organization && !isLoading && (
          <button
            type="button"
            onClick={handleForceAnalyze}
            className="px-4 py-2 border border-indigo-200 text-indigo-600 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2"
            title="Force a fresh analysis ignoring cached data"
          >
            <RefreshCw className="h-4 w-4" />
            Force Analyze
          </button>
        )}
      </div>
    </form>
  );
}