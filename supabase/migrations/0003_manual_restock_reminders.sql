-- =====================================================================
-- Ice-T · Recordatorios de reabasto manuales (por visita, no por ciclo fijo)
-- =====================================================================
-- Cambio de diseño: en vez de una frecuencia fija recalculada sola
-- (last_restock_date + restock_frequency_days), el vendedor/admin captura
-- la próxima fecha de reabasto directamente en cada entrega (le pregunta
-- al cliente "¿en cuántos días te resurto?" y la escribe), porque en la
-- práctica varía visita a visita. `next_restock_date` deja de ser una
-- columna generada y pasa a ser un valor editable normal.
--
-- Ejecuta este archivo DESPUÉS de 0001_init.sql y 0002_views.sql. Si tu
-- proyecto es nuevo y aún no corriste 0001, puedes ignorar este archivo:
-- ya está incorporado ahí si vuelves a copiar la última versión del
-- repo. Si ya corriste 0001/0002 en producción, corre este archivo tal
-- cual, en orden, una sola vez.
-- =====================================================================

-- Convierte next_restock_date de columna generada a columna normal,
-- conservando los valores ya calculados que tuviera cada fila.
alter table public.customers
  alter column next_restock_date drop expression if exists;

-- Ya no se usa una frecuencia fija por cliente.
alter table public.customers
  drop column if exists restock_frequency_days;

comment on column public.customers.next_restock_date is
  'Próxima fecha de reabasto, capturada manualmente en cada entrega (no se recalcula sola).';
