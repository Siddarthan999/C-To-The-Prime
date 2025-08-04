
import { getAuthUrl, setTokensFromCode } from './auth/googleCalendarAuth.js';
import readline from 'readline';
import { writeFile } from 'fs/promises';

async function main() {
  console.log('Visit this URL to authorize access to your Google Calendar:');
  console.log(getAuthUrl());

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Paste the code here: ', async (code) => {
    try {
      const tokens = await setTokensFromCode(code.trim());
      await writeFile('token.json', JSON.stringify(tokens, null, 2));
      console.log('Tokens saved to token.json');
    } catch (err) {
      console.error('Error exchanging code for tokens:', err);
    } finally {
      rl.close();
    }
  });
}

main();
