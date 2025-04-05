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
  
  invalidate(key: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      log(LogLevel.DEBUG, `Cache invalidated for exact key: ${key}`);
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Initialize cache with TTL from config
const requestCache = new SimpleCache(config.cacheTTLSeconds * 1000);

/**
 * Invalidates relevant cache entries based on the modified path.
 */
function invalidateCacheForPath(method: string, path: string): void {
  if (!config.enableCache || method === 'GET') {
    return; // Only invalidate for non-GET requests when cache is enabled
  }

  log(LogLevel.DEBUG, `Attempting cache invalidation for ${method} ${path}`);

  const pathSegments = path.split('?')[0].split('/').filter(s => s);
  // Example: ['projects', '123', 'scenarios', '456', 'tags', '789']

  const keysToInvalidate = new Set<string>();

  // Always invalidate the exact path for GET (if it was cached, unlikely but possible)
  keysToInvalidate.add(`GET:${path}`);

  // Try to determine the resource type and invalidate collections
  if (pathSegments.length >= 2 && pathSegments[0] === 'projects') {
    const projectId = pathSegments[1];
    const projectPath = `/projects/${projectId}`;

    // Invalidate specific project cache
    keysToInvalidate.add(`GET:${projectPath}`);

    if (pathSegments.length >= 3) {
      const resourceType = pathSegments[2]; // e.g., 'scenarios', 'folders'
      const collectionPath = `${projectPath}/${resourceType}`;
      
      // Invalidate the collection cache (e.g., GET:/projects/123/scenarios)
      keysToInvalidate.add(`GET:${collectionPath}`);
      
      // Invalidate specific resource cache if ID is present
      if (pathSegments.length >= 4) {
        const resourceId = pathSegments[3];
        const specificResourcePath = `${collectionPath}/${resourceId}`;
        keysToInvalidate.add(`GET:${specificResourcePath}`);

        // If modifying tags, invalidate the parent scenario/folder as well
        if (pathSegments.length >= 5 && pathSegments[4] === 'tags') {
           keysToInvalidate.add(`GET:${specificResourcePath}?include=tags`); // Also invalidate with tags included
           // Invalidate specific tag cache if ID is present
           if (pathSegments.length >= 6) {
              const tagId = pathSegments[5];
              keysToInvalidate.add(`GET:${specificResourcePath}/tags/${tagId}`);
           }
           // Invalidate the tag collection for the resource
           keysToInvalidate.add(`GET:${specificResourcePath}/tags`);
        }
      }
      
      // Special handling for find_by_tags - invalidate based on key/value?
      // This is complex. A simpler approach is to invalidate the whole collection.
      if (resourceType === 'scenarios' && path.includes('/find_by_tags')) {
         // Already invalidated collectionPath above, which is often sufficient.
         // Finer-grained invalidation would require parsing query params.
      }
    }
  }

  // Invalidate based on the identified keys
  for (const key of keysToInvalidate) {
    log(LogLevel.DEBUG, `Invalidating cache key: ${key}`);
    requestCache.invalidate(key); // Use invalidate method which expects exact key
  }
}

/**
 * Make an authenticated API request to Cucumber Studio with caching support
 */
export async function makeCucumberStudioRequest(path: string, method: string = 'GET', data?: any): Promise<any> {
  const cacheKey = `${method}:${path}`; // Cache key includes method and full path
  
  // Use cache for GET requests if enabled
  if (method === 'GET' && config.enableCache) {
    const cachedResponse = requestCache.get(cacheKey);
    if (cachedResponse) {
      log(LogLevel.DEBUG, `Cache hit for ${method} ${path}`);
      return cachedResponse;
    }
    log(LogLevel.DEBUG, `Cache miss for ${method} ${path}`);
  }
  
  try {
    if (config.enableRequestLogging) {
      log(LogLevel.INFO, `Making ${method} request to: ${config.baseUrl}${path}`);
      if (data && method !== 'GET') {
        // Avoid logging potentially sensitive data unless log level is DEBUG
        if (config.logLevel >= LogLevel.DEBUG) { // Check against config.logLevel
            log(LogLevel.DEBUG, 'Request payload:', JSON.stringify(data));
        } else {
            log(LogLevel.INFO, `Request payload type: ${typeof data}`);
        }
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
        // Avoid logging potentially sensitive data unless log level is DEBUG
        if (config.logLevel >= LogLevel.DEBUG) { // Check against config.logLevel
            log(LogLevel.DEBUG, `Response for ${method} ${path} (Status ${response.status}):`, 
                typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data).substring(0, 500) + '...'); // Limit log size
        } else {
            log(LogLevel.INFO, `Response status for ${method} ${path}: ${response.status}`);
        }
    }
    
    // Cache successful GET responses if caching is enabled
    if (method === 'GET' && config.enableCache) {
      requestCache.set(cacheKey, response.data);
      log(LogLevel.DEBUG, `Cached response for ${method} ${path}`);
    } else if (method !== 'GET') {
      // Invalidate relevant cache entries for non-GET requests
      invalidateCacheForPath(method, path);
    }
    
    return response.data;
  } catch (error) {
    log(LogLevel.ERROR, `Error during ${method} request to ${path}:`, error);
    
    if (axios.isAxiosError(error)) {
        if (error.response) {
            log(LogLevel.ERROR, `API error response (${error.response.status}) for ${method} ${path}:`, error.response.data);
        } else if (error.request) {
            log(LogLevel.ERROR, `No response received from API for ${method} ${path}`);
        } else {
            log(LogLevel.ERROR, `Error setting up request for ${method} ${path}:`, error.message);
        }
    }
    
    throw error; // Re-throw the error to be handled by the calling function
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
 * @returns Array of responses from successful tag additions. Logs errors for failures.
 */
export async function addTagsToScenario(
  projectId: string, 
  scenarioId: string, 
  tags: Array<{key: string, value: string}>
): Promise<any[]> { // Return type adjusted to reflect potential partial success
  const results = [];
  const errors = [];

  for (const tag of tags) {
    try {
      // Attempt to add each tag individually
      const result = await addTagToScenario(projectId, scenarioId, tag.key, tag.value);
      results.push(result); 
    } catch (error) {
      // Log the specific error for this tag and continue with the next
      log(LogLevel.ERROR, `Error adding tag ${tag.key}:${tag.value} to scenario ${scenarioId}:`, error);
      errors.push({ tag: tag, error: error instanceof Error ? error.message : String(error) });
      // Decide if we should re-throw or just collect errors. 
      // For now, collecting allows adding other tags.
      // Consider throwing if *any* tag addition failure is critical.
    }
  }
  
  // Optionally, check the errors array here and throw a summary error if needed
  if (errors.length > 0 && results.length === 0) {
    // If all tags failed to add
    throw new Error(`Failed to add any tags to scenario ${scenarioId}. See logs for details.`);
  }
  
  // Log if some tags failed
  if (errors.length > 0) {
     log(LogLevel.WARN, `Completed adding tags to scenario ${scenarioId} with ${errors.length} failures. See previous logs for details.`);
  }

  return results; // Return results of successful additions
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