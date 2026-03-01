import { config as loadDotEnv } from "dotenv";
import { spawn } from "node:child_process";

loadDotEnv({ path: ".env.local", override: true });

const command = process.platform === "win32" ? "npx next dev" : "npx next dev";
const child = spawn(command, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
