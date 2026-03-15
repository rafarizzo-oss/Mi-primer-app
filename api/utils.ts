import { Request } from 'express';
import { google } from 'googleapis';

export const getOAuth2Client = (req: Request) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("MISSING_CREDENTIALS: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not defined in environment variables.");
  }

  let baseUrl = process.env.APP_URL;
  
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      baseUrl = `${protocol}://${host}`;
    }
  }

  baseUrl = baseUrl.replace(/\/$/, "");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;
  
  console.log(`[AUTH] ClientID: ${clientId.substring(0, 10)}...`);
  console.log(`[AUTH] BaseURL: ${baseUrl}`);
  console.log(`[AUTH] RedirectURI: ${redirectUri}`);

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};
