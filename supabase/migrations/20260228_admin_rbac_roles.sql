DO $$
BEGIN
  UPDATE public.users
  SET role = CASE
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'partner' THEN 'partner'
    ELSE 'user'
  END
  WHERE role IS DISTINCT FROM CASE
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'partner' THEN 'partner'
    ELSE 'user'
  END;

  ALTER TABLE public.users
    ALTER COLUMN role SET DEFAULT 'user';

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_allowed_values'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_allowed_values
      CHECK (role IN ('admin', 'partner', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_self_read_policy'
  ) THEN
    CREATE POLICY users_self_read_policy
      ON public.users
      FOR SELECT
      USING (id = auth.uid());
  END IF;
END $$;
