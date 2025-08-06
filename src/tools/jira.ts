import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initJiraAuth, jiraAuthHeader, ATLASSIAN_BASE_URL } from "../auth/jiraAuth.js";

export async function registerJiraTools(server: McpServer) {
    await initJiraAuth();
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
            console.error("Jira ticket creation error:", errorText);
            return { content: [{ type: "text", text: `Failed to create ticket: ${errorText}` }] };
        }
        const data = await response.json();
        return { content: [{ type: "text", text: `Ticket ${data.key} created successfully.` }] };
    });
    
    // Query tickets with JQL
    server.tool("query-tickets", { jql: z.string() }, async ({ jql }) => {
    const response = await fetch(
        `${ATLASSIAN_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,description,created,updated,priority,assignee,reporter`,
        { headers: jiraAuthHeader }
    );

    if (!response.ok) {
        return {
        content: [{ type: "text", text: `Failed to query tickets with JQL. Status: ${response.status}` }]
        };
    }

    const data = await response.json();

    if (!data.issues || data.issues.length === 0) {
        return {
        content: [{ type: "text", text: "No tickets found." }]
        };
    }

    const ticketsList = data.issues.map((issue: any) => {
        const {
        summary,
        status,
        description,
        created,
        updated,
        priority,
        assignee,
        reporter
        } = issue.fields;

        return `
    🔹 **${issue.key}**  
    - 📝 Summary: ${summary}  
    - 📌 Status: ${status.name}  
    - 🧾 Description: ${description?.content?.[0]?.content?.[0]?.text || "No description"}  
    - 📅 Created: ${new Date(created).toLocaleString()}  
    - 🕒 Updated: ${new Date(updated).toLocaleString()}  
    - 🎯 Priority: ${priority?.name || "None"}  
    - 👤 Assignee: ${assignee?.displayName || "Unassigned"}  
    - 🧑 Reporter: ${reporter?.displayName || "Unknown"}
        `.trim();
    }).join("\n\n");

    return {
        content: [{ type: "text", text: ticketsList }]
    };
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
}