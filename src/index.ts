// src/index.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import 'dotenv/config';

const server = new McpServer({
    name: "Jira MCP Server",
    version: "1.0.0"
});

const JIRA_EMAIL = process.env.JIRA_EMAIL!;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;

const jiraAuthHeader = {
    Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
    'Content-Type': 'application/json'
};

// Get Jira Ticket by Key
server.tool("get-ticket", { key: z.string() }, async ({ key }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch ticket ${key}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    return {
        content: [{
            type: "text",
            text: `Ticket ${key}: ${data.fields.summary}\nStatus: ${data.fields.status.name}\nDescription: ${data.fields.description?.content?.[0]?.content?.[0]?.text ?? 'No description.'}`
        }]
    };
});

// Update Jira Ticket Status
server.tool("update-ticket-status", { key: z.string(), status: z.string() }, async ({ key, status }) => {
    const transitionsResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/transitions`, { headers: jiraAuthHeader });
    const transitionsData = await transitionsResponse.json();
    const transition = transitionsData.transitions.find((t: any) => t.name.toLowerCase() === status.toLowerCase());
    if (!transition) {
        return { content: [{ type: "text", text: `Status "${status}" not found for ticket ${key}.` }] };
    }
    await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/transitions`, {
        method: "POST",
        headers: jiraAuthHeader,
        body: JSON.stringify({ transition: { id: transition.id } })
    });
    return { content: [{ type: "text", text: `Ticket ${key} transitioned to ${status}.` }] };
});

// Create Jira Ticket with ADF description
server.tool("create-ticket", {
    projectKey: z.string(),
    summary: z.string(),
    description: z.string(),
    issueType: z.string().default("Task")
}, async ({ projectKey, summary, description, issueType }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
        method: "POST",
        headers: jiraAuthHeader,
        body: JSON.stringify({
            fields: {
                project: { key: projectKey },
                summary,
                description: {
                    type: "doc",
                    version: 1,
                    content: [{ type: "paragraph", content: [{ type: "text", text: description }] }]
                },
                issuetype: { name: issueType }
            }
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to create ticket: ${errorText}` }] };
    }
    const data = await response.json();
    return { content: [{ type: "text", text: `Ticket ${data.key} created successfully.` }] };
});

// Query tickets with JQL
server.tool("query-tickets", { jql: z.string() }, async ({ jql }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to query tickets with JQL. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const ticketsList = data.issues.map((issue: any) => `${issue.key}: ${issue.fields.summary} (${issue.fields.status.name})`).join("\n");
    return { content: [{ type: "text", text: ticketsList || "No tickets found." }] };
});

// Add comment to a Jira Ticket
server.tool("add-comment", { key: z.string(), comment: z.string() }, async ({ key, comment }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/comment`, {
        method: "POST",
        headers: jiraAuthHeader,
        body: JSON.stringify({
            body: {
                type: "doc",
                version: 1,
                content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }]
            }
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to add comment to ticket ${key}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Comment added to ticket ${key} successfully.` }] };
});

// ✅ Retrieve all comments on a ticket
server.tool("get-comments", { key: z.string() }, async ({ key }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/comment`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to retrieve comments for ticket ${key}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const commentsList = data.comments.map((c: any) => `- (${c.id}) ${c.author.displayName}: ${c.body.content[0]?.content[0]?.text ?? ''}`).join("\n");
    return { content: [{ type: "text", text: commentsList || "No comments found." }] };
});

// ✅ Edit a comment on a ticket
server.tool("edit-comment", { key: z.string(), commentId: z.string(), comment: z.string() }, async ({ key, commentId, comment }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/comment/${commentId}`, {
        method: "PUT",
        headers: jiraAuthHeader,
        body: JSON.stringify({
            body: {
                type: "doc",
                version: 1,
                content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }]
            }
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to edit comment ${commentId} on ticket ${key}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Comment ${commentId} edited successfully on ticket ${key}.` }] };
});

// ✅ Delete a comment on a ticket
server.tool("delete-comment", { key: z.string(), commentId: z.string() }, async ({ key, commentId }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/comment/${commentId}`, {
        method: "DELETE",
        headers: jiraAuthHeader
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to delete comment ${commentId} on ticket ${key}. Status: ${response.status}` }] };
    }
    return { content: [{ type: "text", text: `Comment ${commentId} deleted successfully on ticket ${key}.` }] };
});

// Assign a Jira Ticket
server.tool("assign-ticket", { key: z.string(), assignee: z.string() }, async ({ key, assignee }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/assignee`, {
        method: "PUT",
        headers: jiraAuthHeader,
        body: JSON.stringify({ name: assignee })
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to assign ${key} to ${assignee}. Status: ${response.status}` }] };
    }
    return { content: [{ type: "text", text: `Ticket ${key} assigned to ${assignee}.` }] };
});

// Delete a Jira Ticket
server.tool("delete-ticket", { key: z.string() }, async ({ key }) => {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}`, {
        method: "DELETE",
        headers: jiraAuthHeader
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to delete ticket ${key}. Status: ${response.status}` }] };
    }
    return { content: [{ type: "text", text: `Ticket ${key} deleted successfully.` }] };
});

// Greeting resource for MCP testing
server.resource("greeting", new ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, { name }) => ({
    contents: [{ uri: uri.href, text: `Hello, ${name}!` }]
}));

// Start MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
