import { Resend } from 'resend';

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  client = new Resend(apiKey);
  return client;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.error('Password reset email not sent: RESEND_API_KEY is not configured.');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Typing Institute <onboarding@resend.dev>',
      to,
      subject: 'Reset your Typing Institute password',
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });
    if (error) {
      console.error('Failed to send password reset email:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send password reset email:', err);
    return false;
  }
}
