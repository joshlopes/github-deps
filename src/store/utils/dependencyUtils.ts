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

function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease: string | null } {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, '');

  // Handle X.Y format by adding .0
  if (cleanVersion.match(/^\d+\.\d+$/)) {
    return parseVersion(cleanVersion + '.0');
  }

  // Handle X format by adding .0.0
  if (cleanVersion.match(/^\d+$/)) {
    return parseVersion(cleanVersion + '.0.0');
  }

  const match = cleanVersion.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(.+))?$/);

  if (!match) {
    return { major: 0, minor: 0, patch: 0, prerelease: null };
  }

  return {
    major: parseInt(match[1] || '0', 10),
    minor: parseInt(match[2] || '0', 10),
    patch: parseInt(match[3] || '0', 10),
    prerelease: match[4] || null
  };
}

export function getVersionDifference(current: string, latest: string): VersionInfo {
  if (!current || !latest) {
    return { current, latest, type: 'none' };
  }

  // Clean up versions by removing any non-numeric prefixes/suffixes
  const cleanCurrent = current.match(/\d+(?:\.\d+)*(?:-[\w.]+)?/)?.[0] || current;
  const cleanLatest = latest.match(/\d+(?:\.\d+)*(?:-[\w.]+)?/)?.[0] || latest;

  const currentVersion = parseVersion(cleanCurrent);
  const latestVersion = parseVersion(cleanLatest);

  // If we can't parse either version, don't suggest an upgrade
  if (currentVersion.major === 0 && currentVersion.minor === 0 && currentVersion.patch === 0 &&
      latestVersion.major === 0 && latestVersion.minor === 0 && latestVersion.patch === 0) {
    return { current, latest, type: 'none' };
  }

  // Handle prerelease versions
  // If current is a prerelease and latest is the stable version with the same numbers, consider it a patch
  if (currentVersion.major === latestVersion.major &&
      currentVersion.minor === latestVersion.minor &&
      currentVersion.patch === latestVersion.patch &&
      currentVersion.prerelease && !latestVersion.prerelease) {
    return { current, latest, type: 'patch' };
  }

  // If latest is a prerelease and current is the stable version, or both are prereleases, don't suggest upgrade
  if ((latestVersion.prerelease && !currentVersion.prerelease) ||
      (latestVersion.prerelease && currentVersion.prerelease)) {
    return { current, latest, type: 'none' };
  }

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

export async function getLatestTag(octokit: Octokit, owner: string, repo: string): Promise<string | null> {
  try {
    let allTags: any[] = [];
    let page = 1;
    const per_page = 100;

    // Fetch all tags using pagination
    while (true) {
      const { data: tags } = await octokit.rest.repos.listTags({
        owner,
        repo,
        per_page,
        page,
        request: {
          timeout: 10000
        }
      });

      if (tags.length === 0) break;
      allTags = allTags.concat(tags);
      if (tags.length < per_page) break;
      page++;
    }

    if (allTags.length === 0) {
      return null;
    }

    // First, separate stable versions from prereleases
    const stableVersions = [];
    const prereleaseVersions = [];

    for (const tag of allTags) {
      const version = parseVersion(tag.name);
      if (version.prerelease) {
        prereleaseVersions.push(tag);
      } else {
        stableVersions.push(tag);
      }
    }

    // Sort function for versions
    const sortVersions = (a: any, b: any) => {
      const versionA = parseVersion(a.name);
      const versionB = parseVersion(b.name);

      // Compare major versions
      if (versionA.major !== versionB.major) {
        return versionB.major - versionA.major;
      }

      // Compare minor versions
      if (versionA.minor !== versionB.minor) {
        return versionB.minor - versionA.minor;
      }

      // Compare patch versions
      if (versionA.patch !== versionB.patch) {
        return versionB.patch - versionA.patch;
      }

      return 0;
    };

    // Sort both arrays
    stableVersions.sort(sortVersions);
    prereleaseVersions.sort(sortVersions);

    // Prefer stable versions if available
    if (stableVersions.length > 0) {
      return stableVersions[0].name.replace(/^v/, '');
    }

    // Fall back to prereleases if no stable versions
    if (prereleaseVersions.length > 0) {
      return prereleaseVersions[0].name.replace(/^v/, '');
    }

    return null;
  } catch (error) {
    console.warn(`Error fetching tags for ${owner}/${repo}:`, error);
    return null;
  }
}