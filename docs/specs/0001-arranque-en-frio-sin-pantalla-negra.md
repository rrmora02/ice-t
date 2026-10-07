# 0001 · Eliminar la pantalla negra al abrir la app en frío

- **Estado:** implementado
- **Fecha:** 2026-10-07
- **Migración asociada:** ninguna

## Problema

Al abrir Ice-T en el teléfono después de haber matado el proceso, la
pantalla se queda **completamente negra** varios segundos antes de mostrar
nada. Reportado en iPhone con la app instalada en la pantalla de inicio.

Para un vendedor que abre la app a media ruta, una pantalla negra sin
ningún indicio es indistinguible de que la app se colgó. Lo normal es
cerrarla y volver a abrirla, que empeora la espera.

Revisando el código, no es un único fallo sino tres cosas que se suman:

1. **El lienzo por defecto es negro.** `globals.css` pone
   `color-scheme: light dark` en `html`, pero el fondo sólo se define en
   `body`. Hasta que el CSS se aplica, el navegador pinta el lienzo según
   la preferencia del sistema: con el teléfono en modo oscuro, **negro**.
2. **No hay nada que mostrar mientras llega el HTML.** `start_url` del
   manifiesto es `/dashboard`, que es una ruta dinámica (`requireSession()`
   lee cookies). No hay HTML prerenderizado: el navegador espera un viaje
   completo al servidor antes del primer byte.
3. **El Service Worker va a la red primero** en las navegaciones, así que
   ni siquiera usa la copia en caché mientras espera.

A eso se añade que **no existe ningún `loading.tsx`** en el proyecto, así
que Next.js no tiene un esqueleto que transmitir mientras resuelve la
página en el servidor.

## Para quién

Ambos roles, pero duele sobre todo al **vendedor**: abre la app en la
calle, con peor señal, y es quien más veces la arranca en frío. El
**admin** suele entrar desde una pestaña ya abierta.

## Qué debe pasar

Desde el instante en que se toca el icono y hasta que la pantalla real
está lista, la app debe mostrar algo coherente con su identidad —nunca un
lienzo vacío— y la transición a la pantalla real no debe sentirse como un
salto brusco.

## Criterios de aceptación

- [ ] Al abrir la app en frío con el teléfono en **modo oscuro**, en ningún
      momento se ve un fondo negro ajeno a la app.
- [ ] Al abrir la app en frío con el teléfono en **modo claro**, tampoco se
      ve un destello blanco distinto al fondo de la app.
- [x] Mientras el servidor resuelve el dashboard se muestra un indicador de
      carga, no una pantalla vacía.
- [x] El indicador aparece también al navegar entre secciones si la
      respuesta tarda.
- [x] Nada de lo anterior retrasa la primera pintura: el indicador no puede
      depender de que cargue JavaScript de la aplicación.
- [x] Con la app ya abierta y navegando, no aparece ningún parpadeo nuevo
      que antes no estuviera.

Los dos primeros quedan sin marcar a propósito: el fondo de `html` está
medido en Chromium, pero el problema se reportó en Safari y aquí no hay
WebKit. Los confirma el usuario en su teléfono.

## Fuera de alcance

- Acelerar el dashboard en sí (consultas, índices). Aquí sólo se cubre qué
  se ve mientras tanto.
- Cambiar la estrategia de caché del Service Worker. Se menciona como
  causa, pero tocarla arrastra el modo offline y merece su propio spec.
- Hacer `/dashboard` estático o prerenderizado.

---

## Impacto

### Base de datos y RLS

No aplica. El cambio es de presentación: no toca consultas, políticas ni
migraciones.

### Modo offline

Sin cambios de comportamiento previstos, pero hay que comprobarlo: si el
indicador se añade mal, podría quedarse colgado en lugar de dar paso a
`offline.html` cuando no hay red. El criterio de "no empeora el arranque
sin conexión" debe verificarse a mano en modo avión.

No se toca `public/sw.js`, así que **no hace falta subir `CACHE_VERSION`**
salvo que el plan técnico acabe modificándolo.

