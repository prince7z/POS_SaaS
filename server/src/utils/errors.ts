export class AppError extends Error {
	public readonly statusCode: number;

	public constructor(message: string, statusCode = 400) {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
	}
}

export class NotFoundError extends AppError {
	public constructor(message = "Resource not found") {
		super(message, 404);
	}
}