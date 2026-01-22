# Vercel MCP Server

This is a custom MCP server that wraps the Vercel CLI to provide Vercel integration for AI assistants.

## Installation

The server is already built in `.agent/mcp/vercel-mcp-server`.

## Configuration

To use this with Claude Desktop or other MCP clients, add the following to your configuration file (typically `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vercel": {
      "command": "node",
      "args": [
        "C:\\projects\\hotel\\.agent\\mcp\\vercel-mcp-server\\dist\\index.js"
      ]
    }
  }
}
```

## Available Tools

- `vercel_list_projects`: List all projects.
- `vercel_list_deployments`: List recent deployments for a project.
- `vercel_inspect_logs`: View logs for a specific deployment URL.
- `vercel_list_envs`: List environment variables for a project.
