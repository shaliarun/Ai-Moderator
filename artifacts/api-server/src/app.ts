import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// CORS: in production restrict to ALLOWED_ORIGINS (comma-separated list of
// permitted frontend origins). In development allow all origins.
const rawAllowed = process.env.ALLOWED_ORIGINS;
const corsOptions: cors.CorsOptions = rawAllowed
  ? {
      origin: rawAllowed.split(",").map((o) => o.trim()),
      credentials: true,
    }
  : {
      origin: true,
      credentials: true,
    };

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
