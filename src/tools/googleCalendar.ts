import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGoogleCalendarClient } from "../auth/googleCalendarAuth.js";

// ✅ Local time to UTC ISO conversion (IST)
function convertISTtoUTCISOString(localTimeStr: string): string {
    const date = new Date(`${localTimeStr} GMT+0530`);
    return date.toISOString();
}

export function registerGoogleCalendarTools(server: McpServer) {
    // Get meetings
    server.tool("get-meetings", { date: z.string().optional() }, async ({ date }) => {
        const client = getGoogleCalendarClient();
        const now = new Date();
        const timeMin = date ? new Date(`${date} 00:00 GMT+0530`).toISOString() : new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const timeMax = date ? new Date(`${date} 23:59 GMT+0530`).toISOString() : new Date(now.setHours(23, 59, 59, 999)).toISOString();

        const res = await client.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = res.data.items || [];
        const content = events.map((e: any) => {
            const summary = e.summary || "No Title";
            const start = e.start?.dateTime || e.start?.date;
            const organizer = e.organizer?.email || "Unknown";
            interface Attendee {
                email: string;
                responseStatus?: string;
            }

            const participants: string = (e.attendees as Attendee[] | undefined)?.map(a => `${a.email} (${a.responseStatus})`).join(", ") || "None";
            const meetLink = e.hangoutLink || "No Meet Link";
            return `📅 ${summary}\n🕒 ${start}\n👤 Organizer: ${organizer}\n👥 Participants: ${participants}\n🔗 Meet Link: ${meetLink}`;
        }).join("\n\n") || "No meetings found.";

        return { content: [{ type: "text", text: content }] };
    });

    // Create meeting using local time input
    server.tool("create-meeting", {
        summary: z.string(),
        description: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        start: z.string(), // e.g., "2025-08-02 09:00 PM"
        end: z.string(),   // e.g., "2025-08-02 10:00 PM"
    }, async ({ summary, description, attendees, start, end }) => {
        const client = getGoogleCalendarClient();
        const event = {
            summary,
            description,
            start: { dateTime: convertISTtoUTCISOString(start) },
            end: { dateTime: convertISTtoUTCISOString(end) },
            attendees: attendees?.map(email => ({ email })) || [],
            conferenceData: {
                createRequest: {
                    requestId: `${Date.now()}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                }
            },
            reminders: {
                useDefault: false,
                overrides: [{ method: "email", minutes: 30 }],
            },
        };

        const res = await client.events.insert({
            calendarId: 'primary',
            requestBody: event,
            conferenceDataVersion: 1,
            sendUpdates: "all",
        });

        return {
            content: [{
                type: "text",
                text: `✅ Meeting created successfully!\n📅 ${summary}\n🔗 Google Meet: ${res.data.hangoutLink || "N/A"}\n📤 Attendees: ${attendees?.join(", ") || "None"}`
            }]
        };
    });

    // Respond to meeting
    server.tool("respond-meeting", {
        eventId: z.string(),
        response: z.enum(["yes", "no", "maybe"]),
        email: z.string(),
    }, async ({ eventId, response, email }) => {
        const client = getGoogleCalendarClient();
        await client.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody: {
                attendees: [{ email, responseStatus: response }]
            },
            sendUpdates: "all",
        });

        return { content: [{ type: "text", text: `🗳️ ${email} responded: ${response.toUpperCase()}` }] };
    });

    // Delete meeting
    server.tool("delete-meeting", { eventId: z.string() }, async ({ eventId }) => {
        const client = getGoogleCalendarClient();
        await client.events.delete({ calendarId: 'primary', eventId });
        return { content: [{ type: "text", text: `🗑️ Meeting deleted.` }] };
    });

    // Reschedule meeting with local input
    server.tool("reschedule-meeting", {
        eventId: z.string(),
        start: z.string(),
        end: z.string(),
    }, async ({ eventId, start, end }) => {
        const client = getGoogleCalendarClient();
        const res = await client.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody: {
                start: { dateTime: convertISTtoUTCISOString(start) },
                end: { dateTime: convertISTtoUTCISOString(end) }
            },
            sendUpdates: "all",
        });

        return { content: [{ type: "text", text: `⏰ Meeting rescheduled: ${res.data.htmlLink}` }] };
    });

    // Get meeting link
    server.tool("get-meeting-link", { eventId: z.string() }, async ({ eventId }) => {
        const client = getGoogleCalendarClient();
        const res = await client.events.get({ calendarId: 'primary', eventId });
        return {
            content: [{
                type: "text",
                text: `🔗 Google Meet Link: ${res.data.hangoutLink || "No Meet Link Available"}`
            }]
        };
    });

    // Set Out of Office
    server.tool("set-out-of-office", {
        summary: z.string(),
        start: z.string(),
        end: z.string(),
    }, async ({ summary, start, end }) => {
        const client = getGoogleCalendarClient();
        await client.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary,
                start: { dateTime: convertISTtoUTCISOString(start) },
                end: { dateTime: convertISTtoUTCISOString(end) },
                transparency: "opaque",
                visibility: "public",
                eventType: "outOfOffice",
            },
        });

        return { content: [{ type: "text", text: `📴 Out of office set from ${start} to ${end}` }] };
    });
}
