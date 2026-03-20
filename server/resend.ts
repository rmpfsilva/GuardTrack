import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings?.settings?.api_key) {
    throw new Error('Resend not connected');
  }

  return { apiKey: connectionSettings.settings.api_key as string };
}

// WARNING: Never cache this client — always call this function to get a fresh instance.
export async function getUncachableResendClient(): Promise<Resend> {
  const { apiKey } = await getCredentials();
  return new Resend(apiKey);
}

// The sender address used on all GuardTrack emails.
// Switch to a verified domain address once a custom domain is set up in Resend.
export const GUARDTRACK_FROM = 'GuardTrack <onboarding@resend.dev>';
