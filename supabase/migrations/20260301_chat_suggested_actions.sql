ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS suggested_actions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.messages.suggested_actions IS 'Acciones sugeridas por el asistente para rehidratacion de conversaciones';
