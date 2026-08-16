# Ice-T · Control de venta de hielo

PWA (mobile-first, instalable, con soporte offline) para administrar la venta
de hielo de un negocio: precios por presentación, clientes con recordatorios
de reabasto, ventas (con registro sin conexión), gastos/inversión con
seguimiento de ROI, roles Admin/Vendedor y notificaciones push.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Supabase
(Postgres + Auth + RLS) · Dexie (IndexedDB, cola offline) · Recharts · Web
Push (VAPID).

---

## 1. Crear el proyecto de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratis es
   suficiente para empezar).
2. Ve a **SQL Editor** y ejecuta, en orden, el contenido de:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_views.sql`
   - `supabase/migrations/0003_manual_restock_reminders.sql`
   - `supabase/migrations/0004_security_hardening.sql`

   El 0004 es **obligatorio**: es el que hace que el precio de una venta lo
   ponga el servidor y no el navegador, acota la fecha de la venta, cierra
   los permisos de las funciones y corrige el corte diario para que use la
   zona horaria del negocio en vez de UTC.
3. En **Authentication → Providers**, confirma que "Email" esté habilitado.
   Puedes desactivar "Confirm email" mientras pruebas (así el registro crea
   sesión inmediata); en producción se recomienda dejarlo activo — el flujo
   de `/registro` ya maneja ambos casos.
4. En **Project Settings → API** copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secreta, sólo servidor)

## 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Llena `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` con los valores del paso anterior. Deja
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` para el paso 5 (notificaciones push).

## 3. Instalar dependencias y correr en desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — te llevará a `/login`. Entra a `/registro` para
crear la cuenta de administrador de tu negocio (esto crea el negocio, tu
perfil admin y siembra el catálogo de precios por defecto: bolsas de 1, 2, 3
y 5 kg, y hielo a granel — edítalos en **Precios**).

## 4. Roles

- **Admin**: dueño del negocio. Puede configurar precios, ver/gestionar
  clientes, registrar ventas, ver el dashboard completo, registrar gastos y
  ver el progreso de recuperación de la inversión, y crear/gestionar cuentas
  de vendedores.
- **Vendedor**: cuenta creada por el admin desde **Vendedores** (se genera
  una contraseña temporal que debe compartirse de forma segura; el vendedor
  puede cambiarla en **Configuración → Seguridad**). Puede registrar ventas
  (incluso sin conexión), gestionar clientes y ver su propio dashboard de
  ventas. No ve **la administración de** precios, ni gastos, ni la sección
  de vendedores.

  Precisión sobre los precios: el vendedor sí ve el precio de cada
  presentación —lo necesita para cobrar, y la pantalla de Ventas se lo
  muestra— lo que no puede es editarlo. La política RLS `ice_products_select`
  permite leer el catálogo a todo el negocio y `ice_products_admin_write`
  reserva la escritura al admin.

## 5. Notificaciones push (recordatorios de reabasto)

1. Genera un par de llaves VAPID (una sola vez por proyecto):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Copia la **clave pública** a `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en `.env.local`
   (y en las variables de entorno de tu hosting, ej. Vercel).
3. Despliega la Edge Function que envía los recordatorios:
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase functions deploy send-restock-reminders
   ```
4. Configura los **secrets** de la función (Project Settings → Edge
   Functions → send-restock-reminders, o por CLI):
   ```bash
   npx supabase secrets set \
     VAPID_PUBLIC_KEY=... \
     VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT="mailto:tucorreo@tudominio.com" \
     CRON_SECRET=$(openssl rand -hex 24)
   ```
   `CRON_SECRET` es **obligatorio**: si no está configurado, la función
   responde 500 y no envía nada. Antes se saltaba la comprobación cuando
   faltaba la variable, lo que dejaba la función abierta a cualquiera que
   conociera su URL.
   (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase
   automáticamente en toda Edge Function.)
5. Prográmala para que corra periódicamente (ej. cada hora) con `pg_cron` +
   `pg_net` desde el SQL Editor:
   ```sql
   select cron.schedule(
     'ice-t-restock-reminders',
     '0 * * * *', -- cada hora; ajusta a tu necesidad
     $$
     select net.http_post(
       url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/send-restock-reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', 'EL_MISMO_CRON_SECRET_DE_ARRIBA'
       )
     );
     $$
   );
   ```
   (Si `pg_cron`/`pg_net` no están habilitados, actívalos primero en
   **Database → Extensions**.)
6. Cada usuario activa las notificaciones desde **Configuración →
   Notificaciones de reabasto** (pide permiso del navegador y guarda su
   suscripción). Los recordatorios llegan a los admins del negocio y, si el
   cliente tiene un vendedor asignado, también a esa persona.

## 6. Modo offline (ventas sin conexión)

La pantalla de **Ventas** funciona sin internet una vez que se cargó al
menos una vez: el catálogo de precios y la lista de clientes se cachean en
IndexedDB (Dexie). Si se pierde la conexión, las ventas se guardan en una
cola local y se sincronizan solas al reconectar (o al tocar el indicador de
"pendientes" en la barra superior/lateral). La sincronización usa un
identificador único por venta (`client_uuid`) para que un reintento nunca
duplique una venta ya enviada.

