import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initGithubAuth, GITHUB_ORG, githubAuthHeader } from "../auth/githubAuth.js";

export async function registerGithubTools(server: McpServer) {
  
  await initGithubAuth();
  
  // List Repositories
  server.tool("github-list-repos", {}, async () => {
    const response = await fetch(`https://api.github.com/users/${GITHUB_ORG}/repos`, {
      headers: githubAuthHeader
    });
    if (!response.ok) {
      return { content: [{ type: "text", text: `Failed to fetch repositories. Status: ${response.status}` }] };
    }
    const data = await response.json();
    const repoList = data.map((r: any) => `${r.name}: ${r.html_url}`).join("\n");
    return { content: [{ type: "text", text: repoList || "No repositories found." }] };
  });

  // Get Repository Details
  server.tool("github-get-repo", { repoName: z.string() }, async ({ repoName }) => {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}`, {
      headers: githubAuthHeader
    });
    if (!response.ok) {
      return { content: [{ type: "text", text: `Failed to fetch repository ${repoName}. Status: ${response.status}` }] };
    }
    const data = await response.json();
    return {
      content: [{
        type: "text",
        text: `Repo: ${data.full_name}\nDescription: ${data.description || "No description."}\nURL: ${data.html_url}`
      }]
    };
  });

  // Create Repository
  server.tool("github-create-repo", { repoName: z.string(), isPrivate: z.boolean().default(true) }, async ({ repoName, isPrivate }) => {
    const body = {
      name: repoName,
      private: isPrivate,
      auto_init: true
    };
    const url = GITHUB_ORG === process.env.GITHUB_USERNAME
      ? `https://api.github.com/user/repos`
      : `https://api.github.com/orgs/${GITHUB_ORG}/repos`;
    const response = await fetch(url, {
      method: "POST",
      headers: githubAuthHeader,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { content: [{ type: "text", text: `Failed to create repository. Status: ${response.status}. Details: ${errorText}` }] };
    }
    return { content: [{ type: "text", text: `Repository ${repoName} created successfully.` }] };
  });

  // Delete Repository
  server.tool("github-delete-repo", { repoName: z.string() }, async ({ repoName }) => {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}`, {
      method: "DELETE",
      headers: githubAuthHeader
    });
    if (response.status === 204) {
      return { content: [{ type: "text", text: `Repository ${repoName} deleted successfully.` }] };
    } else {
      return { content: [{ type: "text", text: `Failed to delete repository. Status: ${response.status}` }] };
    }
  });

    // List Pull Requests
  server.tool("github-list-prs", { repoName: z.string() }, async ({ repoName }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/pulls`, {
      headers: githubAuthHeader,
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to list PRs: ${res.status}` }] };
    }
    const text = data.map((pr: any) => `#${pr.number} - ${pr.title} (${pr.state})`).join("\n");
    return { content: [{ type: "text", text: text || "No PRs found." }] };
  });

  // Create Pull Request
  server.tool("github-create-pr", {
    repoName: z.string(),
    title: z.string(),
    head: z.string(),
    base: z.string(),
    body: z.string().optional(),
  }, async ({ repoName, title, head, base, body }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/pulls`, {
      method: "POST",
      headers: githubAuthHeader,
      body: JSON.stringify({ title, head, base, body }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to create PR: ${res.status}` }] };
    }
    return { content: [{ type: "text", text: `PR created: ${data.html_url}` }] };
  });

  // Merge Pull Request
  server.tool("github-merge-pr", {
    repoName: z.string(),
    pullNumber: z.number(),
  }, async ({ repoName, pullNumber }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/pulls/${pullNumber}/merge`, {
      method: "PUT",
      headers: githubAuthHeader,
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Merge failed: ${res.status}` }] };
    }
    return { content: [{ type: "text", text: `PR merged: ${data.message}` }] };
  });

  // Comment on Pull Request
  server.tool("github-comment-pr", {
    repoName: z.string(),
    pullNumber: z.number(),
    comment: z.string(),
  }, async ({ repoName, pullNumber, comment }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/issues/${pullNumber}/comments`, {
      method: "POST",
      headers: githubAuthHeader,
      body: JSON.stringify({ body: comment }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to comment: ${res.status}` }] };
    }
    return { content: [{ type: "text", text: `Comment added: ${data.html_url}` }] };
  });

  // List Comments on Pull Request
  server.tool("github-list-pr-comments", {
    repoName: z.string(),
    pullNumber: z.number(),
  }, async ({ repoName, pullNumber }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/issues/${pullNumber}/comments`, {
      headers: githubAuthHeader,
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to fetch comments: ${res.status}` }] };
    }
    const text = data.map((c: any) => `@${c.user.login}: ${c.body}`).join("\n");
    return { content: [{ type: "text", text: text || "No comments." }] };
  });

  // Approve Pull Request (via review)
  server.tool("github-approve-pr", {
    repoName: z.string(),
    pullNumber: z.number(),
  }, async ({ repoName, pullNumber }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/pulls/${pullNumber}/reviews`, {
      method: "POST",
      headers: githubAuthHeader,
      body: JSON.stringify({ event: "APPROVE" }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { content: [{ type: "text", text: `Approval failed: ${err}` }] };
    }
    return { content: [{ type: "text", text: `Pull request approved.` }] };
  });

  // Request Changes on PR
  server.tool("github-request-changes", {
    repoName: z.string(),
    pullNumber: z.number(),
    comment: z.string(),
  }, async ({ repoName, pullNumber, comment }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/pulls/${pullNumber}/reviews`, {
      method: "POST",
      headers: githubAuthHeader,
      body: JSON.stringify({ event: "REQUEST_CHANGES", body: comment }),
    });
    if (!res.ok) {
      return { content: [{ type: "text", text: `Request changes failed.` }] };
    }
    return { content: [{ type: "text", text: `Change requested.` }] };
  });

  // Close Pull Request
  server.tool("github-close-pr", {
    repoName: z.string(),
    pullNumber: z.number(),
  }, async ({ repoName, pullNumber }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/pulls/${pullNumber}`, {
      method: "PATCH",
      headers: githubAuthHeader,
      body: JSON.stringify({ state: "closed" }),
    });
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to close PR.` }] };
    }
    return { content: [{ type: "text", text: `Pull request closed.` }] };
  });

  // Reopen Pull Request
  server.tool("github-reopen-pr", {
    repoName: z.string(),
    pullNumber: z.number(),
  }, async ({ repoName, pullNumber }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/pulls/${pullNumber}`, {
      method: "PATCH",
      headers: githubAuthHeader,
      body: JSON.stringify({ state: "open" }),
    });
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to reopen PR.` }] };
    }
    return { content: [{ type: "text", text: `Pull request reopened.` }] };
  });

  // Create Branch (from main or any base)
  server.tool("github-create-branch", {
    repoName: z.string(),
    newBranch: z.string(),
    fromBranch: z.string().default("main"),
  }, async ({ repoName, newBranch, fromBranch }) => {
    const refRes = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/git/ref/heads/${fromBranch}`, {
      headers: githubAuthHeader,
    });
    const refData = await refRes.json();
    if (!refRes.ok) {
      return { content: [{ type: "text", text: `Failed to get source branch: ${refData.message}` }] };
    }

    const createRes = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/git/refs`, {
      method: "POST",
      headers: githubAuthHeader,
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
        sha: refData.object.sha,
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return { content: [{ type: "text", text: `Failed to create branch: ${err}` }] };
    }
    return { content: [{ type: "text", text: `Branch '${newBranch}' created.` }] };
  });

  // List Branches
  server.tool("github-list-branches", { repoName: z.string() }, async ({ repoName }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/branches`, {
      headers: githubAuthHeader,
    });
    const branches = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to list branches.` }] };
    }
    const list = branches.map((b: any) => b.name).join("\n");
    return { content: [{ type: "text", text: list || "No branches found." }] };
  });

  // List Commits
  server.tool("github-list-commits", { repoName: z.string(), branch: z.string().optional() }, async ({ repoName, branch }) => {
    const url = `https://api.github.com/repos/${GITHUB_ORG}/${repoName}/commits${branch ? `?sha=${branch}` : ""}`;
    const res = await fetch(url, { headers: githubAuthHeader });
    const commits = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to list commits.` }] };
    }
    const list = commits.map((c: any) => `${c.sha.slice(0, 7)}: ${c.commit.message}`).join("\n");
    return { content: [{ type: "text", text: list }] };
  });

  // Get Commit Info
  server.tool("github-get-commit", { repoName: z.string(), sha: z.string() }, async ({ repoName, sha }) => {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}/commits/${sha}`, {
      headers: githubAuthHeader,
    });
    const commit = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to get commit info.` }] };
    }
    return {
      content: [{
        type: "text",
        text: `Commit: ${commit.sha}\nAuthor: ${commit.commit.author.name}\nDate: ${commit.commit.author.date}\nMessage: ${commit.commit.message}`,
      }],
    };
  });

  // Commit a File to GitHub
  server.tool("github-commit-file", {
    repoName: z.string(),
    branch: z.string().default("main"),
    filePath: z.string(),
    fileContent: z.string(),
    commitMessage: z.string(),
  }, async ({ repoName, branch, filePath, fileContent, commitMessage }) => {
    const fileUrl = `https://api.github.com/repos/${GITHUB_ORG}/${repoName}/contents/${filePath}`;
    // Step 1: Check if file exists to get its SHA
    const getRes = await fetch(`${fileUrl}?ref=${branch}`, {
      headers: githubAuthHeader,
    });
    let sha: string | undefined = undefined;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha; // Existing file SHA
    }
    // Step 2: Commit the file (new or updated)
    const commitRes = await fetch(fileUrl, {
      method: "PUT",
      headers: githubAuthHeader,
      body: JSON.stringify({
        message: commitMessage,
        content: Buffer.from(fileContent).toString("base64"),
        branch,
        ...(sha ? { sha } : {}), // only include SHA if updating
      }),
    });
    const commitData = await commitRes.json();
    if (!commitRes.ok) {
      return {
        content: [{
          type: "text",
          text: `Failed to commit file: ${commitRes.status}\n${JSON.stringify(commitData, null, 2)}`
        }],
      };
    }
    return {
      content: [{
        type: "text",
        text: `✅ File committed: ${commitData.content.html_url}`
      }],
    };
  });
}
