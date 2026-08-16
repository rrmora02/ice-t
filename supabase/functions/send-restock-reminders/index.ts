// Supabase Edge Function: send-restock-reminders
// -------------------------------------------------------------------
// Se ejecuta con un cron (ver README/despliegue) una vez al día (o más
// seguido si prefieres) y:
//   1. Busca clientes cuyo próximo reabasto sea HOY o MAÑANA y que aún
//      no tengan un recordatorio enviado hoy (tabla reminder_log).
//   2. Envía una notificación push (Web Push / VAPID) a los admins del
//      negocio y, si el cliente tiene vendedor asignado, también a ese
//      vendedor.
//   3. Registra el envío en reminder_log para no duplicar.
//
// Usa la Service Role Key (inyectada automáticamente por Supabase en
// cada función) para poder leer todas las filas sin RLS: esta función
// corre en un entorno de confianza (servidor), nunca en el navegador.

// @ts-expect-error - especificador remoto de Deno, válido en el runtime de Supabase Edge Functions
import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error - compatibilidad npm de Deno
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface UpcomingRow {
  customer_id: string;
  business_id: string;
  name: string;
  assigned_vendedor_id: string | null;
  next_restock_date: string;
  days_until: number;
}

Deno.serve(async (req: Request) => {
  // Protección simple: exige un secreto compartido para evitar que
  // cualquiera dispare la función (además de requerir la Service Role
  // Key para las consultas). Configúralo como CRON_SECRET en las
  // variables de entorno de la función y en el header al programarla.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== cronSecret) {
      return new Response("No autorizado", { status: 401 });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const { data: upcoming, error } = await supabase
    .from("v_upcoming_restocks")
    .select("*")
    .lte("next_restock_date", tomorrow)
    .gte("next_restock_date", today);

  if (error) {
    console.error("Error consultando v_upcoming_restocks", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const rows = (upcoming ?? []) as UpcomingRow[];
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    // Evita reenviar el mismo recordatorio el mismo día (unique constraint
    // en reminder_log también protege ante ejecuciones concurrentes).
    const { error: logError } = await supabase
      .from("reminder_log")
      .insert({ customer_id: row.customer_id, reminder_date: today });

    if (logError) {
      // Código 23505 = unique_violation -> ya se envió hoy
      skipped += 1;
      continue;
    }

    // Destinatarios: administradores del negocio + vendedor asignado (si hay).
    const { data: recipients } = await supabase
      .from("profiles")
      .select("id")
      .eq("business_id", row.business_id)
      .eq("active", true)
      .or(`role.eq.admin${row.assigned_vendedor_id ? `,id.eq.${row.assigned_vendedor_id}` : ""}`);

    const recipientIds = (recipients ?? []).map((r: { id: string }) => r.id);
    if (recipientIds.length === 0) continue;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", recipientIds);

    const label =
      row.days_until <= 0 ? `hoy` : `mañana`;

    const payload = JSON.stringify({
      title: "Recordatorio de reabasto",
      body: `${row.name} necesita reabasto de hielo ${label}.`,
      url: "/clientes",
      tag: `restock-${row.customer_id}`,
    });

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          payload
        );
        sent += 1;
      } catch (err) {
        console.error("Push falló, eliminando suscripción caduca", sub.endpoint, err);
        // 404/410 = la suscripción ya no existe en el navegador del usuario.
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return new Response(JSON.stringify({ candidates: rows.length, sent, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
