-- Limpieza de flujo de pedidos para Galerias Muebles y Decoraciones.
-- Ejecutar en Supabase SQL Editor cuando el sitio ya no procesara pedidos.
-- Esto elimina definitivamente tablas, politicas, triggers e historial de pedidos.

begin;

drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;

drop type if exists public.order_status;

delete from public.site_settings
where key = 'checkout';

commit;
