// src/auth/servicenowAuth.ts
import { getAuthFields } from "./keyVaultAuth.js";

let SERVICENOW_INSTANCE_URL = "";
let servicenowAuthHeader: { [key: string]: string } = {};

export async function initServiceNowAuth() {
  const creds = await getAuthFields("ServiceNow");

  if (!creds.SERVICENOW_USERNAME || !creds.SERVICENOW_PASSWORD || !creds.SERVICENOW_INSTANCE_URL) {
    throw new Error("Missing ServiceNow credentials from Key Vault.");
  }

  SERVICENOW_INSTANCE_URL = creds.SERVICENOW_INSTANCE_URL;

  const token = Buffer.from(`${creds.SERVICENOW_USERNAME}:${creds.SERVICENOW_PASSWORD}`).toString("base64");
  servicenowAuthHeader = {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

export { SERVICENOW_INSTANCE_URL, servicenowAuthHeader };
