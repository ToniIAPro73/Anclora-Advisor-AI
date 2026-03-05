# manual_builder — Generador de Manual de Usuario

Genera un manual de usuario completo en formato **DOCX** para Anclora Advisor AI, tomando capturas de pantalla reales de la aplicación desplegada vía Playwright y ensamblando el documento a partir de una plantilla Word.

---

## Arquitectura

```
manual_builder.py
├── Phase 1 — Screenshots
│   ├── Lee manual.screenshots.yml
│   ├── Autentica en la app (UI login o reutiliza .auth/state.json)
│   ├── Navega cada URL del plan con Playwright (Chromium, 1440×900)
│   └── Guarda PNGs en manual-assets/screenshots/
│
├── Phase 2 — DOCX Assembly
│   ├── Abre la plantilla Word (preserva estilos)
│   ├── Limpia el contenido del cuerpo
│   ├── Rellena todas las secciones del manual
│   ├── Inserta imágenes con caption
│   └── Guarda artifacts/AncoraAdvisorAI_Manual.docx
│
└── Phase 3 — Report
    └── Escribe report.json con índice, secciones, gaps y metadatos
```

---

## Requisitos

| Requisito | Versión mínima |
|-----------|---------------|
| Python | 3.9 |
| playwright | 1.40 |
| python-docx | 1.0 |
| PyYAML | 6.0 |
| Pillow | 9.0 |

### Instalar dependencias

```bash
pip install playwright python-docx pyyaml pillow
python -m playwright install chromium
```

---

## Variables de entorno (OBLIGATORIAS para autenticación)

| Variable | Descripción |
|----------|-------------|
| `MANUAL_TEST_USER` | Correo electrónico de la cuenta de prueba |
| `MANUAL_TEST_PASS` | Contraseña de la cuenta de prueba |

**Contrato de seguridad:**
- Las credenciales se leen **exclusivamente** de variables de entorno.
- Nunca se almacenan en código, YAML, logs ni en `report.json`.
- El archivo `.auth/state.json` está en `.gitignore`.

### Configurar en Windows (PowerShell)

```powershell
$env:MANUAL_TEST_USER = "tu@correo.es"
$env:MANUAL_TEST_PASS = "tu_contraseña"
```

### Configurar en bash / Linux / macOS

```bash
export MANUAL_TEST_USER="tu@correo.es"
export MANUAL_TEST_PASS="tu_contraseña"
```

---

## Uso

### Ejecución completa (recomendada)

```bash
python scripts/manual_builder.py
```

Genera:
- `artifacts/AncoraAdvisorAI_Manual.docx`
- `manual-assets/screenshots/*.png`
- `report.json`

### Opciones de CLI

```
--template PATH      Plantilla Word. Default: docs/Free_Simple_ SAAS_Agreement_Template.docx
--plan PATH          Plan de capturas YAML. Default: manual.screenshots.yml
--out PATH           DOCX de salida. Default: artifacts/AncoraAdvisorAI_Manual.docx
--report PATH        Informe JSON. Default: report.json
--assets-dir PATH    Directorio de capturas. Default: manual-assets/screenshots
--auth-state PATH    storageState de Playwright. Default: .auth/state.json
--headless           Ejecutar Chrome sin interfaz gráfica
--dry-run            Solo tomar capturas (sin ensamblar DOCX)
--skip-screenshots   Reutilizar capturas existentes; solo ensamblar DOCX
```

### Solo capturas (depuración)

```bash
python scripts/manual_builder.py --dry-run
```

### Solo DOCX (con capturas ya existentes)

```bash
python scripts/manual_builder.py --skip-screenshots
```

### Con Chrome headless (para CI/CD)

```bash
python scripts/manual_builder.py --headless
```

---

## Plan de capturas (`manual.screenshots.yml`)

El YAML define qué capturas tomar, en qué URL, con qué selector de espera y opcionalmente qué acciones ejecutar antes de capturar.

```yaml
screenshots:
  - id: "01-login"              # Nombre estable del archivo PNG
    section: "getting_started"  # Sección del manual
    url: "/login"               # Ruta relativa a APP_URL
    caption: "Pantalla de inicio de sesión"
    wait_selector: "input[type='email']"
    full_page: false

  - id: "05-fiscal-new-alert"
    section: "fiscal"
    url: "/dashboard/fiscal"
    caption: "Formulario de nueva alerta fiscal"
    wait_selector: "main"
    pre_actions:
      - action: "click"
        selector: "button:has-text('Nueva alerta')"
        timeout: 8000
        optional: true   # No falla si el botón no existe
```

