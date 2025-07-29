import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jiraAuthHeader, ATLASSIAN_BASE_URL } from "../auth/jiraAuth.js";

export function registerConfluenceTools(server: McpServer) {
    // ✅ List Confluence Pages
    server.tool("list-confluence-pages", { spaceKey: z.string() }, async ({ spaceKey }) => {
        const url = `${ATLASSIAN_BASE_URL}/wiki/rest/api/content?spaceKey=${spaceKey}&expand=body.view`;
        const response = await fetch(url, { headers: jiraAuthHeader });
        if (!response.ok) {
            const errorText = await response.text();
            return { content: [{ type: "text", text: `Failed to fetch Confluence pages for space ${spaceKey}. Status: ${response.status}. Details: ${errorText}` }] };
        }
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            return { content: [{ type: "text", text: `No Confluence pages found for space ${spaceKey}.` }] };
        }
        const pagesList = data.results.map(
            (page: any) => `- (${page.id}) ${page.title}: ${ATLASSIAN_BASE_URL}/wiki${page._links.webui}`
        ).join("\n");
        return { content: [{ type: "text", text: pagesList }] };
    });
    
    // List all spaces
    server.tool("list-confluence-spaces", {}, async () => {
        const response = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/space`, { headers: jiraAuthHeader });
        if (!response.ok) {
            return { content: [{ type: "text", text: `Failed to fetch Confluence spaces. Status: ${response.status}` }] };
        }
        const data = await response.json();
        const spacesList = data.results.map((s: any) => `${s.key}: ${s.name}`).join("\n");
        return { content: [{ type: "text", text: spacesList }] };
    });
    
    // Get Confluence page content by ID
    server.tool("get-confluence-page", { pageId: z.string() }, async ({ pageId }) => {
        const response = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/content/${pageId}?expand=body.view`, { headers: jiraAuthHeader });
        if (!response.ok) {
            return { content: [{ type: "text", text: `Failed to fetch page ${pageId}. Status: ${response.status}` }] };
        }
        const data = await response.json();
        return { content: [{ type: "text", text: `Title: ${data.title}\n\n${data.body.view.value.replace(/<[^>]+>/g, '')}` }] };
    });
    
    // Create a Confluence page
    server.tool("create-confluence-page", { spaceKey: z.string(), title: z.string(), content: z.string() }, async ({ spaceKey, title, content }) => {
        const response = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/content`, {
            method: "POST",
            headers: jiraAuthHeader,
            body: JSON.stringify({
                type: "page",
                title,
                space: { key: spaceKey },
                body: { storage: { value: content, representation: "storage" } }
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            return { content: [{ type: "text", text: `Failed to create page. Status: ${response.status}. Details: ${errorText}` }] };
        }
        const data = await response.json();
        return { content: [{ type: "text", text: `Page '${title}' created successfully: ${ATLASSIAN_BASE_URL}/wiki${data._links.webui}` }] };
    });
    
    // Summarize Jira tickets in a Confluence page automatically
    server.tool("summarize-tickets-to-confluence", {
        jql: z.string(),
        spaceKey: z.string(),
        parentPageId: z.string().optional(), // if you want to nest under a page
        pageTitle: z.string()
    }, async ({ jql, spaceKey, parentPageId, pageTitle }) => {
        // Fetch tickets
        const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}`, { headers: jiraAuthHeader });
        if (!response.ok) {
            const errorText = await response.text();
            return { content: [{ type: "text", text: `Failed to query tickets with JQL. Status: ${response.status}. Details: ${errorText}` }] };
        }
        const data = await response.json();
        if (!data.issues || data.issues.length === 0) {
            return { content: [{ type: "text", text: `No tickets found with provided JQL.` }] };
        }
    
        // Create summary
        const summary = data.issues.map(
            (issue: any) => `- **${issue.key}**: ${issue.fields.summary} _(Status: ${issue.fields.status.name})_`
        ).join("\n");
    
        // Create Confluence page
        const createPageResponse = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/content`, {
            method: "POST",
            headers: jiraAuthHeader,
            body: JSON.stringify({
                type: "page",
                title: pageTitle,
                space: { key: spaceKey },
                ancestors: parentPageId ? [{ id: parentPageId }] : undefined,
                body: {
                    storage: {
                        value: `<h1>${pageTitle}</h1><p>Auto-generated Jira summary:</p><pre>${summary}</pre>`,
                        representation: "storage"
                    }
                }
            })
        });
        if (!createPageResponse.ok) {
            const errorText = await createPageResponse.text();
            return { content: [{ type: "text", text: `Failed to create Confluence page. Status: ${createPageResponse.status}. Details: ${errorText}` }] };
        }
        const pageData = await createPageResponse.json();
        const pageUrl = `${ATLASSIAN_BASE_URL}/wiki${pageData._links.webui}`;
    
        return {
            content: [{ type: "text", text: `✅ Confluence page "${pageTitle}" created with Jira summary:\n${pageUrl}` }]
        };
    });
}