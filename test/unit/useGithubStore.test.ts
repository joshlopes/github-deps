import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGithubStore } from '../../src/store/useGithubStore';

// Create mock functions
const mockGetContent = vi.fn();
const mockGet = vi.fn();
const mockGetTree = vi.fn();
const mockGetAuthenticated = vi.fn();
const mockPaginate = vi.fn();

// Mock Octokit before importing the store
vi.mock('octokit', () => ({
  Octokit: vi.fn(() => ({
    rest: {
      repos: {
        getContent: mockGetContent,
        get: mockGet
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
      graphData: { nodes: [], links: [] },
      error: null,
      progress: null,
      hasAttemptedFetch: false,
      isValidatingToken: false,
      isLoadingOrgs: false,
      isLoading: false,
      cache: {},
    });
  });

  it('should extract internal dependencies from both require and repositories sections', async () => {
    const mockComposerJson = {
      name: 'lendable/service-a',
      require: {
        'php': '>=8.2',
        'lendable/name-matching': '^2.0',
        'symfony/console': '^6.0'
      },
      repositories: {
        'lendable/name-matching': {
          type: 'vcs',
          url: 'https://github.com/Lendable/name-matching.git'
        },
        'lendable/event-projector': {
          type: 'vcs',
          url: 'https://github.com/Lendable/event-projector.git'
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
    useGithubStore.getState().setOrganization('lendable');
    
    // Fetch dependencies
    await useGithubStore.getState().fetchDependencies();
    
    // Get the current state
    const { graphData } = useGithubStore.getState();
    
    // Verify all internal dependencies are detected
    const expectedDeps = [
      'lendable/name-matching',
      'lendable/event-projector'
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
        source: 'lendable/service-a',
        target: 'lendable/name-matching',
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
      name: 'lendable/service-b',
      require: {
        'lendable/core': '^1.0'
      },
      repositories: {
        'lendable/core': {
          type: 'vcs',
          url: 'https://github.com/Lendable/core.git'
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
    useGithubStore.getState().setOrganization('lendable');
    
    // Fetch dependencies
    await useGithubStore.getState().fetchDependencies();
    
    // Verify that getContent was called for each composer.json file
    expect(mockGetContent).toHaveBeenCalledTimes(3);
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