---
description: Implementa un spec planeado, tarea por tarea
---

Implementa el spec: $ARGUMENTS

Pasos:

1. Localiza el archivo en `docs/specs/` y léelo entero.
2. Si el `Estado` no es `planeado`, dilo y pregunta antes de seguir.
3. Lee `CLAUDE.md` y `MEMORY.md` si no los tienes en contexto.
4. Ejecuta las tareas en orden, marcando cada `- [ ]` como `- [x]`
   conforme las terminas.
5. Al acabar, corre la verificación que el propio spec define. Como mínimo
   `npm run typecheck`, `npm run lint` y `npm run build`.
6. Si el cambio toca la base, corre las migraciones contra un Postgres
   local (ver `MEMORY.md`) antes de darlas por buenas. Nunca entregues una
   migración sin ejecutarla.
7. Si el cambio toca la interfaz, captúrala a 360 px y míralas.
8. Llena **Notas de implementación** con lo que salió distinto a lo
   planeado y por qué.
9. Cambia `Estado` a `implementado`.
10. Si apareció algo que costó encontrar y no está en `MEMORY.md`,
    añádelo ahí.

Durante la implementación:

- Si descubres que el plan no funciona, **para y dilo** antes de
  improvisar algo distinto. Actualiza el spec y explica el cambio.
- Si una tarea resulta innecesaria, márcala y anota por qué, en vez de
  borrarla en silencio.
- No amplíes el alcance. Lo que quedó fuera, fuera queda; si aparece algo
  que merece hacerse, propónlo como spec aparte.

Al terminar: resume qué se construyó, qué se verificó **y cómo**, y qué no
pudiste comprobar en este entorno (por ejemplo Safari, que aquí no existe).
No hagas commit ni push salvo que te lo pidan.
