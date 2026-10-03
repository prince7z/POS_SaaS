import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type SseEvent = {
	type: string;
	[key: string]: unknown;
};

type MessageResult = {
	message: string;
	request: TextMetrics;
	response: TextMetrics;
	latencyMs: number;
	events: string[];
	assistantResponse: string;
	error?: string;
};

type TextMetrics = {
	characters: number;
	words: number;
	estimatedTokens: number;
};

const baseUrl = (process.env.AGENT_TEST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const outputDirectory = join(process.cwd(), "agent-test-reports");
const messages = [
	"hi",
	"Show me my top customers",
	"Give me a summary of current inventory and identify low stock items",
	"What were our recent expenses and profit performance?",
];

const measure = (value: string): TextMetrics => ({
	characters: value.length,
	words: value.trim() ? value.trim().split(/\s+/u).length : 0,
	estimatedTokens: Math.ceil(value.length / 4),
});

const parseSse = (body: string): SseEvent[] =>
	body
		.split(/\n\n+/u)
		.map((block) => block.match(/^event: ([^\n]+)\ndata: ([\s\S]+)$/m))
		.filter((match): match is RegExpMatchArray => match !== null)
		.map((match) => {
			try {
				return JSON.parse(match[2]) as SseEvent;
			} catch {
				return { type: match[1], raw: match[2] };
			}
		});

const readData = async (response: Response) => {
	const body = await response.text();
	if (!response.ok) {
		throw new Error(`Agent API returned ${response.status}: ${body.slice(0, 300)}`);
	}
	return body;
};

const createConversation = async () => {
	const response = await fetch(`${baseUrl}/api/agent/conversations`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title: "Automated agent context test" }),
	});
	const body = await readData(response);
	const parsed = JSON.parse(body) as { data?: { id?: string } };
	if (!parsed.data?.id) throw new Error("Conversation response did not include an id");
	return parsed.data.id;
};

const sendMessage = async (conversationId: string, message: string): Promise<MessageResult> => {
	const startedAt = performance.now();
	try {
		const response = await fetch(`${baseUrl}/api/agent/conversations/${conversationId}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "text/event-stream",
			},
			body: JSON.stringify({ content: message }),
		});
		const events = parseSse(await readData(response));
		const assistantResponse = events
			.filter((event) => event.type === "assistant.delta")
			.map((event) => typeof event.content === "string" ? event.content : "")
			.join("");
		const errorEvent = events.find((event) => event.type === "run.error");
		return {
			message,
			request: measure(message),
			response: measure(assistantResponse),
			latencyMs: Math.round(performance.now() - startedAt),
			events: events.map((event) => event.type),
			assistantResponse,
			error: typeof errorEvent?.message === "string" ? errorEvent.message : undefined,
		};
	} catch (error) {
		return {
			message,
			request: measure(message),
			response: measure(""),
			latencyMs: Math.round(performance.now() - startedAt),
			events: [],
			assistantResponse: "",
			error: error instanceof Error ? error.message : "Unknown test error",
		};
	}
};

const markdownReport = (conversationId: string, results: MessageResult[], generatedAt: string) => {
	const totalRequestTokens = results.reduce((total, result) => total + result.request.estimatedTokens, 0);
	const totalResponseTokens = results.reduce((total, result) => total + result.response.estimatedTokens, 0);
	const rows = results.map((result, index) =>
		`| ${index + 1} | ${result.message.replace(/\|/gu, "\\|")} | ${result.request.words} | ${result.request.estimatedTokens} | ${result.response.words} | ${result.response.estimatedTokens} | ${result.latencyMs} | ${result.error ?? "PASS"} |`,
	).join("\n");
	return `# Agent Context Test Report

- Generated: ${generatedAt}
- Base URL: \`${baseUrl}\`
- Conversation: \`${conversationId}\`
- Token values are estimates using \`ceil(characters / 4)\`; the current SSE contract does not expose provider token usage.
- These measurements cover the API message and assistant response text. They do not expose or persist prompts, credentials, or private reasoning.

## Summary

- Messages: ${results.length}
- Estimated request tokens: ${totalRequestTokens}
- Estimated response tokens: ${totalResponseTokens}
- Estimated total tokens: ${totalRequestTokens + totalResponseTokens}
- Successful runs: ${results.filter((result) => !result.error).length}
- Failed runs: ${results.filter((result) => result.error).length}

## Message measurements

| # | Message | Request words | Request estimated tokens | Response words | Response estimated tokens | Latency ms | Result |
|---:|---|---:|---:|---:|---:|---:|---|
${rows}

## Responses

${results.map((result, index) => `### ${index + 1}. ${result.message}

- Events: \`${result.events.join("`, `") || "none"}\`
- Response:

\`\`\`
${result.assistantResponse || result.error || "No response"}
\`\`\`
`).join("\n")}
`;
};

const main = async () => {
	const conversationId = await createConversation();
	const results: MessageResult[] = [];
	for (const message of messages) {
		results.push(await sendMessage(conversationId, message));
	}
	const generatedAt = new Date().toISOString();
	await mkdir(outputDirectory, { recursive: true });
	const stamp = generatedAt.replace(/[:.]/gu, "-");
	await writeFile(join(outputDirectory, `agent-context-${stamp}.json`), JSON.stringify({
		generatedAt,
		baseUrl,
		conversationId,
		tokenMethod: "estimated ceil(characters / 4)",
		results,
	}, null, 2));
	await writeFile(join(outputDirectory, `agent-context-${stamp}.md`), markdownReport(conversationId, results, generatedAt));
	console.table(results.map((result) => ({
		message: result.message,
		requestTokens: result.request.estimatedTokens,
		responseTokens: result.response.estimatedTokens,
		latencyMs: result.latencyMs,
		result: result.error ?? "PASS",
	})));
	console.log(`Reports written to ${outputDirectory}`);
	if (results.some((result) => result.error)) process.exitCode = 1;
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
