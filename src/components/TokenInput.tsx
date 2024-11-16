import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useGithubStore } from '../store/useGithubStore';

export function TokenInput() {
  const [tokenInput, setTokenInput] = useState('');
  const { setToken, validateToken, isValidatingToken } = useGithubStore();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setToken(tokenInput);
    await validateToken();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="token" className="block text-sm font-medium text-gray-700">
          GitHub Personal Access Token
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <KeyRound className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="password"
            id="token"
            name="token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="ghp_your_token_here"
            required
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Token needs repo access permissions
        </p>
      </div>

      <button
        type="submit"
        disabled={isValidatingToken || !tokenInput}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isValidatingToken ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Validating...
          </>
        ) : (
          'Validate Token'
        )}
      </button>
    </form>
  );
}