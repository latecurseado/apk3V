-- =============================================================
-- Tres Valles · COMUNIDADES (espacios con varios canales)
-- -------------------------------------------------------------
-- Un "community" (dm_groups.kind='community') CONTIENE canales
-- (dm_groups.kind='channel' con parent_id = id de la comunidad).
-- Reutiliza toda la infra de dm_groups/dm_group_members/messages.
-- Membresía explícita por canal → la RLS existente ya cubre acceso.
-- Idempotente. Ejecutar en Supabase Dashboard -> SQL Editor -> Run.
-- =============================================================

-- 1) Relación comunidad → canales
alter table public.dm_groups
    add column if not exists parent_id uuid references public.dm_groups(id) on delete cascade;
create index if not exists dm_groups_parent_idx on public.dm_groups (parent_id) where parent_id is not null;

-- 2) Crear comunidad + canal "General" por defecto (creador = owner de ambos)
create or replace function public.create_community(
    p_name text, p_description text default '', p_avatar_url text default '', p_is_public boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); comm_id uuid; chan_id uuid;
begin
    if uid is null then raise exception 'No autenticado'; end if;
    if coalesce(trim(p_name), '') = '' then raise exception 'Falta el nombre'; end if;

    insert into public.dm_groups (name, description, avatar_url, kind, is_public, created_by)
    values (p_name, p_description, p_avatar_url, 'community', p_is_public, uid)
    returning id into comm_id;
    insert into public.dm_group_members (group_id, user_id, role) values (comm_id, uid, 'owner');

    insert into public.dm_groups (name, kind, is_public, created_by, parent_id)
    values ('General', 'channel', p_is_public, uid, comm_id)
    returning id into chan_id;
    insert into public.dm_group_members (group_id, user_id, role) values (chan_id, uid, 'owner');

    return comm_id;
end;
$$;
grant execute on function public.create_community(text, text, text, boolean) to authenticated;

-- 3) Añadir un canal a una comunidad (solo owner/admin de la comunidad).
--    Añade a TODOS los miembros actuales de la comunidad al nuevo canal.
create or replace function public.add_channel_to_community(p_community_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); chan_id uuid; comm_public boolean;
begin
    if uid is null then raise exception 'No autenticado'; end if;
    if coalesce(trim(p_name), '') = '' then raise exception 'Falta el nombre del canal'; end if;
    if not exists (
        select 1 from public.dm_group_members
        where group_id = p_community_id and user_id = uid and role in ('owner','admin')
    ) then
        raise exception 'Solo el owner/admin de la comunidad puede crear canales';
    end if;
    select is_public into comm_public from public.dm_groups
        where id = p_community_id and kind = 'community';

    insert into public.dm_groups (name, kind, is_public, created_by, parent_id)
    values (p_name, 'channel', coalesce(comm_public, true), uid, p_community_id)
    returning id into chan_id;

    insert into public.dm_group_members (group_id, user_id, role)
    select chan_id, m.user_id,
           case when m.role in ('owner','admin') then m.role else 'member' end
      from public.dm_group_members m
     where m.group_id = p_community_id
    on conflict do nothing;

    return chan_id;
end;
$$;
grant execute on function public.add_channel_to_community(uuid, text) to authenticated;

-- 4) Unirse a una comunidad pública → te añade a la comunidad y a TODOS sus canales
create or replace function public.join_community(p_community_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
    if uid is null then raise exception 'No autenticado'; end if;
    if not exists (
        select 1 from public.dm_groups
        where id = p_community_id and kind = 'community' and (is_public or created_by = uid)
    ) then
        raise exception 'Comunidad no disponible';
    end if;
    insert into public.dm_group_members (group_id, user_id, role)
    values (p_community_id, uid, 'member') on conflict do nothing;
    insert into public.dm_group_members (group_id, user_id, role)
    select c.id, uid, 'member' from public.dm_groups c where c.parent_id = p_community_id
    on conflict do nothing;
end;
$$;
grant execute on function public.join_community(uuid) to authenticated;

-- ¡Listo! Las Comunidades quedan activas. Los canales reutilizan el chat de grupos.
