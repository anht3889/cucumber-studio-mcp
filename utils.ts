// Utility functions for handling MCP tool requests

import { LogLevel, log } from './config.js';

/**
 * Normalize a tool name by removing prefixes
 */
export function normalizeToolName(name: string): string {
  const prefixesToRemove = ['mcp_cucumber_studio_', 'mcp_'];
  for (const prefix of prefixesToRemove) {
    if (name.startsWith(prefix)) {
      return name.substring(prefix.length);
    }
  }
  return name;
}

/**
 * Extract parameters from request, handling various formats
 */
export function extractParameters(request: any): Record<string, any> {
  const input: Record<string, any> = {};
  const params = request.params;
  
  // Parameters processing priority:
  // 1. params.parameters (official MCP format)
  // 2. params.input (alternative format)
  // 3. params.arguments (legacy format)
  // 4. direct parameters as fallback
  
  // Process params.parameters (preferred MCP format)
  if (params.parameters && typeof params.parameters === 'object') {
    Object.assign(input, params.parameters);
    return input;
  }
  
  // Process params.input
  if (params.input && typeof params.input === 'object') {
    Object.assign(input, params.input);
    return input;
  }
  
  // Process params.arguments
  if (params.arguments && typeof params.arguments === 'object') {
    Object.assign(input, params.arguments);
    return input;
  }
  
  // Process direct parameters as last resort
  const directParams = ['project_id', 'scenario_id', 'tag_key', 'tag_value', 'include_tags', 
                        'folder_id', 'tag_id', 'name', 'description', 'definition', 'steps', 'tags'];
  for (const param of directParams) {
    if (param in params && typeof params[param] !== 'undefined') {
      input[param] = params[param];
    }
  }
  
  return input;
}

/**
 * Extract project ID from input parameters
 */
export function extractProjectId(input: Record<string, any>): string | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  
  // Direct property
  if ('project_id' in input && typeof input.project_id === 'string') {
    return input.project_id;
  }
  
  // Case-insensitive property
  const keys = Object.keys(input);
  const projectIdKey = keys.find(k => k.toLowerCase() === 'project_id');
  if (projectIdKey && typeof input[projectIdKey] === 'string') {
    return input[projectIdKey];
  }
  
  // Nested parameters
  if ('parameters' in input && typeof input.parameters === 'object' && input.parameters) {
    if ('project_id' in input.parameters && typeof input.parameters.project_id === 'string') {
      return input.parameters.project_id;
    }
  }
  
  return undefined;
}

/**
 * Create a success response with proper typing for MCP
 */
export function createSuccessResponse(data: any): any {
  try {
    // First check if data is valid before stringifying
    if (data === undefined || data === null) {
      log(LogLevel.ERROR, "Attempting to create response with null/undefined data");
      return {
        content: [{ type: "text", text: "{}" }]
      };
    }
    
    // Handle errors separately to avoid circular references
    if (data instanceof Error) {
      return {
        content: [{ type: "text", text: JSON.stringify({ 
          error: data.message,
          name: data.name
        }) }]
      };
    }
    
    // Simple JSON stringification
    const jsonString = JSON.stringify(data);
    
    return {
      content: [{ type: "text", text: jsonString }]
    };
  } catch (error) {
    log(LogLevel.ERROR, "Error stringifying response data:", error);
    
    // Fall back to a very simple response
    return {
      content: [{ type: "text", text: '{"success":false,"error":"Failed to serialize response"}' }]
    };
  }
}

/**
 * Create an error response with proper typing for MCP
 */
export function createErrorResponse(message: string): any {
  return {
    content: [{ type: "text", text: message }]
  };
}

/**
 * Handle errors consistently
 */
