CREATE TABLE IF NOT EXISTS public.app_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  domain VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  action VARCHAR(100) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_audit_logs_user_domain_created
  ON public.app_audit_logs(user_id, domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_audit_logs_entity
  ON public.app_audit_logs(entity_type, entity_id, created_at DESC);

ALTER TABLE public.app_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_audit_logs'
      AND policyname = 'app_audit_logs_self_policy'
  ) THEN
    CREATE POLICY app_audit_logs_self_policy
      ON public.app_audit_logs
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE public.app_audit_logs IS 'Auditoria operativa por usuario para modulos de negocio';
