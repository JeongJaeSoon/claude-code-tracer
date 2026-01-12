import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	root: "src/client",
	publicDir: "../../public",
	build: {
		outDir: "../../dist/client",
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			"@client": resolve(__dirname, "src/client"),
			"@server": resolve(__dirname, "src/server"),
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:8080",
				changeOrigin: true,
			},
		},
	},
});