export function handleError(error: unknown, context: string): any {
  // Base error message without sensitive details
  let errorMessage = `An error occurred while ${context}`;
  
  // Log full error details for debugging (server-side only)
  log(LogLevel.ERROR, `Error in ${context}:`, error);
  
  // Extract error message based on error type
  if (error instanceof Error) {
    // Include only necessary error message without stack trace
    errorMessage = `Error ${context}: ${error.message}`;
    
    // Handle Axios errors specially
    if ('isAxiosError' in error && (error as any).isAxiosError) {
      const axiosError = error as any;
      if (axiosError.response) {
        // Include status code but limit response data exposure
        const status = axiosError.response.status;
        errorMessage = `API error ${context} (Status: ${status})`;
        
        // Log full response for debugging (server-side only)
        log(LogLevel.ERROR, 'Full API error response:', axiosError.response.data);
        
        // Include only necessary error details for client
        if (axiosError.response.data && axiosError.response.data.errors) {
          try {
            // Extract API error messages if available
            const apiErrors = axiosError.response.data.errors;
            if (Array.isArray(apiErrors) && apiErrors.length > 0) {
              const apiErrorDetails = apiErrors.map((err: any) => 
                err.title || err.detail || 'Unknown API error'
              ).join('; ');
              errorMessage += `: ${apiErrorDetails}`;
            }
          } catch (e) {
            // Fall back to status-only error if error processing fails
            log(LogLevel.ERROR, 'Error processing API error details:', e);
          }
        }
      } else if (axiosError.request) {
        // Network or timeout issue
        errorMessage = `Network error ${context}: No response received`;
      } else {
        // Request configuration error
        errorMessage = `Request configuration error ${context}`;
      }
    }
  } else if (typeof error === 'string') {
    errorMessage = `Error ${context}: ${error}`;
  } else if (typeof error === 'object' && error !== null) {
    // Extract message from unknown object types but avoid exposing internals
    const errObj = error as any;
    if (errObj.message) {
      errorMessage = `Error ${context}: ${errObj.message}`;
    }
  }
  
  return createErrorResponse(errorMessage);
}

/**
 * Format a scenario definition by removing 'call' from steps
 */
export function formatScenarioDefinition(definition: string): string {
  if (!definition) return '';
  
  const lines = definition.split('\n');
  const formattedLines = lines.map(line => {
    // Keep first and last line unchanged
    if (line.trim().startsWith('scenario') || line.trim() === 'end') {
      return line;
    }
    
    // Remove 'call' from steps
    return line.replace(/call\s+(given|when|then|and)\s+/, '$1 ');
  });
  
  return formattedLines.join('\n');
}

/**
 * Extract steps from a scenario definition
 */
export function extractScenarioSteps(definition: string): Array<{type: string, text: string}> {
  if (!definition) return [];
  
  const lines = definition.split('\n');
  const steps: Array<{type: string, text: string}> = [];
  
  for (let line of lines) {
    line = line.trim();
    
    // Skip scenario declaration and end line
    if (line.startsWith('scenario') || line === 'end') {
      continue;
    }
    
    // Extract step type and text using regex
    const match = line.match(/(?:call\s+)?(given|when|then|and)\s+'([^']+)'/i);
    if (match) {
      steps.push({
        type: match[1].toLowerCase(), // normalize to lowercase
        text: match[2]
      });
    }
  }
  
  return steps;
}

/**
 * Extract scenario name from definition
 */
export function extractScenarioName(definition: string): string {
  if (!definition) return '';
  
  const match = definition.match(/scenario\s+'([^']+)'/i);
  return match ? match[1] : '';
}

/**
 * Convert a scenario to a structure with name and steps
 */
export function scenarioToStructured(definition: string): {name: string, steps: Array<{type: string, text: string}>} {
  return {
    name: extractScenarioName(definition),
    steps: extractScenarioSteps(definition)
  };
}

/**
 * Convert structured steps to a scenario definition
 */
export function stepsToScenarioDefinition(name: string, steps: Array<{type: string, text: string}>): string {
  let definition = `scenario '${name}' do\n`;
  
  // Add each step with call prefix
  steps.forEach(step => {
    definition += `  call ${step.type} '${step.text}'\n`;
  });
  
  // Close the scenario definition
  definition += 'end\n';
  
  return definition;
} 