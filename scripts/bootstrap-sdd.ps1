param(
  [string]$FeatureName = "chat-response-reliability-and-safety",
  [string]$FeatureId = "ANCLORA-CRRS-001",
  [string]$FeatureCode = "CRRS_001",
  [string]$Owner = "@ToniIAPro73",
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$TargetRepoPath,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-DirectoryIfMissing {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
    Write-Host "Created dir: $Path"
  }
}

function Write-TextFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content,
    [switch]$Overwrite
  )

  if ((Test-Path -LiteralPath $Path) -and -not $Overwrite) {
    Write-Host "Skip existing: $Path"
    return
  }

  $parent = Split-Path -Parent $Path
  if ($parent) { New-DirectoryIfMissing -Path $parent }
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
  Write-Host "Wrote file: $Path"
}

$expandedTargetRepoPath = [Environment]::ExpandEnvironmentVariables($TargetRepoPath)
$resolvedRoot = Resolve-Path -LiteralPath $expandedTargetRepoPath -ErrorAction Stop
if (-not (Test-Path -LiteralPath $resolvedRoot.Path -PathType Container)) {
  throw "TargetRepoPath no es un directorio valido: $TargetRepoPath"
}
$root = $resolvedRoot.Path

$dirs = @(
  ".agent/rules",
  ".agent/skills/features/spec-driven-feature-delivery",
  ".agent/skills/features/chat-reliability-and-safety",
  ".agent/skills/features/rag-grounding-and-citations",
  ".agent/skills/features/supabase-data-quality-and-rls",
  ".agent/skills/features/conversation-ux-and-accessibility",
  ".agent/skills/features/observability-and-error-intelligence",
  ".agent/skills/features/$FeatureName",
  ".antigravity/prompts/features/$FeatureName",
  ".antigravity/prompts/features",
  "sdd/.templates",
  "sdd/core",
  "sdd/features/$FeatureName",
  ".github"
)

foreach ($dir in $dirs) {
  New-DirectoryIfMissing -Path (Join-Path $root $dir)
}

$files = @{
  ".agent/rules/workspace-governance.md" = @"
---
trigger: always_on
---

# Workspace Governance - Anclora Advisor AI (SDD)

## Jerarquia normativa
1. `.agent/rules/workspace-governance.md`
2. `.agent/rules/anclora-advisor-ai.md`
3. `AGENTS.md`
4. `sdd/core/*`
5. `sdd/features/<feature>/*`
6. `.agent/skills/**/SKILL.md`
7. `.antigravity/prompts/**`

Si hay conflicto, gana el nivel superior.
"@;
  ".agent/rules/anclora-advisor-ai.md" = @"
---
trigger: always_on
---

# Anclora Advisor AI - Project Rules

1. No exponer secretos en cliente.
2. Mantener tipado estricto y evitar `any`.
3. Toda feature pasa `lint`, `type-check`, `build`.
"@;
  ".agent/rules/feature-$FeatureName.md" = @"
---
trigger: always_on
---

# Feature Rule - $FeatureName

Feature ID: $FeatureId

## Alcance v1
- Contrato estable para endpoint principal de la feature.
- Manejo de errores y timeout.
- Evidencia QA y gate final.
"@;
  ".agent/skills/features/README.md" = @"
# Skills de Features - Anclora Advisor AI
"@;
  ".agent/skills/features/spec-driven-feature-delivery/SKILL.md" = @"
# SKILL: Spec Driven Feature Delivery
"@;
  ".agent/skills/features/chat-reliability-and-safety/SKILL.md" = @"
# SKILL: Chat Reliability and Safety
"@;
  ".agent/skills/features/rag-grounding-and-citations/SKILL.md" = @"
# SKILL: RAG Grounding and Citations
"@;
  ".agent/skills/features/supabase-data-quality-and-rls/SKILL.md" = @"
# SKILL: Supabase Data Quality and RLS
"@;
  ".agent/skills/features/conversation-ux-and-accessibility/SKILL.md" = @"
# SKILL: Conversation UX and Accessibility
"@;
  ".agent/skills/features/observability-and-error-intelligence/SKILL.md" = @"
# SKILL: Observability and Error Intelligence
"@;
  ".agent/skills/features/$FeatureName/SKILL.md" = @"
---
name: feature-$FeatureName
description: "Implementacion de $FeatureId bajo SDD."
---

# Skill - $FeatureName

## Lecturas obligatorias
1) `AGENTS.md`
2) `.agent/rules/workspace-governance.md`
3) `.agent/rules/feature-$FeatureName.md`
4) `sdd/features/$FeatureName/$FeatureName-INDEX.md`
5) `sdd/features/$FeatureName/$FeatureName-spec-v1.md`
6) `sdd/features/$FeatureName/$FeatureName-test-plan-v1.md`
"@;
  ".antigravity/prompts/master-prompt-agentes-paralelos.md" = @"
PROMPT: Orquesta implementacion de una feature por agentes.

PASOS:
1) Agent A.
2) Agent B + Agent C en paralelo.
3) Agent D.
4) Gate final.

REGLAS:
- 1 prompt = 1 commit.
- No saltar orden.
"@;
  ".antigravity/prompts/features/_feature-delivery-baseline.md" = @"
# Feature Delivery Baseline

1. Definir alcance, riesgos y contratos.
2. Implementar por capas: DB -> backend -> frontend -> QA.
3. Ejecutar checks tecnicos.
4. Documentar evidencias en SDD.
"@;
  ".antigravity/prompts/features/_qa-gate-baseline.md" = @"
