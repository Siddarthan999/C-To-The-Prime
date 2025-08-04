// src/auth/githubAuth.ts
import { getAuthFields } from "./keyVaultAuth.js";

let GITHUB_ORG = "";
let githubAuthHeader: Record<string, string> = {};

export const initGithubAuth = async () => {
  const creds = await getAuthFields("GitHub");

  if (!creds.GITHUB_TOKEN || !creds.GITHUB_USERNAME) {
    throw new Error("Missing GitHub credentials from KeyVault.");
  }

  GITHUB_ORG = creds.GITHUB_ORG || creds.GITHUB_USERNAME;

  githubAuthHeader = {
    Authorization: `Bearer ${creds.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json"
  };
};

export { GITHUB_ORG, githubAuthHeader };
