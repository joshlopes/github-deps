import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGithubStore } from '../../src/store/useGithubStore';

// Create mock functions
const mockGetContent = vi.fn();
const mockGet = vi.fn();
const mockGetTree = vi.fn();
const mockGetAuthenticated = vi.fn();
const mockPaginate = vi.fn();

// Create mock for listTags
const mockListTags = vi.fn().mockResolvedValue({ data: [] });

// Mock Octokit before importing the store
vi.mock('octokit', () => ({
  Octokit: vi.fn(() => ({
    rest: {
      repos: {
        getContent: mockGetContent,
        get: mockGet,
        listTags: mockListTags
      },
      git: {
        getTree: mockGetTree
      },
      users: {
        getAuthenticated: mockGetAuthenticated
      }
    },
    paginate: mockPaginate
  }))
}));

describe('useGithubStore Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset store state
    useGithubStore.setState({
      token: '',
      organization: '',
      organizations: [],
      repositories: [],
      graphData: { nodes: [], links: [] },
      error: null,
      progress: null,
      hasAttemptedFetch: false,
      isValidatingToken: false,
      isLoadingOrgs: false,
      isLoading: false,
      cache: {},
      orgCache: {},
    });
  });

  it('should extract internal dependencies from both require and repositories sections', async () => {
    const mockComposerJson = {
      name: 'fooOrg/service-a',
      require: {
        'php': '>=8.2',
        'fooOrg/name-matching': '^2.0',
        'symfony/console': '^6.0'
      },
      repositories: {
        'fooOrg/name-matching': {
          type: 'vcs',
          url: 'https://github.com/fooOrg/name-matching.git'
        },
        'fooOrg/event-projector': {
          type: 'vcs',
          url: 'https://github.com/fooOrg/event-projector.git'
        }
      }
    };

    // Setup mock responses
    mockGetContent.mockResolvedValue({
      data: {
        content: Buffer.from(JSON.stringify(mockComposerJson)).toString('base64')
      }
    });

    mockGet.mockResolvedValue({
      data: { default_branch: 'main' }
    });

    mockGetTree.mockResolvedValue({
      data: {
        tree: [{ type: 'blob', path: 'composer.json' }]
      }
    });

    mockPaginate.mockResolvedValue([
      { name: 'service-a', archived: false, pushed_at: new Date().toISOString() }
    ]);

    // Set token and organization
    useGithubStore.getState().setToken('test-token');
    useGithubStore.getState().setOrganization('fooOrg');

    // Set selected repositories
    useGithubStore.setState({
      repositories: [
        { name: 'service-a', selected: true, archived: false, pushed_at: new Date().toISOString() },
        { name: 'name-matching', selected: true, archived: false, pushed_at: new Date().toISOString() },
        { name: 'event-projector', selected: true, archived: false, pushed_at: new Date().toISOString() }
      ]
    });

    // Fetch dependencies
    await useGithubStore.getState().fetchDependencies();

    // Get the current state
    const { graphData } = useGithubStore.getState();

    // Verify all internal dependencies are detected
    const expectedDeps = [
      'fooOrg/name-matching',
      'fooOrg/event-projector'
    ];

    expectedDeps.forEach(dep => {
      expect(graphData.nodes).toContainEqual(
        expect.objectContaining({
          id: dep,
          name: dep.split('/')[1]
        })
      );
    });

    // Verify links are created correctly
    expect(graphData.links).toContainEqual(
      expect.objectContaining({
        source: 'fooOrg/service-a>fooOrg/service-a',
        target: 'fooOrg/name-matching',
        version: '^2.0'
      })
    );

    // Verify external dependencies are not included
    expect(graphData.nodes).not.toContainEqual(
      expect.objectContaining({
        id: 'symfony/console'
      })
    );
  });

  it('should handle nested composer.json files', async () => {
    const mockComposerJson = {
      name: 'fooOrg/service-b',
      require: {
        'fooOrg/core': '^1.0'
      },
      repositories: {
        'fooOrg/core': {
          type: 'vcs',
          url: 'https://github.com/fooOrg/core.git'
        }
      }
    };

    // Setup mock responses
    mockGetContent.mockResolvedValue({
      data: {
        content: Buffer.from(JSON.stringify(mockComposerJson)).toString('base64')
      }
    });

    mockGet.mockResolvedValue({
      data: { default_branch: 'main' }
    });

    mockGetTree.mockResolvedValue({
      data: {
        tree: [
          { type: 'blob', path: 'composer.json' },
          { type: 'blob', path: 'src/Module/composer.json' },
          { type: 'blob', path: 'tests/composer.json' }
        ]
      }
    });

    mockPaginate.mockResolvedValue([
      { name: 'service-b', archived: false, pushed_at: new Date().toISOString() }
    ]);

    // Set token and organization
    useGithubStore.getState().setToken('test-token');
    useGithubStore.getState().setOrganization('fooOrg');

    // Set selected repositories
    useGithubStore.setState({
      repositories: [
        { name: 'service-b', selected: true, archived: false, pushed_at: new Date().toISOString() },
        { name: 'core', selected: true, archived: false, pushed_at: new Date().toISOString() }
      ]
    });

    // Fetch dependencies
    await useGithubStore.getState().fetchDependencies();

    // Verify that getContent was called for each composer.json file
    expect(mockGetContent).toHaveBeenCalledTimes(12);
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'composer.json' })
    );
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/Module/composer.json' })
    );
    expect(mockGetContent).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'tests/composer.json' })
    );
  });
});