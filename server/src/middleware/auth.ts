import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (_request, _response, next) => {
	next();
};