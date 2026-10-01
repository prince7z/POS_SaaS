export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: string;

	public constructor(message: string, statusCode = 400, code = "APP_ERROR") {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.code = code;
	}
}

export class NotFoundError extends AppError {
	public constructor(message = "Resource not found") {
		super(message, 404, "NOT_FOUND");
	}
}

export const unauthorized = (message = "Authentication required") =>
	new AppError(message, 401, "UNAUTHORIZED");

export const forbidden = (message = "Insufficient access") =>
	new AppError(message, 403, "FORBIDDEN");

export const validationError = (message = "Invalid request") =>
	new AppError(message, 400, "VALIDATION_ERROR");

export const mediaError = (code: string, message: string, statusCode = 400) =>
	new AppError(message, statusCode, code);