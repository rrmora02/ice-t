# NNNN · Título corto en infinitivo

- **Estado:** borrador
- **Fecha:** AAAA-MM-DD
- **Migración asociada:** ninguna / `00NN_nombre.sql`

## Problema

Qué pasa hoy y por qué estorba. En términos del negocio, no de la
implementación. Si viene de algo observado en uso real, dilo.

## Para quién

Rol o roles afectados: **admin**, **vendedor**, o ambos. En esta app la
diferencia es grande — di qué ve y qué puede hacer cada uno después del
cambio.

## Qué debe pasar

Comportamiento esperado, en prosa. Sin pantallas ni nombres de archivo
todavía.

## Criterios de aceptación

Lista verificable. Cada línea debe poder comprobarse abriendo la app o
corriendo una consulta; si no se puede comprobar, no es un criterio.

- [ ] …
- [ ] …

## Fuera de alcance

Qué NO entra, para que no crezca a medio camino.

---

## Impacto

Las cuatro secciones siguientes son las que más fallos han evitado en este
proyecto. Si una no aplica, escribe "No aplica" y por qué.

### Base de datos y RLS

¿Hace falta migración? ¿Qué número le toca? ¿Cambia alguna política, algún
trigger o algún RPC? ¿Un vendedor seguiría viendo solo lo suyo?

### Modo offline

¿Afecta a cómo se registra o sincroniza una venta? ¿Puede quedar algo
encolado que el servidor rechace después? ¿Hay que tocar el catálogo
cacheado o `CACHE_VERSION`?

### Fechas y zona horaria

¿Aparece alguna fecha o corte por día? Si sí, debe resolverse contra
`businesses.timezone` por ambos lados — aplicación y SQL.

### Interfaz en móvil

¿Qué pantalla cambia? ¿Cómo se ve a 360 px? ¿Algún campo de fecha o
numérico (ver `MEMORY.md`)?

---

## Plan técnico

Se llena en el paso `/spec-plan`. Archivos a tocar y enfoque. Las
alternativas descartadas, con su motivo, valen más que la elegida.

## Tareas

- [ ] …

## Cómo se verifica

Comandos y comprobaciones concretas. Mínimo `typecheck`, `lint` y `build`.
Si toca la base, las migraciones contra Postgres local. Si toca interfaz,
captura a 360 px.

## Notas de implementación

Se llena al terminar: qué salió distinto a lo planeado y por qué. Lo que
sorprenda, va a `MEMORY.md`.
