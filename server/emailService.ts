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
    const gmail = await getUncachableGmailClient();
    
    const registrationUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/register?token=${data.inviteToken}`;
    
    const expiryText = data.expiresAt 
      ? `\n\nThis invitation will expire on ${data.expiresAt.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })}.`
      : '';
    
    const emailBody = `Hello,

You have been invited to join GuardTrack as a ${data.role} by ${data.fromName}.

GuardTrack is a security guard shift management system that helps you:
- Check in and out of shifts with geolocation verification
- View your scheduled shifts
- Track your working hours
- Request annual leave
- Manage your credentials (SIA Number, Steward ID)

To create your account, please click the link below:
${registrationUrl}${expiryText}

If you have any questions, please contact ${data.fromName} at ${data.fromEmail}.

Best regards,
GuardTrack Team`;

    const subject = `Invitation to join GuardTrack`;
    
    const message = [
      `From: ${data.fromName} <${data.fromEmail}>`,
      `To: ${data.toEmail}`,
      `Subject: ${subject}`,
      '',
      emailBody
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
