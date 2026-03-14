import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import session from "express-session";
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

async function startServer() {
  console.log("--- INICIANDO SERVIDOR MODULAR ---");
  
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);

  // Logger
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - Path: ${req.path}`);
    next();
  });

  app.use(cookieParser());
  app.use(express.json());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'minimal-todo-secret',
    resave: false,
    saveUninitialized: true,
    proxy: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true 
    }
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
      url: req.url,
      path: req.path,
      headers: req.headers,
      session: !!req.session,
      timestamp: new Date().toISOString()
    });
  });

  // --- STATIC / VITE ---
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando Vite en modo desarrollo...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Sirviendo archivos estáticos en modo producción...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Catch-all para SPA
    app.get('*', (req, res) => {
      const isApi = req.url.startsWith('/api/') || req.path.startsWith('/api/');
      if (isApi) {
        console.log(`[API 404] ${req.method} ${req.url} (Path: ${req.path})`);
        return res.status(404).json({ 
          error: "API route not found", 
          method: req.method, 
          url: req.url,
          path: req.path
        });
      }
      console.log(`[SPA] Serving index.html for ${req.url}`);
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("FATAL ERROR:", err);
});
