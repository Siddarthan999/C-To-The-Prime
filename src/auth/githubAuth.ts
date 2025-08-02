import 'dotenv/config';

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
export const GITHUB_USERNAME = process.env.GITHUB_USERNAME!;
export const GITHUB_ORG = process.env.GITHUB_ORG || GITHUB_USERNAME;

export const githubAuthHeader = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'Content-Type': 'application/json',
};
