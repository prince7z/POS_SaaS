import type { Response } from "express";

export const sendSuccess = <T>(response: Response, data: T, statusCode = 200) =>
	response.status(statusCode).json({ success: true, data });

export const sendMessage = (response: Response, message: string, statusCode = 200) =>
	response.status(statusCode).json({ success: true, message });

export const sendError = (
	response: Response,
	message: string,
	statusCode = 400,
	code = "APP_ERROR",
) => response.status(statusCode).json({ success: false, error: { code, message } });