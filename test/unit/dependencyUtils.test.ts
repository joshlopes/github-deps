import { describe, it, expect, vi } from 'vitest';
import { Octokit } from 'octokit';
import {
  decodeBase64,
  normalizeRepoName,
  getPackageId,
  extractDependencies,
  findComposerFiles,
  getComposerLock,
  getLatestTag,
  getVersionDifference,
} from '../../src/store/utils/dependencyUtils';

describe('dependencyUtils', () => {
  describe('decodeBase64', () => {
    it('should decode base64 strings correctly', () => {
      const encoded = 'SGVsbG8gV29ybGQ='; // "Hello World"
      expect(decodeBase64(encoded)).toBe('Hello World');
    });

    it('should handle strings with whitespace', () => {
      const encoded = 'SGVs bG8g V29y bGQ='; // "Hello World" with spaces
      expect(decodeBase64(encoded)).toBe('Hello World');
    });
  });

  describe('normalizeRepoName', () => {
    it('should normalize repository names correctly', () => {
      expect(normalizeRepoName('vendor/REPO-NAME', 'Organization')).toBe('Organization/repo-name');
      expect(normalizeRepoName('Vendor/Project', 'MyOrg')).toBe('MyOrg/project');
    });
  });

  describe('getPackageId', () => {
    it('should create correct package IDs', () => {
      expect(getPackageId('org/repo', 'vendor/package')).toBe('org/repo>vendor/package');
    });
  });

  describe('extractDependencies', () => {
    const organization = 'MyOrg';
    
    it('should extract dependencies from require and require-dev', () => {
      const composerJson = {
        require: {
          'MyOrg/package1': '^1.0',
          'other/package': '^2.0'
        },
        'require-dev': {
          'MyOrg/package2': '^1.0',
          'another/package': '^3.0'
        }
      };

      const deps = extractDependencies(composerJson, organization);
      expect(deps.size).toBe(2);
      expect(deps.has('MyOrg/package1')).toBe(true);
      expect(deps.has('MyOrg/package2')).toBe(true);
    });

    it('should extract dependencies from repositories', () => {
      const composerJson = {
        require: {},
        repositories: [
          {
            type: 'vcs',
            url: 'https://github.com/MyOrg/repo1.git'
          },
          {
            type: 'vcs',
            url: 'https://github.com/other/repo.git'
          }
        ]
      };

      const deps = extractDependencies(composerJson, organization);
      expect(deps.size).toBe(1);
      expect(deps.has('MyOrg/repo1')).toBe(true);
    });

    it('should handle case-insensitive organization names', () => {
      const composerJson = {
        require: {
          'myorg/package': '^1.0',
          'MYORG/another': '^2.0'
        }
      };

      const deps = extractDependencies(composerJson, 'MyOrg');
      expect(deps.size).toBe(2);
      expect(deps.has('MyOrg/package')).toBe(true);
      expect(deps.has('MyOrg/another')).toBe(true);
    });
  });

  describe('findComposerFiles', () => {
    it('should find composer files in repository', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            get: vi.fn().mockResolvedValue({
              data: { default_branch: 'main' }
            })
          },
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                tree: [
                  { path: 'composer.json', type: 'blob' },
                  { path: 'src/composer.json', type: 'blob' },
                  { path: 'other.json', type: 'blob' }
                ]
              }
            })
          }
        }
      };

      const files = await findComposerFiles(mockOctokit as unknown as Octokit, 'owner', 'repo');
      expect(files).toHaveLength(2);
      expect(files).toContain('composer.json');
      expect(files).toContain('src/composer.json');
    });

    it('should handle errors gracefully', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            get: vi.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      };

      const files = await findComposerFiles(mockOctokit as unknown as Octokit, 'owner', 'repo');
      expect(files).toHaveLength(0);
    });
  });

  describe('getComposerLock', () => {
    it('should fetch and parse composer.lock file', async () => {
      const mockLockContent = JSON.stringify({ packages: [] });
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                content: Buffer.from(mockLockContent).toString('base64')
              }
            })
          }
        }
      };

      const lock = await getComposerLock(mockOctokit as unknown as Octokit, 'owner', 'repo', 'composer.json');
      expect(lock).toEqual({ packages: [] });
    });

    it('should handle missing composer.lock', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockRejectedValue(new Error('Not found'))
          }
        }
      };

      const lock = await getComposerLock(mockOctokit as unknown as Octokit, 'owner', 'repo', 'composer.json');
      expect(lock).toBeNull();
    });
  });

  describe('getLatestTag', () => {
    it('should return the latest semver tag', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            listTags: vi.fn().mockResolvedValue({
              data: [
                { name: 'v2.0.0' },
                { name: 'v1.1.0' },
                { name: 'v1.0.0' }
              ]
            })
          }
        }
      };

      const tag = await getLatestTag(mockOctokit as unknown as Octokit, 'owner', 'repo');
      expect(tag).toBe('2.0.0');
    });

    it('should handle repositories with no tags', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            listTags: vi.fn().mockResolvedValue({ data: [] })
          }
        }
      };

      const tag = await getLatestTag(mockOctokit as unknown as Octokit, 'owner', 'repo');
      expect(tag).toBeNull();
    });
  });

  describe('getVersionDifference', () => {
    it('should detect major version differences', () => {
      expect(getVersionDifference('1.0.0', '2.0.0')).toEqual({
        current: '1.0.0',
        latest: '2.0.0',
        type: 'major'
      });
    });

    it('should detect minor version differences', () => {
      expect(getVersionDifference('1.0.0', '1.1.0')).toEqual({
        current: '1.0.0',
        latest: '1.1.0',
        type: 'minor'
      });
    });

    it('should detect patch version differences', () => {
      expect(getVersionDifference('1.0.0', '1.0.1')).toEqual({
        current: '1.0.0',
        latest: '1.0.1',
        type: 'patch'
      });
    });

    it('should handle equal versions', () => {
      expect(getVersionDifference('1.0.0', '1.0.0')).toEqual({
        current: '1.0.0',
        latest: '1.0.0',
        type: 'none'
      });
    });

    it('should handle invalid versions', () => {
      expect(getVersionDifference('invalid', '1.0.0')).toEqual({
        current: 'invalid',
        latest: '1.0.0',
        type: 'none'
      });
    });
  });
});
