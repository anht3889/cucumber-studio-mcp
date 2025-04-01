// Types and interfaces for the Cucumber Studio MCP server

// Configuration for the Cucumber Studio API
export interface CucumberStudioConfig {
  accessToken: string;
  clientId: string;
  uid: string;
  baseUrl: string;
}

// Standard response format for MCP tools
export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
}

// Schema parameter types
export interface GetProjectParams {
  project_id: string;
}

export interface GetScenariosParams {
  project_id: string;
  include_tags: boolean;
}

// API Response interfaces
export interface CucumberStudioProject {
  id: string;
  type: string;
  attributes: {
    name: string;
    description?: string;
    [key: string]: any;
  };
  relationships?: Record<string, any>;
}

export interface CucumberStudioScenario {
  id: string;
  type: string;
  attributes: {
    name: string;
    description?: string;
    definition?: string;
    structured?: {
      name: string;
      steps: Array<{type: string, text: string}>;
    };
    [key: string]: any;
  };
  relationships?: Record<string, any>;
}

export interface CucumberStudioTag {
  id: string;
  type: string;
  attributes: {
    key: string;
    value: string;
    [key: string]: any;
  };
  relationships?: Record<string, any>;
}

export interface CucumberStudioResponse<T> {
  data: T | T[];
  included?: any[];
  meta?: {
    total_count?: number;
    [key: string]: any;
  };
} 