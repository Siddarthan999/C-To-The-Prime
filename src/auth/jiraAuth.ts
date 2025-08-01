// src/auth/jiraAuth.ts
import { getAuthFields } from "./keyVaultAuth.js";

let ATLASSIAN_BASE_URL = "";
let jiraAuthHeader: { Authorization: string } = { Authorization: "" };

// Immediately fetch and cache auth data
const init = (async () => {
  const creds = await getAuthFields("Atlassian");

  if (!creds.ATLASSIAN_EMAIL || !creds.ATLASSIAN_API_TOKEN || !creds.ATLASSIAN_BASE_URL) {
    throw new Error("Missing Atlassian credentials from KeyVault.");
  }

  ATLASSIAN_BASE_URL = creds.ATLASSIAN_BASE_URL;

  const token = Buffer.from(`${creds.ATLASSIAN_EMAIL}:${creds.ATLASSIAN_API_TOKEN}`).toString("base64");
  jiraAuthHeader = {
    Authorization: `Basic ${token}`
  };
})();

export { ATLASSIAN_BASE_URL, jiraAuthHeader };
