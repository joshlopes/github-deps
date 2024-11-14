import { beforeEach, describe, expect, it } from 'vitest';
import { useGithubStore } from '../../src/store/useGithubStore';

describe('Composer Dependencies Integration Tests', () => {
  beforeEach(() => {
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

  it('should fetch and process real composer.json from symfony/console', async () => {
    const store = useGithubStore.getState();
    store.setOrganization('symfony');
    
    await store.fetchDependencies();

    const { graphData, error } = useGithubStore.getState();
    expect(error).toBeNull();

    // Verify we found some repositories
    expect(graphData.nodes.length).toBeGreaterThan(0);
    expect(graphData.links.length).toBeGreaterThan(0);

    // Verify we found internal dependencies
    const dependencyNodes = graphData.nodes.filter(node => 
      node.id.startsWith('symfony/')
    );
    expect(dependencyNodes.length).toBeGreaterThan(0);

    // Verify dependency relationships
    graphData.links.forEach(link => {
      expect(link.source).toMatch(/^symfony\//);
      expect(link.target).toMatch(/^symfony\//);
      expect(link.version).toBeDefined();
    });
  }, 30000); // Increase timeout to 30 seconds

  it('should properly handle repository statuses', async () => {
    const store = useGithubStore.getState();
    store.setOrganization('symfony');
    
    await store.fetchDependencies();

    const { graphData, error } = useGithubStore.getState();
    expect(error).toBeNull();

    // Get all repository nodes
    const repoNodes = graphData.nodes.filter(node => 
      node.id.startsWith('symfony/')
    );

    // Verify we found repositories
    expect(repoNodes.length).toBeGreaterThan(0);

    // Verify each repository has correct status indicators
    repoNodes.forEach(node => {
      expect(node.color).toBeDefined();
      expect(['#2563eb', '#9ca3af', '#059669']).toContain(node.color);
    });
  }, 30000);

  it('should discover nested composer.json files', async () => {
    const store = useGithubStore.getState();
    store.setOrganization('symfony');
    
    await store.fetchDependencies();

    const { graphData, error } = useGithubStore.getState();
    expect(error).toBeNull();

    // Get all dependencies
    const allDeps = new Set(graphData.links.map(link => link.target));

    // Verify we found dependencies
    expect(allDeps.size).toBeGreaterThan(0);

    // Verify all dependencies are internal Symfony packages
    Array.from(allDeps).forEach(dep => {
      expect(dep).toMatch(/^symfony\//);
    });
  }, 30000);

  it('should handle version constraints correctly', async () => {
    const store = useGithubStore.getState();
    store.setOrganization('symfony');
    
    await store.fetchDependencies();

    const { graphData, error } = useGithubStore.getState();
    expect(error).toBeNull();

    // Verify version formats
    graphData.links.forEach(link => {
      expect(link.version).toBeDefined();
      expect(typeof link.version).toBe('string');
    });
  }, 30000);
});