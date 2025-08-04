
import 'dotenv/config';
import { getAuthUrl } from './auth/googleCalendarAuth.js';

console.log("Script started");

const url = getAuthUrl();
console.log("Visit this URL to authorize access to your Google Calendar:");
console.log(url);
