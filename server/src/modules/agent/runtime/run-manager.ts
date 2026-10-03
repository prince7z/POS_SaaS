const runs = new Map<string, AbortController>();

export const registerRun = (runId: string) => {
	const controller = new AbortController();
	runs.set(runId, controller);
	return controller;
};

export const cancelRun = (runId: string) => {
	const controller = runs.get(runId);
	if (!controller) return false;
	controller.abort();
	runs.delete(runId);
	return true;
};

export const finishRun = (runId: string) => {
	runs.delete(runId);
};
