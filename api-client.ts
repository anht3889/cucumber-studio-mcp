// API client for Cucumber Studio
import axios from 'axios';
import { config, LogLevel, log } from './config.js';

// Simple in-memory cache implementation
interface CacheEntry {
  data: any;
  timestamp: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL: number = 60 * 1000; // Default cache TTL: 60 seconds
  
  constructor(ttlMs?: number) {
    if (ttlMs) {
      this.TTL = ttlMs;
    }
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > this.TTL) {
      // Entry expired
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  invalidate(keyPattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Initialize cache with TTL from config
const requestCache = new SimpleCache(config.cacheTTLSeconds * 1000);

/**
 * Make an authenticated API request to Cucumber Studio with caching support
 */
export async function makeCucumberStudioRequest(path: string, method: string = 'GET', data?: any): Promise<any> {
  try {
    const cacheKey = `${method}:${path}`;
    
    // Only use cache for GET requests if caching is enabled
    if (method === 'GET' && config.enableCache) {
      const cachedResponse = requestCache.get(cacheKey);
      if (cachedResponse) {
        log(LogLevel.DEBUG, `Cache hit for ${method} ${path}`);
        return cachedResponse;
      }
    }
    
    if (config.enableRequestLogging) {
      log(LogLevel.INFO, `Making ${method} request to: ${config.baseUrl}${path}`);
      if (data && method !== 'GET') {
        log(LogLevel.DEBUG, 'Request payload:', JSON.stringify(data));
      }
    }
    
    const requestConfig = {
      method,
      url: `${config.baseUrl}${path}`,
      headers: {
        'Accept': 'application/vnd.api+json; version=1',
        'Content-Type': 'application/vnd.api+json',
        'access-token': config.accessToken,
        'client': config.clientId,
        'uid': config.uid
      },
      data: data,
      timeout: config.requestTimeoutMs // Add timeout from config
    };
    
    const response = await axios(requestConfig);
    
    // Log response if enabled
    if (config.enableResponseLogging) {
      log(LogLevel.DEBUG, `Response for ${method} ${path}:`, 
        typeof response.data === 'object' ? JSON.stringify(response.data) : response.data);
    }
    
    // Cache successful GET responses if caching is enabled
    if (method === 'GET' && config.enableCache) {
      requestCache.set(cacheKey, response.data);
      log(LogLevel.DEBUG, `Cached response for ${method} ${path}`);
    } else if (method !== 'GET' && config.enableCache) {
      // Invalidate cache for non-GET requests that might modify data
      const resourcePath = path.split('?')[0].split('/').slice(0, 3).join('/');
      requestCache.invalidate(resourcePath);
      log(LogLevel.DEBUG, `Invalidated cache for path containing: ${resourcePath}`);
    }
    
    return response.data;
  } catch (error) {
    log(LogLevel.ERROR, 'Error making request to Cucumber Studio:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      log(LogLevel.ERROR, `API error response (${error.response.status}):`, error.response.data);
    } else if (axios.isAxiosError(error) && error.request) {
      log(LogLevel.ERROR, 'No response received from API');
    } else if (axios.isAxiosError(error)) {
      log(LogLevel.ERROR, 'Error setting up request:', error.message);
    }
    
    throw error;
  }
}

/**
 * Get all projects from Cucumber Studio
 */
export async function getProjects(): Promise<any> {
  return makeCucumberStudioRequest('/projects/');
}

/**
 * Get a specific project by ID
 */
export async function getProject(projectId: string): Promise<any> {
  return makeCucumberStudioRequest(`/projects/${projectId}`);
}

/**
 * Get all scenarios for a project
 */
export async function getScenarios(projectId: string, includeTags: boolean = true): Promise<any> {
  const includeParam = includeTags ? '?include=tags' : '';
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios${includeParam}`);
}

/**
 * Get a specific scenario by ID
 */
export async function getScenario(projectId: string, scenarioId: string, includeTags: boolean = true): Promise<any> {
  const includeParam = includeTags ? '?include=tags' : '';
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios/${scenarioId}${includeParam}`);
}

/**
 * Create a new scenario in a project
 */
export async function createScenario(projectId: string, scenarioData: any): Promise<any> {
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios`, 'POST', scenarioData);
}

/**
 * Update an existing scenario
 */
export async function updateScenario(projectId: string, scenarioId: string, scenarioData: any): Promise<any> {
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios/${scenarioId}`, 'PATCH', scenarioData);
}

/**
 * Find scenarios by tags
 */
export async function findScenariosByTags(projectId: string, tagKey: string, tagValue: string, includeTags: boolean = true): Promise<any> {
  const includeParam = includeTags ? '&include=tags' : '';
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios/find_by_tags?key=${encodeURIComponent(tagKey)}&value=${encodeURIComponent(tagValue)}${includeParam}`);
}

/**
 * Add a tag to a scenario
 */
export async function addTagToScenario(projectId: string, scenarioId: string, key: string, value: string): Promise<any> {
  const tagData = {
    data: {
      type: "tags",
      attributes: {
        key: key,
        value: value
      }
    }
  };
  
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios/${scenarioId}/tags`, 'POST', tagData);
}

