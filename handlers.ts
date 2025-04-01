// Handlers for Cucumber Studio MCP tools
import { 
  getProjects, 
  getProject, 
  getScenarios, 
  getScenario, 
  createScenario,
  updateScenario,
  findScenariosByTags,
  addTagToScenario,
  addTagsToScenario,
  updateTag,
  deleteTag,
  deleteScenario,
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder
} from './api-client.js';
import { 
  extractProjectId, 
  createSuccessResponse, 
  handleError, 
  formatScenarioDefinition,
  scenarioToStructured,
  stepsToScenarioDefinition
} from './utils.js';
import {
  CucumberStudioProject,
  CucumberStudioResponse,
  ToolResponse
} from './types.js';
import { z } from 'zod';
import { LogLevel, log } from './config.js';

/**
 * Handle the get_projects tool
 */
export async function handleGetProjects(): Promise<ToolResponse> {
  try {
    // Fetch projects from API
    const data = await getProjects() as CucumberStudioResponse<CucumberStudioProject>;
    
    // Validate response structure before processing
    if (!data || !data.data) {
      throw new Error("Invalid API response structure");
    }
    
    // Additional data validation - ensure data is properly structured
    const projectsData = Array.isArray(data.data) ? data.data : [data.data];
    
    // Validate essential properties using Zod
    const ProjectValidator = z.object({
      id: z.string(),
      type: z.string(),
      attributes: z.object({
        name: z.string()
      }).nonstrict()
    }).nonstrict();
    
    // Validate each project
    projectsData.forEach(project => {
      const result = ProjectValidator.safeParse(project);
      if (!result.success) {
        log(LogLevel.ERROR, `Project validation error:`, result.error);
        // Continue processing, but log the error
      }
    });
    
    // Add meta information if missing
    const enhancedData = {
      ...data,
      meta: {
        ...(data.meta || {}),
        total_count: projectsData.length
      }
    };
    
    return createSuccessResponse(enhancedData);
  } catch (error) {
    return handleError(error, "fetching projects");
  }
}

/**
 * Handle the get_project tool
 */
export async function handleGetProject(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    log(LogLevel.INFO, `Fetching project with ID: ${project_id}`);
    const data = await getProject(project_id);
    return createSuccessResponse(data);
  } catch (error) {
    return handleError(error, "fetching project");
  }
}

/**
 * Format scenario definitions in the response data and add structured steps
 * @param data API response data
 * @returns Data with formatted scenario definitions and structured steps
 */
function formatScenariosInResponse(data: any): any {
  if (!data || !data.data || !Array.isArray(data.data)) {
    return data;
  }
  
  // Format each scenario definition and add structured steps
  const formattedData = {
    ...data,
    data: data.data.map((scenario: any) => {
      if (scenario.attributes && scenario.attributes.definition) {
        const formattedDefinition = formatScenarioDefinition(scenario.attributes.definition);
        const structuredScenario = scenarioToStructured(scenario.attributes.definition);
        
        return {
          ...scenario,
          attributes: {
            ...scenario.attributes,
            definition: formattedDefinition,
            // Add structured representation
            structured: structuredScenario
          }
        };
      }
      return scenario;
    })
  };
  
  return formattedData;
}

/**
 * Handle the get_scenarios tool
 */
export async function handleGetScenarios(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    const include_tags = input && typeof input === 'object' && 'include_tags' in input 
      ? Boolean(input.include_tags) 
      : true;
    
    log(LogLevel.INFO, `Fetching scenarios for project ID: ${project_id}, include_tags: ${include_tags}`);
    
    const data = await getScenarios(project_id, include_tags);
    
    // Format the scenario definitions
    const formattedData = formatScenariosInResponse(data);
    
    // Add scenario count to the response
    const scenarioCount = formattedData.data ? formattedData.data.length : 0;
    const enhancedData = {
      ...formattedData,
      meta: {
        ...(formattedData.meta || {}),
        total_count: scenarioCount
      }
    };
    
    return createSuccessResponse(enhancedData);
  } catch (error) {
    return handleError(error, "fetching scenarios for project");
  }
}

/**
 * Handle the find_scenarios_by_tags tool
 */
