import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { bitbucketAuthHeader, BITBUCKET_WORKSPACE } from "../auth/bitbucketAuth.js";

export function registerBitbucketTools(server: McpServer) {
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
}