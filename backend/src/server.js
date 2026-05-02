import "dotenv/config";
import express      from "express";
import cookieParser from "cookie-parser";

import { connectDB }                        from "./db/connectDB.js";
import { createCors }                       from "./middleware/corsMiddleware.js";
import { errorHandler, notFound }           from "./middleware/errorMiddleware.js";
import appRouter                            from "./router/appRouter.js";

const app           = express();
const port          = Number(process.env.PORT || 5000);
const host          = process.env.HOST || "127.0.0.1";
const mongoUri      = process.env.MONGO_URI || process.env.MONGODB_URI;
const dbName        = process.env.DB_NAME   || "urway";
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173";
const corsAdditionalOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(createCors(frontendOrigin, corsAdditionalOrigins));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());                     // ← needed to read HttpOnly refresh token cookie

if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

app.use("/api", appRouter);
app.use(notFound);
app.use(errorHandler);

async function bootstrap() {
  try {
    await connectDB(mongoUri, { dbName });
    console.log(`[DB] Connected to MongoDB`);
    app.listen(port, host, () =>
      console.log(`[Server] U'rWay backend running on http://${host}:${port}`)
    );
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

bootstrap();
