import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

// Extend session type
declare module 'express-session' {
  interface SessionData {
    tokens: any;
    user: any;
  }
}

// OAuth2 Client Helper
const getOAuth2Client = (req: Request) => {
  // Prefer APP_URL from environment if available
  let baseUrl = process.env.APP_URL;
  
  if (!baseUrl) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    baseUrl = `${protocol}://${host}`;
  }

  // Remove trailing slash if present
  baseUrl = baseUrl.replace(/\/$/, "");

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;
  
  console.log(`[AUTH] OAuth Config - BaseURL: ${baseUrl}, RedirectURI: ${redirectUri}`);

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

async function startServer() {
  console.log("--- STARTING SERVER ---");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);

  // Global Request Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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

  // --- API ROUTES FIRST ---
  const api = express.Router();

  api.get("/health", (req, res) => {
    res.json({ status: "ok", message: "API is operational" });
  });

  api.get("/auth/google/url", (req, res) => {
    console.log("Handling /api/auth/google/url");
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error("Missing Google Credentials");
        return res.status(500).json({ error: "Faltan credenciales de Google (CLIENT_ID/SECRET) en los Secrets." });
      }
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
      res.status(500).json({ error: "Error interno al generar la URL de autenticación" });
    }
  });

  api.get("/auth/google/callback", async (req, res) => {
    console.log("Handling /api/auth/google/callback");
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

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
            <p>Autenticación exitosa. Redirigiendo...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in OAuth callback:", error);
      res.status(500).send("Error durante la autenticación con Google");
    }
  });

  api.get("/auth/me", (req, res) => {
    res.json({ user: req.session.user || null });
  });

  api.post("/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  api.post("/calendar/sync", async (req, res) => {
    const tokens = req.session.tokens;
    if (!tokens) return res.status(401).json({ error: "No autenticado" });

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
      console.error("Error syncing calendar:", error);
      res.status(500).json({ error: "Error al sincronizar con Google Calendar" });
    }
  });

  // API 404 Catch-all
  api.all("*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Ruta de API no encontrada: ${req.originalUrl}` });
  });

  // Mount API Router
  app.use("/api", api);

  // --- VITE / STATIC HANDLER ---
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
});
