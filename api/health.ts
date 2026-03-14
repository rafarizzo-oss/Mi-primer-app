import { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  res.json({ status: "ok", environment: process.env.NODE_ENV });
}
