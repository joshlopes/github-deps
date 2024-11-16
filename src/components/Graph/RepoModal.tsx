import React, { useRef, useEffect } from 'react';
import { 
  X, 
  GitBranch, 
  FileJson, 
  Link as LinkIcon,
  Package,
  GitFork,
  Calendar,
  ArrowUpRight,
  Code,
  GitPullRequest,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { useGithubStore } from '../../store/useGithubStore';
import { getVersionDifference, VersionInfo } from '../../store/utils/dependencyUtils';

function VersionBadge({ versionInfo }: { versionInfo: VersionInfo }) {
  if (versionInfo.type === 'none') {
    return (
      <span className="text-xs text-gray-500">
        v{versionInfo.current}
      </span>
    );
  }

  const colors = {
    patch: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    minor: 'bg-orange-50 text-orange-700 border-orange-200',
    major: 'bg-red-50 text-red-700 border-red-200'
  };

  const messages = {
    patch: 'Patch update available',
    minor: 'Minor update available',
    major: 'Major update available'
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 line-through">
        v{versionInfo.current}
      </span>
      <span className={`text-xs px-1.5 py-0.5 rounded border ${colors[versionInfo.type]} flex items-center gap-1`}>
        <AlertTriangle className="h-3 w-3" />
        v{versionInfo.latest}
        <span className="text-[10px] opacity-75">({messages[versionInfo.type]})</span>
      </span>
    </div>
  );
}

interface RepoModalProps {
  repoId: string;
  onClose: () => void;
  composerFiles?: string[];
  latestTag?: string;
  repoUrl?: string;
}

export function RepoModal({ repoId, onClose, composerFiles = [], latestTag, repoUrl }: RepoModalProps) {
  const { graphData, repositories, organization } = useGithubStore();
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const [orgRepo] = repoId.split('>');
  const [org, repo] = orgRepo.split('/');
  const node = graphData.nodes.find(n => n.id === repoId);
  const repository = repositories.find(r => r.name === repo);
  const defaultBranch = repository?.defaultBranch || 'main';
  
  const dependencies = graphData.links
    .filter(link => link.source === repoId)
    .map(link => {
      const depNode = graphData.nodes.find(n => n.id === link.target);
      const versionInfo = getVersionDifference(link.version, depNode?.version || '');
      const [depOrgRepo] = (depNode?.id || '').split('>');
      const [, depRepo] = depOrgRepo.split('/');
      return {
        id: link.target,
        version: link.version,
        node: depNode,
        versionInfo,
        repoUrl: `https://github.com/${organization}/${depRepo}`
      };
    });

  const dependents = graphData.links
    .filter(link => link.target === repoId)
    .map(link => {
      const depNode = graphData.nodes.find(n => n.id === link.source);
      const versionInfo = getVersionDifference(link.version, node?.version || '');
      const [depOrgRepo] = (depNode?.id || '').split('>');
      const [, depRepo] = depOrgRepo.split('/');
      return {
        id: link.source,
        version: link.version,
        node: depNode,
        versionInfo,
        repoUrl: `https://github.com/${organization}/${depRepo}`
      };
    });

  const outdatedDeps = dependencies.filter(dep => dep.versionInfo.type !== 'none');
  const hasOutdatedDeps = outdatedDeps.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-2xl mt-16 relative">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-white" />
            <div>
              <h2 className="text-lg font-semibold text-white">{repo}</h2>
              <p className="text-indigo-100 text-xs">{org}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-indigo-50 p-3 rounded-lg">
              <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                <GitBranch className="h-4 w-4" />
                <span className="font-medium text-sm">Latest Version</span>
              </div>
              <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-indigo-100">
                {latestTag || 'No tags'}
              </span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg">
              <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                <GitFork className="h-4 w-4" />
                <span className="font-medium text-sm">Type</span>
              </div>
              <span className="text-xs">
                {node?.isMonorepo 
                  ? `Service in ${node.monorepoName}`
                  : 'Standalone Package'}
              </span>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg">
              <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="font-medium text-sm">Composer Files</span>
              </div>
              <span className="text-xs">{composerFiles?.length || 0} files</span>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                <GitBranch className="h-4 w-4" />
                <span className="font-medium text-sm">Default Branch</span>
              </div>
              <span className="text-xs font-mono">{defaultBranch}</span>
            </div>
          </div>

          {/* Outdated Dependencies Warning */}
          {hasOutdatedDeps && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-medium text-sm">
                  {outdatedDeps.length} {outdatedDeps.length === 1 ? 'dependency needs' : 'dependencies need'} updating
                </h3>
              </div>
              <ul className="mt-2 space-y-1">
                {outdatedDeps.map(({ node, versionInfo }) => (
                  <li key={node?.id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-700">{node?.name}</span>
                    <VersionBadge versionInfo={versionInfo} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Composer Files */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-900">
              <FileJson className="h-4 w-4" />
              <h3 className="font-medium text-sm">Composer Files</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              {composerFiles.length > 0 ? (
                <ul className="space-y-1.5">
                  {composerFiles.map((file) => (
                    <li key={file} className="flex items-center justify-between group">
                      <span className="font-mono text-xs text-gray-600">{file}</span>
                      <div className="flex gap-2">
                        <a
                          href={`${repoUrl}/blob/${defaultBranch}/${file}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Code className="h-3.5 w-3.5" />
                        </a>
                        <a
                            href={`${repoUrl}/blob/${defaultBranch}/${file.replace('.json', '.lock')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Lock className="h-3.5 w-3.5"/>
                        </a>
                        <a
                          href={`${repoUrl}/commits/${defaultBranch}/${file}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <GitPullRequest className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No composer files found</p>
              )}
            </div>
          </div>

          {/* Dependencies */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-900">
              <Package className="h-4 w-4" />
              <h3 className="font-medium text-sm">Dependencies ({dependencies.length})</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              {dependencies.length > 0 ? (
                <ul className="space-y-1.5">
                  {dependencies.map(({ id, node, versionInfo, repoUrl }) => (
                    <li key={id} className="flex items-center justify-between group">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{node?.name}</span>
                        {node?.isMonorepo && (
                          <span className="ml-1.5 text-xs text-gray-500">
                            (Service in {node.monorepoName})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <VersionBadge versionInfo={versionInfo} />
                        <a
                          href={repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No dependencies found</p>
              )}
            </div>
          </div>

          {/* Dependents */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-900">
              <GitFork className="h-4 w-4" />
              <h3 className="font-medium text-sm">Used By ({dependents.length})</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              {dependents.length > 0 ? (
                <ul className="space-y-1.5">
                  {dependents.map(({ id, node, versionInfo, repoUrl }) => (
                    <li key={id} className="flex items-center justify-between group">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{node?.name}</span>
                        {node?.isMonorepo && (
                          <span className="ml-1.5 text-xs text-gray-500">
                            (Service in {node.monorepoName})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <VersionBadge versionInfo={versionInfo} />
                        <a
                          href={repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No packages depend on this</p>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap gap-2 pt-3 border-t">
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              View Repository
            </a>
            <a
              href={`${repoUrl}/tags`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <GitBranch className="h-3.5 w-3.5" />
              View Tags
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}