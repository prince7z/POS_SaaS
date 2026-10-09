import { z } from "zod";
import { logger } from "../../../lib/logger";
import type { AgentPerfTracker } from "./perfLogger";

export interface FormattedAgentError {
	errorType: string;
	message: string;
	summary: string;
	issues?: Array<{ path: string; message: string; code: string; expected?: string; received?: string }>;
	details: string;
	stack?: string;
	rawError?: unknown;
}

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	red: "\x1b[31m",
	brightRed: "\x1b[91m",
	yellow: "\x1b[33m",
	brightYellow: "\x1b[93m",
	cyan: "\x1b[36m",
	white: "\x1b[97m",
	gray: "\x1b[90m",
};

/**
 * Parses and formats any error (including Zod parsing errors, SyntaxErrors, API errors, etc.)
 * into a rich, detailed structured representation.
 */
export function formatAgentError(err: unknown): FormattedAgentError {
	if (!err) {
		return {
			errorType: "UnknownError",
			message: "An unknown error occurred",
			summary: "Unknown error",
			details: "No error details available",
		};
	}

	// 1. Zod Validation Error (Type Parsing / Schema Validation Errors)
	if (err instanceof z.ZodError || (typeof err === "object" && err !== null && "issues" in err && Array.isArray((err as z.ZodError).issues))) {
		const zodErr = err as z.ZodError;
		const issues = zodErr.issues.map((issue) => {
			const pathStr = issue.path.length > 0 ? issue.path.join(".") : "(root)";
			let expected: string | undefined;
			let received: string | undefined;

			if ("expected" in issue) expected = String((issue as { expected?: unknown }).expected);
			if ("received" in issue) received = String((issue as { received?: unknown }).received);

			return {
				path: pathStr,
				message: issue.message,
				code: issue.code,
				expected,
				received,
			};
		});

		const issueSummaries = issues.map((i) => {
			let line = `Field "${i.path}": ${i.message}`;
			if (i.expected || i.received) {
				line += ` (expected: ${i.expected ?? "unknown"}, received: ${i.received ?? "unknown"})`;
			}
			return line;
		});

		const summary = `Zod Validation Error (${issues.length} issue${issues.length > 1 ? "s" : ""}): ${issueSummaries.join(" | ")}`;

		const detailsLines = [
			`[Zod Schema Validation Failure]`,
			...issues.map((i, idx) => `  ${idx + 1}. [Path: ${i.path}] [Code: ${i.code}] ${i.message}` + (i.expected ? ` (Expected: ${i.expected}, Received: ${i.received})` : "")),
		];

		return {
			errorType: "ZodValidationError",
			message: zodErr.message,
			summary,
			issues,
			details: detailsLines.join("\n"),
			stack: zodErr.stack,
			rawError: err,
		};
	}

	// 2. Syntax Error (e.g. JSON.parse failures during type parsing)
	if (err instanceof SyntaxError) {
		return {
			errorType: "JSONSyntaxError",
			message: err.message,
			summary: `JSON Syntax Parse Error: ${err.message}`,
			details: `JSON Parse Error: ${err.message}\nStack: ${err.stack}`,
			stack: err.stack,
			rawError: err,
		};
	}

	// 3. Standard Error
	if (err instanceof Error) {
		return {
			errorType: err.name || "Error",
			message: err.message,
			summary: `${err.name || "Error"}: ${err.message}`,
			details: `${err.name || "Error"}: ${err.message}${err.stack ? `\nStack: ${err.stack}` : ""}`,
			stack: err.stack,
			rawError: err,
		};
	}

	// 4. Object Error
	if (typeof err === "object") {
		const str = JSON.stringify(err, null, 2);
		return {
			errorType: "ObjectError",
			message: str,
			summary: `Object Error: ${str.slice(0, 200)}`,
			details: str,
			rawError: err,
		};
	}

	// 5. Primitive string / number
	const strVal = String(err);
	return {
		errorType: "StringError",
		message: strVal,
		summary: strVal,
		details: strVal,
		rawError: err,
	};
}

/**
 * Logs detailed error information to both Winston server logger and a colorized console box.
 */
export function logDetailedAgentError(
	contextTitle: string,
	err: unknown,
	extraInfo?: Record<string, unknown>,
	tracker?: AgentPerfTracker
): FormattedAgentError {
	const formatted = formatAgentError(err);

	// Log via Winston Logger
	logger.error(`[Agent Module Error] ${contextTitle}: ${formatted.summary}`, {
		contextTitle,
		errorType: formatted.errorType,
		message: formatted.message,
		issues: formatted.issues,
		details: formatted.details,
		stack: formatted.stack,
		extraInfo,
		requestId: tracker?.requestId,
		conversationId: tracker?.conversationId,
	});

	// Log entry in perf tracker if present
	tracker?.log({
		layer: "langgraph",
		module: "errorPrinter.ts",
		operation: `ERROR: ${contextTitle}`,
		extra: {
			errorType: formatted.errorType,
			summary: formatted.summary,
			issues: formatted.issues,
			...extraInfo,
		},
	});

	// Print high-visibility colored terminal console box for instant developer visibility
	const border = colors.brightRed;
	const r = colors.reset;
	const b = colors.bold;
	const y = colors.brightYellow;
	const w = colors.white;
	const g = colors.gray;
	const c = colors.cyan;

	console.error(`\n${border}┌─────────────────────────────────────────────────────────────────────────────┐${r}`);
	console.error(`${border}│${r} ${b}${colors.brightRed}❌ AGENT ERROR: [${contextTitle}]${r}`);
	console.error(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
	console.error(`${border}│${r}  ${b}Error Type:${r} ${y}${formatted.errorType}${r}`);
	console.error(`${border}│${r}  ${b}Summary:${r}    ${w}${formatted.summary}${r}`);

	if (tracker?.requestId) {
		console.error(`${border}│${r}  ${b}Request ID:${r} ${c}${tracker.requestId}${r}`);
	}
	if (tracker?.conversationId) {
		console.error(`${border}│${r}  ${b}Conv ID:${r}    ${g}${tracker.conversationId}${r}`);
	}

	if (extraInfo && Object.keys(extraInfo).length > 0) {
		console.error(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.error(`${border}│${r} ${b}${c}🔍 CONTEXT METADATA${r}`);
		for (const [key, value] of Object.entries(extraInfo)) {
			const valStr = typeof value === "object" ? JSON.stringify(value).slice(0, 150) : String(value);
			console.error(`${border}│${r}  • ${key}: ${g}${valStr}${r}`);
		}
	}

	if (formatted.issues && formatted.issues.length > 0) {
		console.error(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.error(`${border}│${r} ${b}${y}⚠️ TYPE PARSING / VALIDATION ISSUES (${formatted.issues.length})${r}`);
		for (const issue of formatted.issues) {
			console.error(`${border}│${r}  ${colors.red}• [Field: ${issue.path}]${r} ${issue.message}`);
			if (issue.expected || issue.received) {
				console.error(`${border}│${r}    ${g}Expected: ${issue.expected ?? "N/A"} | Received: ${issue.received ?? "N/A"}${r}`);
			}
		}
	}

	if (formatted.stack) {
		console.error(`${border}├─────────────────────────────────────────────────────────────────────────────┤${r}`);
		console.error(`${border}│${r} ${b}${g}📜 STACK TRACE${r}`);
		const stackLines = formatted.stack.split("\n").slice(0, 8);
		for (const line of stackLines) {
			console.error(`${border}│${r}  ${g}${line}${r}`);
		}
	}

	console.error(`${border}└─────────────────────────────────────────────────────────────────────────────┘${r}\n`);

	return formatted;
}
