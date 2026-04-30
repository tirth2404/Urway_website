import "dotenv/config";
import express from "express";

import { connectDB } from "./db/connectDB.js";
import { createCors } from "./middleware/corsMiddleware.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import appRouter from "./router/appRouter.js";

const app = express();
const port = Number(process.env.PORT || 5000);
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/urway";
const dbName = process.env.DB_NAME || "urway";
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173";

app.use(createCors(frontendOrigin));
app.use(express.json({ limit: "2mb" }));

// Request logger (dev only)
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
    app.listen(port, "127.0.0.1", () => {
      console.log(`[Server] U'rWay backend running on http://127.0.0.1:${port}`);
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

bootstrap();
