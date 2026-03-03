#!/usr/bin/env node
'use strict';

/**
 * Adds governed web sources from a NotebookLM bundle using real browser automation.
 *
 * Why this exists:
 * - notebooklm-mcp manages the local notebook library metadata.
 * - It does not provide a tool to upload web sources into a notebook.
 * - This script uses Playwright with the saved NotebookLM browser state instead.
 *
 * Environment:
 * - BUNDLE_PATH: optional path to bundle JSON
 * - NOTEBOOKLM_STATE_PATH: optional path to browser_state/state.json
 * - NOTEBOOKLM_FILTER: optional notebook domain/title/id filter
 * - NOTEBOOKLM_MAX_SOURCES: optional per-notebook cap for test runs
 * - HEADLESS=1: run headless
 * - DRY_RUN=1: validate bundle and print plan without mutating NotebookLM
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const DEFAULT_BUNDLE_PATH = path.join(__dirname, 'notebook_bundle_phase7_2026.json');
const DEFAULT_STATE_PATH = path.join(
  process.env.LOCALAPPDATA || '',
  'notebooklm-mcp',
  'Data',
  'browser_state',
  'state.json'
);
const DEFAULT_SYNC_STATE_PATH = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  'notebooklm-mcp',
  'Data',
  'sync_state.json'
);

const NOTEBOOK_GOVERNANCE = {
  fiscal: 'ANCLORA_NOTEBOOK_01_FISCALIDAD_AUTONOMO_ES_BAL',
  laboral: 'ANCLORA_NOTEBOOK_02_TRANSICION_RIESGO_LABORAL',
  mercado: 'ANCLORA_NOTEBOOK_03_MARCA_POSICIONAMIENTO',
};

const NOTEBOOK_SCOPE_RULES = {
  fiscal: {
    keywords: [
      'autonomo',
      'autónomo',
      'iva',
      'irpf',
      'reta',
      'deduccion',
      'deducción',
      'cuota cero',
      'inspeccion',
      'inspección',
      'facturacion',
      'facturación',
      'tribut',
      'baleares',
      'balears',
    ],
    rejectKeywords: [
      'despido',
      'pluriactividad',
      'contrato laboral',
      'marca personal',
      'posicionamiento',
      'linkedin',
      'inmobiliario',
      'proptech',
    ],
  },
  laboral: {
    keywords: [
      'pluriactividad',
      'compatibilidad',
      'contrato',
      'despido',
      'buena fe',
      'excedencia',
      'laboral',
      'transicion',
      'transición',
      'conflicto',
      'reputacional',
      'riesgo',
    ],
    rejectKeywords: [
      'iva',
      'irpf',
      'reta',
      'cuota cero',
      'deduccion',
      'deducción',
      'marca personal',
      'posicionamiento',
      'inmobiliario',
      'proptech',
    ],
  },
  mercado: {
    keywords: [
      'marca',
      'posicionamiento',
      'premium',
      'usp',
      'narrativa',
      'autoridad',
      'conversion',
      'conversión',
      'comercial',
      'linkedin',
      'inmobiliario',
      'inmobiliaria',
      'proptech',
    ],
    rejectKeywords: [
      'despido',
      'pluriactividad',
      'contrato laboral',
      'iva',
      'irpf',
      'reta',
      'cuota cero',
      'deduccion',
      'deducción',
    ],
  },
};

function loadBundle(bundlePath) {
  return JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getSyncKey(notebookId, url) {
  return `${notebookId}::${normalizeUrl(url)}`;
}

function loadSyncState(syncStatePath) {
  if (!fs.existsSync(syncStatePath)) {
    return { synced: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(syncStatePath, 'utf8'));
    return {
      synced: Array.isArray(parsed.synced) ? parsed.synced : [],
    };
  } catch {
    return { synced: [] };
  }
}

function saveSyncState(syncStatePath, syncState) {
  fs.mkdirSync(path.dirname(syncStatePath), { recursive: true });
  fs.writeFileSync(syncStatePath, `${JSON.stringify(syncState, null, 2)}\n`, 'utf8');
}

function countKeywordHits(haystack, keywords) {
  return keywords.filter((keyword) => haystack.includes(normalizeText(keyword))).length;
}

function validateBundle(bundle) {
  const issues = [];

  if (!Array.isArray(bundle) || bundle.length === 0) {
    issues.push('BUNDLE_EMPTY');
    return issues;
  }

  for (const notebook of bundle) {
    if (!NOTEBOOK_GOVERNANCE[notebook.domain]) {
      issues.push(`SOURCE_SCOPE_MISMATCH domain=${notebook.domain ?? 'missing'}`);
      continue;
    }

    if (notebook.notebook_title !== NOTEBOOK_GOVERNANCE[notebook.domain]) {
      issues.push(
        `SOURCE_SCOPE_MISMATCH notebook_title=${notebook.notebook_title ?? 'missing'} domain=${notebook.domain}`
      );
    }

    if (!notebook.notebook_id) {
      issues.push(`SOURCE_SCOPE_MISMATCH notebook_id missing for domain=${notebook.domain}`);
    }

    for (const source of notebook.sources ?? []) {
      if (!source.url) {
        continue;
      }
      if (!source.reason_for_fit || String(source.reason_for_fit).trim().length < 24) {
        issues.push(
          `SOURCE_SCOPE_MISMATCH reason_for_fit missing for title="${source.title}" domain=${notebook.domain}`
        );
        continue;
      }

      const scope = NOTEBOOK_SCOPE_RULES[notebook.domain];
      const haystack = normalizeText(
        `${source.title || ''} ${String(source.content || '').slice(0, 2500)} ${source.reason_for_fit || ''}`
      );
      const keywordHits = countKeywordHits(haystack, scope.keywords);
      const rejectHits = countKeywordHits(haystack, scope.rejectKeywords);

      if (keywordHits < 2) {
        issues.push(
          `SOURCE_SCOPE_MISMATCH insufficient_scope_evidence title="${source.title}" domain=${notebook.domain} keyword_hits=${keywordHits}`
        );
      }

      if (rejectHits >= Math.max(4, keywordHits * 2)) {
        issues.push(
          `SOURCE_SCOPE_MISMATCH closer_to_other_scope title="${source.title}" domain=${notebook.domain} keyword_hits=${keywordHits} reject_hits=${rejectHits}`
        );
      }
    }
  }

  return issues;
}

function filterBundle(bundle) {
  const filter = normalizeText(process.env.NOTEBOOKLM_FILTER);
  if (!filter) {
    return bundle;
  }

  return bundle.filter((notebook) => {
    return [
      notebook.domain,
      notebook.notebook_id,
      notebook.notebook_title,
    ].some((candidate) => normalizeText(candidate).includes(filter));
  });
}

async function launchBrowser(headless) {
  try {
    return await chromium.launch({ headless, channel: 'chrome' });
  } catch {
    return chromium.launch({ headless });
  }
}

async function ensureNotebookReady(page, notebook) {
  await page.goto(`https://notebooklm.google.com/notebook/${notebook.notebook_id}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(4000);

  const currentUrl = page.url();
  if (!currentUrl.startsWith('https://notebooklm.google.com/notebook/')) {
    throw new Error(`Auth invalid or redirect detected: ${currentUrl}`);
  }

  await page
    .getByRole('heading', { name: notebook.notebook_title, exact: true })
    .waitFor({ timeout: 15000 });
}

async function sourceAlreadyPresent(page, notebook, source, syncedKeys) {
  if (syncedKeys.has(getSyncKey(notebook.notebook_id, source.url))) {
    return true;
  }

  const titleSnippet = source.title.split(':')[0].slice(0, 55).trim();
  const checks = [titleSnippet, hostnameOf(source.url)];

  for (const candidate of checks) {
    if (!candidate) {
      continue;
    }
    const count = await page.getByText(candidate, { exact: false }).count().catch(() => 0);
    if (count > 0) {
      return true;
    }
  }

  return false;
}

async function openWebsiteDialog(page) {
  await page.getByRole('button', { name: /Añadir fuente|Añadir fuentes/i }).click();
  await page.getByRole('button', { name: /Sitios web/i }).click();
  await page.getByLabel(/Introduce URLs/i).waitFor({ timeout: 15000 });
}

async function addWebsiteSource(page, source) {
  await openWebsiteDialog(page);

  const input = page.getByLabel(/Introduce URLs/i);
  await input.fill(source.url);
  await page.getByRole('button', { name: /^Insertar$/i }).click();

  const titleSnippet = source.title.split(':')[0].slice(0, 55).trim();
  const host = hostnameOf(source.url);

  await page.waitForFunction(
    ({ snippet, hostName }) => {
      const body = document.body?.innerText || '';
      return body.includes(snippet) || body.includes(hostName);
    },
    { snippet: titleSnippet, hostName: host },
    { timeout: 45000 }
  );
}

async function main() {
  const bundlePath = process.env.BUNDLE_PATH
    ? path.resolve(process.cwd(), process.env.BUNDLE_PATH)
    : DEFAULT_BUNDLE_PATH;
  const statePath = process.env.NOTEBOOKLM_STATE_PATH || DEFAULT_STATE_PATH;
  const headless = process.env.HEADLESS === '1';
  const dryRun = process.env.DRY_RUN === '1';
  const syncStatePath = process.env.NOTEBOOKLM_SYNC_STATE_PATH || DEFAULT_SYNC_STATE_PATH;
  const maxSourcesRaw = process.env.NOTEBOOKLM_MAX_SOURCES;
  const maxSources = maxSourcesRaw ? Number(maxSourcesRaw) : Number.POSITIVE_INFINITY;

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Bundle not found: ${bundlePath}`);
  }

  if (!fs.existsSync(statePath)) {
    throw new Error(`NotebookLM browser state not found: ${statePath}`);
  }

  const bundle = filterBundle(loadBundle(bundlePath));
  const governanceIssues = validateBundle(bundle);
  if (governanceIssues.length > 0) {
    console.error('Decision=NO-GO');
    for (const issue of governanceIssues) {
      console.error(issue);
    }
    process.exit(1);
  }

  console.log(`Bundle: ${path.basename(bundlePath)}`);
  console.log(`State: ${statePath}`);
  console.log(`Sync state: ${syncStatePath}`);
  console.log(`Notebook count: ${bundle.length}`);

  if (dryRun) {
    for (const notebook of bundle) {
      const webSources = (notebook.sources || []).filter((source) => source.url);
      console.log(
        `PLAN ${notebook.domain} ${notebook.notebook_id} web_sources=${Math.min(webSources.length, maxSources)}`
      );
    }
    return;
  }

  const browser = await launchBrowser(headless);
  const syncState = loadSyncState(syncStatePath);
  const syncedKeys = new Set(syncState.synced);
  const context = await browser.newContext({
    storageState: statePath,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });
  const page = await context.newPage();

  let added = 0;
  let skipped = 0;

  try {
    for (const notebook of bundle) {
      console.log(`\n📚 ${notebook.notebook_title} [${notebook.domain}]`);
      await ensureNotebookReady(page, notebook);

      const webSources = (notebook.sources || [])
        .filter((source) => source.url)
        .slice(0, maxSources);

      for (const source of webSources) {
        const syncKey = getSyncKey(notebook.notebook_id, source.url);
        if (await sourceAlreadyPresent(page, notebook, source, syncedKeys)) {
          console.log(`   ⏭️  Skip existing: ${source.title}`);
          syncedKeys.add(syncKey);
          skipped += 1;
          continue;
        }

        console.log(`   ➕ Adding: ${source.title}`);
        await addWebsiteSource(page, source);
        console.log(`   ✅ Added: ${source.title}`);
        syncedKeys.add(syncKey);
        added += 1;
      }
    }
  } finally {
    saveSyncState(syncStatePath, { synced: Array.from(syncedKeys).sort() });
    await context.close();
    await browser.close();
  }

  console.log(`\nDone. added=${added} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
