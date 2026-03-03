# GENERAL_ALERTS

## Objetivo

Centro de alertas transversal para `/dashboard/*` con tres categorias:

- `fiscal`
- `laboral`
- `facturacion`

El sistema unifica alertas manuales y alertas automaticas visibles desde la campana del header.

## Componentes

- Tabla `public.general_alerts`
- Tabla `public.general_alert_reminders`
- API `GET/POST /api/general-alerts`
- API `PATCH /api/general-alerts/[alertId]`
- API `GET/POST /api/general-alert-reminders`
- API `PATCH /api/general-alert-reminders/[reminderId]`
- UI `src/components/layout/GeneralAlertCenter.tsx`

## Flujo

1. El topbar carga `/api/general-alerts`.
2. El backend sincroniza alertas automaticas antes de responder.
3. Se agregan en una sola lista:
   - `fiscal_alerts` pendientes
   - `labor_mitigation_actions` activas con `due_date` o `sla_due_at`
   - `invoices` emitidas y no cobradas con antiguedad operativa
4. Las alertas manuales se crean en la misma tabla y conviven con las automaticas.
5. Los recordatorios recurrentes crean un `app_job` con la siguiente ejecucion calculada.
6. El cron interno procesa `general_alert_reminder_generation` y materializa la alerta correspondiente.
7. El cliente ordena por estado, prioridad y vencimiento.
8. Si el navegador concede permiso, las alertas nuevas disparan `Notification`.

## Reglas de sincronizacion

- `source_key` identifica de forma estable cada alerta automatica.
- `source = manual` nunca se toca por el sincronizador.
- `source = reminder` se genera desde plantillas recurrentes y no entra en la reconciliacion de alertas de dominio.
- Si una alerta automatica deja de aplicar, pasa a `status = resolved`.
- Si vuelve a aplicar, el `upsert` la reactiva como `pending`.

## UX

- Campana en header del dashboard.
- Contador de no leidas.
- Alta manual rapida desde el panel.
- Clasificacion visual por prioridad y categoria.
- Alta de recordatorios recurrentes para suscripciones, cuotas y renovaciones.
- Sin scroll global adicional: el panel usa scroll interno.
