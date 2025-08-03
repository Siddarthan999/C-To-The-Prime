// src/tools/servicenow.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initServiceNowAuth, SERVICENOW_INSTANCE_URL, servicenowAuthHeader } from "../auth/servicenowAuth.js";

await initServiceNowAuth();

const stateMap: Record<string, string> = {
  "1": "New",
  "2": "In Progress",
  "3": "On Hold",
  "4": "Resolved",
  "5": "Closed",
  "6": "Canceled"
};

export function registerServiceNowTools(server: McpServer) {
  // 🔍 Get Incident by Number
  server.tool("get-servicenow-incident", { number: z.string() }, async ({ number }) => {
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
    const res = await fetch(url, { headers: servicenowAuthHeader });

    if (!res.ok) {
      const errorText = await res.text();
      return { content: [{ type: "text", text: `❌ Failed to fetch incident ${number}. Status: ${res.status}. Details: ${errorText}` }] };
    }

    const data = await res.json();
    const incident = data.result?.[0];
    if (!incident) {
      return { content: [{ type: "text", text: `Incident ${number} not found.` }] };
    }

    return {
      content: [{
        type: "text",
        text: `📄 Incident ${incident.number}\n` +
              `• Short Description: ${incident.short_description}\n` +
              `• State: ${stateMap[incident.state] || incident.state} (${incident.state})\n` +
              `• Priority: ${incident.priority}\n` +
              `• Assigned To: ${incident.assigned_to?.display_value || "Unassigned"}\n` +
              `• Caller: ${incident.caller_id?.display_value || "Unknown"}\n` +
              `• Opened: ${incident.opened_at}`
      }]
    };
  });

  // 📋 List Incidents by Caller Email
  server.tool("list-servicenow-incidents", { email: z.string() }, async ({ email }) => {
    const query = `caller_id.email=${email}`;
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=${encodeURIComponent(query)}&sysparm_limit=10`;

    const res = await fetch(url, { headers: servicenowAuthHeader });

    if (!res.ok) {
      return { content: [{ type: "text", text: `❌ Failed to list incidents. Status: ${res.status}` }] };
    }

    const data = await res.json();
    if (!data.result || data.result.length === 0) {
      return { content: [{ type: "text", text: `No incidents found for ${email}.` }] };
    }

    const list = data.result.map((i: any) =>
      `- ${i.number}: ${i.short_description} (State: ${stateMap[i.state] || i.state})`
    ).join("\n");

    return { content: [{ type: "text", text: `Incidents for ${email}:\n${list}` }] };
  });

  // ➕ Create New Incident
  server.tool("create-servicenow-incident", {
    short_description: z.string(),
    description: z.string().optional(),
    caller_email: z.string()
  }, async ({ short_description, description = "", caller_email }) => {
    const body = {
      short_description,
      description,
      caller_id: caller_email
    };

    const res = await fetch(`${SERVICENOW_INSTANCE_URL}/api/now/table/incident`, {
      method: "POST",
      headers: servicenowAuthHeader,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const error = await res.text();
      return { content: [{ type: "text", text: `❌ Failed to create incident. ${error}` }] };
    }

    const data = await res.json();
    return {
      content: [{
        type: "text",
        text: `✅ Incident created: ${data.result.number}\n${data.result.short_description}`
      }]
    };
  });

  // 🔁 Update Incident State
  server.tool("update-servicenow-incident-state", {
    number: z.string(),
    state: z.enum(["1", "2", "3", "4", "5", "6"]) // readable values mapped in UI
  }, async ({ number, state }) => {
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
    const fetchRes = await fetch(url, { headers: servicenowAuthHeader });
    const fetchData = await fetchRes.json();

    const incident = fetchData.result?.[0];
    if (!incident) {
      return { content: [{ type: "text", text: `Incident ${number} not found.` }] };
    }

    const updateRes = await fetch(`${SERVICENOW_INSTANCE_URL}/api/now/table/incident/${incident.sys_id}`, {
      method: "PATCH",
      headers: servicenowAuthHeader,
      body: JSON.stringify({ state })
    });

    if (!updateRes.ok) {
      const error = await updateRes.text();
      return { content: [{ type: "text", text: `❌ Failed to update incident. ${error}` }] };
    }

    return {
      content: [{ type: "text", text: `✅ Incident ${number} updated to state: ${stateMap[state]}` }]
    };
  });

  // 💬 Add Comment or Work Note
  server.tool("add-servicenow-incident-comment", {
    number: z.string(),
    comment: z.string(),
    private: z.boolean().default(false)
  }, async ({ number, comment, private: isPrivate }) => {
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
    const fetchRes = await fetch(url, { headers: servicenowAuthHeader });
    const fetchData = await fetchRes.json();
    const incident = fetchData.result?.[0];

    if (!incident) {
      return { content: [{ type: "text", text: `Incident ${number} not found.` }] };
    }

    const field = isPrivate ? "work_notes" : "comments";

    const updateRes = await fetch(`${SERVICENOW_INSTANCE_URL}/api/now/table/incident/${incident.sys_id}`, {
      method: "PATCH",
      headers: servicenowAuthHeader,
      body: JSON.stringify({ [field]: comment })
    });

    if (!updateRes.ok) {
      const error = await updateRes.text();
      return { content: [{ type: "text", text: `❌ Failed to add comment. ${error}` }] };
    }

    return {
      content: [{ type: "text", text: `✅ ${isPrivate ? "Work note" : "Comment"} added to ${number}.` }]
    };
  });

  // 👤 Assign Incident
  server.tool("assign-servicenow-incident", {
    number: z.string(),
    assignee_sys_id: z.string()
  }, async ({ number, assignee_sys_id }) => {
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
    const fetchRes = await fetch(url, { headers: servicenowAuthHeader });
    const fetchData = await fetchRes.json();
    const incident = fetchData.result?.[0];

    if (!incident) {
      return { content: [{ type: "text", text: `Incident ${number} not found.` }] };
    }

    const assignRes = await fetch(`${SERVICENOW_INSTANCE_URL}/api/now/table/incident/${incident.sys_id}`, {
      method: "PATCH",
      headers: servicenowAuthHeader,
      body: JSON.stringify({ assigned_to: assignee_sys_id })
    });

    if (!assignRes.ok) {
      const error = await assignRes.text();
      return { content: [{ type: "text", text: `❌ Failed to assign incident. ${error}` }] };
    }

    return { content: [{ type: "text", text: `✅ Incident ${number} assigned.` }] };
  });

  // ✅ Close Incident with Resolution Note
  server.tool("close-servicenow-incident", {
    number: z.string(),
    resolution: z.string()
  }, async ({ number, resolution }) => {
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
    const fetchRes = await fetch(url, { headers: servicenowAuthHeader });
    const fetchData = await fetchRes.json();
    const incident = fetchData.result?.[0];

    if (!incident) {
      return { content: [{ type: "text", text: `Incident ${number} not found.` }] };
    }

    const closeRes = await fetch(`${SERVICENOW_INSTANCE_URL}/api/now/table/incident/${incident.sys_id}`, {
      method: "PATCH",
      headers: servicenowAuthHeader,
      body: JSON.stringify({
        state: "5", // Closed
        close_notes: resolution
      })
    });

    if (!closeRes.ok) {
      const error = await closeRes.text();
      return { content: [{ type: "text", text: `❌ Failed to close incident. ${error}` }] };
    }

    return { content: [{ type: "text", text: `✅ Incident ${number} closed with resolution.` }] };
  });

    // ✅ Get Comments and Estimate CSAT
    server.tool("estimate-servicenow-csat", {
        number: z.string()
    }, async ({ number }) => {
        const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
        const res = await fetch(url, { headers: servicenowAuthHeader });
        if (!res.ok) {
            return { content: [{ type: "text", text: `❌ Failed to fetch incident ${number}. Status: ${res.status}` }] };
        }

        const data = await res.json();
        const incident = data.result?.[0];
        if (!incident) {
            return { content: [{ type: "text", text: `Incident ${number} not found.` }] };
        }

        // Fetch comments and work notes
        const commentsUrl = `${SERVICENOW_INSTANCE_URL}/api/now/table/sys_journal_field?sysparm_query=element_id=${incident.sys_id}`;
        const commentsRes = await fetch(commentsUrl, { headers: servicenowAuthHeader });
        const commentsData = await commentsRes.json();

        const textDump = commentsData.result.map((entry: any) =>
            `• (${entry.name} - ${entry.sys_created_on}): ${entry.value}`
        ).join("\n");

        return {
            content: [
                {
                    type: "text",
                    text: `✅ All interactions for incident ${number}:\n\n${textDump}\n\nBased on this, estimate the customer satisfaction (CSAT) score from 1 to 5.`
                }
            ]
        };
    });

    // ✅ Advanced Filtering of Incidents
    server.tool("filter-servicenow-incidents", {
        state: z.string().optional(),
        priority: z.string().optional(),
        assigned_to: z.string().optional(),
        category: z.string().optional()
    }, async (args) => {
    const queryParts: string[] = [];

    if (args.state) queryParts.push(`state=${args.state}`);
    if (args.priority) queryParts.push(`priority=${args.priority}`);
    if (args.assigned_to) queryParts.push(`assigned_to=${args.assigned_to}`);
    if (args.category) queryParts.push(`category=${args.category}`);

    const queryString = queryParts.join("^") || "active=true"; // fallback
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=${encodeURIComponent(queryString)}&sysparm_limit=20`;

    const res = await fetch(url, { headers: servicenowAuthHeader });
    if (!res.ok) {
        return { content: [{ type: "text", text: `❌ Failed to fetch incidents. Status: ${res.status}` }] };
    }

    const data = await res.json();
    if (!data.result || data.result.length === 0) {
        return { content: [{ type: "text", text: `No incidents found for filters:\n${JSON.stringify(args, null, 2)}` }] };
    }

    const list = data.result.map((i: any) =>
        `- ${i.number}: ${i.short_description} (State: ${i.state}, Priority: ${i.priority}, Assigned to: ${i.assigned_to?.display_value || "N/A"})`
    ).join("\n");

    return {
        content: [{ type: "text", text: `Filtered incidents:\n${list}` }]
    };
    });

    // 📚 Suggest Related Knowledge Base Articles
  server.tool("suggest-servicenow-kb", { description: z.string() }, async ({ description }) => {
    const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/kb_knowledge?sysparm_query=short_descriptionLIKE${encodeURIComponent(description)}&sysparm_limit=5`;
    const res = await fetch(url, { headers: servicenowAuthHeader });
    const data = await res.json();

    if (!data.result?.length) {
      return { content: [{ type: "text", text: "❌ No KB articles found related to this issue." }] };
    }

    const kbList = data.result.map((kb: any) =>
      `- 📘 ${kb.short_description} (Article: ${kb.number})\n  Link: ${SERVICENOW_INSTANCE_URL}/kb_view.do?sys_kb_id=${kb.sys_id}`
    ).join("\n\n");

    return { content: [{ type: "text", text: `📚 Related Knowledge Articles:\n\n${kbList}` }] };
  });

  // ⏱ Get SLA Status for a Ticket
  server.tool("get-servicenow-sla-status", { number: z.string() }, async ({ number }) => {
    const incidentUrl = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
    const res = await fetch(incidentUrl, { headers: servicenowAuthHeader });
    const incident = (await res.json()).result?.[0];
    if (!incident) return { content: [{ type: "text", text: `❌ Incident ${number} not found.` }] };

    const slaUrl = `${SERVICENOW_INSTANCE_URL}/api/now/table/task_sla?sysparm_query=task=${incident.sys_id}`;
    const slaRes = await fetch(slaUrl, { headers: servicenowAuthHeader });
    const slaData = await slaRes.json();

    if (!slaData.result?.length) {
      return { content: [{ type: "text", text: `No SLA records found for ${number}.` }] };
    }

    const slaDetails = slaData.result.map((sla: any) =>
      `- SLA: ${sla.sla?.display_value || sla.sla}\n  Status: ${sla.stage}\n  Time left: ${sla.time_left || "N/A"}`
    ).join("\n\n");

    return { content: [{ type: "text", text: `⏱ SLA Details for ${number}:\n\n${slaDetails}` }] };
  });

  // 🛠 Bulk Update Incidents
  server.tool("bulk-update-servicenow-incidents", {
    numbers: z.array(z.string()),
    updates: z.record(z.string(), z.string())
  }, async ({ numbers, updates }) => {
    let success = 0;
    let failed: string[] = [];

    for (const number of numbers) {
      const url = `${SERVICENOW_INSTANCE_URL}/api/now/table/incident?sysparm_query=number=${number}`;
      const fetchRes = await fetch(url, { headers: servicenowAuthHeader });
      const incident = (await fetchRes.json()).result?.[0];
      if (!incident) {
        failed.push(number);
        continue;
      }

      const patchRes = await fetch(`${SERVICENOW_INSTANCE_URL}/api/now/table/incident/${incident.sys_id}`, {
        method: "PATCH",
        headers: servicenowAuthHeader,
        body: JSON.stringify(updates)
      });

      if (patchRes.ok) success++;
      else failed.push(number);
    }

    return {
      content: [
        {
          type: "text",
          text: `✅ Updated ${success} incidents successfully.\n${failed.length ? `❌ Failed: ${failed.join(", ")}` : ""}`
        }
      ]
    };
  });

}
