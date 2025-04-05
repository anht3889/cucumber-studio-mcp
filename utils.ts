// Utility functions for handling MCP tool requests

import { LogLevel, log, config } from './config.js';
import axios from 'axios';

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
  // Base error message
  let baseMessage = `An error occurred while ${context}`;
  let detailedMessage = baseMessage; // More detailed message, potentially sanitized

  // Log full error details for debugging (server-side only)
  log(LogLevel.ERROR, `Error during ${context}:`, error);
  
  // Extract error message based on error type
  if (error instanceof Error) {
    detailedMessage = `Error ${context}: ${error.message}`;
    
    // Handle Axios errors specially
    if (axios.isAxiosError(error)) {
      const axiosError = error;
      if (axiosError.response) {
        const status = axiosError.response.status;
        detailedMessage = `API error ${context} (Status: ${status})`;
        
        // Log full response for debugging (server-side only)
        log(LogLevel.ERROR, 'Full API error response:', axiosError.response.data);
        
        // Add specific API error details if available and not sanitized
        if (axiosError.response.data && axiosError.response.data.errors && !config.sanitizeErrorMessages) {
          try {
            const apiErrors = axiosError.response.data.errors;
            if (Array.isArray(apiErrors) && apiErrors.length > 0) {
              const apiErrorDetails = apiErrors.map((err: any) => 
                err.title || err.detail || 'Unknown API error'
              ).join('; ');
              detailedMessage += `: ${apiErrorDetails}`;
            }
          } catch (e) {
            log(LogLevel.ERROR, 'Error processing API error details:', e);
          }
        }
      } else if (axiosError.request) {
        detailedMessage = `Network error ${context}: No response received`;
      } else {
        detailedMessage = `Request configuration error during ${context}: ${error.message}`;
      }
    }
  } else if (typeof error === 'string') {
    detailedMessage = `Error ${context}: ${error}`;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    if (errObj.message) {
      detailedMessage = `Error ${context}: ${errObj.message}`;
    }
  }

  // Determine the final message based on sanitize config
  const finalMessage = config.sanitizeErrorMessages ? baseMessage + ". Check server logs for details." : detailedMessage;
  
  return createErrorResponse(finalMessage);
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