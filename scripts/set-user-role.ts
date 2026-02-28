import * as dotenv from "dotenv";
import * as path from "path";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type SupportedRole = "admin" | "partner" | "user";

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function getConnectionString(): string {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";
}

async function main(): Promise<void> {
  const role = getArg("--role") as SupportedRole | null;
  const email = getArg("--email");
  const userId = getArg("--id");

  if (!role || !["admin", "partner", "user"].includes(role)) {
    console.error('Usage: npm run -s rbac:set-role -- --role <admin|partner|user> [--email user@example.com | --id <uuid>]');
    process.exit(1);
  }

  if (!email && !userId) {
    console.error("You must provide either --email or --id.");
    process.exit(1);
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error("Missing DATABASE_URL/SUPABASE_DB_URL.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    let result = await client.query(
      `
      UPDATE public.users
      SET role = $1, updated_at = NOW()
      WHERE ($2::text IS NULL OR email = $2)
        AND ($3::uuid IS NULL OR id = $3)
      RETURNING id, email, role, is_active
      `,
      [role, email, userId]
    );

    if (result.rowCount === 0) {
      const bootstrapResult = await client.query(
        `
        INSERT INTO public.users (id, email, full_name, role, is_active)
        SELECT
          au.id,
          au.email,
          COALESCE(
            au.raw_user_meta_data->>'full_name',
            au.raw_user_meta_data->>'name',
            split_part(au.email, '@', 1)
          ),
          $1,
          TRUE
        FROM auth.users au
        WHERE ($2::text IS NULL OR au.email = $2)
          AND ($3::uuid IS NULL OR au.id = $3)
        ON CONFLICT (id) DO UPDATE
        SET
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          is_active = TRUE,
          updated_at = NOW()
        RETURNING id, email, role, is_active
        `,
        [role, email, userId]
      );

      if (bootstrapResult.rowCount === 0) {
        console.error("No matching user found in auth.users or public.users.");
        process.exit(1);
      }

      result = bootstrapResult;
    }

    console.log(JSON.stringify(result.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[rbac:set-role] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
