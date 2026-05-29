-- ============================================================================
-- TRES VALLES — SUPABASE SCHEMA MASTER (todo en uno)
-- ============================================================================
-- Este archivo es la ÚNICA verdad del schema de Supabase.
-- Reemplaza todos los SQL anteriores (schema base + 12 updates + strikes +
-- owner protection + trigger fix + reconciliación de huérfanos).
--
-- Es 100% IDEMPOTENTE — puedes correrlo cuantas veces quieras sin romper
-- nada. Si la base de datos ya tiene algunas cosas, solo agrega lo faltante.
--
-- INSTRUCCIONES:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Pega TODO este archivo (Ctrl+A → Ctrl+V)
--   3. Click "Run"
--   4. Tarda ~10 segundos. Al final muestra estadísticas.
--
-- Después de correrlo NO hace falta ejecutar ningún otro SQL para producción.
-- (El único opcional es supabase-seed-test-users.sql para crear cuentas demo.)
-- ============================================================================

-- ============================================================
-- 0 · EXTENSIONES Y HELPERS GENERALES
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Mantener updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1 · TABLAS PRINCIPALES (idempotentes — solo crea si no existe)
-- ============================================================

-- 1.1 PROFILES — extiende auth.users con datos públicos
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique not null,
    bio text default '',
    pfp text default '',
    role text default 'citizen',
    badges jsonb default '[]'::jsonb,
    is_guest boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Columnas adicionales (de updates 2,3,7,9 — agregadas idempotentemente)
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists birthdate date;
alter table public.profiles add column if not exists banner text default '';
alter table public.profiles add column if not exists online_status text default 'online';
alter table public.profiles add column if not exists custom_status text default '';
alter table public.profiles add column if not exists custom_status_emoji text default '';
alter table public.profiles add column if not exists last_seen timestamptz default now();
alter table public.profiles add column if not exists show_online_status boolean default true;
alter table public.profiles add column if not exists security_q1 text default '';
alter table public.profiles add column if not exists security_a1 text default '';
alter table public.profiles add column if not exists security_q2 text default '';
alter table public.profiles add column if not exists security_a2 text default '';
alter table public.profiles add column if not exists security_q3 text default '';
alter table public.profiles add column if not exists security_a3 text default '';
alter table public.profiles add column if not exists backup_code_hash text default '';
alter table public.profiles add column if not exists is_owner boolean default false;

-- Constraints (drop+recreate para evitar duplicados)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
    check (role in ('citizen', 'admin', 'moderator', 'media', 'bot'));

alter table public.profiles drop constraint if exists profiles_online_status_check;
alter table public.profiles add constraint profiles_online_status_check
    check (online_status in ('online', 'away', 'busy', 'invisible', 'offline'));

create index if not exists profiles_username_idx  on public.profiles(lower(username));
create index if not exists profiles_email_idx     on public.profiles(lower(email));
create index if not exists profiles_last_seen_idx on public.profiles(last_seen desc);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
    for each row execute function public.set_updated_at();

