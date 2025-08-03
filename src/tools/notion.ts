import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { notion } from "../auth/notionAuth.js";
import { PageObjectResponse, isFullPage } from "@notionhq/client";

export function registerNotionTools(server: McpServer) {

  // List all pages (basic listing of known pages)
  server.tool("notion-list-pages", {}, async () => {
    const response = await notion.search({
      filter: { property: "object", value: "page" },
      page_size: 10,
    });

    const pages = response.results;
    if (pages.length === 0) {
      return { content: [{ type: "text", text: "No Notion pages found." }] };
    }

    const formatted = pages
    .filter((p): p is PageObjectResponse => p.object === "page" && "properties" in p)
    .map(p => {
        const titleProp = p.properties["Name"]; // Adjust "Name" to your actual title prop key
        const title = titleProp && "title" in titleProp
        ? titleProp.title?.[0]?.plain_text ?? "Untitled"
        : "Untitled";
        return `📄 ${p.id} — ${title}`;
    })
    .join("\n")

    return {
      content: [{ type: "text", text: `Here are some Notion pages:\n\n${formatted}` }],
    };
  });

  // Fetch page content by page ID
  server.tool("notion-fetch-page", { pageId: z.string() }, async ({ pageId }) => {
    try {
      const blocks = await notion.blocks.children.list({ block_id: pageId });
      const text = blocks.results
        .map(block => {
          if ("paragraph" in block && block.paragraph?.rich_text?.length) {
            return block.paragraph.rich_text.map(t => t.plain_text).join("");
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text", text: `📄 Page content:\n\n${text || "(empty)"}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Failed to fetch page content: ${err.message}` }],
      };
    }
  });

  // Summarize content (simply trims and shows what LLM can read)
  server.tool("notion-summarize-page", { pageId: z.string() }, async ({ pageId }) => {
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    let text = blocks.results
      .map(block => {
        if ("paragraph" in block && block.paragraph?.rich_text?.length) {
          return block.paragraph.rich_text.map(t => t.plain_text).join("");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (text.length > 12000) {
      text = text.slice(0, 12000) + "\n\n[Truncated for context length]";
    }

    return {
      content: [
        {
          type: "text",
          text:
            `📄 Notion page content (for summarization):\n\n${text}\n\nYou can now say:\n- "Summarize this page"\n- "What does this section say about the product vision?"`,
        },
      ],
    };
  });

  // Create a page inside a database
  server.tool("notion-create-page", {
    databaseId: z.string(),
    title: z.string(),
    content: z.string(),
  }, async ({ databaseId, title, content }) => {
    try {
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [{ text: { content: title } }],
          },
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content } }],
            },
          },
        ],
      });

      return {
        content: [{
          type: "text",
          text: `✅ Page created successfully! View here: https://www.notion.so/${response.id.replace(/-/g, "")}`,
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Failed to create page: ${err.message}` }],
      };
    }
  });

  // Query a page by keyword (basic text matching)
  server.tool("notion-query-page", {
    pageId: z.string(),
    keyword: z.string(),
  }, async ({ pageId, keyword }) => {
    const blocks = await notion.blocks.children.list({ block_id: pageId });

    const matchingLines = blocks.results
      .map(block => {
        if ("paragraph" in block && block.paragraph?.rich_text?.length) {
          const text = block.paragraph.rich_text.map(t => t.plain_text).join("");
          return text.includes(keyword) ? text : null;
        }
        return null;
      })
      .filter(Boolean);

    if (matchingLines.length === 0) {
      return {
        content: [{ type: "text", text: `No matches found for "${keyword}" in the page.` }],
      };
    }

    return {
      content: [{
        type: "text",
        text: `🔍 Found the following lines with "${keyword}":\n\n${matchingLines.join("\n\n")}`,
      }],
    };
  });

}
