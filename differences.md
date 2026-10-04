# API & SSE Event Protocol Gap Analysis (`differences.md`)

This document outlines the differences between **what the Frontend expects** (based on `ai-module.md`) and **what the Backend currently expects & returns** (in `server/src/modules/agent/`), along with recommended changes to align the backend with the frontend protocol.

---

## 1. REST API Endpoint & Payload Comparison

| Endpoint Function | Frontend Expected (from `ai-module.md`) | Backend Current Implementation (`server/src/modules/agent/route.ts`) | Status & Required Changes |
| :--- | :--- | :--- | :--- |
| **List Conversations** | `GET /api/agent/conversations`<br>Returns list of summaries with `{ id, title, createdAt, updatedAt, group }`. | `GET /api/agent/conversations`<br>Returns `{ success: true, data: Array<{ id, userId, companyId, title, createdAt, updatedAt }> }`. | **Resolved on Frontend**: Frontend unwraps `{ success: true, data: [...] }`, formats null titles to `"New Conversation"`, and computes `group` (`Today`, `Yesterday`, `Earlier`) from dates. |
| **Get Conversation Details** | `GET /api/agent/conversations/:conversationId`<br>Returns `{ id, title, createdAt, updatedAt, messages: AgentMessage[] }`. | `GET /api/agent/conversations/:conversationId`<br>Returns `{ success: true, data: { id, title, createdAt, updatedAt, messages: Array<{ id, role, content, createdAt }> } }`. | **Resolved on Frontend**: Frontend unwraps response and maps flat string `content` into `{ type: 'text', content }` render blocks. |
| **Stream Agent Response** | `POST /api/agent/stream`<br>Body: `{ "message": "Show sales", "conversationId": "conv_123" }`<br>Stream: `Accept: text/event-stream` | `POST /api/agent/conversations/:conversationId/messages`<br>Body: `{ "content": "Show sales" }`<br>Stream: `text/event-stream` | **Mismatch**: Endpoint URL and payload key differ.<br>👉 **Backend Action**: Add `/api/agent/stream` route expecting `{ message, conversationId }` or support route alias. |
| **Human-in-the-Loop Response** | `POST /api/agent/respond`<br>Body for Question: `{ "conversationId": "conv_123", "questionId": "q_123", "response": { "type": "option" \| "text", "value": "all" } }`<br>Body for Confirmation: `{ "conversationId": "conv_123", "confirmationId": "confirm_123", "response": { "type": "option", "value": true } }` | `POST /api/agent/conversations/:conversationId/resume`<br>Body: `{ "response": <raw_value> }` | **Mismatch**: Route URL and payload keys differ.<br>👉 **Backend Action**: Add `/api/agent/respond` endpoint to handle structured question/confirmation responses and map to LangGraph command resume. |

---

whil

## 2. SSE Event Protocol Comparison

The SSE stream uses ordered events. The event `type` field is the source of truth for rendering.

### SSE Data Line Format Comparison
* **Frontend Expects**: `data: {"id": "evt_123", "type": "<event_type>", "timestamp": 1700000000, "data": { ... }}` followed by double newline `\n\n`. Stream finishes with `data: [DONE]` or `type: "done"`.
* **Backend Currently Sends** (`events.ts`): `event: <event_type>\ndata: {"type": "<event_type>", ...}\n\n`.

### Event Types & Payload Mapping

| Event Concept | Frontend Expected Event (`type`) & `data` Payload | Backend Current Event (`type`) & Payload | Required Backend Changes |
| :--- | :--- | :--- | :--- |
| **Thinking / Progress** | `type: "thinking"`<br>`data: { status: "running" \| "completed", message: string }` | `type: "run.started"` | Emit `thinking` events during step execution (e.g. `"Analyzing sales data..."`). Never expose hidden chain-of-thought. |
| **Todo / Checklist** | `type: "todo"`<br>`data: { id: string, title: string, status: "pending" \| "running" \| "completed" \| "failed" }` | `type: "plan.created"`<br>`data: { steps: Array<{ id, description, status }> }` | Stream individual `todo` events as steps progress rather than sending all steps once in `plan.created`. |
| **Text Stream** | `type: "text"`<br>`data: { messageId: string, delta: string }` | `type: "assistant.delta"`<br>`data: { content: string }` | Change event `type` to `"text"` and payload to `{ messageId, delta }` so text blocks stay ordered relative to charts and tables. |
| **Single Chart** | `type: "chart"`<br>`data: ChartSpec` (`chartType: "bar" \| "line" \| "donut"`, `xKey`, `series`, `data`) | *Not emitted by backend* | Emit structured `chart` events when user requests graphical charts. |
| **Batch Charts** | `type: "chart_batch"`<br>`data: { title?: string, charts: ChartSpec[] }` | *Not emitted by backend* | Emit `chart_batch` events for coordinated multi-chart responses. |
| **Data Table** | `type: "table"`<br>`data: { title?: string, columns: TableColumn[], rows: Record<string, unknown>[] }` | *Not emitted by backend* | Emit structured `table` events with dynamic columns and row values instead of pre-formatted text tables. |
| **Tool Execution** | `type: "tool_call"` (`toolCallId`, `name`, `label`, `status`, `input`)<br>`type: "tool_result"` (`toolCallId`, `status`, `result`, `message`) | *Not emitted by backend* | Emit safe `tool_call` and `tool_result` events correlated by `toolCallId`. |
| **Interactive Question** | `type: "question"`<br>`data: { questionId: string, message: string, options?: Array<{ id, label, value }>, allowTextInput?: boolean }` | `type: "human.input_required"` | Transform LangGraph interrupts for questions into structured `question` events. |
| **Confirmation / Approval** | `type: "confirmation"`<br>`data: { confirmationId: string, message: string, action?: { label: string }, options?: Array<{ id, label, value: boolean }> }` | `type: "human.input_required"` | Transform LangGraph interrupts for action approval into structured `confirmation` events. |
| **Stream Error** | `type: "error"`<br>`data: { code?: string, message: string }` | `type: "run.error"`<br>`data: { message: string }` | Rename event type from `"run.error"` to `"error"`. |
| **Stream Completed** | `type: "done"`<br>`data: null` (or `data: [DONE]`) | `type: "run.completed"`<br>`data: { runId: string }` | Send `type: "done"` or `data: [DONE]` on stream finish. |

