import { Request, Response } from 'express';
import { getOAuth2Client } from '../../utils';

export default function handler(req: Request, res: Response) {
  try {
    const client = getOAuth2Client(req);
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/calendar.events"
      ],
      prompt: "consent"
    });
    console.log(`[AUTH] Generated URL: ${url}`);
    res.json({ url });
  } catch (error: any) {
    console.error("Error generating auth URL:", error);
    const isMissing = error.message?.includes("MISSING_CREDENTIALS");
    res.status(500).json({ 
      error: isMissing ? "Configuración incompleta" : "Error de autenticación", 
      details: isMissing 
        ? "Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en Vercel." 
        : error.message || "Error desconocido"
    });
  }
}
