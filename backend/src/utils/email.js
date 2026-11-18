const config = require('../config');

// In tests emails get saved here so the tests can read the link.
const testOutbox = [];

async function sendEmail({ to, subject, text, html }) {
  if (config.env === 'test') {
    testOutbox.push({ to, subject, text, html });
    return;
  }
  if (!config.resendApiKey) {
    console.log(`[email] RESEND_API_KEY not set, so not sending. To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.emailFrom, to, subject, text, html })
  });
  if (!res.ok) {
    console.error(`[email] Resend returned ${res.status}: ${await res.text()}`);
  }
}

function linkEmail({ to, subject, intro, buttonText, url, footer }) {
  const text = `${intro}\n\n${url}\n\n${footer}`;
  const html = `<p>${intro}</p>
<p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">${buttonText}</a></p>
<p style="color:#555;font-size:13px">${footer}</p>`;
  return sendEmail({ to, subject, text, html });
}

function sendVerificationEmail(user, token) {
  return linkEmail({
    to: user.email,
    subject: 'Verify your email',
    intro: `Hi ${user.firstName}, confirm your email address to finish creating your account.`,
    buttonText: 'Verify email',
    url: `${config.publicUrl}/api/auth/verify-email?token=${token}`,
    footer: 'This link expires in 24 hours. If you did not sign up, you can ignore this email.'
  });
}

function sendPasswordResetEmail(user, token) {
  return linkEmail({
    to: user.email,
    subject: 'Reset your password',
    intro: `Hi ${user.firstName}, use the link below to choose a new password.`,
    buttonText: 'Reset password',
    url: `${config.appUrl}/reset-password?token=${token}`,
    footer: 'This link expires in 1 hour. If you did not ask for a reset, you can ignore this email.'
  });
}

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, testOutbox };
