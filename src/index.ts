// src/index.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import 'dotenv/config';

const server = new McpServer({
    name: "Jira + Confluence MCP Server",
    version: "1.0.0"
});

const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL!;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN!;
const ATLASSIAN_BASE_URL = process.env.ATLASSIAN_BASE_URL!;

const jiraAuthHeader = {
    Authorization: `Basic ${Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64')}`,
    'Content-Type': 'application/json'
};

// === JIRA TOOLS ===

// Get Jira Ticket by Key
server.tool("get-ticket", { key: z.string() }, async ({ key }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}`, { headers: jiraAuthHeader });
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
    const transitionsResponse = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/transitions`, { headers: jiraAuthHeader });
    const transitionsData = await transitionsResponse.json();
    const transition = transitionsData.transitions.find((t: any) => t.name.toLowerCase() === status.toLowerCase());
    if (!transition) {
        return { content: [{ type: "text", text: `Status \"${status}\" not found for ticket ${key}.` }] };
    }
    await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/transitions`, {
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
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue`, {
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
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to query tickets with JQL. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const ticketsList = data.issues.map((issue: any) => `${issue.key}: ${issue.fields.summary} (${issue.fields.status.name})`).join("\n");
    return { content: [{ type: "text", text: ticketsList || "No tickets found." }] };
});

// Add comment to a Jira Ticket
server.tool("add-comment", { key: z.string(), comment: z.string() }, async ({ key, comment }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/comment`, {
        method: "POST",
        headers: jiraAuthHeader,
        body: JSON.stringify({
            body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }] }
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to add comment to ticket ${key}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Comment added to ticket ${key} successfully.` }] };
});

// Retrieve all comments on a ticket
server.tool("get-comments", { key: z.string() }, async ({ key }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/comment`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to retrieve comments for ticket ${key}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const commentsList = data.comments.map((c: any) => `- (${c.id}) ${c.author.displayName}: ${c.body.content[0]?.content[0]?.text ?? ''}`).join("\n");
    return { content: [{ type: "text", text: commentsList || "No comments found." }] };
});

// Edit a comment on a ticket
server.tool("edit-comment", { key: z.string(), commentId: z.string(), comment: z.string() }, async ({ key, commentId, comment }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/comment/${commentId}`, {
        method: "PUT",
        headers: jiraAuthHeader,
        body: JSON.stringify({
            body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }] }
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to edit comment ${commentId} on ticket ${key}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Comment ${commentId} edited successfully on ticket ${key}.` }] };
});

// Delete a comment on a ticket
server.tool("delete-comment", { key: z.string(), commentId: z.string() }, async ({ key, commentId }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/comment/${commentId}`, {
        method: "DELETE",
        headers: jiraAuthHeader
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to delete comment ${commentId} on ticket ${key}. Status: ${response.status}` }] };
    }
    return { content: [{ type: "text", text: `Comment ${commentId} deleted successfully on ticket ${key}.` }] };
});

// Smart Assign Ticket by Name
server.tool("smart-assign-ticket", {
    key: z.string(),
    assigneeName: z.string()
}, async ({ key, assigneeName }) => {
    // Extract project key from issue key
    const projectKey = key.split("-")[0];

    // Fetch assignable users
    const usersResponse = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/user/assignable/search?project=${projectKey}`, { headers: jiraAuthHeader });
    if (!usersResponse.ok) {
        const errorText = await usersResponse.text();
        return { content: [{ type: "text", text: `Failed to fetch assignable users for project ${projectKey}. Status: ${usersResponse.status}. Details: ${errorText}` }] };
    }
    const users = await usersResponse.json();
    if (!users || users.length === 0) {
        return { content: [{ type: "text", text: `No assignable users found for project ${projectKey}.` }] };
    }

    // Find matching user
    const matchingUser = users.find((user: any) =>
        user.displayName.toLowerCase().includes(assigneeName.toLowerCase())
    );

    if (!matchingUser) {
        const userList = users.map((u: any) => u.displayName).join(", ");
        return { content: [{ type: "text", text: `User "${assigneeName}" not found in assignable users for project ${projectKey}. Available users: ${userList}` }] };
    }

    // Assign ticket using accountId
    const assignResponse = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/assignee`, {
        method: "PUT",
        headers: jiraAuthHeader,
        body: JSON.stringify({ accountId: matchingUser.accountId })
    });
    if (!assignResponse.ok) {
        const errorText = await assignResponse.text();
        return { content: [{ type: "text", text: `Failed to assign ${key} to ${matchingUser.displayName}. Status: ${assignResponse.status}. Details: ${errorText}` }] };
    }

    return { content: [{ type: "text", text: `✅ Ticket ${key} assigned to ${matchingUser.displayName} successfully.` }] };
});

// Delete a Jira Ticket
server.tool("delete-ticket", { key: z.string() }, async ({ key }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}`, {
        method: "DELETE",
        headers: jiraAuthHeader
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to delete ticket ${key}. Status: ${response.status}` }] };
    }
    return { content: [{ type: "text", text: `Ticket ${key} deleted successfully.` }] };
});

// Get list of all projects
server.tool("list-projects", {}, async () => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/project/search`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch projects. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const projectList = data.values.map((p: any) => `${p.key}: ${p.name}`).join("\n");
    return { content: [{ type: "text", text: projectList }] };
});

// List issue types for a project
server.tool("list-issue-types", { projectKey: z.string() }, async ({ projectKey }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch issue types for ${projectKey}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const types = data.projects[0].issuetypes.map((t: any) => t.name).join(", ");
    return { content: [{ type: "text", text: `Issue types for ${projectKey}: ${types}` }] };
});

// Attach file to a Jira ticket
server.tool("attach-file", { key: z.string(), fileName: z.string(), fileContent: z.string() }, async ({ key, fileName, fileContent }) => {
    const boundary = "--------------------------" + Date.now();
    const body = `--${boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"${fileName}\"\r\nContent-Type: application/octet-stream\r\n\r\n${fileContent}\r\n--${boundary}--`;
    const headers = {
        Authorization: jiraAuthHeader.Authorization,
        'X-Atlassian-Token': 'no-check',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
    };
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}/attachments`, {
        method: "POST",
        headers,
        body
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to attach file to ${key}. Status: ${response.status}` }] };
    }
    return { content: [{ type: "text", text: `File ${fileName} attached to ${key} successfully.` }] };
});

