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
  console.log("--- INICIANDO SERVIDOR ---");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  
  const app = express();
  const PORT = 3000;

  // Trust proxy para cookies seguros tras el proxy de AI Studio
  app.set('trust proxy', 1);

  // Middleware de logging para depuración
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

  // --- RUTAS DE LA API ---
  // Las definimos directamente en 'app' para evitar problemas con routers
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "API is alive" });
  });

  app.get("/api/auth/google/url", (req, res) => {
    console.log("Generando URL de Google Auth...");
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ error: "Faltan credenciales de Google en el servidor." });
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
      console.error("Error en /api/auth/google/url:", error);
      res.status(500).json({ error: "Error interno al generar la URL" });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
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
            <p>Autenticación exitosa. Cerrando ventana...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error en callback:", error);
      res.status(500).send("Error de autenticación");
    }
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.session.user || null });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.post("/api/calendar/sync", async (req, res) => {
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
      console.error("Error en sync:", error);
      res.status(500).json({ error: "Error al sincronizar con Google Calendar" });
    }
  });

  // Manejador de 404 para cualquier otra ruta de API
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Ruta de API no encontrada: ${req.url}` });
  });

  // --- VITE / STATIC FILES ---
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando Vite en modo middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Sirviendo archivos estáticos desde dist/...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("ERROR FATAL AL INICIAR EL SERVIDOR:", err);
});
