import 'dotenv/config';

export const GITLAB_TOKEN = process.env.GITLAB_TOKEN!;
export const GITLAB_USERNAME = process.env.GITLAB_USERNAME!;
export const GITLAB_GROUP = process.env.GITLAB_GROUP || GITLAB_USERNAME;

export const gitlabAuthHeader = {
  'PRIVATE-TOKEN': GITLAB_TOKEN,
  'Content-Type': 'application/json'
};
