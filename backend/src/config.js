require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';

function required(name, devDefault) {
  const value = process.env[name];
  if (value) return value;
  if (env !== 'production' && devDefault !== undefined) return devDefault;
  throw new Error(`Missing required environment variable ${name} (see .env.example)`);
}

module.exports = {
  env,
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGODB_URI', 'mongodb://localhost:27017/WorkOrderDB'),

  // Long random strings (openssl rand -hex 32)
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',

  // Base URL for the links in emails, e.g. https://api.example.com
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 5000}`).replace(/\/$/, ''),

  // Where the web app is. Password reset links go to its /reset-password page.
  // We don't have a web app yet, so this can be the same as PUBLIC_URL.
  appUrl: (process.env.APP_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),

  // Websites allowed to call the API (comma separated)
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

  // Email. If RESEND_API_KEY is empty the emails are just printed in the log.
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Work Orders <onboarding@resend.dev>'
};
