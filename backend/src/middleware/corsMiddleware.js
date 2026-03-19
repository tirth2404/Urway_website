import cors from "cors";

export function createCors(frontendOrigin) {
  return cors({
    origin: [frontendOrigin, "http://localhost:5173"],
    credentials: true,
  });
}
