ALTER TABLE public.labor_mitigation_actions
  ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS evidence_notes TEXT,
  ADD COLUMN IF NOT EXISTS closure_notes TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_labor_mitigation_owner_email ON public.labor_mitigation_actions(owner_email);
CREATE INDEX IF NOT EXISTS idx_labor_mitigation_due_status ON public.labor_mitigation_actions(status, due_date);

COMMENT ON COLUMN public.labor_mitigation_actions.owner_name IS 'Responsable principal de ejecutar la mitigacion';
COMMENT ON COLUMN public.labor_mitigation_actions.owner_email IS 'Email del responsable principal';
COMMENT ON COLUMN public.labor_mitigation_actions.evidence_notes IS 'Bitacora de seguimiento y evidencias';
COMMENT ON COLUMN public.labor_mitigation_actions.closure_notes IS 'Criterio de cierre o decision final';
COMMENT ON COLUMN public.labor_mitigation_actions.started_at IS 'Momento en el que la mitigacion entro en ejecucion';
COMMENT ON COLUMN public.labor_mitigation_actions.completed_at IS 'Momento de cierre efectivo de la mitigacion';
COMMENT ON COLUMN public.labor_mitigation_actions.last_follow_up_at IS 'Ultimo seguimiento registrado';
