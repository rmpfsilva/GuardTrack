import { getUncachableGmailClient } from './gmail';

interface InvitationEmailData {
  toEmail: string;
  fromEmail: string;
  fromName: string;
  inviteToken: string;
  role: string;
  expiresAt?: Date;
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  try {
    console.log('[Invitation Email] Starting send process...');
    console.log(`[Invitation Email] To: ${data.toEmail}, From: ${data.fromEmail}`);
    
    const gmail = await getUncachableGmailClient();
    console.log('[Invitation Email] Gmail client obtained successfully');
    
    // Build the registration URL - use REPLIT_DOMAINS for production or dev domain
    const domain = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : (process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000');
    const registrationUrl = `${domain}/register?token=${data.inviteToken}`;
    console.log(`[Invitation Email] Registration URL: ${registrationUrl}`);
    
    const expiryHtml = data.expiresAt 
      ? `<p style="color: #666; margin-top: 16px;">This invitation will expire on ${data.expiresAt.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })}.</p>`
      : '';
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #1e40af; margin-top: 0;">Welcome to GuardTrack</h2>
    <p>Hello,</p>
    <p>You have been invited to join <strong>GuardTrack</strong> as a <strong>${data.role}</strong> by ${data.fromName}.</p>
  </div>

  <div style="margin-bottom: 24px;">
    <p><strong>GuardTrack</strong> is a security guard shift management system that helps you:</p>
    <ul style="color: #555;">
      <li>Check in and out of shifts with geolocation verification</li>
      <li>View your scheduled shifts</li>
      <li>Track your working hours</li>
      <li>Request annual leave</li>
      <li>Manage your credentials (SIA Number, Steward ID)</li>
    </ul>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${registrationUrl}" 
       style="display: inline-block; background-color: #1e40af; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
      Create Your Account
    </a>
  </div>

  ${expiryHtml}

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #666; font-size: 14px;">
    <p>If you have any questions, please contact ${data.fromName} at <a href="mailto:${data.fromEmail}" style="color: #1e40af;">${data.fromEmail}</a>.</p>
    <p style="margin-bottom: 0;">Best regards,<br><strong>GuardTrack Team</strong></p>
  </div>
</body>
</html>`;

    const subject = `Invitation to join GuardTrack`;
    
    const message = [
      `From: ${data.fromName} <${data.fromEmail}>`,
      `To: ${data.toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`Invitation email sent successfully to ${data.toEmail}`);
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw new Error('Failed to send invitation email');
  }
}

export async function sendTrialInvitationEmail(toEmail: string, subject: string, body: string): Promise<void> {
  try {
    const bodyPreview = body.length > 100 ? body.substring(0, 100) + '...' : body;
    console.log(`[Email] Starting trial invitation email to: ${toEmail}`);
    console.log(`[Email] Subject: ${subject}`);
    console.log(`[Email] Body preview: ${bodyPreview}`);
    
    const gmail = await getUncachableGmailClient();
    console.log('[Email] Gmail client obtained successfully');
    
    // First, get the authenticated user's email to use as sender
    let senderEmail = 'noreply@guardtrack.com';
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      senderEmail = profile.data.emailAddress || senderEmail;
      console.log(`[Email] Using authenticated sender email: ${senderEmail}`);
    } catch (profileError) {
      console.warn('[Email] Could not fetch user profile, using default sender');
    }
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #1e40af; margin-top: 0;">GuardTrack Trial Invitation</h2>
    <div style="white-space: pre-wrap;">${body}</div>
  </div>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #666; font-size: 14px;">
    <p style="margin-bottom: 0;">Best regards,<br><strong>GuardTrack Team</strong></p>
  </div>
</body>
</html>`;

    const message = [
      `From: GuardTrack <${senderEmail}>`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log('[Email] Sending email via Gmail API...');
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`✅ [Email] Trial invitation email sent successfully to ${toEmail}, Message ID: ${result.data.id}`);
  } catch (error: any) {
    console.error('❌ [Email] Error sending trial invitation email:', error.message);
    if (error.response) {
      console.error('[Email] Response status:', error.response.status);
      console.error('[Email] Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('[Email] Stack trace:', error.stack);
    }
    // Preserve original error for stack trace
    throw error;
  }
}
