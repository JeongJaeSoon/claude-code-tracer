/**
 * 사용 가능한 포트를 찾습니다.
 */
export async function findAvailablePort(
	startPort: number,
	maxTries: number = 100,
): Promise<number> {
	for (let i = 0; i < maxTries; i++) {
		const port = startPort + i;
		if (await isPortAvailable(port)) {
			return port;
		}
	}
	throw new Error(
		`No available port found between ${startPort} and ${startPort + maxTries - 1}`,
	);
}

async function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		try {
			const server = Bun.serve({
				port,
				fetch: () => new Response("test"),
			});
			server.stop();
			resolve(true);
		} catch {
			resolve(false);
		}
	});
}
