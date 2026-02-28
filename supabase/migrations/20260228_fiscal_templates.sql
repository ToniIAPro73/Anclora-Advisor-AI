CREATE TABLE IF NOT EXISTS public.fiscal_alert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  recurrence VARCHAR(20) NOT NULL,
  due_day INTEGER NOT NULL,
  due_month INTEGER,
  start_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fiscal_alert_templates_user ON public.fiscal_alert_templates(user_id, created_at DESC);

ALTER TABLE public.fiscal_alert_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fiscal_alert_templates'
      AND policyname = 'fiscal_alert_templates_self_policy'
  ) THEN
    CREATE POLICY fiscal_alert_templates_self_policy
      ON public.fiscal_alert_templates
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE public.fiscal_alerts
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.fiscal_alert_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_key VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_alerts_template_period
  ON public.fiscal_alerts(user_id, template_id, period_key)
  WHERE template_id IS NOT NULL;
