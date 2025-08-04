import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initGoogleCalendarAuth, getGoogleCalendarClient } from "../auth/googleCalendarAuth.js";

// Normalize date input (string or Date) to UTC ISO string
function normalizeToUTCISOString(input: string | Date): string {
    const date = new Date(input); // Directly handles ISO 8601 with offset
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${input}`);
    }
    return date.toISOString(); // Returns UTC format
}

export async function registerGoogleCalendarTools(server: McpServer) {

    await initGoogleCalendarAuth();
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

    // Create meeting
    server.tool("create-meeting", {
        summary: z.string(),
        description: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        start: z.union([z.string(), z.date()]),
        end: z.union([z.string(), z.date()]),
    }, async ({ summary, description, attendees, start, end }) => {
        const client = getGoogleCalendarClient();
        const event = {
            summary,
            description,
            start: { dateTime: normalizeToUTCISOString(start) },
            end: { dateTime: normalizeToUTCISOString(end) },
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
    // server.tool("respond-meeting", {
    //     eventId: z.string(),
    //     response: z.enum(["yes", "no", "maybe"]),
    //     email: z.string(),
    // }, async ({ eventId, response, email }) => {
    //     const client = getGoogleCalendarClient();
    //     await client.events.patch({
    //         calendarId: 'primary',
    //         eventId,
    //         requestBody: {
    //             attendees: [{ email, responseStatus: response }]
    //         },
    //         sendUpdates: "all",
    //     });

    //     return { content: [{ type: "text", text: `🗳️ ${email} responded: ${response.toUpperCase()}` }] };
    // });

    // Delete meeting
    server.tool("delete-meeting", { eventId: z.string() }, async ({ eventId }) => {
        const client = getGoogleCalendarClient();
        await client.events.delete({ calendarId: 'primary', eventId });
        return { content: [{ type: "text", text: `🗑️ Meeting deleted.` }] };
    });

    // Reschedule meeting
    server.tool("reschedule-meeting", {
        eventId: z.string(),
        start: z.union([z.string(), z.date()]),
        end: z.union([z.string(), z.date()]),
    }, async ({ eventId, start, end }) => {
        const client = getGoogleCalendarClient();
        const res = await client.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody: {
                start: { dateTime: normalizeToUTCISOString(start) },
                end: { dateTime: normalizeToUTCISOString(end) }
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
        start: z.union([z.string(), z.date()]),
        end: z.union([z.string(), z.date()]),
    }, async ({ summary, start, end }) => {
        const client = getGoogleCalendarClient();
        await client.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary,
                start: { dateTime: normalizeToUTCISOString(start) },
                end: { dateTime: normalizeToUTCISOString(end) },
                transparency: "opaque",
                visibility: "public",
                eventType: "outOfOffice",
            },
        });

        return { content: [{ type: "text", text: `📴 Out of office set from ${start} to ${end}` }] };
    });
}
