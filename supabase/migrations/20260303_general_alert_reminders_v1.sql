CREATE TABLE IF NOT EXISTS public.general_alert_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  recurrence VARCHAR(20) NOT NULL,
  anchor_date DATE NOT NULL,
  lead_days INTEGER NOT NULL DEFAULT 7,
  link_href VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_for DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT general_alert_reminders_category_allowed CHECK (category IN ('fiscal', 'laboral', 'facturacion')),
  CONSTRAINT general_alert_reminders_priority_allowed CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT general_alert_reminders_recurrence_allowed CHECK (recurrence IN ('monthly', 'quarterly', 'yearly')),
  CONSTRAINT general_alert_reminders_lead_days_allowed CHECK (lead_days BETWEEN 0 AND 365)
);

CREATE INDEX IF NOT EXISTS idx_general_alert_reminders_user_active
  ON public.general_alert_reminders(user_id, is_active, anchor_date);

ALTER TABLE public.general_alert_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'general_alert_reminders'
      AND policyname = 'general_alert_reminders_self_policy'
  ) THEN
    CREATE POLICY general_alert_reminders_self_policy
      ON public.general_alert_reminders
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE public.general_alert_reminders IS 'Plantillas de recordatorios recurrentes para renovaciones, vencimientos y suscripciones';