-- 1.2 THREADS — posts del muro
create table if not exists public.threads (
    id uuid primary key default uuid_generate_v4(),
    author_id uuid not null references public.profiles(id) on delete cascade,
    content text not null,
    category text default 'general',
    attachments jsonb default '[]'::jsonb,
    outlet_id text,
    is_shared boolean default false,
    original_thread_id uuid references public.threads(id) on delete set null,
    notify_followers boolean default false,
    is_bot boolean default false,
    is_rich boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
create index if not exists threads_author_idx   on public.threads(author_id);
create index if not exists threads_created_idx  on public.threads(created_at desc);
create index if not exists threads_category_idx on public.threads(category);
drop trigger if exists threads_updated_at on public.threads;
create trigger threads_updated_at before update on public.threads
    for each row execute function public.set_updated_at();

-- 1.3 COMMENTS — anidación arbitraria
create table if not exists public.comments (
    id uuid primary key default uuid_generate_v4(),
    thread_id uuid not null references public.threads(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    parent_id uuid references public.comments(id) on delete cascade,
    content text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
create index if not exists comments_thread_idx on public.comments(thread_id, created_at);
create index if not exists comments_parent_idx on public.comments(parent_id);
drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments
    for each row execute function public.set_updated_at();

-- 1.4 LIKES (polimórficos)
create table if not exists public.likes (
    user_id uuid not null references public.profiles(id) on delete cascade,
    target_type text not null check (target_type in ('thread', 'comment')),
    target_id uuid not null,
    created_at timestamptz default now(),
    primary key (user_id, target_type, target_id)
);
create index if not exists likes_target_idx on public.likes(target_type, target_id);

-- 1.5 REACTIONS (emojis sobre threads)
create table if not exists public.reactions (
    user_id uuid not null references public.profiles(id) on delete cascade,
    thread_id uuid not null references public.threads(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now(),
    primary key (user_id, thread_id, emoji)
);
create index if not exists reactions_thread_idx on public.reactions(thread_id);

-- 1.6 FOLLOWS (follower → followed)
create table if not exists public.follows (
    follower_id uuid not null references public.profiles(id) on delete cascade,
    followed_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (follower_id, followed_id),
    check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on public.follows(followed_id);

-- 1.7 BOOKMARKS
create table if not exists public.bookmarks (
    user_id uuid not null references public.profiles(id) on delete cascade,
    thread_id uuid not null references public.threads(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (user_id, thread_id)
);

-- 1.8 BLOCKS
create table if not exists public.blocks (
    blocker_id uuid not null references public.profiles(id) on delete cascade,
    blocked_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (blocker_id, blocked_id),
    check (blocker_id <> blocked_id)
);

-- 1.9 MUTES (silenciar usuarios — más leve que block)
create table if not exists public.mutes (
    muter_id uuid not null references public.profiles(id) on delete cascade,
    muted_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (muter_id, muted_id),
    check (muter_id <> muted_id)
);
create index if not exists mutes_muter_idx on public.mutes(muter_id);

-- 1.10 NOTIFICATIONS
create table if not exists public.notifications (
    id uuid primary key default uuid_generate_v4(),
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    actor_id uuid references public.profiles(id) on delete cascade,
    type text not null,
    target_type text,
    target_id uuid,
    read boolean default false,
    created_at timestamptz default now()
);
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
    check (type in ('new_thread', 'comment', 'like', 'reaction', 'follow', 'reply', 'mention', 'friend_request'));
create index if not exists notifs_recipient_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifs_unread_idx    on public.notifications(recipient_id) where read = false;

-- 1.11 OUTLETS (medios de noticias)
create table if not exists public.outlets (
    id text primary key,
    name text not null,
    url text not null,
    type text default 'web',
    verified boolean default false,
    created_at timestamptz default now()
);
insert into public.outlets (id, name, url, type, verified) values
    ('laretro',  'La Retro Tres Valles',     'https://www.facebook.com/laretro3valles/?locale=es_LA', 'facebook', true),
    ('elcanero', 'El Cañero de La Cuenca',   'https://www.facebook.com/p/El-Ca%C3%B1ero-de-La-Cuenca-61551521516190/', 'facebook', true)
on conflict (id) do nothing;

-- 1.12 BUSINESSES
create table if not exists public.businesses (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    category text,
    address text,
    phone text,
    description text,
    image text,
    lat double precision,
    lng double precision,
    is_template boolean default false,
    created_at timestamptz default now()
);
create index if not exists businesses_category_idx on public.businesses(category);

-- 1.13 GALLERY
create table if not exists public.gallery (
    id uuid primary key default uuid_generate_v4(),
    uploader_id uuid references public.profiles(id) on delete set null,
    image_url text not null,
    caption text,
    created_at timestamptz default now()
);
create index if not exists gallery_created_idx on public.gallery(created_at desc);

-- 1.14 MESSAGES (chat privado 1-a-1)
create table if not exists public.messages (
    id uuid primary key default uuid_generate_v4(),
    sender_id    uuid not null references public.profiles(id) on delete cascade,
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    content text not null,
    read boolean default false,
    created_at timestamptz default now(),
    check (sender_id <> recipient_id)
);
create index if not exists messages_pair_idx on public.messages(
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id),
    created_at desc
);
create index if not exists messages_recipient_unread_idx
    on public.messages(recipient_id, created_at desc) where read = false;

-- 1.15 ADMIN_EMAILS (lista de correos auto-promote a admin)
create table if not exists public.admin_emails (
    email text primary key,
    added_at timestamptz default now(),
    notes text
);
insert into public.admin_emails (email, notes)
values ('pymhermidaj@gmail.com', 'Admin principal · seed inicial')
on conflict (email) do nothing;

-- 1.16 COMMUNITY_VIDEOS (videos de YouTube añadidos por admin)
create table if not exists public.community_videos (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    description text default '',
    youtube_id text not null,
    category text default 'general',
    featured boolean default false,
    added_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now()
);
create index if not exists community_videos_featured_idx on public.community_videos(featured);
create index if not exists community_videos_created_idx  on public.community_videos(created_at desc);

-- 1.17 BANS
create table if not exists public.bans (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    banned_by uuid references public.profiles(id) on delete set null,
    reason text default '',
    is_permanent boolean default false,
    expires_at timestamptz,
    created_at timestamptz default now(),
    unique(user_id)
);
-- Nota: usamos índice simple en lugar de parcial porque `now()` no es IMMUTABLE
-- (PostgreSQL rechaza now() en index predicates). El WHERE se aplica en queries.
create index if not exists bans_user_idx on public.bans(user_id);
create index if not exists bans_expires_idx on public.bans(expires_at) where expires_at is not null;

-- 1.18 FRIEND_REQUESTS
create table if not exists public.friend_requests (
    id uuid primary key default uuid_generate_v4(),
    from_user_id uuid not null references public.profiles(id) on delete cascade,
    to_user_id   uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
    created_at timestamptz default now(),
    responded_at timestamptz,
    check (from_user_id <> to_user_id)
);
create index if not exists fr_to_pending_idx   on public.friend_requests(to_user_id, status, created_at desc);
create index if not exists fr_from_pending_idx on public.friend_requests(from_user_id, status, created_at desc);
create unique index if not exists fr_pair_unique on public.friend_requests(
    least(from_user_id, to_user_id),
    greatest(from_user_id, to_user_id)
) where status in ('pending', 'accepted');

-- 1.19 USER_STRIKES (sistema disciplinario manual)
create table if not exists public.user_strikes (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    given_by uuid references public.profiles(id) on delete set null,
    reason text not null default '',
    severity text not null default 'minor' check (severity in ('minor', 'major', 'severe')),
    revoked boolean default false,
    revoked_reason text default '',
    revoked_by uuid references public.profiles(id) on delete set null,
    revoked_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz default now()
);
create index if not exists user_strikes_user_idx on public.user_strikes(user_id, created_at desc);
-- Nota: usamos solo `revoked = false` (que sí es IMMUTABLE) en el predicado.
-- `now()` no se puede usar en predicates de index — el filtro de expires_at
-- se hace en runtime al consultar.
create index if not exists user_strikes_active_idx on public.user_strikes(user_id, severity)
    where revoked = false;

-- ============================================================
-- 2 · HELPER FUNCTIONS
-- ============================================================

-- ¿Es admin?
create or replace function public.is_admin(uid uuid)
returns boolean as $$
    select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$ language sql stable security definer;

-- ¿Es owner? (super-admin protegido)
create or replace function public.is_owner(uid uuid)
returns boolean as $$
    select exists (select 1 from public.profiles where id = uid and is_owner = true);
$$ language sql stable security definer;

-- ¿Está baneado?
create or replace function public.is_banned(uid uuid)
returns boolean
language sql stable as $$
    select exists (
        select 1 from public.bans
        where user_id = uid
          and (is_permanent = true or (expires_at is not null and expires_at > now()))
    );
$$;

-- ¿Son amigos?
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql stable as $$
    select exists (
        select 1 from public.friend_requests
        where status = 'accepted'
          and ((from_user_id = p_a and to_user_id = p_b)
            or (from_user_id = p_b and to_user_id = p_a))
    );
$$;

-- Strike count activo
create or replace function public.get_active_strike_count(p_user_id uuid)
returns integer language sql stable as $$
    select count(*)::integer from public.user_strikes
    where user_id = p_user_id and revoked = false
      and (expires_at is null or expires_at > now());
$$;

-- Strike weight activo (severity-weighted)
create or replace function public.get_strike_weight(p_user_id uuid)
returns integer language sql stable as $$
    select coalesce(sum(case severity when 'severe' then 5 when 'major' then 3 else 1 end), 0)::integer
    from public.user_strikes
    where user_id = p_user_id and revoked = false
      and (expires_at is null or expires_at > now());
$$;

-- ============================================================
-- 3 · TRIGGER handle_new_user (versión completa estilo "cuenta real")
-- Crea profile automáticamente con TODAS las features activas:
--   - Username único derivado de Google name / email
--   - Avatar de Google si lo proveyó
--   - online_status, last_seen, show_online_status configurados
--   - Notificación de bienvenida automática
--   - Auto-promote a admin si email está en admin_emails
--   - Auto-promote a owner si username = pimpiling
-- Soporta Google OAuth, email/password, todos los flujos.
-- NUNCA bloquea el signup (loguea warning si falla algo).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
    base_username text;
    final_username text;
    counter int := 0;
    initial_role text := 'citizen';
    google_pfp text;
    google_full_name text;
    bd date;
    new_profile_id uuid;
begin
    -- Extraer username preferido (de metadata o derivar del email)
    base_username := coalesce(
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'preferred_username',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(coalesce(new.email, 'user'), '@', 1)
    );
    base_username := lower(regexp_replace(base_username, '[^a-z0-9_]', '_', 'g'));
    base_username := substring(base_username from 1 for 30);
    if length(base_username) = 0 then
        base_username := 'user' || substring(new.id::text from 1 for 8);
    end if;
    final_username := base_username;

    -- Garantizar unicidad
    while exists (select 1 from public.profiles where username = final_username) loop
        counter := counter + 1;
        final_username := base_username || counter::text;
        if counter > 1000 then
            final_username := base_username || '_' || substring(new.id::text from 1 for 8);
            exit;
        end if;
    end loop;

    -- birthdate (opcional, del registro email/password)
    begin
        bd := nullif(new.raw_user_meta_data->>'birthdate', '')::date;
    exception when others then
        bd := null;
    end;

    -- Auto-promote a admin si email está en admin_emails
    if new.email is not null and exists (
        select 1 from public.admin_emails where lower(email) = lower(new.email)
    ) then
        initial_role := 'admin';
    end if;

    -- Avatar de Google (preferido) o lo que sea que vino en metadata
    google_pfp := coalesce(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'picture',
        new.raw_user_meta_data->>'pfp',
        ''
    );

    -- Nombre completo de Google (para bio inicial si lo quieres)
    google_full_name := coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        ''
    );

    -- INSERT del profile con TODOS los campos (no confiamos en defaults)
    insert into public.profiles (
        id, username, pfp, banner, bio, email, birthdate,
        role, is_guest, badges,
        online_status, custom_status, custom_status_emoji, last_seen, show_online_status,
        is_owner, created_at, updated_at
    )
    values (
        new.id,
        final_username,
        google_pfp,
        '',                               -- banner vacío (lo personaliza después)
        '',                               -- bio vacía
        new.email,
        bd,
        initial_role,
        coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false),
        '[]'::jsonb,                      -- badges vacío
        'online',                         -- online por defecto
        '',                               -- sin custom status
        '',                               -- sin emoji
        now(),                            -- last_seen now
        true,                             -- show_online_status
        (lower(final_username) = 'pimpiling'),  -- auto-flag owner si es pimpiling
        now(),
        now()
    )
    on conflict (id) do update set
        email = excluded.email,
        pfp = case when public.profiles.pfp = '' or public.profiles.pfp is null
                   then excluded.pfp else public.profiles.pfp end,
        last_seen = now()
    returning id into new_profile_id;

    -- Notificación de bienvenida (si la inserción del profile fue exitosa)
    if new_profile_id is not null then
        begin
            insert into public.notifications (recipient_id, actor_id, type, target_type, target_id, read)
            values (new_profile_id, new_profile_id, 'mention', null, null, false);
        exception when others then
            -- Si la notificación falla, no es crítico
            null;
        end;
    end if;

    return new;
exception when others then
    -- NUNCA bloqueamos el signup. Loguemos el warning para debug.
    raise warning 'handle_new_user falló para % (%): %', new.email, new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ============================================================
-- 4 · ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.threads         enable row level security;
alter table public.comments        enable row level security;
alter table public.likes           enable row level security;
alter table public.reactions       enable row level security;
alter table public.follows         enable row level security;
alter table public.bookmarks       enable row level security;
alter table public.blocks          enable row level security;
alter table public.mutes           enable row level security;
alter table public.notifications   enable row level security;
alter table public.outlets         enable row level security;
alter table public.businesses      enable row level security;
alter table public.gallery         enable row level security;
alter table public.messages        enable row level security;
alter table public.admin_emails    enable row level security;
alter table public.community_videos enable row level security;
alter table public.bans            enable row level security;
alter table public.friend_requests enable row level security;
alter table public.user_strikes    enable row level security;

-- PROFILES
drop policy if exists profiles_read_all on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_read_all   on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- THREADS
drop policy if exists threads_read_all   on public.threads;
drop policy if exists threads_insert_own on public.threads;
drop policy if exists threads_update_own on public.threads;
drop policy if exists threads_delete_own on public.threads;
create policy threads_read_all   on public.threads for select using (true);
create policy threads_insert_own on public.threads for insert with check (auth.uid() = author_id);
create policy threads_update_own on public.threads for update using (auth.uid() = author_id);
create policy threads_delete_own on public.threads for delete using (auth.uid() = author_id or public.is_admin(auth.uid()));

-- COMMENTS
drop policy if exists comments_read_all   on public.comments;
drop policy if exists comments_insert_own on public.comments;
drop policy if exists comments_update_own on public.comments;
drop policy if exists comments_delete_own on public.comments;
create policy comments_read_all   on public.comments for select using (true);
create policy comments_insert_own on public.comments for insert with check (auth.uid() = author_id);
create policy comments_update_own on public.comments for update using (auth.uid() = author_id);
create policy comments_delete_own on public.comments for delete using (auth.uid() = author_id or public.is_admin(auth.uid()));

-- LIKES, REACTIONS, FOLLOWS, BOOKMARKS, BLOCKS, MUTES
drop policy if exists likes_read_all   on public.likes;
drop policy if exists likes_insert_own on public.likes;
drop policy if exists likes_delete_own on public.likes;
create policy likes_read_all   on public.likes for select using (true);
create policy likes_insert_own on public.likes for insert with check (auth.uid() = user_id);
create policy likes_delete_own on public.likes for delete using (auth.uid() = user_id);

drop policy if exists reactions_read_all   on public.reactions;
drop policy if exists reactions_insert_own on public.reactions;
drop policy if exists reactions_delete_own on public.reactions;
create policy reactions_read_all   on public.reactions for select using (true);
create policy reactions_insert_own on public.reactions for insert with check (auth.uid() = user_id);
create policy reactions_delete_own on public.reactions for delete using (auth.uid() = user_id);

drop policy if exists follows_read_all   on public.follows;
drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;
create policy follows_read_all   on public.follows for select using (true);
create policy follows_insert_own on public.follows for insert with check (auth.uid() = follower_id);
create policy follows_delete_own on public.follows for delete using (auth.uid() = follower_id);

drop policy if exists bookmarks_read_own   on public.bookmarks;
drop policy if exists bookmarks_insert_own on public.bookmarks;
drop policy if exists bookmarks_delete_own on public.bookmarks;
create policy bookmarks_read_own   on public.bookmarks for select using (auth.uid() = user_id);
create policy bookmarks_insert_own on public.bookmarks for insert with check (auth.uid() = user_id);
create policy bookmarks_delete_own on public.bookmarks for delete using (auth.uid() = user_id);

drop policy if exists blocks_read_own   on public.blocks;
drop policy if exists blocks_insert_own on public.blocks;
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_read_own   on public.blocks for select using (auth.uid() = blocker_id);
create policy blocks_insert_own on public.blocks for insert with check (auth.uid() = blocker_id);
create policy blocks_delete_own on public.blocks for delete using (auth.uid() = blocker_id);

drop policy if exists mutes_read_own   on public.mutes;
drop policy if exists mutes_insert_own on public.mutes;
drop policy if exists mutes_delete_own on public.mutes;
create policy mutes_read_own   on public.mutes for select using (auth.uid() = muter_id);
create policy mutes_insert_own on public.mutes for insert with check (auth.uid() = muter_id);
create policy mutes_delete_own on public.mutes for delete using (auth.uid() = muter_id);

-- NOTIFICATIONS
drop policy if exists notifs_read_own   on public.notifications;
drop policy if exists notifs_update_own on public.notifications;
drop policy if exists notifs_delete_own on public.notifications;
drop policy if exists notifs_insert_any on public.notifications;
create policy notifs_read_own   on public.notifications for select using (auth.uid() = recipient_id);
create policy notifs_update_own on public.notifications for update using (auth.uid() = recipient_id);
create policy notifs_delete_own on public.notifications for delete using (auth.uid() = recipient_id);
create policy notifs_insert_any on public.notifications for insert with check (auth.uid() = actor_id);

-- OUTLETS, BUSINESSES, GALLERY
drop policy if exists outlets_read_all   on public.outlets;
drop policy if exists outlets_admin_only on public.outlets;
create policy outlets_read_all   on public.outlets for select using (true);
create policy outlets_admin_only on public.outlets for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists businesses_read_all   on public.businesses;
drop policy if exists businesses_admin_only on public.businesses;
create policy businesses_read_all   on public.businesses for select using (true);
create policy businesses_admin_only on public.businesses for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists gallery_read_all   on public.gallery;
drop policy if exists gallery_insert_own on public.gallery;
drop policy if exists gallery_delete_own on public.gallery;
create policy gallery_read_all   on public.gallery for select using (true);
create policy gallery_insert_own on public.gallery for insert with check (auth.uid() = uploader_id);
create policy gallery_delete_own on public.gallery for delete using (auth.uid() = uploader_id or public.is_admin(auth.uid()));

-- MESSAGES (chat privado)
drop policy if exists messages_read_own       on public.messages;
drop policy if exists messages_insert_as_self on public.messages;
drop policy if exists messages_update_recv    on public.messages;
drop policy if exists messages_delete_own     on public.messages;
create policy messages_read_own on public.messages for select
    using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy messages_insert_as_self on public.messages for insert
    with check (auth.uid() = sender_id);
create policy messages_update_recv on public.messages for update using (auth.uid() = recipient_id);
create policy messages_delete_own on public.messages for delete
    using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- ADMIN_EMAILS
drop policy if exists admin_emails_read       on public.admin_emails;
drop policy if exists admin_emails_admin_only on public.admin_emails;
create policy admin_emails_read on public.admin_emails for select using (true);
create policy admin_emails_admin_only on public.admin_emails for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- COMMUNITY_VIDEOS
drop policy if exists videos_read_all     on public.community_videos;
drop policy if exists videos_admin_write  on public.community_videos;
create policy videos_read_all on public.community_videos for select using (true);
create policy videos_admin_write on public.community_videos for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- BANS
drop policy if exists bans_read_all   on public.bans;
drop policy if exists bans_admin_only on public.bans;
create policy bans_read_all on public.bans for select using (true);
create policy bans_admin_only on public.bans for all
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- FRIEND_REQUESTS
drop policy if exists fr_read_own         on public.friend_requests;
drop policy if exists fr_insert_as_self   on public.friend_requests;
drop policy if exists fr_update_recipient on public.friend_requests;
drop policy if exists fr_delete_either    on public.friend_requests;
create policy fr_read_own on public.friend_requests for select
    using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy fr_insert_as_self on public.friend_requests for insert
    with check (auth.uid() = from_user_id);
create policy fr_update_recipient on public.friend_requests for update using (auth.uid() = to_user_id);
create policy fr_delete_either on public.friend_requests for delete
    using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- USER_STRIKES
drop policy if exists strikes_read_own_or_admin on public.user_strikes;
drop policy if exists strikes_admin_only_write  on public.user_strikes;
drop policy if exists strikes_admin_only_update on public.user_strikes;
create policy strikes_read_own_or_admin on public.user_strikes for select
    using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy strikes_admin_only_write on public.user_strikes for insert
    with check (public.is_admin(auth.uid()));
create policy strikes_admin_only_update on public.user_strikes for update
    using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ============================================================
-- 5 · RPCs (Remote Procedure Calls — funciones que el frontend llama)
-- ============================================================

-- 5.1 Eliminar mi propia cuenta
create or replace function public.delete_my_account()
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
    uid := auth.uid();
    if uid is null then raise exception 'No autenticado'; end if;
    delete from public.profiles where id = uid;
    delete from auth.identities where user_id = uid;
    delete from auth.users where id = uid;
    return true;
exception when others then
    raise warning 'Error eliminando cuenta: %', sqlerrm;
    return false;
end;
$$;

-- 5.2 Admin: eliminar cuenta de cualquier usuario (con protección de owner)
create or replace function public.admin_delete_user(p_username text)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare
    target_id uuid;
    target_is_owner boolean;
    target_role text;
    caller_role text;
    caller_is_owner boolean;
begin
    if auth.uid() is null then raise exception 'No autenticado'; end if;
    select role, is_owner into caller_role, caller_is_owner from public.profiles where id = auth.uid();
    if caller_role <> 'admin' then raise exception 'Solo admins'; end if;

    select id, is_owner, role into target_id, target_is_owner, target_role
        from public.profiles where lower(username) = lower(p_username);
    if target_id is null then return false; end if;
    if target_is_owner then raise exception 'El owner no puede ser eliminado'; end if;
    if target_role = 'admin' and not caller_is_owner then
        raise exception 'Solo el owner puede eliminar a otros admins';
    end if;

    delete from public.profiles where id = target_id;
    delete from auth.identities where user_id = target_id;
    delete from auth.users where id = target_id;
    return true;
end;
$$;

-- 5.3 Admin: banear (con protecciones)
create or replace function public.admin_ban_user(
    p_username text, p_reason text default '', p_permanent boolean default false, p_days integer default 7
) returns boolean language plpgsql security definer set search_path = public as $$
declare
    target_id uuid; target_is_owner boolean; target_role text;
    caller_role text; caller_is_owner boolean;
begin
    select role, is_owner into caller_role, caller_is_owner from public.profiles where id = auth.uid();
    if caller_role <> 'admin' then raise exception 'Solo admins'; end if;
    select id, is_owner, role into target_id, target_is_owner, target_role
        from public.profiles where lower(username) = lower(p_username);
    if target_id is null then return false; end if;
    if target_is_owner then raise exception 'No se puede banear al owner'; end if;
    if target_role = 'admin' and not caller_is_owner then
        raise exception 'Solo el owner puede banear a otros admins';
    end if;
    insert into public.bans (user_id, banned_by, reason, is_permanent, expires_at)
    values (target_id, auth.uid(), p_reason, p_permanent,
            case when p_permanent then null else now() + (p_days || ' days')::interval end)
    on conflict (user_id) do update set
        banned_by = excluded.banned_by, reason = excluded.reason,
        is_permanent = excluded.is_permanent, expires_at = excluded.expires_at,
        created_at = now();
    return true;
end;
$$;

-- 5.4 Admin: desbanear
create or replace function public.admin_unban_user(p_username text)
returns boolean language plpgsql security definer set search_path = public as $$
declare target_id uuid; caller_role text;
begin
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role <> 'admin' then raise exception 'Solo admins'; end if;
    select id into target_id from public.profiles where lower(username) = lower(p_username);
    if target_id is null then return false; end if;
    delete from public.bans where user_id = target_id;
    return true;
end;
$$;

-- 5.5 Owner: promover/revocar admins
create or replace function public.admin_promote_to_admin(p_username text)
returns boolean language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
    if not public.is_owner(auth.uid()) then raise exception 'Solo el owner puede promover admins'; end if;
    select id into target_id from public.profiles where lower(username) = lower(p_username);
    if target_id is null then raise exception 'Usuario no encontrado: %', p_username; end if;
    update public.profiles set role = 'admin' where id = target_id;
    return true;
end;
$$;

create or replace function public.admin_revoke_admin(p_username text)
returns boolean language plpgsql security definer set search_path = public as $$
declare target_id uuid; target_is_owner boolean;
begin
    if not public.is_owner(auth.uid()) then raise exception 'Solo el owner puede revocar admins'; end if;
    select id, is_owner into target_id, target_is_owner from public.profiles where lower(username) = lower(p_username);
    if target_id is null then raise exception 'Usuario no encontrado: %', p_username; end if;
    if target_is_owner then raise exception 'No puedes revocar al owner'; end if;
    update public.profiles set role = 'citizen' where id = target_id;
    return true;
end;
$$;

-- 5.6 Strikes
create or replace function public.admin_add_strike(
    p_username text, p_reason text default '', p_severity text default 'minor', p_expires_days integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
    target_id uuid; target_is_owner boolean; target_role text;
    caller_role text; caller_is_owner boolean; new_id uuid; valid_severity text;
begin
    select role, is_owner into caller_role, caller_is_owner from public.profiles where id = auth.uid();
    if caller_role <> 'admin' then raise exception 'Solo admins'; end if;
    valid_severity := lower(coalesce(p_severity, 'minor'));
    if valid_severity not in ('minor', 'major', 'severe') then raise exception 'Severidad inválida'; end if;
    select id, is_owner, role into target_id, target_is_owner, target_role
        from public.profiles where lower(username) = lower(p_username);
    if target_id is null then raise exception 'Usuario no encontrado'; end if;
    if target_id = auth.uid() then raise exception 'No puedes darte strikes a ti mismo'; end if;
    if target_is_owner then raise exception 'No se puede dar strike al owner'; end if;
    if target_role = 'admin' and not caller_is_owner then
        raise exception 'Solo el owner puede dar strikes a otros admins';
    end if;
    insert into public.user_strikes (user_id, given_by, reason, severity, expires_at)
    values (target_id, auth.uid(), coalesce(p_reason, ''), valid_severity,
            case when p_expires_days is not null and p_expires_days > 0
                 then now() + (p_expires_days || ' days')::interval else null end)
    returning id into new_id;
    return new_id;
end;
$$;

create or replace function public.admin_revoke_strike(p_strike_id uuid, p_reason text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare caller_role text;
begin
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role <> 'admin' then raise exception 'Solo admins'; end if;
    update public.user_strikes set revoked = true, revoked_reason = coalesce(p_reason, ''),
        revoked_by = auth.uid(), revoked_at = now() where id = p_strike_id;
    return found;
end;
$$;

create or replace function public.admin_delete_strike(p_strike_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare caller_role text;
begin
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role <> 'admin' then raise exception 'Solo admins'; end if;
    delete from public.user_strikes where id = p_strike_id;
    return found;
end;
$$;

-- 5.7 Friend requests
create or replace function public.send_friend_request(p_target_username text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target_id uuid; new_id uuid; caller uuid;
begin
    caller := auth.uid();
    if caller is null then raise exception 'No autenticado'; end if;
    select id into target_id from public.profiles where lower(username) = lower(p_target_username);
    if target_id is null then raise exception 'Usuario no encontrado'; end if;
    if target_id = caller then raise exception 'No puedes enviarte solicitud a ti mismo'; end if;
    select id into new_id from public.friend_requests
        where status in ('pending', 'accepted')
          and ((from_user_id = caller and to_user_id = target_id)
            or (from_user_id = target_id and to_user_id = caller))
        limit 1;
    if new_id is not null then return new_id; end if;
    insert into public.friend_requests (from_user_id, to_user_id, status)
    values (caller, target_id, 'pending') returning id into new_id;
    return new_id;
end;
$$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare rcv uuid;
begin
    select to_user_id into rcv from public.friend_requests where id = p_request_id;
    if rcv is null then return false; end if;
    if rcv <> auth.uid() then raise exception 'No eres el receptor'; end if;
    update public.friend_requests set status = 'accepted', responded_at = now()
        where id = p_request_id and status = 'pending';
    return true;
end;
$$;

create or replace function public.reject_friend_request(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare rcv uuid;
begin
    select to_user_id into rcv from public.friend_requests where id = p_request_id;
    if rcv is null then return false; end if;
    if rcv <> auth.uid() then raise exception 'No eres el receptor'; end if;
    delete from public.friend_requests where id = p_request_id;
    return true;
end;
$$;

-- 5.8 Verificación de respuestas de seguridad (recuperación)
create or replace function public.verify_security_answers(
    p_username text, p_a1_hash text, p_a2_hash text, p_a3_hash text
) returns boolean language plpgsql security definer as $$
declare matched int;
begin
    select count(*) into matched from public.profiles
    where lower(username) = lower(p_username)
      and security_a1 = p_a1_hash and security_a2 = p_a2_hash and security_a3 = p_a3_hash
      and security_a1 <> '' and security_a2 <> '' and security_a3 <> '';
    return matched > 0;
end;
$$;

create or replace function public.verify_backup_code(p_username text, p_code_hash text)
returns boolean language plpgsql security definer as $$
declare matched int;
begin
    select count(*) into matched from public.profiles
    where lower(username) = lower(p_username) and backup_code_hash = p_code_hash and backup_code_hash <> '';
    return matched > 0;
end;
$$;

-- ============================================================
-- 6 · GRANTS (permisos para llamar las funciones)
-- ============================================================
grant execute on function public.is_admin(uuid)                                  to anon, authenticated;
grant execute on function public.is_owner(uuid)                                  to anon, authenticated;
grant execute on function public.is_banned(uuid)                                 to anon, authenticated;
grant execute on function public.are_friends(uuid, uuid)                         to anon, authenticated;
grant execute on function public.get_active_strike_count(uuid)                   to anon, authenticated;
grant execute on function public.get_strike_weight(uuid)                         to anon, authenticated;
grant execute on function public.delete_my_account()                             to authenticated;
grant execute on function public.admin_delete_user(text)                         to authenticated;
grant execute on function public.admin_ban_user(text, text, boolean, integer)    to authenticated;
grant execute on function public.admin_unban_user(text)                          to authenticated;
grant execute on function public.admin_promote_to_admin(text)                    to authenticated;
grant execute on function public.admin_revoke_admin(text)                        to authenticated;
grant execute on function public.admin_add_strike(text, text, text, integer)     to authenticated;
grant execute on function public.admin_revoke_strike(uuid, text)                 to authenticated;
grant execute on function public.admin_delete_strike(uuid)                       to authenticated;
grant execute on function public.send_friend_request(text)                       to authenticated;
grant execute on function public.accept_friend_request(uuid)                     to authenticated;
grant execute on function public.reject_friend_request(uuid)                     to authenticated;
grant execute on function public.verify_security_answers(text, text, text, text) to anon, authenticated;
grant execute on function public.verify_backup_code(text, text)                  to anon, authenticated;

-- ============================================================
-- 7 · REALTIME (streaming en vivo)
-- ============================================================
do $$ begin alter publication supabase_realtime add table public.threads;          exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.comments;         exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.likes;            exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reactions;        exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications;    exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.follows;          exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.profiles;         exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.messages;         exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.community_videos; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.mutes;            exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.bans;             exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.friend_requests;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.user_strikes;     exception when duplicate_object then null; end $$;

-- ============================================================
-- 8 · OWNER · marca a pimpiling como dueño protegido
-- ============================================================
update public.profiles
   set is_owner = true, role = 'admin'
 where lower(username) = 'pimpiling';

insert into public.admin_emails (email, notes)
values ('pimpiling@tresvalles.local', 'Co-admin · pimpiling')
on conflict (email) do nothing;

-- ============================================================
-- 9 · RECONCILIACIÓN · crea profiles para auth.users huérfanos
--     y rellena emails que se quedaron en NULL
-- ============================================================
insert into public.profiles (id, username, pfp, email, role, is_guest)
select
    au.id,
    coalesce(
        nullif(lower(regexp_replace(coalesce(
            au.raw_user_meta_data->>'username',
            au.raw_user_meta_data->>'name',
            au.raw_user_meta_data->>'full_name',
            split_part(au.email, '@', 1)
        ), '[^a-z0-9_]', '_', 'g')), ''),
        'user' || substring(au.id::text from 1 for 8)
    ),
    coalesce(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture', ''),
    au.email,
    case when au.email in (select email from public.admin_emails) then 'admin' else 'citizen' end,
    coalesce((au.raw_user_meta_data->>'is_guest')::boolean, false)
from auth.users au
where not exists (select 1 from public.profiles p where p.id = au.id)
on conflict (id) do nothing;

update public.profiles p
   set email = au.email
  from auth.users au
 where p.id = au.id and (p.email is null or p.email = '') and au.email is not null;

-- ============================================================
-- 10 · VERIFICACIÓN FINAL · estadísticas para confirmar que todo OK
-- ============================================================
select 'auth.users'    as tabla, count(*)::text as filas from auth.users
union all
select 'profiles',                count(*)::text from public.profiles
union all
select 'profiles sin email',      count(*)::text from public.profiles where email is null or email = ''
union all
select 'admins',                  count(*)::text from public.profiles where role = 'admin'
union all
select 'owner pimpiling',         coalesce((select 'OK' from public.profiles where lower(username) = 'pimpiling' and is_owner = true limit 1), 'FALTA')
union all
select 'trigger handle_new_user', coalesce((select 'OK' from pg_trigger where tgname = 'on_auth_user_created' limit 1), 'FALTA');

-- Últimos 10 profiles registrados
select username, email, role, created_at
from public.profiles
order by created_at desc
limit 10;
