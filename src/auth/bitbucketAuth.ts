import 'dotenv/config';

export const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME!;
export const BITBUCKET_APP_PASSWORD = process.env.BITBUCKET_APP_PASSWORD!;
export const BITBUCKET_WORKSPACE = process.env.BITBUCKET_WORKSPACE!;

export const bitbucketAuthHeader = {
  Authorization: `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString('base64')}`,
  'Content-Type': 'application/json'
};