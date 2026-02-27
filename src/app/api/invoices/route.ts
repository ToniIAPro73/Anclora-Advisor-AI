import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { validateAccessToken } from "@/lib/auth/token";
import { createUserScopedSupabaseClient } from "@/lib/supabase/server-user";

const invoicePayloadSchema = z.object({
  clientName: z.string().min(2).max(255),
  clientNif: z.string().min(5).max(50),
  amountBase: z.number().positive(),
  ivaRate: z.number().min(0).max(100),
  irpfRetention: z.number().min(0).max(100),
  issueDate: z.string().min(8),
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) {
    return { accessToken: null, userId: null, error: "Missing session token" };
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (!user || error) {
    return { accessToken: null, userId: null, error: error ?? "Invalid session token" };
  }

  return { accessToken, userId: user.id, error: null };
}

export async function GET() {
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const supabase = createUserScopedSupabaseClient(auth.accessToken);
  const { data, error } = await supabase
    .from("invoices")
    .select("id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, invoices: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedContext();
  if (!auth.accessToken || !auth.userId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const payload = invoicePayloadSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ success: false, error: "Invalid invoice payload" }, { status: 400 });
  }

  const invoice = payload.data;
  const totalAmount = round2(invoice.amountBase + (invoice.amountBase * invoice.ivaRate) / 100 - (invoice.amountBase * invoice.irpfRetention) / 100);
  const supabase = createUserScopedSupabaseClient(auth.accessToken);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: auth.userId,
      client_name: invoice.clientName,
      client_nif: invoice.clientNif,
      amount_base: round2(invoice.amountBase),
      iva_rate: round2(invoice.ivaRate),
      irpf_retention: round2(invoice.irpfRetention),
      total_amount: totalAmount,
      issue_date: invoice.issueDate,
      status: "draft",
    })
    .select("id, client_name, client_nif, amount_base, iva_rate, irpf_retention, total_amount, issue_date, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, invoice: data });
}

