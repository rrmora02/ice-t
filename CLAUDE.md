@AGENTS.md

# Ice-T · Guía del proyecto

PWA mobile-first para administrar la venta de hielo de un negocio. Quien la
usa es un repartidor con un teléfono, muchas veces con mala señal: eso
manda sobre casi todas las decisiones de este repositorio.

## Antes de escribir código

Este proyecto sigue **desarrollo guiado por especificación**. Todo cambio
que no sea un arreglo evidente empieza por un spec en `docs/specs/`.
Lee `docs/specs/README.md` para el flujo completo.

Lee también `MEMORY.md`: recoge las decisiones tomadas y los fallos que ya
nos costaron una vez. Varios no son evidentes leyendo el código.

## Stack

| Pieza | Qué se usa |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript estricto |
| Estilos | Tailwind CSS v4, tokens en `src/app/globals.css` |
| Datos | Supabase (Postgres + Auth + RLS) |
| Offline | Dexie (IndexedDB) + Service Worker propio en `public/sw.js` |
| Gráficas | Recharts |
| Push | Web Push (VAPID) + Edge Function en `supabase/functions/` |

## Dónde vive cada cosa

```
src/app/(app)/<ruta>/page.tsx    Server Component: consulta y arma datos
src/app/(app)/<ruta>/actions.ts  Server Actions: validan sesión, rol y zod
src/components/<feature>/        UI de cada pantalla ("use client")
src/components/ui/               Primitivos: Input, Button, Badge, feedback
src/lib/supabase/                Clientes browser / server / admin
src/lib/offline/                 Cola de ventas y sincronización
src/lib/validation.ts            Esquemas zod compartidos
supabase/migrations/             Esquema, RLS, RPC y vistas (orden estricto)
supabase/scripts/                Mantenimiento manual, NO son migraciones
docs/specs/                      Especificaciones de cada cambio
```

## Reglas que no se negocian

1. **El servidor manda.** Toda mutación pasa por una Server Action o un RPC
   que revalida sesión, rol y datos. El navegador nunca es la última
   palabra: la cola offline y las llamadas directas al RPC lo sortean.
2. **RLS es la red de seguridad real.** Antes de dar por buena una
   restricción, pregúntate si la base la sostendría sola.
3. **Nunca `NEXT_PUBLIC_` en un secreto.** `SUPABASE_SERVICE_ROLE_KEY`
   solo se usa en `src/lib/supabase/admin.ts`, y cualquier id que llegue
   del navegador se valida contra `profiles` antes de usarla.
4. **Las fechas se calculan en la zona horaria del negocio**
   (`businesses.timezone`), nunca con la del servidor. Ver
   `src/lib/business-date.ts`.
5. **Las migraciones solo corren hacia adelante.** Numeradas, idempotentes,
   y se prueban contra un Postgres real antes de entregarlas.
6. **Mobile primero.** Se verifica a 360 px. Un campo que desborda en un
   teléfono es un defecto, no un detalle.

## Comandos

```bash
npm run dev         # desarrollo
npm run typecheck   # next typegen + tsc --noEmit
npm run lint
npm run build
```

`npm run typecheck` necesita `next typegen` antes de `tsc` porque tipos
como `LayoutProps` los genera Next; en un clon limpio `tsc` solo falla.

## Verificación antes de entregar

Mínimo: `typecheck`, `lint` y `build` en verde. Si el cambio toca la base,
además correr las migraciones sobre un Postgres local (ver `MEMORY.md`). Si
toca la interfaz, capturar a 360 px.

Las 3 advertencias de lint sobre `watch()` de react-hook-form son
preexistentes y conocidas.

## Idioma

Código, comentarios, mensajes de commit, specs y textos de la interfaz, en
español. Los identificadores del esquema (tablas, columnas) están en inglés
por consistencia con lo ya existente.
