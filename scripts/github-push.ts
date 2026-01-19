import { execSync } from 'child_process';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function main() {
  const repoName = 'industrial-competence-platform';
  const owner = 'boloukiamir-bit';
  
  console.log('Getting GitHub access token...');
  const token = await getAccessToken();
  
  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`;
  
  console.log('Configuring git remote...');
  try {
    execSync('git remote remove origin', { stdio: 'pipe' });
  } catch (e) {}
  
  execSync(`git remote add origin "${remoteUrl}"`, { stdio: 'inherit' });
  
  console.log('Pushing to GitHub...');
  execSync('git push -u origin main --force', { stdio: 'inherit' });
  
  console.log('\nSuccess! Code pushed to GitHub.');
  console.log(`Repository: https://github.com/${owner}/${repoName}`);
  
  execSync('git remote remove origin', { stdio: 'pipe' });
  execSync(`git remote add origin https://github.com/${owner}/${repoName}.git`, { stdio: 'pipe' });
}

main().catch(console.error);