---

## 3. System Prompt & LLM Instructions Analysis

### Current Backend System Prompts (`server/src/modules/agent/prompts/`)

#### 1. `plannerSystemPrompt` (`planner.ts`):
```text
You are the planning component of an internal POS assistant.
Return only the structured Plan schema. Do not execute tools and do not include prose outside that schema.
Use only the registered capability tools. Read operations may be planned directly. Any mutation must set requiresConfirmation=true.
Never place companyId, userId, permissions, credentials, SQL, or internal service names in tool arguments.
Always include a final step. Ask for human input when required information is missing.
```

#### 2. `finalSystemPrompt` (`final.ts`):
```text
You are the final response component for an internal POS assistant.
Answer concisely using only the user request and the plan result. Never invent business data, expose private reasoning,
credentials, SQL, signed URLs, permissions, or internal implementation details. If no business operation has run yet,
explain that the request was understood and is ready for the next execution phase.
```

---

### Required System Prompt Enhancements

To support rich frontend UI blocks (Charts, Tables, Interactive Questions, Confirmations), the system prompts should be updated as follows:

#### 1. Formatting Structured Output (Charts & Tables)
Update system prompt instructions to direct the model/tools when to produce structured chart and table outputs:
- **Charts**: When a user asks for visual trends, comparisons, or revenue metrics, format data as standard `ChartSpec`:
  ```json
  {
    "chartType": "line | bar | donut",
    "title": "Monthly Revenue Growth",
    "xKey": "month",
    "series": [{ "dataKey": "revenue", "label": "Revenue (₹)" }],
    "data": [{ "month": "Jul", "revenue": 320000 }, ...]
  }
  ```
- **Tables**: When presenting multi-column records (e.g. Top Customers, Low Stock Products, Branch Breakdowns), structure them into `TableData`:
  ```json
  {
    "title": "Top Performing Products",
    "columns": [
      { "key": "product", "label": "Product Name" },
      { "key": "revenue", "label": "Revenue" }
    ],
    "rows": [
      { "product": "Barcode Scanner Pro", "revenue": "₹124,600" }
    ]
  }
  ```

#### 2. Structuring Human-in-the-Loop Clarifications (Questions & Confirmations)
- **Question Interrupts**: Instruct the LLM to provide structured options whenever asking clarifying questions:
  ```json
  {
    "questionId": "q_123",
    "message": "Which store location would you like to inspect?",
    "options": [
      { "id": "main", "label": "Main Store (HQ)", "value": "main" },
      { "id": "downtown", "label": "Downtown Branch", "value": "downtown" },
      { "id": "all", "label": "All Locations", "value": "all" }
    ],
    "allowTextInput": true
  }
  ```
- **Confirmation Interrupts**: For mutations requiring approval:
  ```json
  {
    "confirmationId": "confirm_123",
    "message": "Do you want to update retail prices for Hardware by +5%?",
    "action": { "label": "Bulk Price Update (+5%)" },
    "options": [
      { "id": "approve", "label": "Approve & Execute", "value": true },
      { "id": "reject", "label": "Cancel Action", "value": false }
    ]
  }
  ```

#### 3. Strict Chain-of-Thought Isolation
- Reinforce that hidden reasoning, internal SQL statements, database schemas, and tool parameters must **never** be exposed in `text` or `thinking` events.
- Emit only safe, high-level user status strings in `thinking` events (e.g. `"Fetching inventory status..."`, `"Comparing store revenue..."`).

---

## 4. Recommended Backend Refactoring Steps

1. **Add Route Aliases in Backend Express Router** (`route.ts`):
   - Map `POST /api/agent/stream` to `controller.messageStream` (extracting `message` and `conversationId` from request body).
   - Map `POST /api/agent/respond` to `controller.resume` (extracting `questionId`/`confirmationId` and `response` from request body).

2. **Update SSE Streaming Event Emitter** (`streaming/events.ts`):
   - Update `AgentEvent` type definition to match the protocol envelopes (`thinking`, `todo`, `text`, `chart`, `chart_batch`, `table`, `tool_call`, `tool_result`, `question`, `confirmation`, `error`, `done`).
   - Format `data:` SSE lines as `data: JSON.stringify({ id, type, timestamp, data })\n\n`.

3. **Update LLM System Prompts** (`prompts/planner.ts` & `prompts/final.ts`):
   - Add chart, table, question, and confirmation JSON spec instructions.
