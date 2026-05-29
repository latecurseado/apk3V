-- =============================================================
-- Tres Valles · Home customizer · persistencia por usuario
-- -------------------------------------------------------------
-- Guarda qué widgets ve cada usuario en su inicio y en qué orden.
-- Idempotente. Ejecutar en: Supabase Dashboard -> SQL Editor -> Run
-- La RLS de "profiles self update" (del schema MASTER) ya permite que
-- cada usuario actualice su propia fila, así que no hace falta policy nueva.
-- =============================================================

alter table public.profiles
    add column if not exists home_widgets jsonb;

-- (opcional) comentario para documentación del schema
comment on column public.profiles.home_widgets is
    'Array JSON de ids de widgets visibles en el inicio, en orden. NULL = orden por defecto.';
