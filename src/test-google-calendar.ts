import { google } from 'googleapis';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Load tokens from token.json
  const tokens = JSON.parse(await readFile('token.json', 'utf-8'));

  // Set up OAuth2 client
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials(tokens);

  // Set up Google Calendar client
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

  // Get today's date range
  const now = new Date();
  const timeMin = new Date(now.setHours(0,0,0,0)).toISOString();
  const timeMax = new Date(now.setHours(23,59,59,999)).toISOString();

  // Fetch events
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items || [];
  if (events.length === 0) {
    console.log('No meetings found for today.');
  } else {
    console.log('Meetings for today:');
    for (const event of events) {
      console.log(`- ${event.summary} (${event.start?.dateTime || event.start?.date})`);
    }
  }
}

main().catch(err => {
  console.error('Error fetching meetings:', err);
});
