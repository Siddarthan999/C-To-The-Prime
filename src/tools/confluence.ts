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
      return {
        content: [{ type: "text", text: `Failed to fetch Confluence pages for space ${spaceKey}. Status: ${response.status}. Details: ${errorText}` }],
      };
    }
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return {
        content: [{ type: "text", text: `No Confluence pages found for space ${spaceKey}.` }],
      };
    }
    const pagesList = data.results.map(
      (page: any) => `- (${page.id}) ${page.title}: ${ATLASSIAN_BASE_URL}/wiki${page._links.webui}`
    ).join("\n");

    return {
      content: [{ type: "text", text: pagesList }],
    };
  });

  // ✅ List All Spaces
  server.tool("list-confluence-spaces", {}, async () => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/space`, { headers: jiraAuthHeader });
    if (!response.ok) {
      return { content: [{ type: "text", text: `Failed to fetch Confluence spaces. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const spacesList = data.results.map((s: any) => `${s.key}: ${s.name}`).join("\n");
    return { content: [{ type: "text", text: spacesList }] };
  });

  // ✅ Get Confluence Page Content
  server.tool("get-confluence-page", { pageId: z.string() }, async ({ pageId }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/content/${pageId}?expand=body.view`, { headers: jiraAuthHeader });
    if (!response.ok) {
      return { content: [{ type: "text", text: `Failed to fetch page ${pageId}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const plainText = data.body.view.value.replace(/<[^>]+>/g, '');

    return {
      content: [{ type: "text", text: `Title: ${data.title}\n\n${plainText}` }],
    };
  });

  // ✅ Create Confluence Page
  server.tool("create-confluence-page", {
    spaceKey: z.string(),
    title: z.string(),
    content: z.string()
  }, async ({ spaceKey, title, content }) => {
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

  // ✅ Summarize Jira Tickets into Confluence
  server.tool("summarize-tickets-to-confluence", {
    jql: z.string(),
    spaceKey: z.string(),
    parentPageId: z.string().optional(),
    pageTitle: z.string()
  }, async ({ jql, spaceKey, parentPageId, pageTitle }) => {
    const response = await fetch(
      `${ATLASSIAN_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,description,created,updated,priority,assignee,reporter`,
      { headers: jiraAuthHeader }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [{ type: "text", text: `Failed to query tickets with JQL. Status: ${response.status}. Details: ${errorText}` }]
      };
    }

    const data = await response.json();
    if (!data.issues || data.issues.length === 0) {
      return {
        content: [{ type: "text", text: `No tickets found with provided JQL.` }]
      };
    }

    // Build formatted HTML
    const summary = data.issues.map((issue: any) => {
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

      const descText = description?.content?.[0]?.content?.[0]?.text || "No description";

      return `
        <h3>${issue.key}: ${summary}</h3>
        <ul>
          <li><strong>Status:</strong> ${status.name}</li>
          <li><strong>Description:</strong> ${descText}</li>
          <li><strong>Created:</strong> ${new Date(created).toLocaleString()}</li>
          <li><strong>Updated:</strong> ${new Date(updated).toLocaleString()}</li>
          <li><strong>Priority:</strong> ${priority?.name || "None"}</li>
          <li><strong>Assignee:</strong> ${assignee?.displayName || "Unassigned"}</li>
          <li><strong>Reporter:</strong> ${reporter?.displayName || "Unknown"}</li>
        </ul>
      `;
    }).join("<hr/>");

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
            value: `<h1>${pageTitle}</h1><p>Auto-generated Jira ticket summary:</p>${summary}`,
            representation: "storage"
          }
        }
      })
    });

    if (!createPageResponse.ok) {
      const errorText = await createPageResponse.text();
      return {
        content: [{ type: "text", text: `Failed to create Confluence page. Status: ${createPageResponse.status}. Details: ${errorText}` }]
      };
    }

    const pageData = await createPageResponse.json();
    const pageUrl = `${ATLASSIAN_BASE_URL}/wiki${pageData._links.webui}`;

    return {
      content: [{ type: "text", text: `✅ Confluence page "${pageTitle}" created with detailed Jira summary:\n${pageUrl}` }]
    };
  });


  // ✅ Summarize a Confluence Page
  server.tool("summarize-confluence-page", { pageId: z.string() }, async ({ pageId }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/content/${pageId}?expand=body.view`, { headers: jiraAuthHeader });
    if (!response.ok) {
      return { content: [{ type: "text", text: `❌ Failed to fetch page ${pageId}. Status: ${response.status}` }] };
    }

    const data = await response.json();
    let plainText = data.body.view.value.replace(/<[^>]+>/g, '');

    if (plainText.length > 12000) {
      plainText = plainText.slice(0, 12000) + "\n\n[Truncated for context length]";
    }

    return {
      content: [{
        type: "text",
        text: `✅ Confluence page "${data.title}" loaded.\n\n${plainText}\n\nYou can now ask:\n- "Summarize this page."\n- "What does this say about the architecture?"`
      }]
    };
  });

  // ✅ Query a Confluence Page
  server.tool("query-confluence-page", {
    pageId: z.string(),
    question: z.string()
  }, async ({ pageId, question }) => {
    const response = await fetch(`${ATLASSIAN_BASE_URL}/wiki/rest/api/content/${pageId}?expand=body.view`, { headers: jiraAuthHeader });
    if (!response.ok) {
      return { content: [{ type: "text", text: `❌ Failed to fetch page ${pageId}. Status: ${response.status}` }] };
    }

    const data = await response.json();
    let plainText = data.body.view.value.replace(/<[^>]+>/g, '');

    if (plainText.length > 12000) {
      plainText = plainText.slice(0, 12000) + "\n\n[Truncated for context length]";
    }

    return {
      content: [{
        type: "text",
        text: `✅ Content from "${data.title}" loaded.\n\n${plainText}\n\nYou can now ask:\n- "${question}"\n(Respond using the information above.)`
      }]
    };
  });

  // ✅ List Macro Usage in a Page
  server.tool("get-confluence-macros", { pageId: z.string() }, async ({ pageId }) => {
    const url = `${ATLASSIAN_BASE_URL}/wiki/rest/api/content/${pageId}?expand=body.storage`;
    const response = await fetch(url, { headers: jiraAuthHeader });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [{
          type: "text",
          text: `❌ Failed to fetch page ${pageId} for macro parsing. Status: ${response.status}. Details: ${errorText}`
        }]
      };
    }

    const data = await response.json();
    const html = data.body.storage.value;

    // Match <ac:structured-macro ac:name="macroName">
    const macroRegex = /<ac:structured-macro[^>]*ac:name="([^"]+)"/g;
    const macros = new Set<string>();
    let match;
    while ((match = macroRegex.exec(html)) !== null) {
      macros.add(match[1]);
    }

    if (macros.size === 0) {
      return {
        content: [{ type: "text", text: `No macros found on page "${data.title}".` }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `🧩 Macros used in page "${data.title}":\n\n` + [...macros].map(m => `- ${m}`).join("\n")
      }]
    };
  });

}
