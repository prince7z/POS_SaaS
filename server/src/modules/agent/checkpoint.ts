import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { env } from "../../config/env";

let checkpointerPromise: Promise<PostgresSaver> | undefined;

export const getAgentCheckpointer = () => {
	checkpointerPromise ??= (async () => {
		const checkpointer = PostgresSaver.fromConnString(env.databaseUrl);
		await checkpointer.setup();
		return checkpointer;
	})();
	return checkpointerPromise;
};
