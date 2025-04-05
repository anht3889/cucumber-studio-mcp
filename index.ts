#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import components from modular files
import { validateConfig, config, LogLevel, log } from './config.js';
import { 
  handleGetProjects, 
  handleGetProject, 
  handleGetScenarios,
  handleGetScenario,
  handleCreateScenario,
  handleUpdateScenario,
  handleAddTag,
  handleAddTags,
  handleFindScenariosByTags,
  handleUpdateTag,
  handleDeleteTag,
  handleDeleteScenario,
  handleGetFolders,
  handleCreateFolder,
  handleUpdateFolder,
  handleDeleteFolder
} from './handlers.js';
import { normalizeToolName, handleError } from './utils.js';
import {
  GetProjectSchema,
  GetScenariosSchema,
  GetScenarioSchema,
  FindScenariosByTagsSchema,
  CreateScenarioSchema,
  UpdateScenarioSchema,
  AddTagToScenarioSchema,
  AddTagsToScenarioSchema,
  UpdateTagSchema,
  DeleteTagSchema,
  DeleteScenarioSchema,
  GetFoldersSchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  DeleteFolderSchema
} from './schemas.js';
import { z } from 'zod';

// Define read-only and write operations
const READ_OPERATIONS = [
  "cucumber_studio_get_projects",
  "cucumber_studio_get_project",
  "cucumber_studio_get_scenarios",
  "cucumber_studio_get_scenario",
  "cucumber_studio_find_scenarios_by_tags",
  "cucumber_studio_get_folders"
];

const WRITE_OPERATIONS = [
  "cucumber_studio_create_scenario",
  "cucumber_studio_update_scenario",
  "cucumber_studio_add_tag",
  "cucumber_studio_add_tags",
  "cucumber_studio_update_tag",
  "cucumber_studio_delete_tag",
  "cucumber_studio_delete_scenario",
  "cucumber_studio_create_folder",
  "cucumber_studio_update_folder",
  "cucumber_studio_delete_folder"
];

// Helper function to check if an operation is allowed in the current mode
function isOperationAllowed(toolName: string): boolean {
  if (READ_OPERATIONS.includes(toolName)) {
    return true; // Read operations are always allowed
  }
  
  if (WRITE_OPERATIONS.includes(toolName) && config.readOnlyMode) {
    return false; // Write operations are not allowed in read-only mode
  }
  
  return true; // All other operations are allowed by default
}

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  // Only log to file, not to stderr
  log(LogLevel.ERROR, "Uncaught exception:", error);
  
  // Exit gracefully if this is a fatal error
  if (error.message.includes('EADDRINUSE') || 
      error.message.includes('EACCES') || 
      error.message.includes('Cannot find module')) {
    process.exit(1);
  }
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  // Only log to file, not to stderr
  log(LogLevel.ERROR, "Unhandled promise rejection:", reason);
});

// Create the MCP server
const server = new McpServer({
  name: "cucumber-studio-server",
  version: "0.6.3"
});

// Helper function to register tools with common error handling and logging
function registerTool<T extends z.ZodRawShape>(
  toolName: string,
  schemaShape: T | {}, // Allow empty object for tools with no params
  // Allow handlers that take inferred params or no params
  handler: ((params: z.infer<z.ZodObject<T>>) => Promise<any>) | (() => Promise<any>)
) {
  // Only register write operations if not in read-only mode
  if (WRITE_OPERATIONS.includes(toolName) && config.readOnlyMode) {
    log(LogLevel.INFO, `Skipping registration of write tool '${toolName}' due to read-only mode.`);
    return;
  }

  server.tool(toolName, schemaShape, async (params: any) => { // Explicitly type params as any to satisfy linter
    const normalizedToolName = normalizeToolName(toolName);
    try {
      log(LogLevel.DEBUG, `Handling ${toolName} request`);
      
      let result: any;
      // Check if the schema is empty (meaning no parameters are expected)
      if (Object.keys(schemaShape).length === 0) {
        // Call the handler assuming it takes no parameters
        result = await (handler as () => Promise<any>)();
      } else {
        // Call the handler assuming it takes parameters
        // The MCP SDK should have already validated params against schemaShape
        result = await (handler as (p: z.infer<z.ZodObject<T>>) => Promise<any>)(params);
      }

      log(LogLevel.DEBUG, `Successfully handled ${toolName} request`);
      return result;
    } catch (error) {
      log(LogLevel.ERROR, `Error in ${normalizedToolName} handler:`, error);
      // Use the context derived from the normalized tool name for clearer error messages
      return handleError(error, `handling ${normalizedToolName}`); 
    }
  });
}

// Register read-only tools using the helper
// Note: Cast handleGetProjects to the expected type (() => Promise<any>)
registerTool("cucumber_studio_get_projects", {}, handleGetProjects as () => Promise<any>); 
registerTool("cucumber_studio_get_project", GetProjectSchema.shape, handleGetProject);
registerTool("cucumber_studio_get_scenarios", GetScenariosSchema.shape, handleGetScenarios);
registerTool("cucumber_studio_get_scenario", GetScenarioSchema.shape, handleGetScenario);
registerTool("cucumber_studio_find_scenarios_by_tags", FindScenariosByTagsSchema.shape, handleFindScenariosByTags);
registerTool("cucumber_studio_get_folders", GetFoldersSchema.shape, handleGetFolders);

// Register write operation tools using the helper (will be skipped if in read-only mode)
registerTool("cucumber_studio_create_scenario", CreateScenarioSchema.shape, handleCreateScenario);
registerTool("cucumber_studio_update_scenario", UpdateScenarioSchema.shape, handleUpdateScenario);
registerTool("cucumber_studio_add_tag", AddTagToScenarioSchema.shape, handleAddTag);
registerTool("cucumber_studio_add_tags", AddTagsToScenarioSchema.shape, handleAddTags);
registerTool("cucumber_studio_update_tag", UpdateTagSchema.shape, handleUpdateTag);
registerTool("cucumber_studio_delete_tag", DeleteTagSchema.shape, handleDeleteTag);
registerTool("cucumber_studio_delete_scenario", DeleteScenarioSchema.shape, handleDeleteScenario);
registerTool("cucumber_studio_create_folder", CreateFolderSchema.shape, handleCreateFolder);
registerTool("cucumber_studio_update_folder", UpdateFolderSchema.shape, handleUpdateFolder);
registerTool("cucumber_studio_delete_folder", DeleteFolderSchema.shape, handleDeleteFolder);

// Main execution
async function main() {
  try {
    // Set MCP protocol flag to disable console output
    process.env.MCP_PROTOCOL = 'true';
    
    // Validate the configuration
    validateConfig();
    
    // After successful validation, redirect console methods
    log(LogLevel.INFO, "Configuration valid, setting up MCP server...");
    
    // Redirect all console methods to prevent them from writing to stdout/stderr
    // This is safer than overriding stdout/stderr directly
    const noOp = () => true;
    console.log = noOp;
    console.error = noOp;
    console.warn = noOp;
    console.info = noOp;
    console.debug = noOp;
    
    // Create the server transport and start the server
    const transport = new StdioServerTransport();
    
    // Connect to the transport
    await server.connect(transport);
    
    // Log to file only
    log(LogLevel.INFO, "Cucumber Studio MCP server started successfully");
  } catch (error) {
    // Log the error to file only
    log(LogLevel.ERROR, "Error starting Cucumber Studio MCP server:", error);
    
    // Exit with error code
    process.exit(1);
  }
}

// Start the server
main(); 