// Gmail integration - google-mail connection
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  // Check if we have a cached token that hasn't expired
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    console.log('[Gmail Auth] Using cached access token');
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  console.log('[Gmail Auth] Fetching connection from Replit API...');
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  console.log('[Gmail Auth] Connection status:', connectionSettings?.status);
  console.log('[Gmail Auth] Has settings:', !!connectionSettings?.settings);
  console.log('[Gmail Auth] Has access_token:', !!connectionSettings?.settings?.access_token);
  console.log('[Gmail Auth] Has oauth.credentials.access_token:', !!connectionSettings?.settings?.oauth?.credentials?.access_token);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.error('[Gmail Auth] No valid access token found');
    console.error('[Gmail Auth] Connection settings:', JSON.stringify(connectionSettings, null, 2));
    throw new Error('Gmail not connected or no valid access token');
  }
  
  console.log('[Gmail Auth] Successfully retrieved access token');
  return accessToken;
}

export async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}
