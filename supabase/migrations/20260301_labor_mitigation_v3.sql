ALTER TABLE public.labor_mitigation_actions
  ADD COLUMN IF NOT EXISTS sla_due_at DATE,
  ADD COLUMN IF NOT EXISTS checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_labor_mitigation_sla_due ON public.labor_mitigation_actions(sla_due_at);

COMMENT ON COLUMN public.labor_mitigation_actions.sla_due_at IS 'Fecha compromiso/SLA para completar la mitigacion';
COMMENT ON COLUMN public.labor_mitigation_actions.checklist_items IS 'Checklist operativo estructurado de la mitigacion';
COMMENT ON COLUMN public.labor_mitigation_actions.evidence_links IS 'Enlaces a evidencias o pruebas externas asociadas';
