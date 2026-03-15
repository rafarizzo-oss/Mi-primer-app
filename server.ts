import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import session from "cookie-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Import API handlers
import healthHandler from "./api/health.ts";
import googleUrlHandler from "./api/auth/google/url.ts";
import googleCallbackHandler from "./api/auth/google/callback.ts";
import meHandler from "./api/auth/me.ts";
import logoutHandler from "./api/auth/logout.ts";
import syncHandler from "./api/calendar/sync.ts";

dotenv.config();

// Extend session type
declare module 'express-session' {
  interface SessionData {
    tokens: any;
    user: any;
  }
}

export const app = express();

async function setupApp() {
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json());

  app.use(session({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'minimal-todo-secret'],
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: 'none',
    httpOnly: true
  }));

  // --- API ROUTES ---
  app.get("/api/health", healthHandler);
  app.get("/api/auth/google/url", googleUrlHandler);
  app.get("/api/auth/google/callback", googleCallbackHandler);
  app.get("/api/auth/me", meHandler);
  app.post("/api/auth/logout", logoutHandler);
  app.post("/api/calendar/sync", syncHandler);

  // Debug route
  app.get("/api/debug", (req, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      session: !!req.session,
      timestamp: new Date().toISOString()
    });
  });

  // --- STATIC / VITE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const isApi = req.url.startsWith('/api/') || req.path.startsWith('/api/');
      if (isApi) return res.status(404).json({ error: "API route not found" });
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Initialize the app
setupApp().catch(console.error);

// Export for Vercel
export default app;

// Start local server if not on Vercel
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
  });
}
