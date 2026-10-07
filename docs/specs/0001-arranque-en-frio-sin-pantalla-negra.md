# 0001 · Eliminar la pantalla negra al abrir la app en frío

- **Estado:** planeado
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
- [ ] Mientras el servidor resuelve el dashboard se muestra un indicador de
      carga, no una pantalla vacía.
- [ ] El indicador aparece también al navegar entre secciones si la
      respuesta tarda.
- [ ] Nada de lo anterior retrasa la primera pintura: el indicador no puede
      depender de que cargue JavaScript de la aplicación.
- [ ] Con la app ya abierta y navegando, no aparece ningún parpadeo nuevo
      que antes no estuviera.

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

_Pendiente: se llena en `/spec-plan`._

## Tareas

_Pendiente._

## Cómo se verifica

_Pendiente._

## Notas de implementación

_Pendiente._
