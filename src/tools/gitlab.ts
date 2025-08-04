import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gitlabAuthHeader, GITLAB_GROUP } from "../auth/gitlabAuth.js";

export function registerGitlabTools(server: McpServer) {

  // List Repositories
  server.tool("gitlab-list-projects", {}, async () => {
    const res = await fetch(`https://gitlab.com/api/v4/projects?membership=true`, {
      headers: gitlabAuthHeader
    });
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to fetch projects. Status: ${res.status}` }] };
    }
    const data = await res.json();
    const output = data.map((p: any) => `${p.name}: ${p.web_url}`).join("\n");
    return { content: [{ type: "text", text: output || "No projects found." }] };
  });

  // Trigger Pipeline
  server.tool("gitlab-trigger-pipeline", { projectId: z.string(), ref: z.string() }, async ({ projectId, ref }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/trigger/pipeline`, {
      method: "POST",
      headers: gitlabAuthHeader,
      body: JSON.stringify({ ref })
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to trigger pipeline. ${res.status}: ${data.message || JSON.stringify(data)}` }] };
    }
    return { content: [{ type: "text", text: `Pipeline triggered for ${ref} on project ${projectId}. ID: ${data.id}` }] };
  });

  // List Pipelines
  server.tool("gitlab-list-pipelines", { projectId: z.string() }, async ({ projectId }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/pipelines`, {
      headers: gitlabAuthHeader
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to list pipelines: ${res.status}` }] };
    }
    const text = data.map((p: any) => `#${p.id} - ${p.status} (${p.ref})`).join("\n");
    return { content: [{ type: "text", text: text || "No pipelines found." }] };
  });

  // Get Pipeline Status
  server.tool("gitlab-get-pipeline", { projectId: z.string(), pipelineId: z.number() }, async ({ projectId, pipelineId }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}`, {
      headers: gitlabAuthHeader
    });
    const data = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to get pipeline: ${res.status}` }] };
    }
    return {
      content: [{
        type: "text",
        text: `Pipeline #${data.id}\nStatus: ${data.status}\nRef: ${data.ref}\nURL: ${data.web_url}`
      }]
    };
  });

  // Cancel Pipeline
  server.tool("gitlab-cancel-pipeline", { projectId: z.string(), pipelineId: z.number() }, async ({ projectId, pipelineId }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/cancel`, {
      method: "POST",
      headers: gitlabAuthHeader
    });
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to cancel pipeline: ${res.status}` }] };
    }
    return { content: [{ type: "text", text: `Pipeline #${pipelineId} canceled.` }] };
  });

  // Rerun Pipeline
  server.tool("gitlab-rerun-pipeline", { projectId: z.string(), pipelineId: z.number() }, async ({ projectId, pipelineId }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/retry`, {
      method: "POST",
      headers: gitlabAuthHeader
    });
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed to rerun pipeline: ${res.status}` }] };
    }
    return { content: [{ type: "text", text: `Pipeline #${pipelineId} rerun successfully.` }] };
  });

  // List Merge Requests
  server.tool("gitlab-list-mrs", { projectId: z.string() }, async ({ projectId }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests`, {
        headers: gitlabAuthHeader
    });
    const data = await res.json();
    if (!res.ok) {
        return { content: [{ type: "text", text: `Failed to list MRs: ${res.status}` }] };
    }
    const text = data.map((mr: any) => `!${mr.iid} - ${mr.title} (${mr.state})`).join("\n");
    return { content: [{ type: "text", text: text || "No merge requests found." }] };
    });

    // List Jobs in a Pipeline
    server.tool("gitlab-list-pipeline-jobs", {
      projectId: z.string(),
      pipelineId: z.number()
    }, async ({ projectId, pipelineId }) => {
      const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/jobs`, {
        headers: gitlabAuthHeader
      });
      const data = await res.json();
      if (!res.ok) {
        return { content: [{ type: "text", text: `Failed to list jobs: ${res.status}` }] };
      }
      const output = data.map((job: any) => `#${job.id} - ${job.name} [${job.status}]`).join("\n");
      return { content: [{ type: "text", text: output || "No jobs found in this pipeline." }] };
    });

    // ✅ Download Artifacts of a Job
    server.tool("gitlab-download-artifacts", {
    projectId: z.string(),
    jobId: z.number()
    }, async ({ projectId, jobId }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/jobs/${jobId}/artifacts`, {
        headers: gitlabAuthHeader
    });
    if (!res.ok) {
        return {
        content: [{
            type: "text",
            text: `❌ Failed to download artifacts: ${res.status}`
        }]
        };
    }
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return {
        content: [{
        type: "resource",
        resource: {
            text: `Download artifacts for job ${jobId}`,
            uri: `data:application/zip;base64,${base64}`,
            mimeType: "application/zip"
        }
        }]
    };
    });

    // ✅ Add Project CI/CD Variable
    server.tool("gitlab-add-variable", {
    projectId: z.string(),
    key: z.string(),
    value: z.string()
    }, async ({ projectId, key, value }) => {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/variables`, {
        method: "POST",
        headers: gitlabAuthHeader,
        body: JSON.stringify({ key, value })
    });
    if (!res.ok) {
        const err = await res.text();
        return {
        content: [{
            type: "text",
            text: `❌ Failed to add variable: ${res.status}. Details: ${err}`
        }]
        };
    }
    return {
        content: [{
        type: "text",
        text: `✅ Variable ${key} added successfully.`
        }]
    };
    });

    // ✅ Create a New Project
    server.tool("gitlab-create-project", {
    name: z.string(),
    visibility: z.enum(["private", "public", "internal"]).default("public"),
    namespaceId: z.string().optional()
    }, async ({ name, visibility, namespaceId }) => {
    const body: any = { name, visibility };
    if (namespaceId) {
        body.namespace_id = namespaceId;
    }
    const res = await fetch(`https://gitlab.com/api/v4/projects`, {
        method: "POST",
        headers: gitlabAuthHeader,
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
        return {
        content: [{
            type: "text",
            text: `❌ Failed to create project: ${res.status}. ${data.message || JSON.stringify(data)}`
        }]
        };
    }
    return {
        content: [{
        type: "text",
        text: `✅ Project created: ${data.name}\nURL: ${data.web_url}`
        }]
    };
    });

}
