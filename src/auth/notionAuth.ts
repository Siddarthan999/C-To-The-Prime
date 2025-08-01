// src/auth/notionAuth.ts
import { Client } from "@notionhq/client";
import { getAuthFields } from "./keyVaultAuth.js";

let notion: Client;

const init = (async () => {
  const creds = await getAuthFields("Notion");

  if (!creds.NOTION_API_KEY) {
    throw new Error("Missing Notion credentials from KeyVault.");
  }

  notion = new Client({
    auth: creds.NOTION_API_KEY,
  });
})();

export { notion };