# QA Gate Baseline

## Validacion de entorno
- Leer `.env.local` y `.env.example`.
- Prohibido hardcodear secrets.

## Validacion i18n
- Cobertura obligatoria en `es` y `en` para texto nuevo/modificado.

## Criterios NO-GO
- Errores en `lint`, `type-check` o `build`.
- `I18N_MISSING_KEYS` distinto de none.
- `ENV_MISMATCH` distinto de none.
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-v1.md" = @"
# Feature v1 - $FeatureName

Feature ID: $FeatureId
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-shared-context.md" = @"
# Shared Context - $FeatureName

Feature ID: $FeatureId
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-master-parallel.md" = @"
# Master Parallel - $FeatureName

Feature ID: $FeatureId

1) Agent A.
2) Agent B + Agent C.
3) Agent D.
4) Gate final.
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-a-spec.md" = @"
# Agent A (Spec) - $FeatureName

TAREAS:
1) Congelar contrato.
2) Alinear spec y test-plan.
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-b-backend.md" = @"
# Agent B (Backend) - $FeatureName

TAREAS:
1) Implementar rutas/servicios backend.
2) Manejo de errores tipado.
3) Pruebas de contrato.
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-c-frontend.md" = @"
# Agent C (Frontend) - $FeatureName

TAREAS:
1) Estados UI claros.
2) Mensajes `es`/`en`.
3) Sin regresion visual.
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-d-qa.md" = @"
# Agent D (QA) - $FeatureName

TAREAS:
1) Validacion de entorno.
2) QA funcional y no-regresion.
3) Ejecutar lint, type-check, build.
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-gate-final.md" = @"
# Gate Final - $FeatureName

PRECONDICIONES:
- QA completado.
- `ENV_MISMATCH` = none.
- `I18N_MISSING_KEYS` = none.
"@;
  "sdd/.templates/spec-feature-template.md" = @"
# Spec Feature Template
"@;
  "sdd/.templates/prompt-feature-template.md" = @"
# Prompt Feature Template
"@;
  "sdd/.templates/skill-feature-template.md" = @"
# Skill Feature Template
"@;
  "sdd/.templates/feature-governance-checklist.md" = @"
# Feature Governance Checklist Template
"@;
  "sdd/.templates/qa-report-template.md" = @"
# QA Report Template
"@;
  "sdd/.templates/gate-final-template.md" = @"
# Gate Final Template
"@;
  "sdd/core/constitution-canonical.md" = @"
# Constitution Canonical - Anclora Advisor AI
"@;
  "sdd/core/product-spec-v0.md" = @"
# Product Spec v0 - Anclora Advisor AI
"@;
  "sdd/core/spec-core-v1.md" = @"
# Spec Core v1
"@;
  "sdd/core/INDEX.md" = @"
# SDD Core Index

- [constitution-canonical.md](./constitution-canonical.md)
- [product-spec-v0.md](./product-spec-v0.md)
- [spec-core-v1.md](./spec-core-v1.md)
- [CHANGELOG.md](./CHANGELOG.md)
"@;
  "sdd/core/CHANGELOG.md" = @"
# Core Changelog
"@;
  "sdd/features/FEATURES.md" = @"
# Features Index

- [$FeatureName](./$FeatureName/$FeatureName-INDEX.md)
"@;
  "sdd/features/$FeatureName/$FeatureName-INDEX.md" = @"
# $FeatureName - INDEX

Feature ID: $FeatureId

- [spec-v1](./$FeatureName-spec-v1.md)
- [test-plan-v1](./$FeatureName-test-plan-v1.md)
- [spec-migration](./$FeatureName-spec-migration.md)
- [qa-report](./QA_REPORT_$FeatureCode.md)
- [gate-final](./GATE_FINAL_$FeatureCode.md)
"@;
  "sdd/features/$FeatureName/$FeatureName-spec-v1.md" = @"
# $FeatureName-spec-v1
"@;
  "sdd/features/$FeatureName/$FeatureName-test-plan-v1.md" = @"
# $FeatureName-test-plan-v1
"@;
  "sdd/features/$FeatureName/$FeatureName-spec-migration.md" = @"
# $FeatureName-spec-migration
"@;
  "sdd/features/$FeatureName/QA_REPORT_$FeatureCode.md" = @"
# QA Report - $FeatureCode
"@;
  "sdd/features/$FeatureName/GATE_FINAL_$FeatureCode.md" = @"
# Gate Final - $FeatureCode
"@;
  ".github/CODEOWNERS" = @"
* $Owner
"@;
  ".github/PULL_REQUEST_TEMPLATE.md" = @"
## Summary

- Feature / change:
- Main risk:
"@;
  "GOVERNANCE.md" = @"
# Governance
"@;
  "CONTRIBUTING.md" = @"
# Contributing
"@;
  "SECURITY.md" = @"
# Security
"@
}

foreach ($relativePath in $files.Keys) {
  $target = Join-Path $root $relativePath
  Write-TextFile -Path $target -Content $files[$relativePath] -Overwrite:$Force
}

Write-Host ""
Write-Host "Bootstrap complete."
Write-Host "Target repo: $root"
Write-Host "Feature scaffold: sdd/features/$FeatureName"
Write-Host "Feature ID: $FeatureId"
Write-Host "Use -Force to overwrite existing files."
