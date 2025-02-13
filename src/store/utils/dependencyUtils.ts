import {Octokit} from 'octokit';
import {ComposerJson} from '../../types';

export interface VersionInfo {
  current: string;
  latest: string;
  type: 'none' | 'patch' | 'minor' | 'major';
}

export function decodeBase64(base64: string): string {
  return atob(base64.replace(/\s/g, ''));
}

export function normalizeRepoName(name: string, organization: string): string {
  const [, repoName] = name.split('/');
  return `${organization}/${repoName.toLowerCase()}`;
}

export function getPackageId(repoName: string, composerName: string): string {
  return `${repoName}>${composerName}`;
}

export function extractDependencies(composerJson: ComposerJson, organization: string): Set<string> {
  const deps = new Set<string>();
  const orgLower = organization.toLowerCase();

  const allDeps = {
    ...composerJson.require,
    ...composerJson['require-dev'],
  };

  Object.entries(allDeps).forEach(([dep, ]) => {
    const depLower = dep.toLowerCase();
    if (depLower.startsWith(`${orgLower}/`)) {
      deps.add(normalizeRepoName(dep, organization));
    }
  });

  if (composerJson.repositories) {
    Object.entries(composerJson.repositories).forEach(([, repo]) => {
      if (
        typeof repo === 'object' &&
        repo !== null &&
        'url' in repo &&
        typeof repo.url === 'string'
      ) {
        const url = repo.url.toLowerCase();
        const orgVariations = [`/${orgLower}/`, `/${organization}/`];

        if (url.includes('github.com') && orgVariations.some(v => url.includes(v))) {
          const match = url.match(/github\.com\/[^\/]+\/([^\/\.]+)/i);
          if (match) {
            const repoName = match[1].toLowerCase();
            deps.add(`${organization}/${repoName}`);
          }
        }
      }
    });
  }

  return deps;
}

export async function findComposerFiles(octokit: Octokit, owner: string, repo: string): Promise<string[]> {
  try {
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
      request: {
        timeout: 10000
      }
    });

    const defaultBranch = repoData.default_branch;

    try {
      const { data: tree } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: '1',
        request: {
          timeout: 10000
        }
      });

      return tree.tree
        .filter(item =>
          item.type === 'blob' &&
          item.path?.toLowerCase().endsWith('composer.json')
        )
        .map(item => item.path!)
        .filter(Boolean);
    } catch (error) {
      console.warn(`Error fetching tree for ${owner}/${repo}, falling back to manual checks:`, error);
      return [];
    }
  } catch (error) {
    console.error(`Error processing repo ${owner}/${repo}:`, error);
    return [];
  }
}

export async function getComposerLock(octokit: Octokit, owner: string, repo: string, path: string): Promise<any | null> {
  try {
    const lockPath = path.replace('composer.json', 'composer.lock');
    const { data: file } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: lockPath,
      request: {
        timeout: 10000
      }
    });

    if ('content' in file) {
      const content = decodeBase64(file.content);
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`Error fetching composer.lock for ${owner}/${repo}:`, error);
  }
  return null;
}

export async function getLatestTag(octokit: Octokit, owner: string, repo: string): Promise<string | null> {
  try {
    const { data: tags } = await octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 100,
      request: {
        timeout: 10000
      }
    });

    // Sort tags by creation date (newest first)
    const sortedTags = tags.sort((a, b) => {
      const versionInfo = getVersionDifference(a.name, b.name);
      if (versionInfo.type === 'none') {
          return 0;
      }
      const parsedA = parseVersion(a.name);
      const parsedB = parseVersion(b.name);

        if (versionInfo.type === 'major' && parsedA.major > parsedB.major) {
            return -1;
        }
        if (versionInfo.type === 'major' && parsedA.major < parsedB.major) {
            return 1;
        }
        if (versionInfo.type === 'minor' && parsedA.minor > parsedB.minor) {
            return -1;
        }
        if (versionInfo.type === 'minor' && parsedA.minor < parsedB.minor) {
            return 1;
        }
        if (versionInfo.type === 'patch' && parsedA.patch > parsedB.patch) {
            return -1;
        }
        if (versionInfo.type === 'patch' && parsedA.patch < parsedB.patch) {
            return 1;
        }

        return 0;
    });

    // Return the most recent tag name without 'v' prefix
    return sortedTags[0]?.name.replace(/^v/, '') || null;
  } catch (error) {
    console.warn(`Error fetching tags for ${owner}/${repo}:`, error);
    return null;
  }
}

function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease: string | null } {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, '');
  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  
  if (!match) {
    return { major: 0, minor: 0, patch: 0, prerelease: null };
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null
  };
}

export function getVersionDifference(current: string, latest: string): VersionInfo {
  if (!current || !latest) {
    return { current, latest, type: 'none' };
  }

  // Handle non-semver versions
  if (!current.match(/^\d+\.\d+\.\d+/) || !latest.match(/^\d+\.\d+\.\d+/)) {
    return { current, latest, type: 'none' };
  }

  const currentVersion = parseVersion(current);
  const latestVersion = parseVersion(latest);

  if (latestVersion.major > currentVersion.major) {
    return { current, latest, type: 'major' };
  }
  if (latestVersion.major === currentVersion.major && latestVersion.minor > currentVersion.minor) {
    return { current, latest, type: 'minor' };
  }
  if (latestVersion.major === currentVersion.major && 
      latestVersion.minor === currentVersion.minor && 
      latestVersion.patch > currentVersion.patch) {
    return { current, latest, type: 'patch' };
  }

  return { current, latest, type: 'none' };
}