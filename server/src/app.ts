import cors from "cors";
import express from "express";
import helmet from "helmet";

import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/error";
import { notFound } from "./middleware/notFound";
import apiRouter from "./routes";
import { env } from "./config/env";

const app = express();

app.use(helmet({
	crossOriginResourcePolicy: {
		policy: "cross-origin",
	},
}));
app.use(cors({
	origin: [env.origin,"http://localhost:5173", "http://jcom.pcodes.tech"],
	credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((request, _response, next) => {
	logger.info(`${request.method} ${request.originalUrl}`);
	next();
});

app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
