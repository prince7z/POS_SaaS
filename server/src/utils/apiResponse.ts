import type { Response } from "express";

export const sendSuccess = <T>(response: Response, data: T, statusCode = 200) =>
	response.status(statusCode).json({ success: true, data });

export const sendError = (response: Response, message: string, statusCode = 400) =>
	response.status(statusCode).json({ success: false, error: message });