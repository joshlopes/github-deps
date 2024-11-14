import React from 'react';
import { useGithubStore } from '../store/useGithubStore';
import { TokenInput } from './TokenInput';
import { OrganizationSelect } from './OrganizationSelect';

export function ConfigForm() {
  const { token } = useGithubStore();

  return (
    <div className="space-y-6 w-full max-w-md">
      {!token ? <TokenInput /> : <OrganizationSelect />}
    </div>
  );
}