// Fetch changelog for a ticket
server.tool("get-changelog", { key: z.string() }, async ({ key }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/rest/api/3/issue/${key}?expand=changelog`, { headers: jiraAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch changelog for ${key}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const changes = data.changelog.histories.map((h: any) => {
        const when = h.created;
        const author = h.author.displayName;
        const items = h.items.map((i: any) => `${i.field}: ${i.fromString} -> ${i.toString}`).join(", ");
        return `- ${when} by ${author}: ${items}`;
    }).join("\n");
    return { content: [{ type: "text", text: changes || "No changelog entries found." }] };
});

// Add Tickets to Sprints

server.tool("add-ticket-to-sprint", {
    key: z.string(),
    boardName: z.string(),
    sprintName: z.string()
}, async ({ key, boardName, sprintName }) => {
    // Fetch all boards to find the board ID
    const boardsResponse = await fetch(`${ATLASSIAN_BASE_URL}/rest/agile/1.0/board?name=${encodeURIComponent(boardName)}`, { headers: jiraAuthHeader });
    if (!boardsResponse.ok) {
        const errorText = await boardsResponse.text();
        return { content: [{ type: "text", text: `Failed to fetch boards. Status: ${boardsResponse.status}. Details: ${errorText}` }] };
    }
    const boardsData = await boardsResponse.json();
    const board = boardsData.values.find((b: any) => b.name.toLowerCase() === boardName.toLowerCase());
    if (!board) {
        return { content: [{ type: "text", text: `Board '${boardName}' not found.` }] };
    }

    // Fetch sprints for that board
    const sprintsResponse = await fetch(`${ATLASSIAN_BASE_URL}/rest/agile/1.0/board/${board.id}/sprint`, { headers: jiraAuthHeader });
    if (!sprintsResponse.ok) {
        const errorText = await sprintsResponse.text();
        return { content: [{ type: "text", text: `Failed to fetch sprints for board ${boardName}. Status: ${sprintsResponse.status}. Details: ${errorText}` }] };
    }
    const sprintsData = await sprintsResponse.json();
    const sprint = sprintsData.values.find((s: any) => s.name.toLowerCase() === sprintName.toLowerCase());
    if (!sprint) {
        return { content: [{ type: "text", text: `Sprint '${sprintName}' not found on board '${boardName}'.` }] };
    }

    // Add the issue to the sprint
    const addIssueResponse = await fetch(`${ATLASSIAN_BASE_URL}/rest/agile/1.0/sprint/${sprint.id}/issue`, {
        method: "POST",
        headers: jiraAuthHeader,
        body: JSON.stringify({ issues: [key] })
    });
    if (!addIssueResponse.ok) {
        const errorText = await addIssueResponse.text();
        return { content: [{ type: "text", text: `Failed to add ${key} to sprint '${sprintName}'. Status: ${addIssueResponse.status}. Details: ${errorText}` }] };
    }

    return { content: [{ type: "text", text: `✅ Ticket ${key} added to sprint '${sprintName}' on board '${boardName}' successfully.` }] };
});


// === CONFLUENCE TOOLS ===

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

// === BITBUCKET TOOLS ===

const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME!;
const BITBUCKET_APP_PASSWORD = process.env.BITBUCKET_APP_PASSWORD!;
const BITBUCKET_WORKSPACE = process.env.BITBUCKET_WORKSPACE!;

const bitbucketAuthHeader = {
    Authorization: `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString('base64')}`,
    'Content-Type': 'application/json'
};

// List Repositories
server.tool("bitbucket-list-repos", {}, async () => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}`, { headers: bitbucketAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch repositories. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const repoList = data.values.map((r: any) => `${r.slug}: ${r.links.html.href}`).join("\n");
    return { content: [{ type: "text", text: repoList || "No repositories found." }] };
});