### Fechas y zona horaria

No aplica. No aparece ninguna fecha ni corte por día.

### Interfaz en móvil

Es el centro del spec. Hay que verificar a 360 px, en **modo claro y
oscuro**, y con la app **instalada en la pantalla de inicio**, que es donde
se reportó.

Aviso importante: el problema se observó en **iPhone**, y en este entorno
no hay WebKit — las capturas son Chromium. Parte de la verificación tendrá
que hacerla el usuario en su teléfono. Si el plan incluye imágenes de
arranque de iOS (`apple-touch-startup-image`), eso es específico de Safari
y **no se puede comprobar aquí en absoluto**.

---

## Decisiones

Resueltas con el usuario antes de planear:

1. **Esqueleto**, no pantalla de marca.
2. **Sin imágenes de arranque de iOS.** Se descarta el camino
   `apple-touch-startup-image`.
3. **La espera real es de 3 a 4 segundos.** Eso cambia el enfoque: no es un
   parpadeo que tapar, es latencia que reducir. Un esqueleto sobre 4
   segundos sigue siendo una espera de 4 segundos.

## Hallazgo que cambia el alcance

Contando los viajes a Supabase que ocurren **antes del primer byte de
HTML** en un arranque en frío a `/dashboard`:

| Dónde | Llamadas | Encadenadas |
| --- | --- | --- |
| `proxy.ts` → `updateSession` | `auth.getUser()` | 1 |
| `(app)/layout.tsx` → `requireSession()` | `getUser` + `profiles` + `businesses` | 3, secuenciales |
| `dashboard/page.tsx` → `requireSession()` | **las mismas 3, otra vez** | 3, secuenciales |
| `dashboard/page.tsx` → datos | 6 consultas | en paralelo |

Son **siete viajes de ida y vuelta**, seis de ellos en cadena, antes de que
el servidor pueda empezar a responder. Desde un teléfono con mala señal,
eso explica holgadamente los 3-4 segundos.

Lo relevante: `requireSession()` se ejecuta **dos veces por petición** —una
en el layout y otra en la página— y repite las tres consultas. No es
necesario: dentro de una misma petición el resultado es idéntico.

## Plan técnico

El hallazgo cambia el orden de prioridades. Un esqueleto bonito sobre una
espera de 4 segundos sigue siendo una espera de 4 segundos, así que primero
se recorta la espera y después se cubre lo que queda.

Tres cambios independientes entre sí. Ninguno toca base de datos,
`sw.js` ni `offline.html`.

### 1. Memoizar `requireSession()` por petición

`src/lib/session.ts`. Envolver `requireSession` en `cache()` de React.

`cache()` memoiza con alcance de **una** petición: la segunda llamada
dentro del mismo render devuelve el resultado de la primera sin volver a
Supabase. Pasa de seis viajes encadenados a tres.

Es importante que el alcance sea la petición y no el proceso: una caché que
sobreviviera a la petición podría servirle a un usuario la sesión de otro.
`cache()` de React no lo hace, y por eso se usa esta y no un `Map` propio.

`requireAdmin()` no necesita cambios: llama a la versión memoizada y hereda
el ahorro.

### 2. Fondo explícito en `html`

`src/app/globals.css`. Añadir `background: var(--background)` a la regla de
`html`.

Es la causa 1 del problema. Con `color-scheme: light dark` el navegador
pinta el lienzo según la preferencia del sistema antes de que el documento
tenga estilos propios, y en modo oscuro eso es negro. Definiendo el fondo
en `html` —no sólo en `body`— el lienzo arranca ya del color de la app.

### 3. Esqueletos de carga

- `src/components/ui/skeleton.tsx` (nuevo): `Skeleton` para un bloque, y
  `SkeletonScreen` como envoltorio.
- `src/app/(app)/dashboard/loading.tsx`, `ventas/loading.tsx`,
  `clientes/loading.tsx` (nuevos).

