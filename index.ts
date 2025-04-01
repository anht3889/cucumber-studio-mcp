#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import components from modular files
import { validateConfig, config, LogLevel, log } from './config.js';
import { TOOL_DEFINITIONS } from './schemas.js';
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
import { normalizeToolName, extractParameters, createErrorResponse, handleError } from './utils.js';

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
const server = new Server(
  { name: "cucumber-studio-server", version: "0.6.3" },
  { capabilities: { tools: {} } }
);

// Request handlers setup
server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (config.readOnlyMode) {
    // In read-only mode, only return read-only tools
    const readOnlyTools = TOOL_DEFINITIONS.filter(tool => 
      READ_OPERATIONS.includes(normalizeToolName(tool.name))
    );
    return { tools: readOnlyTools };
  }
  
  return { tools: TOOL_DEFINITIONS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  log(LogLevel.DEBUG, "Tool call request:", JSON.stringify(request.params));
  
  try {
    // Extract and normalize tool name
    const originalName = request.params.name;
    const toolName = normalizeToolName(originalName);
    log(LogLevel.DEBUG, `Original tool name: ${originalName}, normalized to: ${toolName}`);
    
    // Check if the operation is allowed in the current mode
    if (!isOperationAllowed(toolName)) {
      log(LogLevel.WARN, `Operation ${toolName} is not allowed in read-only mode`);
      return createErrorResponse(`Operation '${originalName}' is not allowed in read-only mode. Please check the server configuration.`);
    }
    
    // Extract parameters from various possible formats
    const input = extractParameters(request);
    log(LogLevel.DEBUG, "Processed input:", JSON.stringify(input));
    
    // Route to appropriate handler
    let response;
    try {
      switch (toolName) {
        case "cucumber_studio_get_projects":
          response = await handleGetProjects();
          break;
        
        case "cucumber_studio_get_project":
          response = await handleGetProject(input);
          break;
        
        case "cucumber_studio_get_scenarios":
          response = await handleGetScenarios(input);
          break;
        
        case "cucumber_studio_get_scenario":
          response = await handleGetScenario(input);
          break;
        
        case "cucumber_studio_find_scenarios_by_tags":
          response = await handleFindScenariosByTags(input);
          break;
        
        case "cucumber_studio_create_scenario":
          response = await handleCreateScenario(input);
          break;
        
        case "cucumber_studio_update_scenario":
          response = await handleUpdateScenario(input);
          break;
        
        case "cucumber_studio_add_tag":
          response = await handleAddTag(input);
          break;
        
        case "cucumber_studio_add_tags":
          response = await handleAddTags(input);
          break;
        
        case "cucumber_studio_update_tag":
          response = await handleUpdateTag(input);
          break;
        
        case "cucumber_studio_delete_tag":
          response = await handleDeleteTag(input);
          break;
        
        case "cucumber_studio_delete_scenario":
          response = await handleDeleteScenario(input);
          break;
        
        case "cucumber_studio_get_folders":
          response = await handleGetFolders(input);
          break;
        
        case "cucumber_studio_create_folder":
          response = await handleCreateFolder(input);
          break;
        
        case "cucumber_studio_update_folder":
          response = await handleUpdateFolder(input);
          break;
        
        case "cucumber_studio_delete_folder":
          response = await handleDeleteFolder(input);
          break;
        
        default:
          response = createErrorResponse(`Unknown tool: ${originalName}`);
      }
    } catch (handlerError) {
      log(LogLevel.ERROR, `Error in handler for tool ${toolName}:`, handlerError);
      return handleError(handlerError, `executing ${toolName}`);
    }
    
    // Validate that the response structure is correct
    if (!response) {
      log(LogLevel.ERROR, "No response returned from handler");
      return createErrorResponse(`No response returned from handler for tool: ${originalName}`);
    }
    
    if (!response.content || !Array.isArray(response.content)) {
      log(LogLevel.ERROR, "Invalid response structure:", response);
      return createErrorResponse("Handler returned an invalid response structure");
    }
    
    return response;
  } catch (error) {
    log(LogLevel.ERROR, "Unhandled error in request handler:", error);
    return handleError(error, "processing request");
  }
});

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

// Run the server
main().catch(error => {
  log(LogLevel.ERROR, "Unhandled error:", error);
  process.exit(1);
}); 