import { Request, Response } from 'express';
import { getOAuth2Client } from '../../utils';
import { google } from 'googleapis';

export default async function handler(req: Request, res: Response) {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code");

  const client = getOAuth2Client(req);
  try {
    const { tokens } = await client.getToken(code as string);
    req.session.tokens = tokens;
    
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    req.session.user = data;

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Éxito. Redirigiendo...</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error in callback:", error);
    res.status(500).send("Authentication Error");
  }
}
