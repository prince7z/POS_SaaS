const formatValue = (value: unknown): string =>
	value instanceof Error ? value.stack ?? value.message : String(value);

const write = (level: string, message: string, value?: unknown): void => {
	const suffix = value === undefined ? "" : ` ${formatValue(value)}`;
	console.log(`[${level.toUpperCase()}] ${message}${suffix}`);
};

export const logger = {
	info: (message: string, value?: unknown) => write("info", message, value),
	error: (message: string, value?: unknown) => write("error", message, value),
	warn: (message: string, value?: unknown) => write("warn", message, value),
};