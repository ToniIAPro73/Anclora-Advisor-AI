# generador_manual

CLI reutilizable para generar un manual de usuario DOCX a partir del repositorio, una plantilla Word y capturas reales tomadas con Playwright contra una app remota.

## Alcance

- `run_mode=remote`
- reutiliza `./.auth/state.json` si la sesión sigue válida
- si falta o caduca el estado, hace login UI con Playwright
- lee credenciales solo desde:
  - `MANUAL_TEST_USER`
  - `MANUAL_TEST_PASS`
- genera:
  - manual DOCX
  - capturas en `./manual-assets/screenshots`
  - `report.json`

## Requisitos

- Python con `python-docx`, `PyYAML` y `playwright`
- Navegador Chromium instalado para Playwright
- Variables de entorno:
  - `MANUAL_TEST_USER`
  - `MANUAL_TEST_PASS`

## Ejecución

```powershell
$env:MANUAL_TEST_USER="usuario@example.com"
$env:MANUAL_TEST_PASS="***"
python scripts/generador_manual.py `
  --app-url https://ancloraadvisorai-ten.vercel.app/ `
  --template docs/Free_Simple_ SAAS_Agreement_Template.docx `
  --output-docx manual-assets/MANUAL_USUARIO_CODEX.docx
```

## Modo sin capturas

Para generar solo el plan, el DOCX base y `report.json` sin abrir Playwright:

```powershell
python scripts/generador_manual.py --plan-only --allow-partial
```

## Archivos

- `scripts/generador_manual.py`: CLI principal
- `manual.screenshots.yml`: plan curado de capturas
- `./.auth/state.json`: sesión persistida
- `./manual-assets/screenshots`: capturas reales
- `./report.json`: resumen de ficheros, gaps y fuentes usadas

## Cómo funciona el login

1. Intenta reutilizar `./.auth/state.json`.
2. Navega a `/dashboard/chat`.
3. Si vuelve a `/login`, rellena el formulario de acceso con `MANUAL_TEST_USER` y `MANUAL_TEST_PASS`.
4. Guarda un nuevo `storageState`.

## Selectores y estabilidad

- viewport fijo `1440x900`
- espera `networkidle`
- oculta toasts si existen
- usa `manual.screenshots.yml`
- si el selector raíz no sirve, lo sustituye por uno estable (`main`, `[role="main"]` o `body`) y reescribe el YAML

## Troubleshooting

- `Las variables MANUAL_TEST_USER y MANUAL_TEST_PASS son obligatorias`
  - exporta ambas variables antes de ejecutar
- `Executable doesn't exist` / navegador ausente
  - instala Chromium con:
    - `python -m playwright install chromium`
    - o `npx playwright install chromium`
- el login abre `/login` aunque exista `.auth/state.json`
  - la sesión ha caducado; el CLI relogueará y sobrescribirá `./.auth/state.json`
- faltan pantallas en el DOCX
  - revisa `report.json` y `manual.screenshots.yml`
  - corrige la acción o el selector raíz de la captura afectada
