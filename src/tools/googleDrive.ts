import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import { drive } from "../auth/googleAuth.js";

export function registerGoogleDriveTools(server: McpServer) {
    // === GOOGLE DRIVE: Share File/Folder Tool ===
    server.tool(
        "google-drive-share",
        {
            fileId: z.string(),
            email: z.string(),
            role: z.enum(["reader", "writer", "commenter", "owner"]).default("writer"),
        },
        async (params: { fileId: string; email: string; role: "reader" | "writer" | "commenter" | "owner" }) => {
            const { fileId, email, role } = params;
            try {
                const res = await drive.permissions.create({
                    fileId,
                    requestBody: {
                        type: "user",
                        role,
                        emailAddress: email,
                    },
                    sendNotificationEmail: false,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: `✅ Granted ${role} access to ${email} for file/folder ID: ${fileId}`,
                        },
                    ],
                };
            } catch (err: any) {
                console.error("❌ Error sharing file/folder:", err.message);
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ Failed to share file/folder: ${err.message}`,
                        },
                    ],
                };
            }
        }
    );
    // === GOOGLE DRIVE: List Files Tool (with optional parentFolderId) ===
    server.tool("google-drive-list-files", {
        parentFolderId: z.string().optional()
    }, async ({ parentFolderId }) => {
        try {
            let query;
            if (parentFolderId) {
                query = `'${parentFolderId}' in parents and trashed = false`;
            } else {
                const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
                query = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';
            }

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
                    text: `Here are the files in the specified folder:\n\n${fileList}\n\nYou can now say:\n\"Fetch document <fileId> and summarize\" or \"Move file <fileId> to <folderId>\"`
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

    server.tool("google-drive-create-folder", {
    name: z.string(),
    parentId: z.string().optional()
    }, async ({ name, parentId }) => {
    try {
        const res = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            ...(parentId && { parents: [parentId] })
        }
        });

        return {
        content: [{
            type: "text",
            text: `📁 Folder "${name}" created successfully with ID: ${res.data.id}`
        }]
        };
    } catch (err: any) {
        console.error("❌ Error creating folder:", err.message);
        return {
        content: [{ type: "text", text: `❌ Failed to create folder: ${err.message}` }]
        };
    }
    });

    server.tool("google-drive-list-folders", {}, async () => {
    try {
        const res = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: "files(id, name, createdTime)",
        pageSize: 50
        });

        const folders = res.data.files ?? [];

        if (folders.length === 0) {
        return {
            content: [{ type: "text", text: "📁 No folders found in your Google Drive." }]
        };
        }

        const folderList = folders
        .map(f => `📁 ${f.name} | ID: ${f.id} | Created: ${f.createdTime}`)
        .join("\n");

        return {
        content: [{
            type: "text",
            text: `Here are your folders in Google Drive:\n\n${folderList}\n\nYou can now:\n- "Move a file to <folderId>"\n- "List files in <folderId>"`
        }]
        };
    } catch (error: any) {
        console.error(error);
        return {
        content: [{ type: "text", text: `❌ Failed to list folders: ${error.message}` }]
        };
    }
    });
    
    // server.tool("google-drive-create-file", {
    // name: z.string(),
    // content: z.string(),
    // parentFolderId: z.string().optional()
    // }, async ({ name, content, parentFolderId }) => {
    // try {
    //     const fileMetadata: any = {
    //     name,
    //     mimeType: 'text/plain'
    //     };

    //     if (parentFolderId) {
    //     fileMetadata.parents = [parentFolderId];
    //     }

    //     const media = {
    //     mimeType: 'text/plain',
    //     body: content // ✅ pass the string directly
    //     };

    //     const res = await drive.files.create({
    //     requestBody: fileMetadata,
    //     media
    //     });

    //     return {
    //     content: [{
    //         type: "text",
    //         text: `✅ File "${name}" created successfully with ID: ${res.data.id}`
    //     }]
    //     };
    // } catch (err: any) {
    //     console.error("❌ Error creating file:", err.message);
    //     return {
    //     content: [{
    //         type: "text",
    //         text: `❌ Failed to create file: ${err.message}`
    //     }]
    //     };
    // }
    // });

    server.tool("google-drive-delete-file", {
    fileId: z.string()
    }, async ({ fileId }) => {
    try {
        await drive.files.delete({
        fileId,
        supportsAllDrives: true // IMPORTANT: needed for shared drive files
        });

        return {
        content: [{
            type: "text",
            text: `🗑️ File or folder with ID \`${fileId}\` was successfully deleted from Google Drive.`
        }]
        };
    } catch (error: any) {
        console.error("❌ Error deleting file:", error.message);
        return {
        content: [{
            type: "text",
            text: `❌ Failed to delete file or folder: ${error.message}`
        }]
        };
    }
    });

    server.tool("google-drive-move-file", {
        fileId: z.string(),
        fromFolderId: z.string(),
        toFolderId: z.string()
    }, async ({ fileId, fromFolderId, toFolderId }) => {
        try {
            const res = await drive.files.update({
                fileId,
                addParents: toFolderId,
                removeParents: fromFolderId,
                supportsAllDrives: true, // ✅ Needed for shared drive
                fields: "id, name, parents"
            });

            return {
                content: [{
                    type: "text",
                    text: `✅ File "${res.data.name}" (ID: \`${fileId}\`) was successfully moved from folder \`${fromFolderId}\` to \`${toFolderId}\`.`
                }]
            };
        } catch (error: any) {
            console.error("❌ Error moving file:", error.message);
            return {
                content: [{
                    type: "text",
                    text: `❌ Failed to move file: ${error.message}`
                }]
            };
        }
    });

    server.tool("google-drive-get-link", {
    fileId: z.string()
}, async ({ fileId }) => {
    try {
        // Make sure the file is shared (e.g., anyone with the link can view)
        await drive.permissions.create({
            fileId,
            requestBody: {
                type: "anyone",
                role: "reader" // or "writer" if needed
            },
            supportsAllDrives: true
        });

        // Now get the file metadata which includes the shareable link
        const res = await drive.files.get({
            fileId,
            fields: "id, name, webViewLink, webContentLink",
            supportsAllDrives: true
        });

        return {
            content: [{
                type: "text",
                text: `🔗 Shareable link for "${res.data.name}":\n\nView: ${res.data.webViewLink}\nDownload: ${res.data.webContentLink ?? "Not available"}`
            }]
        };
    } catch (err: any) {
        console.error("❌ Error getting shareable link:", err.message);
        return {
            content: [{
                type: "text",
                text: `❌ Failed to generate shareable link: ${err.message}`
            }]
        };
    }
});

}