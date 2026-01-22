import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Create server instance
const server = new McpServer({
  name: "vercel-mcp-server",
  version: "1.0.0",
});

async function execVercelCommand(command: string): Promise<any> {
  try {
    // Add --yes to avoid interactive prompts where possible, though list commands usually don't need it.
    // For list commands, we want JSON output if available, but Vercel CLI JSON support varies.
    // 'vercel project ls' does not natively support --json in all versions, careful here.
    // We will try running plain commands first.
    
    const { stdout, stderr } = await execAsync(`vercel ${command}`, {
        // Increase max buffer for logs
        maxBuffer: 1024 * 1024 * 10 
    });
    
    return {
        stdout: stdout.trim(),
        stderr: stderr.trim()
    };
  } catch (error: any) {
    return {
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

// Tool: List Projects
server.tool(
  "vercel_list_projects",
  "List projects in the authenticated Vercel account",
  {},
  async () => {
    const result = await execVercelCommand("project ls");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool: List Deployments
server.tool(
  "vercel_list_deployments",
  "List deployments for a specific project",
  {
    projectName: z.string().describe("The name of the project to list deployments for"),
    limit: z.number().optional().describe("Number of deployments to list (default 20)")
  },
  async ({ projectName, limit }) => {
    const cmd = `deployment ls ${projectName} ${limit ? `--limit ${limit}` : ''}`;
    const result = await execVercelCommand(cmd);
    return {
      content: [{ type: "text", text: "Deployments:\n" + result.stdout }],
    };
  }
);

// Tool: Inspect Logs
server.tool(
  "vercel_inspect_logs",
  "Get logs for a specific deployment URL",
  {
    deploymentUrl: z.string().describe("The URL of the deployment to inspect (e.g. my-app-123.vercel.app)")
  },
  async ({ deploymentUrl }) => {
    // logs need user confirmation unless we handle it carefully, 
    // but standard logs command just prints.
    const result = await execVercelCommand(`logs ${deploymentUrl}`);
    return {
      content: [{ type: "text", text: result.stdout || result.stderr || "No logs found or error occurred." }],
    };
  }
);

// Tool: List Environment Variables
server.tool(
    "vercel_list_envs",
    "List environment variables for a project (Development, Preview, Production)",
    {
        projectName: z.string().describe("The project name")
    },
    async ({ projectName }) => {
        const result = await execVercelCommand(`env ls ${projectName}`);
        return {
            content: [{ type: "text", text: result.stdout }]
        };
    }
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vercel MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main loop:", error);
  process.exit(1);
});
