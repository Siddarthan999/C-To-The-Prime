// src/auth/keyVaultAuth.ts
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const KEYVAULT_BASE_URL = process.env.KEYVAULT_BASE_URL || "https://c-to-the-prime-api-key-vault.vercel.app/";
const KEYVAULT_API_KEY = process.env.KEYVAULT_API_KEY!;
const USER_ID = process.env.KEYVAULT_USER_ID!;

export async function getToolIdByName(toolName: string): Promise<string> {
  const res = await axios.get(`${KEYVAULT_BASE_URL}/api/tools/list-mcp`, {
    headers: { "x-api-key": KEYVAULT_API_KEY },
  });

  const tools = res.data as { id: string; name: string }[];
  const match = tools.find(t => t.name.toLowerCase() === toolName.toLowerCase());

  if (!match) throw new Error(`Tool not found: ${toolName}`);
  return match.id;
}

export async function getAuthFields(toolName: string): Promise<Record<string, string>> {
  const toolId = await getToolIdByName(toolName);

  const res = await axios.get(`${KEYVAULT_BASE_URL}/api/credentials/get-mcp`, {
    headers: { "x-api-key": KEYVAULT_API_KEY },
    params: {
      user_id: USER_ID,
      tool_id: toolId,
    },
  });

  if (res.status !== 200) {
    throw new Error(`Failed to fetch credentials for ${toolName}`);
  }

  return res.data as Record<string, string>;
}