Nota de alcance: esto cubre el caso típico de reparto (la app se abrió con
señal antes de salir a la ruta). Una carga completamente en frío sin ninguna
conexión previa depende del caché del Service Worker (`public/sw.js`), que
guarda la última versión visitada de cada página.

## 7. Seguridad

- Cada tabla tiene **Row Level Security** habilitada; el aislamiento entre
  negocios (multi-tenant) y entre roles vive en la base de datos, no sólo en
  la UI — revisa `supabase/migrations/0001_init.sql`.
- Las ventas se crean únicamente a través del RPC `create_sale`, que valida
  en el servidor que cliente y productos pertenezcan al negocio del
  vendedor autenticado (nunca confía en `business_id` enviado por el
  cliente).
- **El precio de venta lo pone el servidor.** `create_sale` ignora el
  `unit_price` que manda el navegador y lee el precio vigente de
  `ice_products`. Consecuencia a tener presente: una venta guardada offline
  que se sincroniza después de un cambio de precio queda registrada con el
  precio del momento de la sincronización.
- `create_sale` también acota `sold_at`: una fecha futura se recorta a
  `now()` (reloj del teléfono adelantado) y una anterior a 30 días se
  rechaza, para que nadie reescriba históricos ya revisados.
- Las operaciones que usan la `service_role` key comprueban antes, contra
  `profiles`, que el usuario objetivo sea del mismo negocio. Esa llave
  ignora RLS, así que un `id` que llega del navegador jamás se le pasa sin
  validar.
- Las contraseñas temporales de vendedores se generan con el CSPRNG del
  sistema (`node:crypto`), no con `Math.random()`.
- Los mensajes de error de la base no se devuelven crudos al navegador
  (ver `src/lib/errors.ts`): filtraban nombres de tablas, columnas y
  constraints. El detalle completo queda en los logs del servidor.
- Cabeceras de seguridad (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) se aplican a todas las rutas desde
  `next.config.ts`.
- Al cerrar sesión se limpian la caché de páginas del Service Worker y el
  catálogo/clientes guardados en IndexedDB: ambos son por origen, no por
  usuario, y estos teléfonos se comparten entre vendedores. La cola de
  ventas pendientes **no** se borra (son ventas reales sin sincronizar).
- La `service_role` key sólo se usa en `src/lib/supabase/admin.ts`
  (protegido con `import "server-only"`) y únicamente para crear cuentas de
  vendedores desde una Server Action que ya validó que quien llama es admin.
- Todas las mutaciones validan con `zod` en el servidor (`src/lib/
  validation.ts`), independientemente de la validación en el formulario.
- Un trigger de base de datos impide que un vendedor se autopromueva a
  admin editando su propio perfil (ver `protect_profile_privileged_columns`
  en la migración).
- **Pendiente de configurar en el panel de Supabase** (no se puede hacer
  desde el código): activa **Authentication → Providers → Email → Secure
  password change**. Sin eso, `Configuración → Seguridad` permite cambiar
  la contraseña con sólo tener la sesión abierta, sin pedir la contraseña
  actual — basta un teléfono desbloqueado y prestado para quedarse con la
  cuenta.
- **Rate limiting**: Supabase Auth ya limita intentos de login repetidos.
  Para limitar abuso de las Server Actions en producción (ej. muchas
  ventas/gastos por segundo desde una sola cuenta comprometida), se
  recomienda añadir [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
  o las reglas de Firewall de Vercel — no se incluyó un limitador en memoria
  porque en un entorno serverless no persiste entre invocaciones y daría una
  falsa sensación de protección.

## 8. Estructura del proyecto

```
src/app/(app)/...        Rutas autenticadas (dashboard, ventas, clientes,
                          precios, gastos, vendedores, configuración) —
                          cada una con su page.tsx (Server Component) y
                          actions.ts (Server Actions con su propia
                          validación + chequeo de sesión/rol)
src/app/login, /registro  Autenticación
src/components/           UI (primitivos en ui/, y una carpeta por feature)
src/lib/supabase/         Clientes de Supabase (browser, server, admin)
src/lib/offline/          Base local (Dexie) + motor de sincronización
src/lib/validation.ts     Esquemas zod compartidos por formularios y acciones
src/types/db.ts           Tipos de dominio (reflejan el esquema SQL)
supabase/migrations/      Esquema, RLS, funciones RPC y vistas
supabase/functions/       Edge Function de recordatorios push
public/sw.js              Service Worker (cache offline + push)
```

## 9. Despliegue

Cualquier hosting compatible con Next.js App Router funciona (Vercel es el
más simple). Configura ahí las mismas variables de entorno de `.env.local`
(incluyendo `NEXT_PUBLIC_VAPID_PUBLIC_KEY`). No necesitas correr nada más:
la base de datos vive en Supabase, no en el servidor de Next.js.

## 10. Personalizar precios y colores

- Precios: se configuran desde la app (**Precios**), no hay que tocar
  código — los 5 productos iniciales son sólo semilla.
- Colores/tema: `src/app/globals.css` (variables `--brand-from`,
  `--brand-to`, etc.). La paleta de las gráficas del dashboard sigue el
  método del skill de dataviz interno (`src/lib/chart-colors.ts`) — si
  cambias esos colores, revalida contraste/CVD antes de usarlos ahí.
