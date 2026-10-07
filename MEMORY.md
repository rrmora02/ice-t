# Memoria del proyecto

Decisiones tomadas y fallos que ya costaron una vez. Casi ninguno se
deduce leyendo el código: por eso están aquí.

Al resolver algo que costó encontrar, añádelo. Al revertir una decisión,
no borres la entrada: anota que cambió y por qué.

---

## Trampas del entorno

### La CSP se calcula al compilar, no al ejecutar

`next.config.ts` arma la cabecera `Content-Security-Policy` leyendo
`NEXT_PUBLIC_SUPABASE_URL`. Si esa variable no está presente **en el
momento del build**, la compilación **termina con éxito** y emite
`connect-src 'self'` — y entonces el navegador bloquea todas las llamadas
a Supabase.

El síntoma desconcierta: la app carga, se ve bien, y el login falla sin
mensaje claro. Comprobado compilando el proyecto sin la variable.

Consecuencias: las variables van en el hosting **antes** del primer
despliegue, y cambiar el proyecto de Supabase obliga a **volver a
desplegar** — editar la variable en el panel no basta.

Verificación rápida en producción:

```bash
curl -sSI https://<dominio>/login | grep -i content-security-policy
```

`connect-src` debe nombrar tu proyecto de Supabase. Si solo dice `'self'`,
el build salió sin la variable.

### Las `NEXT_PUBLIC_` se congelan en el bundle

Se incrustan al compilar. Cambiarlas en el panel del hosting no surte
efecto hasta un nuevo despliegue.

### El servidor corre en UTC

Vercel ejecuta en UTC y el negocio está en `America/Mexico_City` (UTC-6).
Calcular "hoy" con `new Date().toISOString()` hacía que a las **18:00
locales** el corte de "Ventas de hoy" se fuera a cero: para el servidor ya
era el día siguiente y ninguna venta coincidía.

Toda fecha de negocio se resuelve con `src/lib/business-date.ts` contra
`businesses.timezone`. Las vistas SQL hacen lo propio con
`(sold_at at time zone b.timezone)::date` desde la migración 0004. **Las
dos mitades tienen que ir alineadas**: si una usa UTC y la otra la zona
local, el desajuste reaparece, solo que al revés.

---

## Validación

### Los esquemas zod se aplican DOS veces sobre el mismo dato

El formulario valida en el navegador y react-hook-form entrega al Server
Action la **salida ya transformada**; el Server Action vuelve a parsear esa
salida porque no confía en el cliente.

Por eso **todo esquema con `.transform()` debe aceptar su propio
resultado**. `phone`, `address` y `notes` eran
`.optional().or(z.literal(""))`, que acepta `undefined` y `""` pero **no
`null`** — justo lo que producía su propia transformación. Guardar un
cliente fallaba siempre con el mensaje genérico de zod, `"Invalid input"`,
sin decir el campo.

El helper `textoOpcional()` en `src/lib/validation.ts` resuelve el caso.
Al añadir un campo transformado, comprueba que `schema.parse(schema.parse(x))`
no reviente.

### `z.coerce.number()` convierte `""` en `0`

Un campo numérico vacío se guardaba como cero en silencio. Usa
`campoNumerico()`, que distingue vacío, no numérico y fuera de rango, y
responde en español.

### `min` y `step` incoherentes bloquean el formulario

`<input type="number" min="0.01" step="1">` hace que el valor `1` sea
**inválido** para el navegador (los válidos serían 0.01, 1.01, 2.01…). Sin
`noValidate`, el envío se bloquea con un mensaje nativo confuso. Usa el
primitivo `NumberInput`.

---

## Base de datos

### Las migraciones solo corren hacia adelante

`create or replace view` **no puede eliminar una columna**. Reejecutar una
migración anterior a otra que añadió columnas a una vista **falla**; no
"deshace". Si hay que revertir, se escribe una migración nueva.

### `max()` no existe para `jsonb`

Al agregar un `jsonb` en una vista, llévalo al `GROUP BY` en lugar de
envolverlo en `max()`.

### El trigger que impide cambiar roles también bloquea el SQL Editor

`protect_profile_privileged_columns` impide cambiar `role`, `active` o
`business_id` a quien no sea admin. En el SQL Editor no hay sesión, así que
`auth.uid()` es nulo, `is_admin()` da falso y un `UPDATE` directo falla con
`No tienes permiso para cambiar estos campos de tu perfil`.

