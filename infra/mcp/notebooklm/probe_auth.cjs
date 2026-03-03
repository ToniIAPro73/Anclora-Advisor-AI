#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function resolveDataDir() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new Error('LOCALAPPDATA not set');
  }

  return path.join(localAppData, 'notebooklm-mcp', 'Data');
}

function getProbeTargetUrl(dataDir) {
  const libraryPath = path.join(dataDir, 'library.json');
  if (fs.existsSync(libraryPath)) {
    try {
      const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
      const activeNotebook = (library.notebooks || []).find(
        (notebook) => notebook.id === library.active_notebook_id
      );
      if (activeNotebook?.url) {
        return activeNotebook.url;
      }

      const firstNotebook = (library.notebooks || []).find((notebook) => notebook.url);
      if (firstNotebook?.url) {
        return firstNotebook.url;
      }
    } catch {}
  }

  return 'https://notebooklm.google.com/';
}

async function main() {
  const dataDir = resolveDataDir();
  const statePath = path.join(dataDir, 'browser_state', 'state.json');

  if (!fs.existsSync(statePath)) {
    console.error(`AUTH_PROBE_FAIL missing_state path="${statePath}"`);
    process.exit(1);
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => {
    return chromium.launch({ headless: true });
  });

  const context = await browser.newContext({
    storageState: statePath,
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
  });

  const page = await context.newPage();
  const targetUrl = getProbeTargetUrl(dataDir);

  try {
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    if (!currentUrl.startsWith('https://notebooklm.google.com/')) {
      console.error(
        `AUTH_PROBE_FAIL redirect="${currentUrl}" target="${targetUrl}"`
      );
      process.exit(1);
    }

    console.log(`AUTH_PROBE_OK url="${currentUrl}" target="${targetUrl}"`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`AUTH_PROBE_FAIL error="${error instanceof Error ? error.message : String(error)}"`);
  process.exit(1);
});
