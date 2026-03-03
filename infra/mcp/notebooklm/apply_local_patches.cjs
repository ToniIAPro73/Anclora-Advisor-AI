#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const authManagerPath = path.join(
  __dirname,
  'node_modules',
  'notebooklm-mcp',
  'dist',
  'auth',
  'auth-manager.js'
);

function replaceOrFail(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Patch anchor not found for ${label}`);
  }
  return source.replace(before, after);
}

function applyAuthManagerPatch(source) {
  let next = source;

  if (!next.includes('async getVerificationNotebookUrl()')) {
    next = replaceOrFail(
      next,
      `    async loadAuthState(context, statePath) {
        try {
            // Read state.json
            const stateData = await fs.readFile(statePath, { encoding: "utf-8" });
            const state = JSON.parse(stateData);
            // Add cookies to context
            if (state.cookies) {
                await context.addCookies(state.cookies);
                log.success(\`✅ Loaded \${state.cookies.length} cookies from \${statePath}\`);
                return true;
            }
            log.warning(\`⚠️  No cookies found in state file\`);
            return false;
        }
        catch (error) {
            log.error(\`❌ Failed to load auth state: \${error}\`);
            return false;
        }
    }`,
      `    async loadAuthState(context, statePath) {
        try {
            // Read state.json
            const stateData = await fs.readFile(statePath, { encoding: "utf-8" });
            const state = JSON.parse(stateData);
            // Add cookies to context
            if (state.cookies) {
                await context.addCookies(state.cookies);
                log.success(\`✅ Loaded \${state.cookies.length} cookies from \${statePath}\`);
                return true;
            }
            log.warning(\`⚠️  No cookies found in state file\`);
            return false;
        }
        catch (error) {
            log.error(\`❌ Failed to load auth state: \${error}\`);
            return false;
        }
    }
    async getVerificationNotebookUrl() {
        const libraryPath = path.join(CONFIG.dataDir, "library.json");
        try {
            const raw = await fs.readFile(libraryPath, { encoding: "utf-8" });
            const library = JSON.parse(raw);
            const notebooks = Array.isArray(library?.notebooks) ? library.notebooks : [];
            const activeNotebook = notebooks.find((notebook) => notebook.id === library?.active_notebook_id && notebook?.url);
            if (activeNotebook?.url) {
                return activeNotebook.url;
            }
            const firstNotebook = notebooks.find((notebook) => notebook?.url);
            if (firstNotebook?.url) {
                return firstNotebook.url;
            }
        }
        catch (error) {
            log.warning(\`⚠️  Could not load verification notebook from library: \${error}\`);
        }
        return "https://notebooklm.google.com/";
    }
    async verifyNotebookAccess(page, targetUrl) {
        try {
            log.info(\`🔍 Verifying NotebookLM access via: \${targetUrl}\`);
            await page.goto(targetUrl, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            for (let attempt = 0; attempt < 10; attempt++) {
                const currentUrl = page.url();
                if (currentUrl.startsWith("https://notebooklm.google.com/")) {
                    log.success(\`✅ NotebookLM access verified: \${currentUrl}\`);
                    return true;
                }
                if (currentUrl.includes("accounts.google.com")) {
                    log.warning(\`⚠️  Verification redirected to Google auth: \${currentUrl.slice(0, 120)}...\`);
                    return false;
                }
                await page.waitForTimeout(1000);
            }
        }
        catch (error) {
            log.warning(\`⚠️  NotebookLM verification failed: \${error}\`);
        }
        return false;
    }`,
      'auth helper methods'
    );
  }

  if (!next.includes('Base Chrome profile locked. Retrying setup_auth with isolated profile')) {
    next = replaceOrFail(
      next,
      `            // ✅ CRITICAL FIX: Use launchPersistentContext (same as runtime!)
            // This ensures session cookies persist correctly
            const context = await chromium.launchPersistentContext(CONFIG.chromeProfileDir, {
                headless: !shouldShowBrowser, // Use override or default to visible for setup
                channel: "chrome",
                viewport: CONFIG.viewport,
                locale: "en-US",
                timezoneId: "Europe/Berlin",
                args: [
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            });`,
      `            const launchOptions = {
                headless: !shouldShowBrowser,
                channel: "chrome",
                viewport: CONFIG.viewport,
                locale: "en-US",
                timezoneId: "Europe/Berlin",
                args: [
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            };
            let setupProfileDir = CONFIG.chromeProfileDir;
            let context;
            try {
                // ✅ CRITICAL FIX: Use launchPersistentContext (same as runtime!)
                // This ensures session cookies persist correctly
                context = await chromium.launchPersistentContext(setupProfileDir, launchOptions);
            }
            catch (error) {
                const setupFallbackDir = path.join(CONFIG.chromeInstancesDir, \`setup-auth-\${Date.now()}\`);
                await fs.mkdir(setupFallbackDir, { recursive: true });
                setupProfileDir = setupFallbackDir;
                log.warning(\`⚠️  Base Chrome profile locked. Retrying setup_auth with isolated profile: \${setupFallbackDir}\`);
                context = await chromium.launchPersistentContext(setupProfileDir, launchOptions);
            };`,
      'setup_auth profile fallback'
    );
  }

  if (!next.includes('Setup reached NotebookLM, but could not verify access to a real notebook')) {
    next = replaceOrFail(
      next,
      `            // Perform login with progress updates
            const loginSuccess = await this.performLogin(page, sendProgress);
            if (loginSuccess) {
                // ✅ Save browser state to state.json (for validation & backup)
                // Chrome ALSO saves everything to the persistent profile automatically!
                await sendProgress?.("Saving authentication state...", 9, 10);
                await this.saveBrowserState(context, page);
                log.success("✅ Setup complete - authentication saved to:");
                log.success(\`  📄 State file: \${this.stateFilePath}\`);
                log.success(\`  📁 Chrome profile: \${CONFIG.chromeProfileDir}\`);
                log.info("💡 Session cookies will now persist across restarts!");
            }`,
      `            // Perform login with progress updates
            const loginSuccess = await this.performLogin(page, sendProgress);
            if (loginSuccess) {
                const verificationUrl = await this.getVerificationNotebookUrl();
                const verified = await this.verifyNotebookAccess(page, verificationUrl);
                if (!verified) {
                    log.error("❌ Setup reached NotebookLM, but could not verify access to a real notebook");
                    await context.close();
                    return false;
                }
                // ✅ Save browser state to state.json (for validation & backup)
                // Chrome ALSO saves everything to the persistent profile automatically!
                await sendProgress?.("Saving authentication state...", 9, 10);
                await this.saveBrowserState(context, page);
                log.success("✅ Setup complete - authentication saved to:");
                log.success(\`  📄 State file: \${this.stateFilePath}\`);
                log.success(\`  📁 Chrome profile: \${setupProfileDir}\`);
                log.info("💡 Session cookies will now persist across restarts!");
            }`,
      'setup_auth verification'
    );
  }

  return next;
}

function main() {
  if (!fs.existsSync(authManagerPath)) {
    throw new Error(`Auth manager not found: ${authManagerPath}`);
  }

  const original = fs.readFileSync(authManagerPath, 'utf8');
  const patched = applyAuthManagerPatch(original);

  if (patched === original) {
    console.log('NotebookLM MCP local patches already applied');
    return;
  }

  fs.writeFileSync(authManagerPath, patched, 'utf8');
  console.log('NotebookLM MCP local patches applied');
}

main();
