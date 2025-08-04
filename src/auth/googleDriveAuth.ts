import { google } from "googleapis";
import { getAuthFields } from "./keyVaultAuth.js";

let drive: ReturnType<typeof google.drive>;

export const initGoogleDriveAuth = async () => {
  const creds = await getAuthFields("Google Drive");

  if (!creds.GOOGLE_CLIENT_EMAIL || !creds.GOOGLE_PRIVATE_KEY) {
    throw new Error("Missing Google Drive credentials from KeyVault.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.GOOGLE_CLIENT_EMAIL,
      private_key: creds.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  drive = google.drive({ version: "v3", auth });
};

export const getGoogleDriveClient = () => {
  if (!drive) {
    throw new Error("Google Drive client not initialized. Call initGoogleDriveAuth() first.");
  }
  return drive;
};