export async function handleFindScenariosByTags(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.tag_key) {
      throw new Error(`Missing required parameter: tag_key`);
    }
    
    if (!input.tag_value) {
      throw new Error(`Missing required parameter: tag_value`);
    }
    
    const include_tags = input && typeof input === 'object' && 'include_tags' in input 
      ? Boolean(input.include_tags) 
      : true;
    
    log(LogLevel.INFO, `Finding scenarios for project ID: ${project_id} with tag ${input.tag_key}:${input.tag_value}, include_tags: ${include_tags}`);
    
    const data = await findScenariosByTags(project_id, input.tag_key, input.tag_value, include_tags);
    
    // Format the scenario definitions
    const formattedData = formatScenariosInResponse(data);
    
    // Add scenario count to the response
    const scenarioCount = formattedData.data ? formattedData.data.length : 0;
    const enhancedData = {
      ...formattedData,
      meta: {
        ...(formattedData.meta || {}),
        total_count: scenarioCount
      }
    };
    
    return createSuccessResponse(enhancedData);
  } catch (error) {
    return handleError(error, "finding scenarios by tags");
  }
}

/**
 * Handle the get_scenario tool
 */
export async function handleGetScenario(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.scenario_id) {
      throw new Error(`Missing required parameter: scenario_id`);
    }
    
    const include_tags = input && typeof input === 'object' && 'include_tags' in input 
      ? Boolean(input.include_tags) 
      : true;
    
    log(LogLevel.INFO, `Fetching scenario with ID: ${input.scenario_id} from project ID: ${project_id}, include_tags: ${include_tags}`);
    
    const data = await getScenario(project_id, input.scenario_id, include_tags);
    
    // Format the scenario definition and add structured data
    const formattedData = formatScenariosInResponse(data);
    
    return createSuccessResponse(formattedData);
  } catch (error) {
    return handleError(error, "fetching scenario");
  }
}

/**
 * Handle the create_scenario tool
 */
export async function handleCreateScenario(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.name) {
      throw new Error(`Missing required parameter: name`);
    }
    
    // Prepare the request payload
    const scenarioData: any = {
      data: {
        type: "scenarios",
        attributes: {
          name: input.name
        }
      }
    };
    
    // Add optional attributes if provided
    if (input.description) {
      scenarioData.data.attributes.description = input.description;
    }
    
    if (input.folder_id) {
      scenarioData.data.attributes["folder-id"] = input.folder_id;
    }
    
    log(LogLevel.INFO, `Creating scenario with name: ${input.name} in project ID: ${project_id}`);
    
    // Create the scenario
    const createResponse = await createScenario(project_id, scenarioData);
    const scenarioId = createResponse.data.id;
    
    let addedTags = false;
    
    // If tags are provided, add them to the scenario
    if (input.tags && Array.isArray(input.tags) && input.tags.length > 0) {
      log(LogLevel.INFO, `Adding tags to scenario ID: ${scenarioId}`);
      await addTagsToScenario(project_id, scenarioId, input.tags);
      addedTags = true;
    }
    
    // If steps are provided, update the scenario with the generated definition
    if (input.steps && Array.isArray(input.steps) && input.steps.length > 0) {
      log(LogLevel.INFO, `Adding steps to scenario ID: ${scenarioId}`);
      
      // Convert steps to scenario definition
      const definition = stepsToScenarioDefinition(input.name, input.steps);
      
      // Prepare the update request payload
      const updateData = {
        data: {
          type: "scenarios",
          id: scenarioId,
          attributes: {
            definition: definition
          }
        }
      };
      
      // Update the scenario with the definition
      await updateScenario(project_id, scenarioId, updateData);
    }
    
    // If tags or steps were added, fetch the updated scenario to return
    if (addedTags || (input.steps && Array.isArray(input.steps) && input.steps.length > 0)) {
      const updatedData = await getScenario(project_id, scenarioId, true);
      const formattedData = formatScenariosInResponse(updatedData);
      
      return createSuccessResponse(formattedData);
    }
    
    // If no tags or steps added, just return the created scenario
    return createSuccessResponse(createResponse);
  } catch (error) {
    return handleError(error, "creating scenario");
  }
}

/**
 * Handle the update_scenario tool
 */
