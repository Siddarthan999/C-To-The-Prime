// src/auth/bitbucketAuth.ts
import { getAuthFields } from "./keyVaultAuth.js";

let BITBUCKET_WORKSPACE = "";
let bitbucketAuthHeader: { Authorization: string; "Content-Type": string } = {
  Authorization: "",
  "Content-Type": "application/json",
};

const init = (async () => {
  const creds = await getAuthFields("BitBucket");

  if (
    !creds.BITBUCKET_USERNAME ||
    !creds.BITBUCKET_APP_PASSWORD ||
    !creds.BITBUCKET_WORKSPACE
  ) {
    throw new Error("Missing Bitbucket credentials from KeyVault.");
  }

  BITBUCKET_WORKSPACE = creds.BITBUCKET_WORKSPACE;

  const token = Buffer.from(`${creds.BITBUCKET_USERNAME}:${creds.BITBUCKET_APP_PASSWORD}`).toString("base64");

  bitbucketAuthHeader = {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
})();

export { BITBUCKET_WORKSPACE, bitbucketAuthHeader };