### Campos de `pre_actions`

| Campo | Descripción |
|-------|-------------|
| `action` | `click`, `fill`, `wait`, `goto` |
| `selector` | Selector CSS o Playwright |
| `timeout` | Timeout en ms (default: 8000) |
| `optional` | Si `true`, el fallo solo genera un warning |
| `value` | Valor a introducir (solo para `fill`) |

---

## Flujo de autenticación

1. **Primera ejecución:** el script abre Chrome con la URL de login, completa el formulario con las credenciales de env vars y guarda el `storageState` en `.auth/state.json`.
2. **Ejecuciones siguientes:** el script reutiliza el `storageState`. Si la sesión ha expirado (redirección al login detectada), re-autentica automáticamente.

---

## Salidas

### `artifacts/AncoraAdvisorAI_Manual.docx`

Manual completo con las secciones:

| Sección | ID |
|---------|----|
| Introducción | `intro` |
| Primeros pasos | `getting_started` |
| Mapa de navegación | `navigation` |
| Chat Asesor (IA) | `chat` |
| Módulo Fiscal | `fiscal` |
| Módulo Laboral | `laboral` |
| Módulo de Facturación | `facturacion` |
| Centro de Alertas | `alertas` |
| Cuenta y preferencias | `account` |
| Glosario | `glossary` |
| Preguntas frecuentes | `faq` |
| Solución de problemas | `troubleshooting` |
| Soporte y contacto | `support` |

### `report.json`

```json
{
  "generated_at": "2026-03-03T10:00:00Z",
  "generated_files": ["artifacts/AncoraAdvisorAI_Manual.docx"],
  "screenshot_index": [...],
  "sections_added": ["intro", "getting_started", ...],
  "gaps": ["Screenshot 'xx' not found", ...],
  "sources_used": {
    "template": "docs/Free_Simple_ SAAS_Agreement_Template.docx",
    "screenshot_plan": "manual.screenshots.yml",
    "app_url": "https://ancloraadvisorai-ten.vercel.app"
  },
  "glossary": ["AEAT", "ATIB", ...],
  "pending_validation": [...]
}
```

---

## Resolución de problemas

### `Missing credentials` al iniciar

Las variables de entorno `MANUAL_TEST_USER` y `MANUAL_TEST_PASS` no están definidas. Defínalas antes de ejecutar el script (ver sección de configuración).

### `Template not found`

La plantilla DOCX no existe en la ruta esperada. Compruebe que el archivo `docs/Free_Simple_ SAAS_Agreement_Template.docx` existe en la raíz del repositorio.

### Capturas en blanco o sin contenido

- Aumente el timeout de `wait_selector` en el YAML.
- Desactive `--headless` para ver el navegador en tiempo real y depurar.
- Compruebe que la sesión es válida navegando manualmente a `APP_URL`.

### `browserType.launchPersistentContext: ... closed`

Otro proceso (p. ej. el servidor MCP de Claude Code) tiene el perfil de Chrome bloqueado. Cierre ese proceso antes de ejecutar el script, o use `--headless` que lanza Chromium sin perfil compartido.

### Selector no encontrado para `pre_actions`

El UI ha cambiado. Abra el navegador sin headless, inspeccione el elemento y actualice el `selector` en `manual.screenshots.yml`. Marque la acción como `optional: true` si es no crítica.

---

## Añadir nuevas capturas

1. Añada una entrada en `manual.screenshots.yml`.
2. Referencie el `id` en `MANUAL_SECTIONS` dentro de `manual_builder.py` (en la subsección correspondiente, campo `screenshot_id`).
3. Ejecute `python scripts/manual_builder.py --dry-run` para verificar la captura.
4. Ejecute sin `--dry-run` para regenerar el DOCX completo.

---

## Integración CI/CD

```yaml
# Ejemplo GitHub Actions
- name: Generate Manual
  env:
    MANUAL_TEST_USER: ${{ secrets.MANUAL_TEST_USER }}
    MANUAL_TEST_PASS: ${{ secrets.MANUAL_TEST_PASS }}
  run: |
    pip install playwright python-docx pyyaml pillow
    python -m playwright install chromium --with-deps
    python scripts/manual_builder.py --headless
```

Añada `MANUAL_TEST_USER` y `MANUAL_TEST_PASS` como secrets del repositorio. **Nunca** los escriba en el YAML del workflow.
