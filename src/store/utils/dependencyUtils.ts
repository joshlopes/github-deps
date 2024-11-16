import { Octokit } from 'octokit';
import { ComposerJson } from '../../types';

// Helper function to compare semantic versions
function compareVersions(a: string, b: string): number {
  // Remove 'v' prefix if present
  const cleanA = a.replace(/^v/, '');
  const cleanB = b.replace(/^v/, '');

  const partsA = cleanA.split('.').map(part => {
    // Handle pre-release versions (e.g., -alpha, -beta, -RC)
    const preRelease = part.match(/(\d+)(.+)?/);
    return preRelease ? [parseInt(preRelease[1]), preRelease[2] || ''] : [parseInt(part), ''];
  });

  const partsB = cleanB.split('.').map(part => {
    const preRelease = part.match(/(\d+)(.+)?/);
    return preRelease ? [parseInt(preRelease[1]), preRelease[2] || ''] : [parseInt(part), ''];
  });

  // Compare each part
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const [numA, suffixA] = partsA[i] || [0, ''];
    const [numB, suffixB] = partsB[i] || [0, ''];

    if (numA !== numB) {
      return numB - numA; // Descending order
    }

    if (suffixA !== suffixB) {
      // No suffix is greater than any suffix
      if (!suffixA) return -1;
      if (!suffixB) return 1;
      // Compare suffixes alphabetically (e.g., alpha < beta < rc)
      return suffixB.localeCompare(suffixA);
    }
  }

  return 0;
}

export function decodeBase64(base64: string): string {
  const binaryString = atob(base64.replace(/\s/g, ''));
  return binaryString;
}

export function normalizeRepoName(name: string, organization: string): string {
  const [orgName, repoName] = name.split('/');
  return `${organization}/${repoName.toLowerCase()}`;
}

export function getPackageId(repoName: string, composerName: string): string {
  return `${repoName}>${composerName}`;
}

export async function getLatestTag(octokit: Octokit, owner: string, repo: string): Promise<string | null> {
  try {
    const { data: tags } = await octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 100, // Fetch more tags to ensure we don't miss the latest
      request: {
        timeout: 10000
      }
    });

    if (!tags.length) return null;

    // Filter out non-version tags and sort remaining tags
    const versionTags = tags
      .map(tag => tag.name)
      .filter(tag => /^v?\d+(\.\d+)*(-\w+)?$/.test(tag)) // Match version tags like v1.2.3 or 1.2.3-beta
      .sort(compareVersions);

    return versionTags[0] || tags[0].name; // Fallback to first tag if no version tags found
  } catch (error) {
    console.warn(`Error fetching tags for ${owner}/${repo}:`, error);
    return null;
  }
}

export function extractDependencies(composerJson: ComposerJson, organization: string): Set<string> {
  const deps = new Set<string>();
  const orgLower = organization.toLowerCase();

  const allDeps = {
    ...composerJson.require,
    ...composerJson['require-dev'],
  };

  Object.entries(allDeps).forEach(([dep, version]) => {
    const depLower = dep.toLowerCase();
    if (depLower.startsWith(`${orgLower}/`)) {
      deps.add(normalizeRepoName(dep, organization));
    }
  });

  if (composerJson.repositories) {
    Object.entries(composerJson.repositories).forEach(([name, repo]) => {
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