No desactives el trigger. `supabase/scripts/03_cambiar-rol.sql` se
identifica como un admin existente solo durante esa transacción. Desde la
app no hace falta nada de esto: quien llama ya es admin.

### Un negocio nunca debe quedarse sin administradores activos

Si pasa, nadie puede volver a gestionar precios, gastos ni cuentas, y
recuperarlo exige entrar al SQL Editor. Tanto `cambiarRolMiembro` como
`actualizarEstadoVendedor` lo comprueban. Cualquier operación nueva que
pueda dejar el negocio sin admins debe hacerlo también.

### `create_sale` es autoritativo sobre el precio

Ignora el `unit_price` del navegador y lee el de `ice_products`.
Contrapartida aceptada: una venta guardada offline que se sincroniza
después de un cambio de precio queda al precio del momento de sincronizar.

También acota `sold_at` (futuro se recorta a `now()`, anterior a 30 días se
rechaza) y exige cliente desde la migración 0006.

### Probar migraciones sin Supabase

Postgres 16 está disponible en el contenedor. Con un stub de `auth.users`
y `auth.uid()` se pueden correr las migraciones reales y probar RLS
cambiando `request.jwt.claim.sub`. Es como se detectaron varios de los
fallos de esta lista.

---

## Navegador y PWA

### Safari no ofrece instalar

`beforeinstallprompt` no existe en WebKit, y en iPhone **todos** los
navegadores usan WebKit. El banner de instalación nunca aparece ahí; hay
que añadirla a mano desde Compartir.

Importa porque **en iPhone las notificaciones push solo funcionan con la
app añadida a la pantalla de inicio** (iOS 16.4+).

### Los campos de fecha desbordan en WebKit

`input[type="date"]` tiene un ancho intrínseco propio que ignora
`width: 100%`. Se corrige con `-webkit-appearance: none` en
`globals.css`, que a su vez oculta el icono del calendario en Chromium y
hay que reponerlo.

**No hay WebKit en este contenedor**: las capturas son Chromium. Cualquier
arreglo específico de Safari se verifica en un iPhone real.

### Texto de campos a 16px en móvil

Safari en iOS hace zoom automático al enfocar un campo con fuente menor.

### El Service Worker cachea páginas autenticadas

Cache Storage es por origen, no por usuario. En un teléfono compartido
entre vendedores el siguiente en entrar podía ver la página del anterior.
Al cerrar sesión se limpia (`clearLocalBusinessData`). La cola de ventas
pendientes **no** se borra: son ventas reales sin sincronizar.

Al tocar `public/sw.js`, sube `CACHE_VERSION`. Para cambios que solo viajan
en CSS o JS con hash en el nombre no hace falta.

---

## Herramientas y proceso

**Toda edición por script lleva aserción.** `str.replace` en Python
—y `sed` sin `-E ... /q`— no fallan cuando el patrón no coincide: devuelven
el texto igual y el script termina en 0. Pasó de verdad: el commit `740e33e`
decía "plan técnico" y el plan nunca llegó al archivo, porque el patrón no
coincidía con el documento real. Antes de sustituir, afirma que el patrón
existe; al terminar, afirma que el resultado tiene lo que debía tener. Un
fallo ruidoso cuesta un minuto; un commit que miente cuesta la confianza en
el historial.

Si un comando genera un archivo y otro lo commitea, **únelos con `&&`**. En
líneas separadas, el commit se ejecuta aunque el primero haya fallado.

---

## Decisiones de producto

- **Toda venta va a nombre de un cliente** (migración 0006). Ya no existe
  la venta de mostrador. Las anteriores se conservan en el histórico bajo
  ese nombre: el pasado no se reescribe.
- **El vendedor ve los precios** — los necesita para cobrar — pero no puede
  editarlos.
- **El recordatorio de reabasto es manual por visita**, no un ciclo fijo:
  en la práctica varía cada entrega.
- **Los errores de validación por campo se quedan en línea**, junto al
  campo. Los toasts son para avisos transitorios y acciones globales.

---

## Pendientes conocidos

- Activar **Secure password change** en Supabase, o pedir la contraseña
  actual con `current_password`. Hoy basta una sesión abierta para
  cambiarla.
- No hay banco de pruebas automatizado. La verificación es typecheck, lint,
  build, migraciones contra Postgres local y capturas.
- Sin límite de tasa en las Server Actions.