export async function handleUpdateScenario(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.scenario_id) {
      throw new Error(`Missing required parameter: scenario_id`);
    }
    
    let needsUpdate = false;
    
    // Prepare the update request payload
    const updateData: any = {
      data: {
        type: "scenarios",
        id: input.scenario_id,
        attributes: {}
      }
    };
    
    // Add attributes if provided
    if (input.name) {
      updateData.data.attributes.name = input.name;
      needsUpdate = true;
    }
    
    if (input.description !== undefined) {
      updateData.data.attributes.description = input.description;
      needsUpdate = true;
    }
    
    if (input.folder_id) {
      updateData.data.attributes["folder-id"] = input.folder_id;
      needsUpdate = true;
    }
    
    // Handle definition from steps if provided
    if (input.steps && Array.isArray(input.steps) && input.steps.length > 0) {
      // Get the scenario name (from input or from existing scenario)
      let scenarioName = input.name;
      if (!scenarioName) {
        const existingScenario = await getScenario(project_id, input.scenario_id, false);
        scenarioName = existingScenario.data.attributes.name;
      }
      
      // Convert steps to scenario definition
      const definition = stepsToScenarioDefinition(scenarioName, input.steps);
      updateData.data.attributes.definition = definition;
      needsUpdate = true;
    } else if (input.definition) {
      // Use explicit definition if provided
      updateData.data.attributes.definition = input.definition;
      needsUpdate = true;
    }
    
    let tagsAdded = false;
    
    // If tags are provided, add them to the scenario
    if (input.tags && Array.isArray(input.tags) && input.tags.length > 0) {
      log(LogLevel.INFO, `Adding tags to scenario ID: ${input.scenario_id}`);
      await addTagsToScenario(project_id, input.scenario_id, input.tags);
      tagsAdded = true;
    }
    
    // Only perform update if there are attributes to update
    if (needsUpdate && Object.keys(updateData.data.attributes).length > 0) {
      log(LogLevel.INFO, `Updating scenario ID: ${input.scenario_id} in project ID: ${project_id}`);
      await updateScenario(project_id, input.scenario_id, updateData);
    } else if (!tagsAdded) {
      throw new Error("No attributes or tags provided for update. Please provide at least one attribute or tag to update.");
    }
    
    // Fetch the updated scenario to return
    const updatedData = await getScenario(project_id, input.scenario_id, true);
    const formattedData = formatScenariosInResponse(updatedData);
    
    return createSuccessResponse(formattedData);
  } catch (error) {
    return handleError(error, "updating scenario");
  }
}

/**
 * Handle the add_tag tool
 */
export async function handleAddTag(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.scenario_id) {
      throw new Error(`Missing required parameter: scenario_id`);
    }
    
    if (!input.key) {
      throw new Error(`Missing required parameter: key`);
    }
    
    if (!input.value) {
      throw new Error(`Missing required parameter: value`);
    }
    
    log(LogLevel.INFO, `Adding tag ${input.key}:${input.value} to scenario ID: ${input.scenario_id} in project ID: ${project_id}`);
    
    const response = await addTagToScenario(project_id, input.scenario_id, input.key, input.value);
    
    // Fetch the updated scenario to return with all tags
    const updatedData = await getScenario(project_id, input.scenario_id, true);
    const formattedData = formatScenariosInResponse(updatedData);
    
    return createSuccessResponse(formattedData);
  } catch (error) {
    return handleError(error, "adding tag to scenario");
  }
}

/**
 * Handle the add_tags tool
 */
export async function handleAddTags(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.scenario_id) {
      throw new Error(`Missing required parameter: scenario_id`);
    }
    
    if (!input.tags || !Array.isArray(input.tags) || input.tags.length === 0) {
      throw new Error(`Missing or invalid required parameter: tags. Expected a non-empty array.`);
    }
    
    log(LogLevel.INFO, `Adding ${input.tags.length} tags to scenario ID: ${input.scenario_id} in project ID: ${project_id}`);
    
    await addTagsToScenario(project_id, input.scenario_id, input.tags);
    
    // Fetch the updated scenario to return with all tags
    const updatedData = await getScenario(project_id, input.scenario_id, true);
    const formattedData = formatScenariosInResponse(updatedData);
    
    return createSuccessResponse(formattedData);
  } catch (error) {
    return handleError(error, "adding tags to scenario");
  }
}

/**
 * Handle the update_tag tool
 */
export async function handleUpdateTag(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.scenario_id) {
      throw new Error(`Missing required parameter: scenario_id`);
    }
    
    if (!input.tag_id) {
      throw new Error(`Missing required parameter: tag_id`);
    }
    
    if (!input.key) {
      throw new Error(`Missing required parameter: key`);
    }
    
    if (!input.value) {
      throw new Error(`Missing required parameter: value`);
    }
    
    log(LogLevel.INFO, `Updating tag ID: ${input.tag_id} on scenario ID: ${input.scenario_id} in project ID: ${project_id}`);
    
    const response = await updateTag(project_id, input.scenario_id, input.tag_id, input.key, input.value);
    
    // Fetch the updated scenario to return with all tags
    const updatedData = await getScenario(project_id, input.scenario_id, true);
    const formattedData = formatScenariosInResponse(updatedData);
    
    return createSuccessResponse(formattedData);
  } catch (error) {
    return handleError(error, "updating tag on scenario");
  }
}

