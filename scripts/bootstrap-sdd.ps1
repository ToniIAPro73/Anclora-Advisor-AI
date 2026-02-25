param(
  [string]$FeatureName = "chat-response-reliability-and-safety",
  [string]$Owner = "@ToniIAPro73",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir {
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

  $dir = Split-Path -Parent $Path
  if ($dir) { Ensure-Dir -Path $dir }
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
  Write-Host "Wrote file: $Path"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$featureDir = Join-Path $root "sdd/features/$FeatureName"
$featureCode = "CRRS_001"

$dirs = @(
  ".agent/rules",
  ".agent/skills/features/spec-driven-feature-delivery",
  ".agent/skills/features/chat-reliability-and-safety",
  ".agent/skills/features/rag-grounding-and-citations",
  ".agent/skills/features/supabase-data-quality-and-rls",
  ".agent/skills/features/conversation-ux-and-accessibility",
  ".agent/skills/features/observability-and-error-intelligence",
  ".antigravity/prompts/features/$FeatureName",
  "sdd/.templates",
  "sdd/core",
  "sdd/features/$FeatureName",
  ".github"
)

foreach ($dir in $dirs) {
  Ensure-Dir -Path (Join-Path $root $dir)
}

$files = @{
  ".agent/rules/workspace-governance.md" = @"
---
trigger: always_on
---

# Workspace Governance - Anclora Advisor AI (SDD)
"@;
  ".agent/rules/anclora-advisor-ai.md" = @"
---
trigger: always_on
---

# Anclora Advisor AI - Project Rules
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
  ".antigravity/prompts/features/_feature-delivery-baseline.md" = @"
# Feature Delivery Baseline
"@;
  ".antigravity/prompts/features/_qa-gate-baseline.md" = @"
# QA Gate Baseline
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-v1.md" = @"
# Feature v1 - $FeatureName
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-shared-context.md" = @"
# Shared Context - $FeatureName
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-master-parallel.md" = @"
# Master Parallel - $FeatureName
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-a-spec.md" = @"
# Agent A (Spec) - $FeatureName
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-b-backend.md" = @"
# Agent B (Backend) - $FeatureName
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-c-frontend.md" = @"
# Agent C (Frontend) - $FeatureName
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-agent-d-qa.md" = @"
# Agent D (QA) - $FeatureName
"@;
  ".antigravity/prompts/features/$FeatureName/feature-$FeatureName-gate-final.md" = @"
# Gate Final - $FeatureName
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

- [spec-v1](./$FeatureName-spec-v1.md)
- [test-plan-v1](./$FeatureName-test-plan-v1.md)
- [spec-migration](./$FeatureName-spec-migration.md)
- [qa-report](./QA_REPORT_$featureCode.md)
- [gate-final](./GATE_FINAL_$featureCode.md)
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
  "sdd/features/$FeatureName/QA_REPORT_$featureCode.md" = @"
# QA Report - $featureCode
"@;
  "sdd/features/$FeatureName/GATE_FINAL_$featureCode.md" = @"
# Gate Final - $featureCode
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
Write-Host "Feature scaffold: sdd/features/$FeatureName"
Write-Host "Use -Force to overwrite existing files."
