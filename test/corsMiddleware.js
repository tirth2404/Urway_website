import cors from "cors";

export function createCors(frontendOrigin) {
  const origins = [
    frontendOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
  ].filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      if (origins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    // FIX: expose Set-Cookie so browsers can read the HttpOnly refresh-token
    // cookie that /api/auth/signin and /api/auth/refresh set on cross-origin
    // responses. Without this, some browsers silently drop the header during
    // CORS preflight even when credentials:true is set on the fetch call.
    exposedHeaders: ["Set-Cookie"],
  });
}