// Get Repository Details
server.tool("bitbucket-get-repo", { repoSlug: z.string() }, async ({ repoSlug }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}`, { headers: bitbucketAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch repository ${repoSlug}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    return { content: [{ type: "text", text: `Repo: ${data.full_name}\nDescription: ${data.description ?? "No description."}\nURL: ${data.links.html.href}` }] };
});

// Create Repository
server.tool("bitbucket-create-repo", { repoSlug: z.string(), isPrivate: z.boolean().default(true) }, async ({ repoSlug, isPrivate }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}`, {
        method: "POST",
        headers: bitbucketAuthHeader,
        body: JSON.stringify({ scm: "git", is_private: isPrivate })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to create repository ${repoSlug}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Repository ${repoSlug} created successfully.` }] };
});

// Delete Repository
server.tool("bitbucket-delete-repo", { repoSlug: z.string() }, async ({ repoSlug }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}`, {
        method: "DELETE",
        headers: bitbucketAuthHeader
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to delete repository ${repoSlug}. Status: ${response.status}` }] };
    }
    return { content: [{ type: "text", text: `Repository ${repoSlug} deleted successfully.` }] };
});

// List Pull Requests
server.tool("bitbucket-list-prs", { repoSlug: z.string() }, async ({ repoSlug }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}/pullrequests`, { headers: bitbucketAuthHeader });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch pull requests for ${repoSlug}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const prList = data.values.map((pr: any) => `#${pr.id} ${pr.title} [${pr.state}] - ${pr.links.html.href}`).join("\n");
    return { content: [{ type: "text", text: prList || "No pull requests found." }] };
});

// Create Pull Request
server.tool("bitbucket-create-pr", {
    repoSlug: z.string(),
    title: z.string(),
    sourceBranch: z.string(),
    destinationBranch: z.string()
}, async ({ repoSlug, title, sourceBranch, destinationBranch }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}/pullrequests`, {
        method: "POST",
        headers: bitbucketAuthHeader,
        body: JSON.stringify({
            title,
            source: { branch: { name: sourceBranch } },
            destination: { branch: { name: destinationBranch } }
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to create pull request. Status: ${response.status}. Details: ${errorText}` }] };
    }
    const data = await response.json();
    return { content: [{ type: "text", text: `Pull request #${data.id} created successfully: ${data.links.html.href}` }] };
});

// Merge Pull Request
server.tool("bitbucket-merge-pr", { repoSlug: z.string(), prId: z.string() }, async ({ repoSlug, prId }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}/pullrequests/${prId}/merge`, {
        method: "POST",
        headers: bitbucketAuthHeader
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to merge pull request #${prId}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Pull request #${prId} merged successfully.` }] };
});

// Comment on Pull Request
server.tool("bitbucket-comment-pr", { repoSlug: z.string(), prId: z.string(), comment: z.string() }, async ({ repoSlug, prId, comment }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}/pullrequests/${prId}/comments`, {
        method: "POST",
        headers: bitbucketAuthHeader,
        body: JSON.stringify({ content: { raw: comment } })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to comment on PR #${prId}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Comment added to pull request #${prId}.` }] };
});

// List Comments on Pull Request
server.tool("bitbucket-list-pr-comments", { repoSlug: z.string(), prId: z.string() }, async ({ repoSlug, prId }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}/pullrequests/${prId}/comments`, {
        headers: bitbucketAuthHeader
    });
    if (!response.ok) {
        return { content: [{ type: "text", text: `Failed to fetch comments for PR #${prId}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const commentsList = data.values.map((c: any) => `- ${c.user.display_name}: ${c.content.raw}`).join("\n");
    return { content: [{ type: "text", text: commentsList || "No comments found on this pull request." }] };
});

// Approve Pull Request
server.tool("bitbucket-approve-pr", { repoSlug: z.string(), prId: z.string() }, async ({ repoSlug, prId }) => {
    const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${BITBUCKET_WORKSPACE}/${repoSlug}/pullrequests/${prId}/approve`, {
        method: "POST",
        headers: bitbucketAuthHeader
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to approve PR #${prId}. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Pull request #${prId} approved successfully.` }] };
});

// Start MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
