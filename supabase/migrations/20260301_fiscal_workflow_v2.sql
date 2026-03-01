ALTER TABLE public.fiscal_alerts
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS presented_at DATE;

CREATE INDEX IF NOT EXISTS idx_fiscal_alerts_workflow_status
  ON public.fiscal_alerts(user_id, workflow_status, due_date);

COMMENT ON COLUMN public.fiscal_alerts.workflow_status IS 'Estado de tramitacion fiscal: pending, prepared, presented, closed';
COMMENT ON COLUMN public.fiscal_alerts.presented_at IS 'Fecha efectiva de presentacion de la obligacion';