/**
 * Add multiple tags to a scenario
 * @param projectId Project ID
 * @param scenarioId Scenario ID
 * @param tags Array of tags with key and value
 */
export async function addTagsToScenario(projectId: string, scenarioId: string, tags: Array<{key: string, value: string}>): Promise<any> {
  const results = [];
  
  for (const tag of tags) {
    try {
      const result = await addTagToScenario(projectId, scenarioId, tag.key, tag.value);
      results.push(result);
    } catch (error) {
      console.error(`Error adding tag ${tag.key}:${tag.value} to scenario ${scenarioId}:`, error);
      throw error;
    }
  }
  
  return results;
}

/**
 * Update an existing tag on a scenario
 * @param projectId Project ID
 * @param scenarioId Scenario ID
 * @param tagId Tag ID
 * @param key New tag key
 * @param value New tag value
 */
export async function updateTag(projectId: string, scenarioId: string, tagId: string, key: string, value: string): Promise<any> {
  const tagData = {
    data: {
      type: "tags",
      id: tagId,
      attributes: {
        key: key,
        value: value
      }
    }
  };
  
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios/${scenarioId}/tags/${tagId}`, 'PATCH', tagData);
}

/**
 * Delete a tag from a scenario
 * @param projectId Project ID
 * @param scenarioId Scenario ID
 * @param tagId Tag ID
 */
export async function deleteTag(projectId: string, scenarioId: string, tagId: string): Promise<any> {
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios/${scenarioId}/tags/${tagId}`, 'DELETE');
}

/**
 * Delete a scenario from a project
 * @param projectId Project ID
 * @param scenarioId Scenario ID
 */
export async function deleteScenario(projectId: string, scenarioId: string): Promise<any> {
  return makeCucumberStudioRequest(`/projects/${projectId}/scenarios/${scenarioId}`, 'DELETE');
}

/**
 * Get all folders from a project
 * @param projectId Project ID
 */
export async function getFolders(projectId: string): Promise<any> {
  return makeCucumberStudioRequest(`/projects/${projectId}/folders`);
}

/**
 * Create a new folder in a project
 * @param projectId Project ID
 * @param name Folder name
 * @param parentId Optional parent folder ID
 */
export async function createFolder(projectId: string, name: string, parentId?: number): Promise<any> {
  const folderData = {
    data: {
      attributes: {
        name: name,
        ...(parentId ? { "parent-id": parentId } : {})
      }
    }
  };
  
  return makeCucumberStudioRequest(`/projects/${projectId}/folders`, 'POST', folderData);
}

/**
 * Update an existing folder in a project
 * @param projectId Project ID
 * @param folderId Folder ID
 * @param name New folder name
 * @param description New folder description
 * @param definition New folder definition
 * @param parentId New parent folder ID
 */
export async function updateFolder(
  projectId: string, 
  folderId: string, 
  name?: string, 
  description?: string, 
  definition?: string,
  parentId?: number
): Promise<any> {
  const folderData = {
    data: {
      type: "folders",
      id: folderId,
      attributes: {
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        ...(definition ? { definition } : {}),
        ...(parentId ? { "parent-id": parentId } : {})
      }
    }
  };
  
  return makeCucumberStudioRequest(`/projects/${projectId}/folders/${folderId}`, 'PATCH', folderData);
}

/**
 * Delete a folder from a project
 * @param projectId Project ID
 * @param folderId Folder ID
 */
export async function deleteFolder(projectId: string, folderId: string): Promise<any> {
  return makeCucumberStudioRequest(`/projects/${projectId}/folders/${folderId}`, 'DELETE');
} 