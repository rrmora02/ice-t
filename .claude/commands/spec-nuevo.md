---
description: Crea un spec nuevo en docs/specs/ a partir de una descripción
---

Crea una especificación nueva para: $ARGUMENTS

Pasos:

1. Lee `docs/specs/README.md`, `docs/specs/TEMPLATE.md` y `MEMORY.md` si
   aún no los tienes en contexto.
2. Averigua el siguiente número libre: `ls docs/specs/` y toma el mayor
   `NNNN` más uno, con cuatro dígitos. El primero es `0001`.
3. Explora el código que el cambio tocaría **antes** de escribir. Un spec
   que no sabe dónde vive lo que describe no sirve.
4. Crea `docs/specs/NNNN-slug-corto.md` desde la plantilla, con
   `Estado: borrador` y la fecha de hoy.
5. Llena **sólo hasta "Fuera de alcance"**. El plan técnico y las tareas
   son del paso siguiente: mezclarlos lleva a decidir la implementación
   antes de acordar el problema.
6. Llena también las cuatro secciones de **Impacto**. Si alguna no aplica,
   escribe "No aplica" y una línea de porqué.

Reglas:

- Los criterios de aceptación tienen que poder comprobarse abriendo la app
  o corriendo una consulta. "Debe ser intuitivo" no es un criterio.
- Di explícitamente qué cambia para el **admin** y qué para el
  **vendedor**. En esta app la diferencia pesa.
- Si la descripción es ambigua en algo que cambiaría el diseño, **no lo
  adivines**: escribe el spec con lo que está claro y deja las preguntas
  en una sección "Preguntas abiertas" al final.

Al terminar: no escribas código. Resume en pocas líneas qué propone el
spec, qué preguntas abiertas quedaron, y dile al usuario que lo revise y
cambie `Estado` a `aprobado` cuando esté conforme.
