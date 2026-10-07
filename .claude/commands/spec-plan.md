---
description: Añade plan técnico y tareas a un spec aprobado
---

Añade el plan técnico y las tareas al spec: $ARGUMENTS

(Acepta el número `NNNN` o parte del nombre del archivo.)

Pasos:

1. Localiza el archivo en `docs/specs/`. Si no existe o hay más de un
   candidato, pregunta en vez de elegir.
2. Comprueba el `Estado`. Si no es `aprobado`, dilo y pregunta si sigues
   de todos modos — planear sobre un spec sin revisar suele significar
   replanear después.
3. Lee `MEMORY.md` antes de decidir el enfoque. Varias trampas de este
   repositorio (doble validación de zod, zona horaria, migraciones solo
   hacia adelante, WebKit) cambian el plan.
4. Explora los archivos concretos que vas a tocar. Cita rutas reales.
5. Llena **Plan técnico**, **Tareas** y **Cómo se verifica**.
6. Cambia `Estado` a `planeado`.

Sobre el plan:

- Nombra los archivos por ruta real, no por descripción.
- Si descartaste un enfoque, escríbelo con su motivo. Suele ser lo más
  útil del spec meses después.
- Si hace falta migración, di qué número le toca (el siguiente libre en
  `supabase/migrations/`) y qué hace. Recuerda que solo se corre hacia
  adelante.
- Si el plan contradice algo acordado en la primera mitad del spec, no lo
  silencies: corrige esa parte y señálalo.

Las tareas son pasos ejecutables y verificables, no epígrafes. Incluye las
de verificación.

Al terminar: no escribas código. Resume el enfoque, lo descartado y
cualquier riesgo, y pide revisión antes de implementar.
