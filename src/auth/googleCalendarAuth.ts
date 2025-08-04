// src/auth/googleCalendarAuth.ts
import { google } from 'googleapis';
import { getAuthFields } from './keyVaultAuth.js';

let oAuth2Client: any = null;

export const initGoogleCalendarAuth = async () => {
  const creds = await getAuthFields("Google Calendar");

  if (
    !creds.GOOGLE_CLIENT_ID ||
    !creds.GOOGLE_CLIENT_SECRET ||
    !creds.GOOGLE_REDIRECT_URI
  ) {
    throw new Error("Missing Google OAuth credentials from Key Vault.");
  }

  oAuth2Client = new google.auth.OAuth2(
    creds.GOOGLE_CLIENT_ID,
    creds.GOOGLE_CLIENT_SECRET,
    creds.GOOGLE_REDIRECT_URI
  );

  if (
    creds.GOOGLE_ACCESS_TOKEN &&
    creds.GOOGLE_REFRESH_TOKEN &&
    creds.GOOGLE_EXPIRY_DATE
  ) {
    oAuth2Client.setCredentials({
      access_token: creds.GOOGLE_ACCESS_TOKEN,
      refresh_token: creds.GOOGLE_REFRESH_TOKEN,
      scope: creds.GOOGLE_SCOPE,
      token_type: creds.GOOGLE_TOKEN_TYPE,
      expiry_date: Number(creds.GOOGLE_EXPIRY_DATE),
    });
  } else {
    console.warn("⚠️ Google token credentials missing from Key Vault.");
  }
};

export function getOAuthClient() {
  if (!oAuth2Client) throw new Error("Google OAuth not initialized. Call initGoogleCalendarAuth first.");
  return oAuth2Client;
}

export function getGoogleCalendarClient() {
  if (!oAuth2Client) throw new Error("Google OAuth not initialized. Call initGoogleCalendarAuth first.");
  return google.calendar({ version: 'v3', auth: oAuth2Client });
}

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
  return tokens;
}
