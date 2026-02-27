const requiredPublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_KEY ?? readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function validatePublicEnv(): void {
  for (const key of requiredPublicEnv) {
    readEnv(key);
  }
}

