import { spawn } from "node:child_process";

/**
 * 기본 브라우저에서 URL을 엽니다.
 * 플랫폼에 따라 다른 명령어를 사용합니다.
 */
export async function openBrowser(url: string): Promise<void> {
	const platform = process.platform;

	let command: string;
	let args: string[];

	switch (platform) {
		case "darwin":
			command = "open";
			args = [url];
			break;
		case "win32":
			command = "cmd";
			args = ["/c", "start", url];
			break;
		default:
			// Linux and others
			command = "xdg-open";
			args = [url];
	}

	return new Promise((resolve, _reject) => {
		const child = spawn(command, args, {
			detached: true,
			stdio: "ignore",
		});

		child.unref();

		child.on("error", (err) => {
			console.warn(`Failed to open browser: ${err.message}`);
			resolve(); // Don't fail if browser can't be opened
		});

		// Give it a moment to start
		setTimeout(resolve, 500);
	});
}
