export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  color?: string;
}

export interface DependencyLink {
  source: string;
  target: string;
  version: string;
}

export interface GraphData {
  nodes: DependencyNode[];
  links: DependencyLink[];
}

export interface ComposerJson {
  name: string;
  version?: string;
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
  repositories?: Record<string, {
    type?: string;
    url?: string;
  }>;
}

export interface AnalysisProgress {
  total: number;
  current: number;
  currentRepo: string;
  isPhp: boolean;
  dependencies: string[];
}

export interface Repository {
  name: string;
  archived: boolean;
  pushed_at: string;
  selected?: boolean;
  composerFiles?: string[];
}

export interface CachedRepository extends Repository {
  cachedAt: number;
}

export interface OrganizationCache {
  repositories: CachedRepository[];
  timestamp: number;
}