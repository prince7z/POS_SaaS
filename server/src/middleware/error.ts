import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
	error,
	_request,
	response,
	_next,
) => {
	const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
	const message = error instanceof Error ? error.message : "Internal server error";
	response.status(statusCode).json({ success: false, error: message });
};