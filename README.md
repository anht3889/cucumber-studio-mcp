# Cucumber Studio MCP

MCP (Model Context Protocol) server for integrating Cucumber Studio with AI assistants. This integration allows AI assistants to interact with Cucumber Studio to manage BDD scenarios, projects, folders, and tags.

## Features

- **Comprehensive BDD Management**: Access and manage your Cucumber Studio projects, scenarios, folders, and tags
- **Read-Only Mode**: Optional protection to prevent accidental modifications to your BDD assets
- **Caching Support**: Improved performance with configurable caching
- **Detailed Logging**: Configurable logging levels for troubleshooting
- **API Coverage**: Coverage of essential Cucumber Studio operations

## Tools

### Read-Only Tools (available in all modes)

1. `cucumber_studio_get_projects`
   - Get all projects from Cucumber Studio
   - Inputs:
     - None
   - Returns: List of all accessible projects

2. `cucumber_studio_get_project`
   - Get a specific project by ID
   - Inputs:
     - `project_id` (string): ID of the project to retrieve
   - Returns: Project details including name, description, and metadata

3. `cucumber_studio_get_scenarios`
   - Get all scenarios from a project
   - Inputs:
     - `project_id` (string): ID of the project
     - `include_tags` (optional boolean): Whether to include tags in the response (default: true)
   - Returns: List of scenarios in the project

4. `cucumber_studio_get_scenario`
   - Get a specific scenario by ID
   - Inputs:
     - `project_id` (string): ID of the project
     - `scenario_id` (string): ID of the scenario
     - `include_tags` (optional boolean): Whether to include tags (default: true)
   - Returns: Scenario details including steps, tags, and metadata

5. `cucumber_studio_find_scenarios_by_tags`
   - Find scenarios with specific tags
   - Inputs:
     - `project_id` (string): ID of the project
     - `tag_key` (string): The tag key to search for
     - `tag_value` (string): The tag value to search for
     - `include_tags` (optional boolean): Whether to include tags (default: true)
   - Returns: List of matching scenarios

6. `cucumber_studio_get_folders`
   - Get all folders from a project
   - Inputs:
     - `project_id` (string): ID of the project
   - Returns: List of folders in the project

### Write Tools (blocked in read-only mode)

7. `cucumber_studio_create_scenario`
   - Create a new scenario
   - Inputs:
     - `project_id` (string): ID of the project
     - `name` (string): Name of the scenario
     - `description` (optional string): Description
     - `folder_id` (optional string): ID of the folder
     - `steps` (optional array): Steps for the scenario
     - `tags` (optional array): Tags to add to the scenario
   - Returns: Created scenario details

8. `cucumber_studio_update_scenario`
   - Update an existing scenario
   - Inputs:
     - `project_id` (string): ID of the project
     - `scenario_id` (string): ID of the scenario to update
     - `name` (optional string): New name
     - `description` (optional string): New description
     - `folder_id` (optional string): New folder ID
     - `steps` or `definition` (optional): New steps or definition
     - `tags` (optional array): New tags
   - Returns: Updated scenario details

9. `cucumber_studio_delete_scenario`
   - Delete a scenario
   - Inputs:
     - `project_id` (string): ID of the project
     - `scenario_id` (string): ID of the scenario to delete
   - Returns: Operation result

10. `cucumber_studio_add_tag`
    - Add a tag to a scenario
    - Inputs:
      - `project_id` (string): ID of the project
      - `scenario_id` (string): ID of the scenario
      - `key` (string): Tag key
      - `value` (string): Tag value
    - Returns: Added tag details

11. `cucumber_studio_add_tags`
    - Add multiple tags to a scenario
    - Inputs:
      - `project_id` (string): ID of the project
      - `scenario_id` (string): ID of the scenario
      - `tags` (array): Tags to add, each with `key` and `value`
    - Returns: Operation result

