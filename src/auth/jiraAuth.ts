import 'dotenv/config';

export const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL!;
export const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN!;
export const ATLASSIAN_BASE_URL = process.env.ATLASSIAN_BASE_URL!;

export const jiraAuthHeader = {
  Authorization: `Basic ${Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64')}`,
  'Content-Type': 'application/json',
};
