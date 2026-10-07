# Especificaciones

Este proyecto usa **desarrollo guiado por especificación**: antes de tocar
código se escribe qué se va a construir, cómo se sabrá que quedó bien y qué
queda fuera. El spec se revisa, se aprueba y recién entonces se implementa.

No es burocracia por gusto. En este proyecto casi todo cambio roza al menos
una de estas cosas: RLS y roles, la cola offline, las migraciones o la zona
horaria. Las secciones de la plantilla existen para que nada de eso se
decida a medio implementar.

## Cuándo escribir un spec

| Caso | ¿Spec? |
| --- | --- |
| Pantalla, campo o flujo nuevo | Sí |
| Cambio en el esquema, RLS o un RPC | Sí |
| Cambia qué ve o puede hacer un rol | Sí |
| Afecta a cómo se registran o sincronizan ventas | Sí |
| Corregir un fallo concreto y acotado | No, un commit basta |
| Ajuste visual sin cambio de comportamiento | No |

Ante la duda, escríbelo: media hora de spec sale más barata que rehacer una
migración ya aplicada en producción.

## Flujo

```
  /spec-nuevo "..."        →  borrador      (qué y para quién)
       ↓  lo revisas y ajustas
       ↓  marcas Estado: aprobado
  /spec-plan NNNN          →  planeado      (cómo, y en qué tareas)
       ↓  lo revisas
  /spec-impl NNNN          →  implementado  (código + verificación)
```

Cada paso se detiene para que lo revises. El spec es el acuerdo: si al
implementar aparece algo que lo contradice, se actualiza el spec y se
comenta, no se improvisa.

## Convenciones

- Un archivo por spec: `docs/specs/NNNN-slug-corto.md`, numeración
  correlativa de cuatro dígitos empezando en `0001`.
- El número **no** se corresponde con el de las migraciones. Si un spec
  necesita migración, se anota cuál en su sección de base de datos.
- `Estado` arriba del archivo: `borrador`, `aprobado`, `planeado`,
  `implementado` o `descartado`.
- Un spec descartado **no se borra**: se marca y se explica por qué. Saber
  qué se decidió no hacer vale tanto como lo demás.
- Los specs implementados se quedan donde están. Son el registro de por qué
  el código es como es.

## Plantilla

`TEMPLATE.md`. Las secciones que no apliquen se marcan con "No aplica" y
una línea de porqué — no se borran, para que se note que se consideraron.
