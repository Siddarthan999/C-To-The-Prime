// src/auth/notionAuth.ts
import { Client } from "@notionhq/client";
import 'dotenv/config';

export const notion = new Client({
  auth: process.env.NOTION_API_KEY, // Your integration token
});