12. `cucumber_studio_update_tag`
    - Update an existing tag
    - Inputs:
      - `project_id` (string): ID of the project
      - `scenario_id` (string): ID of the scenario
      - `tag_id` (string): ID of the tag to update
      - `key` (string): New tag key
      - `value` (string): New tag value
    - Returns: Updated tag details

13. `cucumber_studio_delete_tag`
    - Delete a tag from a scenario
    - Inputs:
      - `project_id` (string): ID of the project
      - `scenario_id` (string): ID of the scenario
      - `tag_id` (string): ID of the tag to delete
    - Returns: Operation result

14. `cucumber_studio_create_folder`
    - Create a new folder
    - Inputs:
      - `project_id` (string): ID of the project
      - `name` (string): Name of the folder
      - `parent_id` (optional number): ID of the parent folder
    - Returns: Created folder details

15. `cucumber_studio_update_folder`
    - Update an existing folder
    - Inputs:
      - `project_id` (string): ID of the project
      - `folder_id` (string): ID of the folder to update
      - `name` (optional string): New folder name
      - `description` (optional string): New description
      - `definition` (optional string): New definition
      - `parent_id` (optional number): New parent folder ID
    - Returns: Updated folder details

16. `cucumber_studio_delete_folder`
    - Delete a folder
    - Inputs:
      - `project_id` (string): ID of the project
      - `folder_id` (string): ID of the folder to delete
    - Returns: Operation result

### Required Credentials
To use Cucumber Studio MCP, you need to obtain the following credentials:

1. **Access Token**: Your Cucumber Studio API access token
2. **Client ID**: Your Cucumber Studio client identifier
3. **User ID**: Your Cucumber Studio user email/ID

These can be obtained from your Cucumber Studio account settings.

## Environment Variables

- `CUCUMBER_STUDIO_ACCESS_TOKEN` (required): Your Cucumber Studio API access token
- `CUCUMBER_STUDIO_CLIENT_ID` (required): Your Cucumber Studio client identifier
- `CUCUMBER_STUDIO_UID` (required): Your Cucumber Studio user email/ID

### Optional Environment Variables

```bash
# API Configuration
CUCUMBER_STUDIO_BASE_URL=https://studio.cucumberstudio.com/api  # Default URL

# Access Control
CUCUMBER_STUDIO_READ_ONLY_MODE=true  # Default: false

# Logging Configuration
CUCUMBER_STUDIO_LOG_LEVEL=info  # Options: error, warn, info, debug
CUCUMBER_STUDIO_ENABLE_REQUEST_LOGGING=true  # Default: true
CUCUMBER_STUDIO_ENABLE_RESPONSE_LOGGING=false  # Default: false
CUCUMBER_STUDIO_LOG_DIR=./logs  # Directory for log files

# Performance
CUCUMBER_STUDIO_ENABLE_CACHE=true  # Default: true
CUCUMBER_STUDIO_CACHE_TTL_SECONDS=120  # Default: 120 seconds
CUCUMBER_STUDIO_REQUEST_TIMEOUT_MS=30000  # Default: 30 seconds
```

## Setup

### Usage with Claude and other AI assistants

The MCP server can be integrated with AI assistants that support the Model Context Protocol, enabling them to interact with your Cucumber Studio projects and scenarios.

```json
{
  "mcpServers": {
    "cucumber-studio": {
      "command": "npx",
      "args": [
        "-y",
        "@anht3889/cucumber-studio-mcp"
      ],
      "env": {
        "CUCUMBER_STUDIO_ACCESS_TOKEN": "<YOUR_ACCESS_TOKEN>",
        "CUCUMBER_STUDIO_CLIENT_ID": "<YOUR_CLIENT_ID>",
        "CUCUMBER_STUDIO_UID": "<YOUR_UID>",
        "CUCUMBER_STUDIO_READ_ONLY_MODE": "< true / false>"
      }
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run with inspector for debugging
npm run inspect

# Run the inspector against the live npm package
npm run inspect-live
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

## Author

Anh Tran 