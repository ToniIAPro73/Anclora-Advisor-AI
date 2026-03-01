import { config as loadDotEnv } from "dotenv";
import { spawn } from "node:child_process";

loadDotEnv({ path: ".env.local", override: true });

const extraArgs = process.argv.slice(2);
const command = process.platform === "win32"
  ? `npx playwright test ${extraArgs.join(" ")}`
  : `npx playwright test ${extraArgs.join(" ")}`;
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
