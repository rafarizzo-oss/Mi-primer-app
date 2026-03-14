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
    res.json({ url });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
