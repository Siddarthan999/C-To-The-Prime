dotenv.config();

import { google } from 'googleapis';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export function getAuthUrl(): string {
  const SCOPES = ['https://www.googleapis.com/auth/calendar'];
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

export async function setTokensFromCode(code: string) {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  // Optionally store tokens securely here
  return tokens;
}

export function getOAuthClient() {
  return oAuth2Client;
}


export function getGoogleCalendarClient() {
  // Load tokens from token.json if available
  if (existsSync('token.json')) {
    try {
      const tokens = JSON.parse(readFileSync('token.json', 'utf-8'));
      oAuth2Client.setCredentials(tokens);
    } catch (err) {
      console.error('Failed to load tokens from token.json:', err);
    }
  }
  return google.calendar({ version: 'v3', auth: oAuth2Client });
}
