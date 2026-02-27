import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUserFromCookies();
  redirect(user ? "/dashboard/chat" : "/login");
}
