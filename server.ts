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
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${protocol}://${host}/api/auth/google/callback`;
  
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

async function startServer() {
  console.log("--- Starting Server ---");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  
  const app = express();
  const PORT = 3000;

  // Trust proxy is important for secure cookies behind AI Studio proxy
  app.set('trust proxy', 1);

  // LOGGING MIDDLEWARE - MUST BE FIRST
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.url} (Path: ${req.path})`);
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

  // --- API Router ---
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    console.log("Health check requested");
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      env: {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
      }
    });
  });

  apiRouter.get("/auth/google/url", (req, res) => {
    console.log("Generating Google Auth URL...");
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error("Missing credentials in env");
        return res.status(500).json({ error: "Faltan las credenciales GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET." });
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
      res.status(500).json({ error: "Error interno al generar la URL de Google" });
    }
  });

  apiRouter.get("/auth/google/callback", async (req, res) => {
    console.log("Google Auth Callback received");
    const { code } = req.query;
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
            <p>Autenticación exitosa. Esta ventana se cerrará automáticamente.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Error de autenticación");
    }
  });

  apiRouter.get("/auth/me", (req, res) => {
    res.json({ user: req.session.user || null });
  });

  apiRouter.post("/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  apiRouter.post("/calendar/sync", async (req, res) => {
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
      console.error("Error syncing with calendar:", error);
      res.status(500).json({ error: "Error al sincronizar con Google Calendar" });
    }
  });

  // Mount API router
  app.use("/api", apiRouter);

  // API 404 Handler - prevents HTML from being served for missing API routes
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `Ruta de API no encontrada: ${req.url}` });
  });

  // --- Static / Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
