import { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  req.session.destroy(() => {
    res.json({ success: true });
  });
}
