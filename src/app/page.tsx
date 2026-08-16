import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El middleware ya redirige "/" según la sesión; esta página es un
// respaldo por si acaso.
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
