// src/index.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerJiraTools } from "./tools/jira.js";
import { registerConfluenceTools } from "./tools/confluence.js";
import { registerBitbucketTools } from "./tools/bitbucket.js";
import { registerGoogleDriveTools } from "./tools/googleDrive.js";
import { registerNotionTools } from "./tools/notion.js";
import { registerGithubTools } from "./tools/github.js";

const server = new McpServer({
    name: "C to the Prime MCP Server",
    version: "1.0.0"
});

registerJiraTools(server);
registerConfluenceTools(server);
registerBitbucketTools(server);
registerGoogleDriveTools(server);
registerNotionTools(server);
registerGithubTools(server);

// Start MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
