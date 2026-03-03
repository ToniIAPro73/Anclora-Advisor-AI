CREATE TABLE IF NOT EXISTS public.general_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  source_entity_type VARCHAR(80),
  source_entity_id UUID,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_date DATE,
  link_href VARCHAR(500),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMP,
  browser_notified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT general_alerts_source_allowed CHECK (source IN ('manual', 'reminder', 'fiscal', 'laboral', 'facturacion')),
  CONSTRAINT general_alerts_category_allowed CHECK (category IN ('fiscal', 'laboral', 'facturacion')),
  CONSTRAINT general_alerts_priority_allowed CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT general_alerts_status_allowed CHECK (status IN ('pending', 'resolved'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_general_alerts_user_source_key
  ON public.general_alerts(user_id, source_key);

CREATE INDEX IF NOT EXISTS idx_general_alerts_user_status_priority
  ON public.general_alerts(user_id, status, priority, due_date);

CREATE INDEX IF NOT EXISTS idx_general_alerts_user_created
  ON public.general_alerts(user_id, created_at DESC);

ALTER TABLE public.general_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'general_alerts'
      AND policyname = 'general_alerts_self_policy'
  ) THEN
    CREATE POLICY general_alerts_self_policy
      ON public.general_alerts
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE public.general_alerts IS 'Centro de alertas general por usuario para fiscal, laboral y facturacion';