/**
 * Handle the delete_tag tool
 */
export async function handleDeleteTag(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.scenario_id) {
      throw new Error(`Missing required parameter: scenario_id`);
    }
    
    if (!input.tag_id) {
      throw new Error(`Missing required parameter: tag_id`);
    }
    
    log(LogLevel.INFO, `Deleting tag ID: ${input.tag_id} from scenario ID: ${input.scenario_id} in project ID: ${project_id}`);
    
    await deleteTag(project_id, input.scenario_id, input.tag_id);
    
    // Fetch the updated scenario to return with all remaining tags
    const updatedData = await getScenario(project_id, input.scenario_id, true);
    const formattedData = formatScenariosInResponse(updatedData);
    
    return createSuccessResponse(formattedData);
  } catch (error) {
    return handleError(error, "deleting tag from scenario");
  }
}

/**
 * Handle the delete_scenario tool
 */
export async function handleDeleteScenario(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    if (!input.scenario_id) {
      throw new Error(`Missing required parameter: scenario_id`);
    }
    
    log(LogLevel.INFO, `Deleting scenario ID: ${input.scenario_id} from project ID: ${project_id}`);
    
    await deleteScenario(project_id, input.scenario_id);
    
    return createSuccessResponse({ 
      success: true,
      message: `Successfully deleted scenario ${input.scenario_id} from project ${project_id}`
    });
  } catch (error) {
    return handleError(error, "deleting scenario");
  }
}

/**
 * Handle the get_folders tool
 */
export async function handleGetFolders(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    
    if (!project_id) {
      throw new Error(`Missing or invalid project_id parameter. Received: ${JSON.stringify(input)}`);
    }
    
    log(LogLevel.INFO, `Fetching folders for project ID: ${project_id}`);
    
    const data = await getFolders(project_id);
    
    // Add folder count to the response
    const folderCount = data.data ? data.data.length : 0;
    const enhancedData = {
      ...data,
      meta: {
        ...(data.meta || {}),
        total_count: folderCount
      }
    };
    
    return createSuccessResponse(enhancedData);
  } catch (error) {
    return handleError(error, "fetching folders for project");
  }
}

/**
 * Handle the create_folder tool
 */
export async function handleCreateFolder(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    const { name, parent_id } = input;
    
    if (!project_id || !name) {
      throw new Error(`Missing required parameters. Received: ${JSON.stringify(input)}`);
    }
    
    log(LogLevel.INFO, `Creating folder "${name}" in project ID: ${project_id}`);
    
    const data = await createFolder(project_id, name, parent_id);
    return createSuccessResponse(data);
  } catch (error) {
    return handleError(error, "creating folder");
  }
}

/**
 * Handle the update_folder tool
 */
export async function handleUpdateFolder(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    const { folder_id, name, description, definition, parent_id } = input;
    
    if (!project_id || !folder_id) {
      throw new Error(`Missing required parameters. Received: ${JSON.stringify(input)}`);
    }
    
    // Check if at least one attribute is provided for update
    if (!name && !description && !definition && parent_id === undefined) {
      throw new Error("No attributes provided for update. Please provide at least one attribute to update.");
    }
    
    log(LogLevel.INFO, `Updating folder ID: ${folder_id} in project ID: ${project_id}`);
    
    const data = await updateFolder(project_id, folder_id, name, description, definition, parent_id);
    return createSuccessResponse(data);
  } catch (error) {
    return handleError(error, "updating folder");
  }
}

/**
 * Handle the delete_folder tool
 */
export async function handleDeleteFolder(input: Record<string, any>): Promise<any> {
  try {
    const project_id = extractProjectId(input);
    const { folder_id } = input;
    
    if (!project_id || !folder_id) {
      throw new Error(`Missing required parameters. Received: ${JSON.stringify(input)}`);
    }
    
    log(LogLevel.INFO, `Deleting folder ID: ${folder_id} from project ID: ${project_id}`);
    
    await deleteFolder(project_id, folder_id);
    
    return createSuccessResponse({ 
      success: true,
      message: `Successfully deleted folder ${folder_id} from project ${project_id}`
    });
  } catch (error) {
    return handleError(error, "deleting folder");
  }
} 