`loading.tsx` es el fallback de streaming que Next.js envía **antes** de
terminar de resolver la página. No depende de que cargue JavaScript de la
aplicación: llega en el primer trozo del HTML. Eso satisface el criterio de
"no retrasa la primera pintura".

El esqueleto del dashboard reproduce la forma real de la pantalla —número
de tarjetas, altura de la cabecera— para que al llegar los datos no se note
un salto de maquetación.

Las etiquetas de accesibilidad van una sola vez en `SkeletonScreen`, no por
bloque: con lector de pantalla se oye "Cargando…" en lugar de una ristra de
elementos vacíos. Los bloques van `aria-hidden`.

### Lo que este plan no arregla

El instante **anterior** a que exista un documento —desde que se toca el
icono hasta que iOS entrega la primera pintura al navegador— lo controla el
sistema operativo. La única palanca era `apple-touch-startup-image`, y se
descartó en las decisiones. Así que puede quedar un destello corto que no
depende de este código.

## Tareas

- [x] `requireSession` envuelto en `cache()` de React.
- [x] `background: var(--background)` en la regla de `html`.
- [x] `Skeleton` y `SkeletonScreen` en `src/components/ui/skeleton.tsx`.
- [x] `loading.tsx` en `dashboard`, `ventas` y `clientes`.
- [x] Typecheck, lint y build en verde.
- [x] Fondo de `html` medido en modo claro y oscuro.
- [x] Capturas a 360 px en ambos esquemas, sin desborde horizontal.
- [ ] Confirmación del arranque en frío real en iPhone (la hace el usuario).

## Cómo se verifica

Lo comprobado en este entorno:

1. `npm run typecheck`, `npm run lint` y `npm run build`. En verde; el lint
   deja tres avisos que ya existían antes de este cambio.
2. Fondo de `html` medido en el navegador, no deducido del CSS:
   `rgb(246, 249, 252)` en modo claro y `rgb(11, 18, 32)` en oscuro.
   Ninguno es negro, que era el punto.
3. `sr-only` comprobado en el CSS compilado: Tailwind la emite, así que la
   etiqueta de `SkeletonScreen` queda oculta de verdad y no como texto
   visible.
4. Capturas a 360 px de ancho, en claro y oscuro, de los tres esqueletos.
   Sin desborde horizontal.

Lo que **no** se puede comprobar aquí, y por qué:

- **El arranque en frío en iPhone.** En este contenedor no hay WebKit; las
  capturas son Chromium. El problema se reportó en Safari instalado en la
  pantalla de inicio, que es justo el motor que falta.
- **La mejora de latencia en números.** Pasar de seis viajes a tres es
  verificable leyendo el código, pero cuánto se nota depende de la señal del
  teléfono y de la latencia de Supabase. No hay forma de medirlo desde aquí.
- **El arranque sin conexión.** Se razona, no se mide: no se tocó `sw.js`
  ni `offline.html`, y el esqueleto es un fallback del servidor, así que el
  Service Worker responde antes de que Next llegue a intervenir. Conviene
  confirmarlo en modo avión.

Queda pendiente, entonces, que el usuario abra la app en frío en su iPhone
—en modo oscuro, instalada en la pantalla de inicio— y diga si todavía ve
negro y si la espera se siente más corta.

## Notas de implementación

Implementado en `94b0e69`.

**Error en el registro de commits.** El commit `740e33e` se tituló "spec
0001: plan tecnico", pero el plan **nunca llegó al archivo**. El script que
lo escribía usaba `str.replace` con un patrón que no coincidía con el texto
real del documento, y `replace` no falla cuando no encuentra nada: devuelve
la cadena igual. El commit quedó con un mensaje que describía un contenido
inexistente. El plan que está arriba se escribió después, en el commit que
acompaña a esta nota.

Lección, anotada también en `MEMORY.md`: **toda edición por script lleva
aserción**. Si se busca un patrón para sustituirlo, hay que afirmar primero
que existe; si no, el fallo es silencioso y queda un commit que miente.
