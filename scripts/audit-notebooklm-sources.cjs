#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_BUNDLE_PATH = path.join(__dirname, 'notebook_bundle_phase7_2026.json');
const MCP_ENTRY = path.join(
  process.cwd(),
  'infra',
  'mcp',
  'notebooklm',
  'node_modules',
  'notebooklm-mcp',
  'dist',
  'index.js'
);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function loadBundle(bundlePath) {
  return JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
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

function buildNotebookUrl(notebookId) {
  return `https://notebooklm.google.com/notebook/${notebookId}`;
}

function buildAuditQuestion(notebook) {
  const purposeByDomain = {
    fiscal: 'Solo fiscalidad de autónomo en España/Baleares: IAE, IVA, IRPF, RETA, deducciones, inspección y escenarios de facturación.',
    laboral: 'Solo transición laboral y riesgo: pluriactividad, compatibilidades, conflicto contractual/laboral, timing de salida y riesgo reputacional.',
    mercado: 'Solo posicionamiento premium, narrativa comercial, autoridad y mercado inmobiliario/proptech para conversión.',
  };

  const candidates = (notebook.sources || [])
    .filter((source) => source.url)
    .map((source, index) => {
      return [
        `${index + 1}. title=${source.title}`,
        `url=${source.url}`,
        `reason_for_fit=${source.reason_for_fit}`,
        `content_excerpt=${String(source.content || '').slice(0, 700).replace(/\s+/g, ' ').trim()}`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    'Actúa como auditor estricto de gobernanza para un cuaderno de NotebookLM.',
    `Cuaderno destino: ${notebook.notebook_title}`,
    `Dominio esperado: ${notebook.domain}`,
    `Propósito permitido: ${purposeByDomain[notebook.domain]}`,
    'Evalúa cada candidata propuesta para este cuaderno.',
    'Responde SOLO JSON válido con este formato exacto:',
    '{"decision":"GO|NO-GO","notebook_title":"...","summary":"...","sources":[{"title":"...","decision":"GO|NO-GO","reason":"..."}]}',
    'Marca NO-GO si una fuente se desvía del propósito del cuaderno, mezcla un dominio incorrecto o tiene justificación insuficiente.',
    'No añadas explicación fuera del JSON.',
    '',
    'CANDIDATAS:',
    candidates,
  ].join('\n');
}

function extractJsonPayload(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('AUDIT_INVALID_RESPONSE missing_json');
  }
  return JSON.parse(match[0]);
}

async function callMcpTool(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [MCP_ENTRY], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    let settled = false;
    let buffer = '';

    const settle = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        callback();
      } finally {
        try {
          child.kill();
        } catch {}
      }
    };

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        let payload;
        try {
          payload = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (payload.id !== 2) {
          continue;
        }

        settle(() => {
          if (!payload?.result?.content?.[0]?.text) {
            throw new Error(`AUDIT_INVALID_RESPONSE tool=${name}`);
          }

          resolve({
            text: payload.result.content[0].text,
            stderr,
          });
        });
        return;
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      settle(() => reject(error));
    });

    const timeoutMs = Number(process.env.NOTEBOOKLM_AUDIT_TIMEOUT_MS || 90000);
    const timer = setTimeout(() => {
      settle(() => reject(new Error(`AUDIT_TIMEOUT tool=${name}`)));
    }, timeoutMs);

    child.on('close', () => {
      if (settled) {
        return;
      }

      settle(() => reject(new Error(`AUDIT_MCP_CLOSED tool=${name}`)));
    });

    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'anclora-notebook-audit', version: '1.0.0' },
      },
    }) + '\n');

    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    }) + '\n');
    child.stdin.end();
  });
}

async function auditNotebook(notebook) {
  const response = await callMcpTool('ask_question', {
    notebook_url: buildNotebookUrl(notebook.notebook_id),
    question: buildAuditQuestion(notebook),
    browser_options: {
      headless: true,
      show: false,
      timeout_ms: 90000,
    },
  });

  const toolPayload = extractJsonPayload(response.text);
  if (toolPayload.success === false) {
    throw new Error(`AUDIT_MCP_FAILED ${toolPayload.error}`);
  }

  return extractJsonPayload(toolPayload.data?.answer || toolPayload.answer || response.text);
}

async function main() {
  const bundlePath = process.env.BUNDLE_PATH
    ? path.resolve(process.cwd(), process.env.BUNDLE_PATH)
    : DEFAULT_BUNDLE_PATH;

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Bundle not found: ${bundlePath}`);
  }

  if (!fs.existsSync(MCP_ENTRY)) {
    throw new Error(`MCP entry not found: ${MCP_ENTRY}`);
  }

  const bundle = filterBundle(loadBundle(bundlePath));
  const failures = [];

  console.log(`Bundle: ${path.basename(bundlePath)}`);
  console.log(`MCP: ${MCP_ENTRY}`);
  console.log(`Notebook count: ${bundle.length}`);

  for (const notebook of bundle) {
    console.log(`\n🔎 Auditing ${notebook.notebook_title} [${notebook.domain}]`);
    try {
      const result = await auditNotebook(notebook);
      const sourceFailures = (result.sources || []).filter((source) => source.decision !== 'GO');
      if (result.decision !== 'GO' || sourceFailures.length > 0) {
        failures.push({
          notebook: notebook.notebook_title,
          summary: result.summary || 'Audit rejected by NotebookLM MCP',
          sources: sourceFailures,
        });
        console.log(`   ❌ ${result.summary || 'Rejected'}`);
      } else {
        console.log(`   ✅ ${result.summary || 'Audit passed'}`);
      }
    } catch (error) {
      failures.push({
        notebook: notebook.notebook_title,
        summary: error instanceof Error ? error.message : String(error),
        sources: [],
      });
      console.log(`   ❌ ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0) {
    console.error('\nDecision=NO-GO');
    for (const failure of failures) {
      console.error(`AUDIT_FAILURE notebook="${failure.notebook}" summary="${failure.summary}"`);
      for (const source of failure.sources) {
        console.error(`AUDIT_SOURCE_FAILURE notebook="${failure.notebook}" title="${source.title}" reason="${source.reason}"`);
      }
    }
    process.exit(1);
  }

  console.log('\nDecision=GO');
}

main().catch((error) => {
  console.error('Decision=NO-GO');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
