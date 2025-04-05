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
import { AxiosResponse } from 'axios'; // Import AxiosResponse if needed for type checking
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
} from './schemas.js'; // Ensure schemas are imported

/**
 * Handle the get_projects tool
 */
export async function handleGetProjects(): Promise<ToolResponse> {
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
}

/**
 * Handle the get_project tool
 */
// Use inferred type from Zod schema
export async function handleGetProject(input: z.infer<typeof GetProjectSchema>): Promise<any> { 
  // No need to extract project_id manually, it's typed!
  log(LogLevel.INFO, `Fetching project with ID: ${input.project_id}`);
  const data = await getProject(input.project_id);
  return createSuccessResponse(data);
}

/**
 * Format scenario definitions in the response data and add structured steps
 * @param data API response data (assuming it contains a 'data' property which could be an object or array)
 * @returns Data with formatted scenario definitions and structured steps
 */
function formatScenariosInResponse(data: any): any {
  if (!data) {
    return data; // Return original data if null or undefined
  }

  // Handle both single scenario object and array of scenarios
  const scenarios = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
  
  if (scenarios.length === 0) {
    return data; // Return original data if no scenarios found
  }

  const formattedScenarios = scenarios.map((scenario: any) => {
    if (scenario && scenario.attributes && scenario.attributes.definition) {
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
  });

  // Reconstruct the response structure based on whether it was an array or single object
  const formattedData = {
    ...data,
    data: Array.isArray(data.data) ? formattedScenarios : formattedScenarios[0]
  };

  return formattedData;
}

/**
 * Handle the get_scenarios tool
 */
// Use inferred type from Zod schema
export async function handleGetScenarios(input: z.infer<typeof GetScenariosSchema>): Promise<any> {
  // project_id and include_tags are directly accessible and typed
  log(LogLevel.INFO, `Fetching scenarios for project ID: ${input.project_id}, include_tags: ${input.include_tags}`);
  const data = await getScenarios(input.project_id, input.include_tags);
  
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
}

/**
 * Handle the find_scenarios_by_tags tool
 */
// Use inferred type from Zod schema
export async function handleFindScenariosByTags(input: z.infer<typeof FindScenariosByTagsSchema>): Promise<any> {
  log(LogLevel.INFO, `Finding scenarios for project ID: ${input.project_id} with tag ${input.tag_key}:${input.tag_value}, include_tags: ${input.include_tags}`);
  const data = await findScenariosByTags(input.project_id, input.tag_key, input.tag_value, input.include_tags);
  
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
}

/**
 * Handle the get_scenario tool
 */
// Use inferred type from Zod schema
export async function handleGetScenario(input: z.infer<typeof GetScenarioSchema>): Promise<any> {
  log(LogLevel.INFO, `Fetching scenario with ID: ${input.scenario_id} from project ID: ${input.project_id}, include_tags: ${input.include_tags}`);
  const data = await getScenario(input.project_id, input.scenario_id, input.include_tags);
  
  // Format the scenario definition and add structured data
  const formattedData = formatScenariosInResponse(data);
  
  return createSuccessResponse(formattedData);
}

/**
 * Handle the create_scenario tool
 */
// Use inferred type from Zod schema
export async function handleCreateScenario(input: z.infer<typeof CreateScenarioSchema>): Promise<any> {
  // Parameters are typed and directly accessible
  const { project_id, name, description, folder_id, tags, steps } = input;

  // Prepare the request payload
  const scenarioData: any = {
    data: {
      type: "scenarios",
      attributes: {
        name: name
      }
    }
  };
  
  // Add optional attributes if provided
  if (description) {
    scenarioData.data.attributes.description = description;
  }
  if (folder_id) {
    scenarioData.data.attributes["folder-id"] = folder_id;
  }
  
  log(LogLevel.INFO, `Creating scenario with name: ${name} in project ID: ${project_id}`);
  
  // Create the scenario
  const createResponse = await createScenario(project_id, scenarioData);
  const scenarioId = createResponse?.data?.id;

  if (!scenarioId) {
    throw new Error('Failed to create scenario: ID not found in response.');
  }
  
  let tagsWereAdded = false;
  let stepsWereAdded = false;
  
  // If tags are provided, add them to the scenario
  if (tags && tags.length > 0) {
    log(LogLevel.INFO, `Adding tags to scenario ID: ${scenarioId}`);
    await addTagsToScenario(project_id, scenarioId, tags);
    tagsWereAdded = true;
  }
  
  // If steps are provided, update the scenario with the generated definition
  if (steps && steps.length > 0) {
    log(LogLevel.INFO, `Adding steps to scenario ID: ${scenarioId}`);
    const definition = stepsToScenarioDefinition(name, steps);
    const updateData = {
      data: {
        type: "scenarios",
        id: scenarioId,
        attributes: { definition: definition }
      }
    };
    await updateScenario(project_id, scenarioId, updateData);
    stepsWereAdded = true;
  }
  
  // If tags or steps were added, fetch the updated scenario 
  if (tagsWereAdded || stepsWereAdded) {
    log(LogLevel.DEBUG, `Fetching updated scenario ${scenarioId} after adding tags/steps.`);
    const updatedData = await getScenario(project_id, scenarioId, true); 
    const formattedData = formatScenariosInResponse(updatedData);
    return createSuccessResponse(formattedData);
  }
  
  // If no tags or steps added, format and return the initial creation response
  log(LogLevel.DEBUG, `Returning initial create response for scenario ${scenarioId}.`);
  const formattedCreateResponse = formatScenariosInResponse(createResponse);
  return createSuccessResponse(formattedCreateResponse);
}

/**
 * Handle the update_scenario tool
 */
// Use inferred type from Zod schema
export async function handleUpdateScenario(input: z.infer<typeof UpdateScenarioSchema>): Promise<any> {
  const { project_id, scenario_id, name, description, folder_id, steps, definition, tags } = input;
  
  let needsAttributeUpdate = false;
  const updateData: any = {
    data: {
      type: "scenarios",
      id: scenario_id,
      attributes: {}
    }
  };
  
  // Add attributes if provided
  if (name) {
    updateData.data.attributes.name = name;
    needsAttributeUpdate = true;
  }
  if (description !== undefined) { // Check for undefined to allow clearing description
    updateData.data.attributes.description = description;
    needsAttributeUpdate = true;
  }
  if (folder_id) {
    updateData.data.attributes["folder-id"] = folder_id;
    needsAttributeUpdate = true;
  }
  
  // Handle definition from steps or direct definition
  if (steps && steps.length > 0) {
    let scenarioName = name;
    if (!scenarioName) {
      log(LogLevel.DEBUG, `Fetching scenario ${scenario_id} to get name for step generation.`);
      const existingScenario = await getScenario(project_id, scenario_id, false);
      scenarioName = existingScenario?.data?.attributes?.name;
      if (!scenarioName) {
        throw new Error(`Could not determine scenario name for step generation (Scenario ID: ${scenario_id})`);
      }
    }
    const generatedDefinition = stepsToScenarioDefinition(scenarioName, steps);
    updateData.data.attributes.definition = generatedDefinition;
    needsAttributeUpdate = true;
  } else if (definition) { // Use explicit definition if provided (and steps are not)
    updateData.data.attributes.definition = definition;
    needsAttributeUpdate = true;
  }
  
  let tagsWereAdded = false;
  let updateResponse: any = null;
  
  // Perform attribute update if necessary
  if (needsAttributeUpdate && Object.keys(updateData.data.attributes).length > 0) {
    log(LogLevel.INFO, `Updating scenario attributes for ID: ${scenario_id} in project ID: ${project_id}`);
    updateResponse = await updateScenario(project_id, scenario_id, updateData);
  } 
  
  // Add tags if provided
  if (tags && tags.length > 0) {
    log(LogLevel.INFO, `Adding tags to scenario ID: ${scenario_id}`);
    await addTagsToScenario(project_id, scenario_id, tags); 
    tagsWereAdded = true;
  }
  
  // Check if any action was taken
  if (!needsAttributeUpdate && !tagsWereAdded) {
    throw new Error("No attributes or tags provided for update.");
  }
  
  // Determine response
  if (tagsWereAdded) {
    log(LogLevel.DEBUG, `Fetching updated scenario ${scenario_id} after adding tags.`);
    const updatedData = await getScenario(project_id, scenario_id, true); 
    const formattedData = formatScenariosInResponse(updatedData);
    return createSuccessResponse(formattedData);
  } else if (updateResponse) {
    log(LogLevel.DEBUG, `Returning response from attribute update for scenario ${scenario_id}.`);
    const formattedUpdateResponse = formatScenariosInResponse(updateResponse);
    return createSuccessResponse(formattedUpdateResponse);
  } else {
     // Fallback: should not happen if logic above is correct
    log(LogLevel.WARN, `Update scenario reached unexpected state for scenario ${scenario_id}. Fetching current state.`);
    const currentData = await getScenario(project_id, scenario_id, true);
    return createSuccessResponse(formatScenariosInResponse(currentData));
  }
}

/**
 * Handle the add_tag tool
 */
// Use inferred type from Zod schema
export async function handleAddTag(input: z.infer<typeof AddTagToScenarioSchema>): Promise<any> {
  const { project_id, scenario_id, key, value } = input;

  log(LogLevel.INFO, `Adding tag ${key}:${value} to scenario ID: ${scenario_id} in project ID: ${project_id}`);
  await addTagToScenario(project_id, scenario_id, key, value);
  
  log(LogLevel.DEBUG, `Fetching scenario ${scenario_id} after adding tag.`);
  const updatedData = await getScenario(project_id, scenario_id, true);
  return createSuccessResponse(formatScenariosInResponse(updatedData));
}

/**
 * Handle the add_tags tool
 */
// Use inferred type from Zod schema
export async function handleAddTags(input: z.infer<typeof AddTagsToScenarioSchema>): Promise<any> {
  const { project_id, scenario_id, tags } = input;
  
  log(LogLevel.INFO, `Adding ${tags.length} tags to scenario ID: ${scenario_id} in project ID: ${project_id}`);
  await addTagsToScenario(project_id, scenario_id, tags);
  
  log(LogLevel.DEBUG, `Fetching scenario ${scenario_id} after adding tags.`);
  const updatedData = await getScenario(project_id, scenario_id, true);
  return createSuccessResponse(formatScenariosInResponse(updatedData));
}

/**
 * Handle the update_tag tool
 */
// Use inferred type from Zod schema
export async function handleUpdateTag(input: z.infer<typeof UpdateTagSchema>): Promise<any> {
  const { project_id, scenario_id, tag_id, key, value } = input;
   
  log(LogLevel.INFO, `Updating tag ID: ${tag_id} on scenario ID: ${scenario_id} in project ID: ${project_id}`);
  await updateTag(project_id, scenario_id, tag_id, key, value);
  
  log(LogLevel.DEBUG, `Fetching scenario ${scenario_id} after updating tag ${tag_id}.`);
  const updatedData = await getScenario(project_id, scenario_id, true);
  return createSuccessResponse(formatScenariosInResponse(updatedData));
}

/**
 * Handle the delete_tag tool
 */
// Use inferred type from Zod schema
export async function handleDeleteTag(input: z.infer<typeof DeleteTagSchema>): Promise<any> {
  const { project_id, scenario_id, tag_id } = input;

  log(LogLevel.INFO, `Deleting tag ID: ${tag_id} from scenario ID: ${scenario_id} in project ID: ${project_id}`);
  await deleteTag(project_id, scenario_id, tag_id);
  
  log(LogLevel.DEBUG, `Fetching scenario ${scenario_id} after deleting tag ${tag_id}.`);
  const updatedData = await getScenario(project_id, scenario_id, true);
  return createSuccessResponse(formatScenariosInResponse(updatedData));
}

/**
 * Handle the delete_scenario tool
 */
// Use inferred type from Zod schema
export async function handleDeleteScenario(input: z.infer<typeof DeleteScenarioSchema>): Promise<any> {
  const { project_id, scenario_id } = input;

  log(LogLevel.INFO, `Deleting scenario ID: ${scenario_id} from project ID: ${project_id}`);
  await deleteScenario(project_id, scenario_id);
  
  return createSuccessResponse({ 
    success: true,
    message: `Successfully deleted scenario ${scenario_id} from project ${project_id}`
  });
}

/**
 * Handle the get_folders tool
 */
// Use inferred type from Zod schema
export async function handleGetFolders(input: z.infer<typeof GetFoldersSchema>): Promise<any> {
  log(LogLevel.INFO, `Fetching folders for project ID: ${input.project_id}`);
  const data = await getFolders(input.project_id);
  
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
}

/**
 * Handle the create_folder tool
 */
// Use inferred type from Zod schema
export async function handleCreateFolder(input: z.infer<typeof CreateFolderSchema>): Promise<any> {
  const { project_id, name, parent_id } = input;
  
  log(LogLevel.INFO, `Creating folder "${name}" in project ID: ${project_id}`);
  const data = await createFolder(project_id, name, parent_id);
  return createSuccessResponse(data);
}

/**
 * Handle the update_folder tool
 */
// Use inferred type from Zod schema
export async function handleUpdateFolder(input: z.infer<typeof UpdateFolderSchema>): Promise<any> {
  const { project_id, folder_id, name, description, definition, parent_id } = input;
    
  // Check if at least one attribute is provided for update
  if (name === undefined && description === undefined && definition === undefined && parent_id === undefined) {
    throw new Error("No attributes provided for update. Please provide at least one attribute (name, description, definition, parent_id) to update.");
  }
  
  log(LogLevel.INFO, `Updating folder ID: ${folder_id} in project ID: ${project_id}`);
  const data = await updateFolder(project_id, folder_id, name, description, definition, parent_id);
  return createSuccessResponse(data);
}

/**
 * Handle the delete_folder tool
 */
// Use inferred type from Zod schema
export async function handleDeleteFolder(input: z.infer<typeof DeleteFolderSchema>): Promise<any> {
  const { project_id, folder_id } = input;
    
  log(LogLevel.INFO, `Deleting folder ID: ${folder_id} from project ID: ${project_id}`);
  await deleteFolder(project_id, folder_id);
  
  return createSuccessResponse({ 
    success: true,
    message: `Successfully deleted folder ${folder_id} from project ${project_id}`
  });
} 