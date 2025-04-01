// Schema definitions for Cucumber Studio tools
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Schema definitions
export const GetProjectSchema = z.object({
  project_id: z.string().describe("ID of the project to retrieve")
});

export const GetScenariosSchema = z.object({
  project_id: z.string().describe("ID of the project whose scenarios to retrieve"),
  include_tags: z.boolean().default(true).describe("Whether to include tags information")
});

export const GetScenarioSchema = z.object({
  project_id: z.string().describe("ID of the project the scenario belongs to"),
  scenario_id: z.string().describe("ID of the scenario to retrieve"),
  include_tags: z.boolean().default(true).describe("Whether to include tags information")
});

export const FindScenariosByTagsSchema = z.object({
  project_id: z.string().describe("ID of the project to search in"),
  tag_key: z.string().describe("The tag key to search for"),
  tag_value: z.string().describe("The tag value to search for"),
  include_tags: z.boolean().default(true).describe("Whether to include tags information")
});

// Schema for step format
const StepSchema = z.object({
  type: z.string().describe("The type of step (given, when, then, and)"),
  text: z.string().describe("The text of the step")
});

// Schema for tag format
const TagSchema = z.object({
  key: z.string().describe("The tag key"),
  value: z.string().describe("The tag value")
});

export const CreateScenarioSchema = z.object({
  project_id: z.string().describe("ID of the project to create the scenario in"),
  name: z.string().describe("Name of the scenario"),
  description: z.string().optional().describe("Description of the scenario"),
  folder_id: z.string().optional().describe("ID of the folder to place the scenario in"),
  steps: z.array(StepSchema).optional().describe("Steps for the scenario"),
  tags: z.array(TagSchema).optional().describe("Tags to add to the scenario")
});

export const UpdateScenarioSchema = z.object({
  project_id: z.string().describe("ID of the project the scenario belongs to"),
  scenario_id: z.string().describe("ID of the scenario to update"),
  name: z.string().optional().describe("New name for the scenario"),
  description: z.string().optional().describe("New description for the scenario"),
  folder_id: z.string().optional().describe("New folder ID for the scenario"),
  steps: z.array(StepSchema).optional().describe("New steps for the scenario"),
  definition: z.string().optional().describe("New definition for the scenario (alternative to steps)"),
  tags: z.array(TagSchema).optional().describe("Tags to add to the scenario")
});

export const AddTagToScenarioSchema = z.object({
  project_id: z.string().describe("ID of the project the scenario belongs to"),
  scenario_id: z.string().describe("ID of the scenario to tag"),
  key: z.string().describe("The tag key"),
  value: z.string().describe("The tag value")
});

export const AddTagsToScenarioSchema = z.object({
  project_id: z.string().describe("ID of the project the scenario belongs to"),
  scenario_id: z.string().describe("ID of the scenario to tag"),
  tags: z.array(TagSchema).describe("Tags to add to the scenario")
});

export const UpdateTagSchema = z.object({
  project_id: z.string().describe("ID of the project the scenario belongs to"),
  scenario_id: z.string().describe("ID of the scenario containing the tag"),
  tag_id: z.string().describe("ID of the tag to update"),
  key: z.string().describe("The updated tag key"),
  value: z.string().describe("The updated tag value")
});

export const DeleteTagSchema = z.object({
  project_id: z.string().describe("ID of the project the scenario belongs to"),
  scenario_id: z.string().describe("ID of the scenario containing the tag"),
  tag_id: z.string().describe("ID of the tag to delete")
});

export const DeleteScenarioSchema = z.object({
  project_id: z.string().describe("ID of the project the scenario belongs to"),
  scenario_id: z.string().describe("ID of the scenario to delete")
});

export const GetFoldersSchema = z.object({
  project_id: z.string().describe("ID of the project whose folders to retrieve")
});

export const CreateFolderSchema = z.object({
  project_id: z.string().describe("ID of the project to create the folder in"),
  name: z.string().describe("Name of the folder"),
  parent_id: z.number().optional().describe("ID of the parent folder (optional)")
});

export const UpdateFolderSchema = z.object({
  project_id: z.string().describe("ID of the project the folder belongs to"),
  folder_id: z.string().describe("ID of the folder to update"),
  name: z.string().optional().describe("New name for the folder"),
  description: z.string().optional().describe("New description for the folder"),
  definition: z.string().optional().describe("New definition for the folder"),
  parent_id: z.number().optional().describe("New parent folder ID")
});

export const DeleteFolderSchema = z.object({
  project_id: z.string().describe("ID of the project the folder belongs to"),
  folder_id: z.string().describe("ID of the folder to delete")
});

// Tool definitions for registration with MCP
export const TOOL_DEFINITIONS = [
  {
    name: "cucumber_studio_get_projects",
    description: "Get all projects from Cucumber Studio",
    inputSchema: zodToJsonSchema(z.object({})),
  },
  {
    name: "cucumber_studio_get_project",
    description: "Get a specific project from Cucumber Studio by ID",
    inputSchema: zodToJsonSchema(GetProjectSchema),
  },
  {
    name: "cucumber_studio_get_scenarios",
    description: "Get all scenarios from a specified project in Cucumber Studio",
    inputSchema: zodToJsonSchema(GetScenariosSchema),
  },
  {
    name: "cucumber_studio_get_scenario",
    description: "Get a specific scenario by ID from a project in Cucumber Studio",
    inputSchema: zodToJsonSchema(GetScenarioSchema),
  },
  {
    name: "cucumber_studio_find_scenarios_by_tags",
    description: "Find scenarios in a project that have a specific tag",
    inputSchema: zodToJsonSchema(FindScenariosByTagsSchema),
  },
  {
    name: "cucumber_studio_create_scenario",
    description: "Create a new scenario in a project",
    inputSchema: zodToJsonSchema(CreateScenarioSchema),
  },
  {
    name: "cucumber_studio_update_scenario",
    description: "Update an existing scenario in a project",
    inputSchema: zodToJsonSchema(UpdateScenarioSchema),
  },
  {
    name: "cucumber_studio_add_tag",
    description: "Add a tag to a scenario",
    inputSchema: zodToJsonSchema(AddTagToScenarioSchema),
  },
  {
    name: "cucumber_studio_add_tags",
    description: "Add multiple tags to a scenario",
    inputSchema: zodToJsonSchema(AddTagsToScenarioSchema),
  },
  {
    name: "cucumber_studio_update_tag",
    description: "Update an existing tag on a scenario",
    inputSchema: zodToJsonSchema(UpdateTagSchema),
  },
  {
    name: "cucumber_studio_delete_tag",
    description: "Delete a tag from a scenario",
    inputSchema: zodToJsonSchema(DeleteTagSchema),
  },
  {
    name: "cucumber_studio_delete_scenario",
    description: "Delete a scenario from a project",
    inputSchema: zodToJsonSchema(DeleteScenarioSchema),
  },
  {
    name: "cucumber_studio_get_folders",
    description: "Get all folders from a project",
    inputSchema: zodToJsonSchema(GetFoldersSchema),
  },
  {
    name: "cucumber_studio_create_folder",
    description: "Create a new folder in a project",
    inputSchema: zodToJsonSchema(CreateFolderSchema),
  },
  {
    name: "cucumber_studio_update_folder",
    description: "Update an existing folder in a project",
    inputSchema: zodToJsonSchema(UpdateFolderSchema),
  },
  {
    name: "cucumber_studio_delete_folder",
    description: "Delete a folder from a project",
    inputSchema: zodToJsonSchema(DeleteFolderSchema),
  }
]; 