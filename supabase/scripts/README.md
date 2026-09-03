# Scripts de mantenimiento

Estos archivos **no son migraciones** y por eso viven fuera de
`supabase/migrations/`: no forman parte de la secuencia que se ejecuta al
montar la base y no deben correrse "por si acaso". Se pegan a mano en el
**SQL Editor** de Supabase cuando hace falta.

| Archivo | Qué hace | Destructivo |
| --- | --- | --- |
| `00_diagnostico.sql` | Reporta qué objetos existen, si se aplicó la migración 0004 y cuántas filas hay por tabla. | No, sólo lee |
| `01_reset-completo.sql` | Borra todos los objetos de Ice-T y todas las cuentas. Después hay que volver a correr las cuatro migraciones. | Sí, irreversible |
| `02_borrar-datos.sql` | Vacía los datos conservando tablas, vistas, funciones y políticas RLS. | Sí, irreversible |
| `03_cambiar-rol.sql` | Asciende un vendedor a administrador, o lo degrada. | No borra nada, pero cambia permisos |

## Cómo elegir

Ejecuta primero `00_diagnostico.sql`:

- **Todo aparece como "FALTA"** — el proyecto está vacío. No necesitas
  limpiar nada: corre las migraciones `0001` a `0004`.
- **Todo "ok" y "0004 aplicado"** — el esquema está al día. Con
  `02_borrar-datos.sql` basta y es más rápido.
- **Falta algo, o "0004" no está aplicado** — el esquema es viejo o quedó
  a medias. Usa `01_reset-completo.sql` y vuelve a correr las cuatro
  migraciones. Dejar un esquema desactualizado con datos nuevos da
  problemas más difíciles de diagnosticar que empezar de cero.

## Antes de ejecutar cualquiera de los dos destructivos

1. Confirma en la esquina superior del panel que estás en el **proyecto
   correcto**. Es el error más caro de todo el proceso.
2. Si hay algo que quieras conservar, expórtalo antes: no hay deshacer.

## Si reutilizas un proyecto de pruebas como producción

Limpiar los datos no limpia las credenciales. La `service_role key` de ese
proyecto pudo haber estado en archivos `.env` locales, capturas o chats
durante las pruebas. Rótala en **Project Settings → API** antes de abrir la
app al público, actualiza la variable en el hosting y vuelve a desplegar.

Revisa también la configuración de **Authentication**, que no se toca al
limpiar la base: el **Site URL** seguirá apuntando a donde lo dejaste
mientras probabas.

## Verificación

Los tres scripts se probaron contra PostgreSQL 16 ejecutando el ciclo
completo: migraciones `0001`–`0004`, siembra de datos a través de los RPC
reales (`create_business_and_admin` y `create_sale`), diagnóstico, limpieza
y vuelta a aplicar las migraciones sobre la base vacía.

## Cambiar el rol de alguien

`03_cambiar-rol.sql` existe porque un `UPDATE` normal sobre `profiles` **no
funciona** desde el SQL Editor. La tabla tiene el trigger
`protect_profile_privileged_columns`, que impide cambiar `role`, `active` o
`business_id` a quien no sea administrador; en el SQL Editor no hay sesión
de usuario, así que `auth.uid()` es nulo y el intento falla con:

```
ERROR: No tienes permiso para cambiar estos campos de tu perfil
```

El script no desactiva el trigger —dejarlo apagado por descuido abriría un
agujero— sino que se identifica como un administrador que ya existe en ese
negocio, y sólo durante esa transacción.

Ten presente lo que implica ascender a alguien: un administrador ve precios,
gastos y el ROI del negocio, y puede crear vendedores y regenerarles la
contraseña.

El script se niega a degradar al último administrador activo de un negocio:
nadie podría volver a gestionarlo.
