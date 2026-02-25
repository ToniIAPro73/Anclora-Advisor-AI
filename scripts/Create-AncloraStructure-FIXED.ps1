# Create-AncloraStructure.ps1
# Script PowerShell para generar la estructura completa del proyecto Anclora Advisor AI
# VERSIÓN CORREGIDA - Sin errores de sintaxis

param(
    [string]$ProjectPath = "C:\Users\Usuario\Workspace\01_Proyectos\anclora-advisor-ai"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ANCLORA ADVISOR AI - Generador de Estructura" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Ruta del proyecto: $ProjectPath" -ForegroundColor Yellow
Write-Host ""

# Verificar si la carpeta existe
if (-not (Test-Path $ProjectPath)) {
    Write-Host "❌ Error: La carpeta $ProjectPath no existe." -ForegroundColor Red
    exit 1
}

# Cambiar al directorio del proyecto
Set-Location $ProjectPath
Write-Host "✅ Directorio actual: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# PASO 1: CREAR ESTRUCTURA DE CARPETAS
Write-Host "PASO 1: Creando estructura de carpetas..." -ForegroundColor Cyan
Write-Host ""

$folders = @(
    "src\app\api\chat",
    "src\components\features",
    "src\components\shared",
    "src\hooks",
    "src\lib\agents",
    "src\lib\utils",
    "src\styles",
    "src\types",
    "lib\agents",
    "database\migrations",
    "config",
    "docs\setup",
    "docs\architecture",
    "docs\api",
    "tests\unit",
    "tests\integration",
    "scripts",
    "public"
)

foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "📂 Creada: $folder" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Ya existe: $folder" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Estructura de carpetas creada exitosamente" -ForegroundColor Green
Write-Host ""

# PASO 2: CREAR ARCHIVOS CRÍTICOS EN RAÍZ
Write-Host "PASO 2: Creando archivos en raíz..." -ForegroundColor Cyan
Write-Host ""

# .env.example (vacío - para llenar después)
$envContent = @"
# ============================================================
# ANCLORA ADVISOR AI - ENVIRONMENT CONFIGURATION
# Copia este archivo a .env.local y rellena tus valores
# ============================================================

# ============================================================
# SUPABASE CONFIGURATION
# ============================================================
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ============================================================
# AUTHENTICATION
# ============================================================
AUTH_PROVIDER=supabase

# ============================================================
# LLM CONFIGURATION - LOCAL (OLLAMA)
# ============================================================
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:7b-instruct
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest

# ============================================================
# LLM CONFIGURATION - FALLBACK (ANTHROPIC)
# ============================================================
ANTHROPIC_API_KEY=

# ============================================================
# NOTEBOOKLM & MCP CONFIGURATION
# ============================================================
NOTEBOOKLM_GEM_FISCAL_ID=
NOTEBOOKLM_GEM_LABORAL_ID=
NOTEBOOKLM_GEM_MERCADO_ID=

# ============================================================
# EMBEDDING CONFIGURATION
# ============================================================
EMBEDDING_MODEL=sentence-transformers/multilingual-MiniLM-L12-v2
EMBEDDING_DIMENSION=384
EMBEDDING_BATCH_SIZE=32

# ============================================================
# RAG CONFIGURATION
# ============================================================
RAG_SIMILARITY_THRESHOLD=0.6
RAG_TOP_K_RESULTS=5
RAG_ENABLE_RERANKING=true
RAG_CACHE_ENABLED=true
RAG_CACHE_TTL_HOURS=24

# ============================================================
# APLICACIÓN
# ============================================================
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000

# ============================================================
# LOGGING
# ============================================================
LOG_LEVEL=debug
LOG_FORMAT=json
ENABLE_SKILL_LOGGING=true
ENABLE_AUDIT_LOGGING=true

# ============================================================
# MONITORING & OBSERVABILITY
# ============================================================
SENTRY_DSN=
DATADOG_API_KEY=

# ============================================================
# FEATURE FLAGS
# ============================================================
ENABLE_RATE_LIMITING=true
ENABLE_REQUEST_VALIDATION=true
ENABLE_RESPONSE_VALIDATION=true
ENABLE_ERROR_REPORTING=true
"@

$envContent | Out-File ".env.example" -Encoding UTF8 -Force
Write-Host "📄 Creado: .env.example" -ForegroundColor Green

# .gitignore
$gitignoreContent = @"
# dependencies
node_modules/
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
Thumbs.db

# Logs
logs/
*.log

# Temporary files
*.tmp
/tmp

# Python
__pycache__/
*.py[cod]
*`$py.class
*.so
.Python
env/
venv/
.venv
"@

$gitignoreContent | Out-File ".gitignore" -Encoding UTF8 -Force
Write-Host "📄 Creado: .gitignore" -ForegroundColor Green

# package.json
$packageJsonContent = @"
{
  "name": "anclora-advisor-ai",
  "version": "1.0.0",
  "description": "Aplicación de asesoría fiscal, laboral y de mercado automatizada para autónomos pluriactividad",
  "type": "module",
  "main": "server/index.ts",
  "scripts": {
    "dev": "next dev",
    "build": "next build && tsc --noEmit",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "db:setup": "node scripts/setup_db.js",
    "db:seed": "node scripts/seed_db.js"
  },
  "keywords": [
    "asesoría",
    "fiscal",
    "laboral",
    "RAG",
    "LLM",
    "Baleares"
  ],
  "author": "CTO Toni - Anclora Group",
  "license": "PROPRIETARY",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.21.0",
    "@supabase/supabase-js": "^2.38.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.3.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.37",
    "@typescript-eslint/eslint-plugin": "^6.13.1",
    "@typescript-eslint/parser": "^6.13.1",
    "eslint": "^8.54.0",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
"@

$packageJsonContent | Out-File "package.json" -Encoding UTF8 -Force
Write-Host "📄 Creado: package.json" -ForegroundColor Green

# tsconfig.json
$tsconfigContent = @"
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
"@

$tsconfigContent | Out-File "tsconfig.json" -Encoding UTF8 -Force
Write-Host "📄 Creado: tsconfig.json" -ForegroundColor Green

# next.config.js
$nextConfigContent = @"
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
"@

$nextConfigContent | Out-File "next.config.js" -Encoding UTF8 -Force
Write-Host "📄 Creado: next.config.js" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Archivos de raíz creados exitosamente" -ForegroundColor Green
Write-Host ""

# PASO 3: CREAR ARCHIVOS DE CONFIGURACIÓN
Write-Host "PASO 3: Creando archivos de configuración..." -ForegroundColor Cyan
Write-Host ""

# config/llm_config.json
$llmConfigContent = @"
{
  "primary_llm": {
    "type": "local",
    "model": "mistral:7b-instruct",
    "provider": "ollama",
    "base_url": "http://localhost:11434",
    "temperature": 0.2,
    "top_p": 0.9,
    "max_tokens": 2048,
    "context_window": 8192
  },
  "fallback_llm": {
    "type": "api",
    "model": "claude-3-5-sonnet-20241022",
    "provider": "anthropic",
    "temperature": 0.2,
    "max_tokens": 2048
  },
  "embedding_model": {
    "type": "local",
    "model": "sentence-transformers/multilingual-MiniLM-L12-v2",
    "provider": "huggingface_local",
    "dimension": 384,
    "batch_size": 32,
    "device": "cpu"
  },
  "vector_store": {
    "type": "supabase_pgvector",
    "provider": "supabase",
    "table": "rag_chunks",
    "embedding_column": "embedding",
    "similarity_metric": "cosine",
    "similarity_threshold": 0.6,
    "top_k_results": 5
  }
}
"@

$llmConfigContent | Out-File "config\llm_config.json" -Encoding UTF8 -Force
Write-Host "📄 Creado: config\llm_config.json" -ForegroundColor Green

# config/gem_sources.json
$gemSourcesContent = @"
{
  "gems": [
    {
      "id": "gem_fiscal",
      "name": "GEM Fiscal & Administrativo",
      "description": "Cuaderno NotebookLM con normativa RETA, IRPF, IVA, ROAIIB (Baleares 2025-2026)",
      "source_type": "notebooklm",
      "notebooklm_id": "REEMPLAZAR_CON_ID_REAL",
      "embedding_model": "sentence-transformers/multilingual-MiniLM-L12-v2",
      "vector_dimension": 384,
      "chunks_count": 0,
      "last_synced": null,
      "indexed": false,
      "priority": 1,
      "keywords": ["RETA", "IRPF", "IVA", "cuota cero", "retenciones", "ROAIIB"]
    },
    {
      "id": "gem_laboral",
      "name": "GEM Riesgo Laboral & Blindaje Jurídico",
      "description": "Cuaderno NotebookLM con normativa de pluriactividad, buena fe contractual, propiedad intelectual",
      "source_type": "notebooklm",
      "notebooklm_id": "REEMPLAZAR_CON_ID_REAL",
      "embedding_model": "sentence-transformers/multilingual-MiniLM-L12-v2",
      "vector_dimension": 384,
      "chunks_count": 0,
      "last_synced": null,
      "indexed": false,
      "priority": 2,
      "keywords": ["pluriactividad", "buena fe", "competencia", "no concurrencia", "riesgo laboral"]
    },
    {
      "id": "gem_mercado",
      "name": "GEM Mercado Inmobiliario Premium Mallorca",
      "description": "Cuaderno NotebookLM con análisis de mercado (Palma, Son Vida, Andratx, Portals)",
      "source_type": "notebooklm",
      "notebooklm_id": "REEMPLAZAR_CON_ID_REAL",
      "embedding_model": "sentence-transformers/multilingual-MiniLM-L12-v2",
      "vector_dimension": 384,
      "chunks_count": 0,
      "last_synced": null,
      "indexed": false,
      "priority": 3,
      "keywords": ["mercado premium", "Palma", "Son Vida", "Andratx", "Portals", "precios", "m2"]
    }
  ]
}
"@

$gemSourcesContent | Out-File "config\gem_sources.json" -Encoding UTF8 -Force
Write-Host "📄 Creado: config\gem_sources.json" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Archivos de configuración creados exitosamente" -ForegroundColor Green
Write-Host ""

# PASO 4: CREAR ARCHIVOS FUENTE BÁSICOS
Write-Host "PASO 4: Creando archivos fuente básicos..." -ForegroundColor Cyan
Write-Host ""

# src/app/layout.tsx
$layoutContent = @"
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anclora Advisor AI - Asesor Fiscal & Laboral',
  description: 'Aplicación de asesoría fiscal, laboral y de mercado inmobiliario para autónomos pluriactividad',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
"@

$layoutContent | Out-File "src\app\layout.tsx" -Encoding UTF8 -Force
Write-Host "📄 Creado: src\app\layout.tsx" -ForegroundColor Green

# src/app/page.tsx
$pageContent = @"
'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Anclora Advisor AI
          </h1>
          <p className="text-xl text-gray-300">
            Asesor fiscal, laboral y de mercado inmobiliario
          </p>
        </div>

        <div className="mb-12 bg-gray-800 bg-opacity-50 backdrop-blur rounded-lg p-8 border border-gray-700">
          <p className="text-gray-100 text-lg leading-relaxed mb-6">
            Sistema automatizado de asesoría para autónomos en pluriactividad.
            Obtén recomendaciones basadas en normativa Baleares 2025-2026.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
              <h3 className="font-bold text-amber-400 mb-2">Fiscal</h3>
              <p className="text-sm text-gray-300">
                RETA, IRPF, IVA, ROAIIB
              </p>
            </div>
            <div className="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
              <h3 className="font-bold text-amber-400 mb-2">Laboral</h3>
              <p className="text-sm text-gray-300">
                Pluriactividad, Blindaje Jurídico
              </p>
            </div>
            <div className="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
              <h3 className="font-bold text-amber-400 mb-2">Mercado</h3>
              <p className="text-sm text-gray-300">
                Análisis, Posicionamiento
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/chat"
            className="px-8 py-4 bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold rounded-lg transition duration-200 transform hover:scale-105"
          >
            Comenzar Consulta →
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition duration-200 border border-gray-600"
          >
            Dashboard
          </Link>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-700">
          <p className="text-gray-400 text-sm">
            Anclora Group © 2026. Baleares, España.
          </p>
        </div>
      </div>
    </main>
  );
}
"@

$pageContent | Out-File "src\app\page.tsx" -Encoding UTF8 -Force
Write-Host "📄 Creado: src\app\page.tsx" -ForegroundColor Green

# src/app/globals.css
$cssContent = @"
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #1a1a1a;
  --color-accent: #c9a876;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}
"@

$cssContent | Out-File "src\app\globals.css" -Encoding UTF8 -Force
Write-Host "📄 Creado: src\app\globals.css" -ForegroundColor Green

# src/types/index.ts
$typesContent = @"
export type ISO8601 = string;
export type UUID = string;

export type SpecialistType = 'fiscal' | 'labor' | 'market';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RoutingResult {
  primarySpecialist: SpecialistType;
  secondarySpecialists: SpecialistType[];
  confidence: number;
  reasoning: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  routing?: {
    primarySpecialist: string;
    confidence: number;
  };
  citations?: string[];
  alerts?: Array<{ type: string; message: string }>;
}
"@

$typesContent | Out-File "src\types\index.ts" -Encoding UTF8 -Force
Write-Host "📄 Creado: src\types\index.ts" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Archivos fuente creados exitosamente" -ForegroundColor Green
Write-Host ""

# PASO 5: CREAR DOCUMENTACIÓN
Write-Host "PASO 5: Creando documentación..." -ForegroundColor Cyan
Write-Host ""

# README.md
$readmeContent = @"
# Anclora Advisor AI

**Aplicación de Asesoría Fiscal, Laboral y de Mercado Automatizada**

Sistema RAG (Retrieval-Augmented Generation) multi-especialista para autónomos en pluriactividad.

## 🏗️ Stack Tecnológico

- **Frontend:** Next.js 15 + React 19 + Tailwind CSS
- **Backend:** Node.js 20 + TypeScript
- **Base de Datos:** Supabase (PostgreSQL + pgvector)
- **LLM:** Ollama (Mistral 7B local) + Claude (fallback)
- **Orquestación:** Multi-Agent Orchestrator (TypeScript)

## 🚀 Quick Start

\`\`\`bash
# 1. Navega al proyecto
cd anclora-advisor-ai

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
Copy-Item .env.example .env.local
# Editar .env.local con tus credenciales Supabase + Anthropic

# 4. Configurar base de datos
npm run db:setup

# 5. Iniciar desarrollo
npm run dev
\`\`\`

Accede a: \`http://localhost:3000\`

## 📋 Estructura de Carpetas

\`\`\`
src/
├── app/
│   ├── api/chat/route.ts       ← Endpoint POST /api/chat
│   ├── layout.tsx
│   └── page.tsx
├── components/features/        ← Componentes React
├── hooks/useChat.ts            ← Hook para integración
├── lib/agents/orchestrator.ts  ← Orquestador central
└── types/index.ts
\`\`\`

## 🔧 Arquitectura Multi-Agente

\`\`\`
User Query
    ↓
API /api/chat
    ↓
Orchestrator (Router + 3 Specialists)
    ├── RouterAgent: Clasifica consulta
    ├── FiscalSpecialist: RETA, IVA, ROAIIB
    ├── LaborSpecialist: Riesgo laboral, pluriactividad
    └── MarketSpecialist: Análisis mercado Mallorca
    ↓
Response + Alerts + Citations
\`\`\`

## ✅ Próximos Pasos

1. Rellenar \`.env.local\` con credenciales
2. Crear base de datos en Supabase
3. npm run db:setup
4. npm run dev
5. Acceder a http://localhost:3000

## 📞 Contacto

**CTO:** Toni - Anclora Group

---

**Versión:** 1.0.0-alpha | **Última actualización:** Febrero 2026
"@

$readmeContent | Out-File "README.md" -Encoding UTF8 -Force
Write-Host "📄 Creado: README.md" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Documentación creada exitosamente" -ForegroundColor Green
Write-Host ""

# RESUMEN FINAL
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ ESTRUCTURA COMPLETADA EXITOSAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Resumen:" -ForegroundColor Yellow
Write-Host "  ✅ Carpetas creadas: $(@(Get-ChildItem -Directory -ErrorAction SilentlyContinue).Count)"
Write-Host "  ✅ Archivos creados: $(@(Get-ChildItem -File -ErrorAction SilentlyContinue).Count)"
Write-Host ""
Write-Host "📍 Ubicación: $ProjectPath" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Editar .env.local con tus credenciales Supabase + Anthropic"
Write-Host "  2. Ejecutar: npm install"
Write-Host "  3. Ejecutar: npm run db:setup"
Write-Host "  4. Ejecutar: npm run dev"
Write-Host ""
Write-Host "🌐 Accede a: http://localhost:3000" -ForegroundColor Green
Write-Host ""
