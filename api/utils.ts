import { Request } from 'express';
import { google } from 'googleapis';

export const getOAuth2Client = (req: Request) => {
  let baseUrl = process.env.APP_URL;
  
  if (!baseUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    baseUrl = `${protocol}://${host}`;
  }

  baseUrl = baseUrl.replace(/\/$/, "");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;
  
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};
