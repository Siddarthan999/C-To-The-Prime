import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";import { drive } from "../auth/googleAuth.js";

export function registerGoogleDriveTools(server: McpServer) {
    // === GOOGLE DRIVE: List Files Tool ===
    server.tool("google-drive-list-files", {}, async () => {
        try {
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
            const query = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';
            
            const res = await drive.files.list({
                q: query,
                fields: 'files(id, name, createdTime)',
                pageSize: 20
            });

            const files = res.data.files ?? [];
            if (files.length === 0) {
                return { content: [{ type: "text", text: "No files found in the specified Google Drive folder." }] };
            }

            const fileList = files.map(f => `📄 ${f.name} | ID: ${f.id} | Created: ${f.createdTime}`).join("\n");

            return {
                content: [{
                    type: "text",
                    text: `Here are the recent files in your Google Drive:\n\n${fileList}\n\nYou can now say:\n"Fetch document <fileId> and summarize" or "What is the objective mentioned under <topic> in <fileId>?"`
                }]
            };
        } catch (error: any) {
            console.error(error);
            return {
                content: [{ type: "text", text: `❌ Failed to list Google Drive files: ${error.message}` }]
            };
        }
    });

    // === GOOGLE DRIVE: Fetch File Tool ===
    server.tool("google-drive-fetch-doc", { fileId: z.string() }, async ({ fileId }) => {
        try {
            const res = await drive.files.export(
                { fileId, mimeType: 'text/plain' },
                { responseType: 'stream' }
            );

            let content = "";
            await new Promise((resolve, reject) => {
                res.data.on('data', d => content += d);
                res.data.on('end', resolve);
                res.data.on('error', reject);
            });

            if (content.length > 12000) {
                content = content.slice(0, 12000) + "\n\n[Truncated for context length]";
            }

            return {
                content: [{
                    type: "text",
                    text: `✅ Document fetched from Google Drive:\n\n${content}\n\nYou can now ask:\n- "Summarize this document."\n- "What are the objectives under the section 'Vision'?"`
                }]
            };
        } catch (error: any) {
            console.error(error);
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to fetch document: ${error.message}`
                }]
            };
        }
    });
}