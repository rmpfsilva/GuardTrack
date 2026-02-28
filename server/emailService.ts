import { getUncachableGmailClient } from './gmail';

interface InvitationEmailData {
  toEmail: string;
  fromEmail: string;
  fromName: string;
  inviteToken: string;
  role: string;
  expiresAt?: Date;
  companyName?: string;
  companyCode?: string;
  companyUuid?: string;
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  try {
    console.log('[Invitation Email] Starting send process...');
    console.log(`[Invitation Email] To: ${data.toEmail}, From: ${data.fromEmail}`);
    
    const gmail = await getUncachableGmailClient();
    console.log('[Invitation Email] Gmail client obtained successfully');
    
    const domain = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : (process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000');

    // Primary CTA: install link with invite token preserved
    const installUrl = data.companyUuid
      ? `${domain}/install/${data.companyUuid}?inviteToken=${data.inviteToken}`
      : `${domain}/register?token=${data.inviteToken}`;

    console.log(`[Invitation Email] Install URL: ${installUrl}`);
    
    const expiryHtml = data.expiresAt 
      ? `<p style="color: #888; font-size: 13px; margin-top: 8px;">This invitation expires on ${data.expiresAt.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })}.</p>`
      : '';

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(installUrl)}&bgcolor=ffffff&color=1e40af&margin=8`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f3f4f6;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); padding: 32px 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">GuardTrack</h1>
    <p style="color: #bfdbfe; margin: 6px 0 0 0; font-size: 14px;">${data.companyName || 'Security Guard Management'}</p>
  </div>

  <!-- Main card -->
  <div style="background: white; margin: 0; padding: 32px 28px;">

    <h2 style="color: #1e3a8a; margin: 0 0 12px 0; font-size: 22px;">You've been invited to GuardTrack</h2>
    <p style="color: #374151; margin: 0 0 24px 0; font-size: 15px;">
      To access your shifts and tasks, you must first install the GuardTrack app on your phone.
    </p>

    <!-- Primary CTA button -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${installUrl}"
         style="display: inline-block; background-color: #1d4ed8; color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 17px; letter-spacing: 0.2px;">
        Install GuardTrack App
      </a>
    </div>

    <!-- Steps -->
    <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px 24px; margin: 24px 0;">
      <p style="font-weight: 600; color: #1e3a8a; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">After tapping the button above:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 6px 0; vertical-align: top; width: 28px;">
            <span style="display: inline-block; background: #1d4ed8; color: white; border-radius: 50%; width: 22px; height: 22px; text-align: center; line-height: 22px; font-size: 12px; font-weight: 700;">1</span>
          </td>
          <td style="padding: 6px 0 6px 10px; color: #374151; font-size: 14px;">Follow the install instructions (3 taps)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; vertical-align: top;">
            <span style="display: inline-block; background: #1d4ed8; color: white; border-radius: 50%; width: 22px; height: 22px; text-align: center; line-height: 22px; font-size: 12px; font-weight: 700;">2</span>
          </td>
          <td style="padding: 6px 0 6px 10px; color: #374151; font-size: 14px;">Open GuardTrack from your home screen</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; vertical-align: top;">
            <span style="display: inline-block; background: #1d4ed8; color: white; border-radius: 50%; width: 22px; height: 22px; text-align: center; line-height: 22px; font-size: 12px; font-weight: 700;">3</span>
          </td>
          <td style="padding: 6px 0 6px 10px; color: #374151; font-size: 14px;">Create your password and sign in</td>
        </tr>
      </table>
    </div>

    ${expiryHtml}

    <!-- Desktop fallback: QR code -->
    <div style="border-top: 1px solid #e5e7eb; margin-top: 28px; padding-top: 24px; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 14px 0;">
        <strong>Reading this on a computer?</strong><br>
        Scan this QR code with your phone to install GuardTrack:
      </p>
      <img src="${qrUrl}" alt="QR Code" width="140" height="140" style="border-radius: 8px; border: 1px solid #e5e7eb;" />
    </div>

  </div>

  <!-- Footer -->
  <div style="padding: 20px 28px; text-align: center;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 6px 0;">
      Invited by ${data.fromName} &middot; <a href="mailto:${data.fromEmail}" style="color: #6b7280;">${data.fromEmail}</a>
    </p>
    <p style="color: #9ca3af; font-size: 11px; margin: 0;">
      Open this email on your mobile device for the best experience.
    </p>
  </div>

</body>
</html>`;

    const subject = data.companyName
      ? `Install GuardTrack App \u2013 ${data.companyName}`
      : `Install GuardTrack App`;
    
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

    console.log(`✅ [Invitation Email] Sent successfully to ${data.toEmail}`);
  } catch (error: any) {
    console.error('❌ [Invitation Email] Error sending email:', error.message);
    if (error.response) {
      console.error('[Invitation Email] Response status:', error.response.status);
      console.error('[Invitation Email] Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('[Invitation Email] Stack trace:', error.stack);
    }
    // Preserve original error message for better debugging
    throw error;
  }
}

interface JobShareNotificationData {
  toEmail: string;
  fromCompanyName: string;
  toCompanyName: string;
  siteName: string;
  status: string;
  startDate: string;
  endDate: string;
  positions?: string;
  notes?: string;
}

export async function sendJobShareNotificationEmail(data: JobShareNotificationData): Promise<void> {
  try {
    console.log(`[Job Share Email] Sending notification to: ${data.toEmail} - Status: ${data.status}`);

    const gmail = await getUncachableGmailClient();

    let senderEmail = 'noreply@guardtrack.com';
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      senderEmail = profile.data.emailAddress || senderEmail;
    } catch (profileError) {
      console.warn('[Job Share Email] Could not fetch user profile, using default sender');
    }

    const statusLabels: Record<string, string> = {
      accepted: 'Accepted',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn',
      cancelled: 'Cancelled',
      edited: 'Updated',
      deleted: 'Deleted',
    };

    const statusColors: Record<string, string> = {
      accepted: '#16a34a',
      rejected: '#dc2626',
      withdrawn: '#ea580c',
      cancelled: '#dc2626',
      edited: '#2563eb',
      deleted: '#dc2626',
    };

    const statusLabel = statusLabels[data.status] || data.status;
    const statusColor = statusColors[data.status] || '#333';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #1e40af; margin-top: 0;">Job Share Update</h2>
    <p>Your job share ${data.status === 'edited' || data.status === 'deleted' || data.status === 'cancelled' ? `from <strong>${data.fromCompanyName}</strong> has been` : 'request has been'} <strong style="color: ${statusColor};">${statusLabel}</strong>${data.status !== 'edited' && data.status !== 'deleted' && data.status !== 'cancelled' ? ` by <strong>${data.toCompanyName}</strong>` : ''}.</p>
  </div>

  <div style="margin-bottom: 24px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666; width: 140px;">Site:</td>
        <td style="padding: 8px 0; font-weight: 600;">${data.siteName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Period:</td>
        <td style="padding: 8px 0; font-weight: 600;">${data.startDate} - ${data.endDate}</td>
      </tr>
      ${data.positions ? `<tr>
        <td style="padding: 8px 0; color: #666;">Positions:</td>
        <td style="padding: 8px 0; font-weight: 600;">${data.positions}</td>
      </tr>` : ''}
    </table>
  </div>

  ${data.notes ? `<div style="background-color: #e0f2fe; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
    <p style="margin: 0; color: #0369a1;"><strong>Notes:</strong> ${data.notes}</p>
  </div>` : ''}

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #666; font-size: 14px;">
    <p style="margin-bottom: 0;">Best regards,<br><strong>GuardTrack Team</strong></p>
  </div>
</body>
</html>`;

    const subject = `Job Share ${statusLabel} - ${data.siteName}`;

    const message = [
      `From: GuardTrack <${senderEmail}>`,
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

    console.log(`[Job Share Email] Sent successfully to ${data.toEmail}`);
  } catch (error: any) {
    console.error('[Job Share Email] Error sending email:', error.message);
    throw error;
  }
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string, requestHost: string): Promise<void> {
  try {
    console.log(`[Password Reset Email] Sending to: ${toEmail}`);

    const gmail = await getUncachableGmailClient();

    let senderEmail = 'noreply@guardtrack.com';
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      senderEmail = profile.data.emailAddress || senderEmail;
    } catch {
      console.warn('[Password Reset Email] Could not fetch sender profile, using default');
    }

    const resetUrl = `${requestHost}/reset-password?token=${resetToken}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #1e40af; margin-top: 0;">Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset your <strong>GuardTrack</strong> password. Click the button below to set a new password.</p>
    <p style="color: #666; font-size: 14px;">This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${resetUrl}"
       style="display: inline-block; background-color: #1e40af; color: white; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-weight: 600; font-size: 16px;">
      Reset My Password
    </a>
  </div>

  <div style="background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 13px; color: #64748b;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin: 8px 0 0 0; font-size: 13px; word-break: break-all; color: #1e40af;">${resetUrl}</p>
  </div>

  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #666; font-size: 14px;">
    <p style="margin-bottom: 0;">Best regards,<br><strong>GuardTrack Team</strong></p>
  </div>
</body>
</html>`;

    const message = [
      `From: GuardTrack <${senderEmail}>`,
      `To: ${toEmail}`,
      `Subject: Reset your GuardTrack password`,
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
      requestBody: { raw: encodedMessage },
    });

    console.log(`✅ [Password Reset Email] Sent successfully to ${toEmail}`);
  } catch (error: any) {
    console.error('❌ [Password Reset Email] Error sending email:', error.message);
    if (error.response) {
      console.error('[Password Reset Email] Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
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
