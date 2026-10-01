import type { ErrorRequestHandler } from "express";

import { AppError } from "../utils/errors";

export const errorHandler: ErrorRequestHandler = (
	error,
	_request,
	response,
	_next,
) => {
	const appError = error instanceof AppError ? error : undefined;
	const statusCode = appError?.statusCode ?? 500;
	const message = appError?.message ?? "Internal server error";
	const code = appError?.code ?? "INTERNAL_SERVER_ERROR";
	response.status(statusCode).json({ success: false, error: { code, message } });
};