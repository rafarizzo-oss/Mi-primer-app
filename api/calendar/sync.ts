import { Request, Response } from 'express';
import { getOAuth2Client } from '../utils';
import { google } from 'googleapis';

export default async function handler(req: Request, res: Response) {
  const tokens = req.session.tokens;
  if (!tokens) return res.status(401).json({ error: "Unauthorized" });

  const { text, dueDate } = req.body;
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: client });
    const start = new Date(dueDate);
    const end = new Date(start.getTime() + 30 * 60000);

    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `Tarea: ${text}`,
        description: 'Sincronizado desde Minimalist Todo App',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error syncing:", error);
    res.status(500).json({ error: "Sync Error" });
  }
}
