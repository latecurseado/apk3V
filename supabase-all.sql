-- =============================================================
-- Tres Valles · Master SQL UNIFICADO (todos los SQLs del PoC en uno)
-- -------------------------------------------------------------
-- Ejecuta UNA SOLA VEZ en: Supabase Dashboard -> SQL Editor -> Run
-- Es idempotente: puedes correrlo varias veces sin romper nada.
--
-- Asume que el schema base ya está cargado (profiles, threads,
-- comments, likes, etc. del supabase-schema-MASTER.sql original).
-- Si vas de cero, ejecuta primero supabase-schema-MASTER.sql.
-- =============================================================

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. CONTADOR DE VISITAS (site_stats + RPCs)                ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.site_stats (
    id     smallint primary key default 1,
    views  bigint   not null   default 0,
    constraint site_stats_singleton check (id = 1)
);
insert into public.site_stats (id, views) values (1, 0) on conflict (id) do nothing;

alter table public.site_stats enable row level security;
drop policy if exists "site_stats public read" on public.site_stats;
create policy "site_stats public read" on public.site_stats for select using (true);

create or replace function public.bump_site_views() returns bigint
language sql security definer set search_path = public as $$
    update public.site_stats set views = views + 1 where id = 1 returning views;
$$;

create or replace function public.get_site_views() returns bigint
language sql stable security definer set search_path = public as $$
    select views from public.site_stats where id = 1;
$$;

grant execute on function public.bump_site_views() to anon, authenticated;
grant execute on function public.get_site_views()  to anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. CMS · content_sections (secciones editables de páginas)║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.content_sections (
    id           uuid primary key default gen_random_uuid(),
    page_slug    text not null,
    section_key  text not null,
    title        text not null,
    icon         text default 'fa-circle-info',
    sort_order   int  default 0,
    body         text not null,
    updated_at   timestamptz not null default now(),
    updated_by   uuid references public.profiles(id),
    unique (page_slug, section_key)
);
create index if not exists content_sections_page_order_idx
    on public.content_sections (page_slug, sort_order);

alter table public.content_sections enable row level security;
drop policy if exists "content_sections public read" on public.content_sections;
create policy "content_sections public read" on public.content_sections for select using (true);
drop policy if exists "content_sections admin insert" on public.content_sections;
create policy "content_sections admin insert" on public.content_sections for insert
    with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "content_sections admin update" on public.content_sections;
create policy "content_sections admin update" on public.content_sections for update
    using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "content_sections admin delete" on public.content_sections;
create policy "content_sections admin delete" on public.content_sections for delete
    using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create or replace function public.touch_content_section() returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$;
drop trigger if exists content_sections_touch on public.content_sections;
create trigger content_sections_touch before update on public.content_sections
    for each row execute function public.touch_content_section();

create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.am_i_admin() to anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. FOROS v2 · forums + follows (amigos)                   ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.forums (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique,
    name        text not null,
    description text default '',
    icon        text default 'fa-comments',
    is_system   boolean not null default false,
    sort_order  int default 100,
    rules       text default '',
    color       text default '#00d2ff',
    visibility  text not null default 'public',
    created_by  uuid references public.profiles(id),
    created_at  timestamptz not null default now()
);
create index if not exists forums_sort_idx on public.forums (sort_order, created_at);
alter table public.forums enable row level security;

drop policy if exists "forums public read" on public.forums;
create policy "forums public read" on public.forums for select using (true);
drop policy if exists "forums authed insert" on public.forums;
create policy "forums authed insert" on public.forums for insert
    with check (auth.uid() is not null and not is_system);
drop policy if exists "forums owner delete" on public.forums;
create policy "forums owner delete" on public.forums for delete
    using (
        not is_system and (
            created_by = auth.uid() or
            exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
        )
    );
drop policy if exists "forums owner update" on public.forums;
create policy "forums owner update" on public.forums for update
    using (
        created_by = auth.uid() or
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );

-- Seed: foros del sistema
insert into public.forums (slug, name, description, icon, is_system, sort_order) values
    ('general',  'General',  'El foro principal. Conversación abierta.',                  'fa-hashtag',       true, 10),
    ('noticias', 'Noticias', 'Lo que pasa en Tres Valles.',                              'fa-newspaper',     true, 20),
    ('ayuda',    'Ayuda',    'Pregunta lo que necesites.',                               'fa-hands-helping', true, 30),
    ('eventos',  'Eventos',  'Conciertos, fiestas, ferias, reuniones.',                  'fa-calendar',      true, 40),
    ('negocios', 'Negocios', 'Promociona o pregunta por comercios locales.',             'fa-store',         true, 50)
on conflict (slug) do nothing;

-- Threads: forum_id + edited_at + pinned_at + attachments
alter table public.threads add column if not exists forum_id    uuid references public.forums(id) on delete set null;
alter table public.threads add column if not exists edited_at   timestamptz;
alter table public.threads add column if not exists pinned_at   timestamptz;
create index if not exists threads_forum_idx on public.threads (forum_id, created_at desc);
create index if not exists threads_pinned_idx on public.threads (forum_id, pinned_at desc nulls last, created_at desc);
update public.threads t set forum_id = (select id from public.forums where slug = 'general') where forum_id is null;

-- Comments: edited_at + parent_id (para respuestas anidadas)
alter table public.comments add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id) where parent_id is not null;

-- Trigger edited_at
create or replace function public.touch_edited_at() returns trigger language plpgsql as $$
begin
    if new.content is distinct from old.content then new.edited_at = now(); end if;
    return new;
end;
$$;
drop trigger if exists threads_touch_edited on public.threads;
create trigger threads_touch_edited before update on public.threads
    for each row execute function public.touch_edited_at();
drop trigger if exists comments_touch_edited on public.comments;
create trigger comments_touch_edited before update on public.comments
    for each row execute function public.touch_edited_at();

-- Follows
create table if not exists public.follows (
    follower_id uuid not null references public.profiles(id) on delete cascade,
    followed_id uuid not null references public.profiles(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (follower_id, followed_id),
    check (follower_id <> followed_id)
);
create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_followed_idx on public.follows (followed_id);
alter table public.follows enable row level security;
drop policy if exists "follows public read" on public.follows;
create policy "follows public read" on public.follows for select using (true);
drop policy if exists "follows self insert" on public.follows;
create policy "follows self insert" on public.follows for insert with check (follower_id = auth.uid());
drop policy if exists "follows self delete" on public.follows;
create policy "follows self delete" on public.follows for delete using (follower_id = auth.uid());


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. INTERACCIONES · bookmarks, reactions, polls            ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.bookmarks (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    thread_id  uuid not null references public.threads(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, thread_id)
);
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);
alter table public.bookmarks enable row level security;
drop policy if exists "bookmarks self read" on public.bookmarks;
create policy "bookmarks self read" on public.bookmarks for select using (user_id = auth.uid());
drop policy if exists "bookmarks self write" on public.bookmarks;
create policy "bookmarks self write" on public.bookmarks for insert with check (user_id = auth.uid());
drop policy if exists "bookmarks self delete" on public.bookmarks;
create policy "bookmarks self delete" on public.bookmarks for delete using (user_id = auth.uid());

create table if not exists public.reactions (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    thread_id  uuid not null references public.threads(id) on delete cascade,
    emoji      text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, thread_id, emoji)
);
create index if not exists reactions_thread_idx on public.reactions (thread_id);
alter table public.reactions enable row level security;
drop policy if exists "reactions public read" on public.reactions;
create policy "reactions public read" on public.reactions for select using (true);
drop policy if exists "reactions self write" on public.reactions;
create policy "reactions self write" on public.reactions for insert with check (user_id = auth.uid());
drop policy if exists "reactions self delete" on public.reactions;
create policy "reactions self delete" on public.reactions for delete using (user_id = auth.uid());

-- Polls
create table if not exists public.polls (
    id              uuid primary key default gen_random_uuid(),
    thread_id       uuid not null references public.threads(id) on delete cascade,
    question        text not null,
    allow_multiple  boolean not null default false,
    ends_at         timestamptz,
    created_at      timestamptz not null default now()
);
create unique index if not exists polls_one_per_thread on public.polls (thread_id);

create table if not exists public.poll_options (
    id          uuid primary key default gen_random_uuid(),
    poll_id     uuid not null references public.polls(id) on delete cascade,
    text        text not null,
    sort_order  int default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, sort_order);

create table if not exists public.poll_votes (
    poll_id    uuid not null references public.polls(id) on delete cascade,
    option_id  uuid not null references public.poll_options(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (poll_id, option_id, user_id)
);
create index if not exists poll_votes_user_idx on public.poll_votes (user_id);

alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

drop policy if exists "polls public read" on public.polls;
create policy "polls public read" on public.polls for select using (true);
drop policy if exists "polls authed insert" on public.polls;
create policy "polls authed insert" on public.polls for insert
    with check (
        auth.uid() is not null and
        exists (select 1 from public.threads t where t.id = thread_id and t.author_id = auth.uid())
    );

drop policy if exists "poll_options public read" on public.poll_options;
create policy "poll_options public read" on public.poll_options for select using (true);
drop policy if exists "poll_options authed insert" on public.poll_options;
create policy "poll_options authed insert" on public.poll_options for insert
    with check (
        exists (
            select 1 from public.polls p
            join public.threads t on t.id = p.thread_id
            where p.id = poll_id and t.author_id = auth.uid()
        )
    );

drop policy if exists "poll_votes public read" on public.poll_votes;
create policy "poll_votes public read" on public.poll_votes for select using (true);
drop policy if exists "poll_votes self write" on public.poll_votes;
create policy "poll_votes self write" on public.poll_votes for insert with check (user_id = auth.uid());
drop policy if exists "poll_votes self delete" on public.poll_votes;
create policy "poll_votes self delete" on public.poll_votes for delete using (user_id = auth.uid());


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. MOD · subscriptions, mods, invites                     ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.forum_subscriptions (
    forum_id   uuid not null references public.forums(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (forum_id, user_id)
);
create index if not exists forum_subs_user_idx on public.forum_subscriptions (user_id);
alter table public.forum_subscriptions enable row level security;
drop policy if exists "forum_subs public read" on public.forum_subscriptions;
create policy "forum_subs public read" on public.forum_subscriptions for select using (true);
drop policy if exists "forum_subs self write" on public.forum_subscriptions;
create policy "forum_subs self write" on public.forum_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "forum_subs self delete" on public.forum_subscriptions;
create policy "forum_subs self delete" on public.forum_subscriptions for delete using (user_id = auth.uid());

create table if not exists public.forum_mods (
    forum_id   uuid not null references public.forums(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (forum_id, user_id)
);
alter table public.forum_mods enable row level security;
drop policy if exists "forum_mods public read" on public.forum_mods;
create policy "forum_mods public read" on public.forum_mods for select using (true);
drop policy if exists "forum_mods owner write" on public.forum_mods;
create policy "forum_mods owner write" on public.forum_mods for insert
    with check (
        exists (select 1 from public.forums f where f.id = forum_id and f.created_by = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
drop policy if exists "forum_mods owner delete" on public.forum_mods;
create policy "forum_mods owner delete" on public.forum_mods for delete
    using (
        exists (select 1 from public.forums f where f.id = forum_id and f.created_by = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );

create table if not exists public.forum_invites (
    forum_id   uuid not null references public.forums(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    invited_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    primary key (forum_id, user_id)
);
alter table public.forum_invites enable row level security;
drop policy if exists "invites public read" on public.forum_invites;
create policy "invites public read" on public.forum_invites for select using (true);
drop policy if exists "invites owner-mod write" on public.forum_invites;
create policy "invites owner-mod write" on public.forum_invites for insert
    with check (
        exists (select 1 from public.forums f where f.id = forum_id and f.created_by = auth.uid())
        or exists (select 1 from public.forum_mods m where m.forum_id = forum_id and m.user_id = auth.uid())
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );

-- Visibility-aware policies en threads
drop policy if exists "threads visibility aware" on public.threads;
create policy "threads visibility aware" on public.threads for select
    using (
        forum_id is null
        or exists (
            select 1 from public.forums f
            where f.id = threads.forum_id
              and (
                f.visibility = 'public'
                or f.created_by = auth.uid()
                or exists (select 1 from public.forum_mods m where m.forum_id = f.id and m.user_id = auth.uid())
                or exists (select 1 from public.forum_invites i where i.forum_id = f.id and i.user_id = auth.uid())
                or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
              )
        )
    );
drop policy if exists "threads mod delete" on public.threads;
create policy "threads mod delete" on public.threads for delete
    using (
        author_id = auth.uid()
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
        or (forum_id is not null and exists (select 1 from public.forum_mods m where m.forum_id = threads.forum_id and m.user_id = auth.uid()))
        or (forum_id is not null and exists (select 1 from public.forums f where f.id = threads.forum_id and f.created_by = auth.uid()))
    );
drop policy if exists "threads self update" on public.threads;
create policy "threads self update" on public.threads for update
    using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "threads admin update" on public.threads;
create policy "threads admin update" on public.threads for update
    using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
    with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "comments self update" on public.comments;
create policy "comments self update" on public.comments for update
    using (author_id = auth.uid()) with check (author_id = auth.uid());


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. PROFILES · campos extra + bucket avatars               ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists bio text default '';

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars self write" on storage.objects;
create policy "avatars self write" on storage.objects for insert
    with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "avatars self update" on storage.objects;
create policy "avatars self update" on storage.objects for update
    using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "avatars self delete" on storage.objects;
create policy "avatars self delete" on storage.objects for delete
    using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. NOTIFICATIONS · tabla + triggers automáticos           ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.notifications (
    id            uuid primary key default gen_random_uuid(),
    recipient_id  uuid not null references public.profiles(id) on delete cascade,
    actor_id      uuid references public.profiles(id) on delete set null,
    type          text not null,
    target_type   text,
    target_id     uuid,
    extra         jsonb default '{}'::jsonb,
    read          boolean not null default false,
    created_at    timestamptz not null default now()
);
-- IMPORTANTE · Si la tabla ya existía de supabase-schema-MASTER.sql sin estas
-- columnas, el CREATE TABLE IF NOT EXISTS NO las añade. Las añadimos por separado.
alter table public.notifications add column if not exists extra jsonb default '{}'::jsonb;
alter table public.notifications add column if not exists target_type text;
alter table public.notifications add column if not exists target_id uuid;

create index if not exists notifs_recipient_idx on public.notifications (recipient_id, read, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifs self read" on public.notifications;
create policy "notifs self read" on public.notifications for select using (recipient_id = auth.uid());
drop policy if exists "notifs self update" on public.notifications;
create policy "notifs self update" on public.notifications for update using (recipient_id = auth.uid());
drop policy if exists "notifs self delete" on public.notifications;
create policy "notifs self delete" on public.notifications for delete using (recipient_id = auth.uid());

-- Triggers
create or replace function public.notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.follower_id <> new.followed_id then
        insert into public.notifications (recipient_id, actor_id, type, target_type, target_id)
        values (new.followed_id, new.follower_id, 'follow', 'profile', new.follower_id);
    end if;
    return new;
end;
$$;
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows
    for each row execute function public.notify_on_follow();

create or replace function public.notify_on_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
    if new.target_type <> 'thread' then return new; end if;
    select author_id into author from public.threads where id = new.target_id;
    if author is not null and author <> new.user_id then
        insert into public.notifications (recipient_id, actor_id, type, target_type, target_id)
        values (author, new.user_id, 'like_thread', 'thread', new.target_id);
    end if;
    return new;
end;
$$;
drop trigger if exists likes_notify on public.likes;
create trigger likes_notify after insert on public.likes
    for each row execute function public.notify_on_like();

create or replace function public.notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
    select author_id into author from public.threads where id = new.thread_id;
    if author is not null and author <> new.author_id then
        insert into public.notifications (recipient_id, actor_id, type, target_type, target_id, extra)
        values (author, new.author_id, 'comment', 'thread', new.thread_id, jsonb_build_object('comment_id', new.id));
    end if;
    return new;
end;
$$;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
    for each row execute function public.notify_on_comment();

create or replace function public.notify_on_mention() returns trigger
language plpgsql security definer set search_path = public as $$
declare mention_match text; target_user_id uuid;
begin
    -- regexp_matches devuelve text[] (array de capturas) por cada match.
    -- Tomamos m[1] = la primera (y única) captura · la @ no está incluida.
    for mention_match in
        select m[1] from regexp_matches(coalesce(new.content, ''), '@([a-zA-Z0-9_]{2,30})', 'g') as t(m)
    loop
        select id into target_user_id from public.profiles where lower(username) = lower(mention_match);
        if target_user_id is not null and target_user_id <> new.author_id then
            insert into public.notifications (recipient_id, actor_id, type, target_type, target_id)
            values (target_user_id, new.author_id, 'mention', 'thread', new.id)
            on conflict do nothing;
        end if;
    end loop;
    return new;
exception when others then
    -- NUNCA bloquear el INSERT del hilo por culpa de este trigger.
    raise warning 'notify_on_mention falló: %', sqlerrm;
    return new;
end;
$$;
drop trigger if exists threads_mention_notify on public.threads;
create trigger threads_mention_notify after insert on public.threads
    for each row execute function public.notify_on_mention();

create or replace function public.mark_all_notifs_read() returns int
language sql security definer set search_path = public as $$
    with updated as (
        update public.notifications set read = true
         where recipient_id = auth.uid() and read = false returning 1
    ) select count(*)::int from updated;
$$;
grant execute on function public.mark_all_notifs_read() to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. DMs · dm_threads + dm_messages + RPCs                  ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.dm_threads (
    id              uuid primary key default gen_random_uuid(),
    user_a          uuid not null references public.profiles(id) on delete cascade,
    user_b          uuid not null references public.profiles(id) on delete cascade,
    last_message_at timestamptz not null default now(),
    created_at      timestamptz not null default now(),
    check (user_a < user_b),
    unique (user_a, user_b)
);
create index if not exists dm_threads_user_a_idx on public.dm_threads (user_a, last_message_at desc);
create index if not exists dm_threads_user_b_idx on public.dm_threads (user_b, last_message_at desc);
alter table public.dm_threads enable row level security;
drop policy if exists "dm_threads participants read" on public.dm_threads;
create policy "dm_threads participants read" on public.dm_threads for select
    using (user_a = auth.uid() or user_b = auth.uid());
drop policy if exists "dm_threads participants update" on public.dm_threads;
create policy "dm_threads participants update" on public.dm_threads for update
    using (user_a = auth.uid() or user_b = auth.uid());

create table if not exists public.dm_messages (
    id            uuid primary key default gen_random_uuid(),
    dm_thread_id  uuid not null references public.dm_threads(id) on delete cascade,
    sender_id     uuid not null references public.profiles(id) on delete cascade,
    content       text not null,
    read_at       timestamptz,
    created_at    timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on public.dm_messages (dm_thread_id, created_at);
alter table public.dm_messages enable row level security;
drop policy if exists "dm_messages participants read" on public.dm_messages;
create policy "dm_messages participants read" on public.dm_messages for select
    using (exists (
        select 1 from public.dm_threads t
        where t.id = dm_messages.dm_thread_id
          and (t.user_a = auth.uid() or t.user_b = auth.uid())
    ));
drop policy if exists "dm_messages participants send" on public.dm_messages;
create policy "dm_messages participants send" on public.dm_messages for insert
    with check (
        sender_id = auth.uid() and exists (
            select 1 from public.dm_threads t
            where t.id = dm_thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
        )
    );
drop policy if exists "dm_messages mark read" on public.dm_messages;
create policy "dm_messages mark read" on public.dm_messages for update
    using (
        sender_id <> auth.uid() and exists (
            select 1 from public.dm_threads t
            where t.id = dm_thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
        )
    );

create or replace function public.on_dm_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
    update public.dm_threads set last_message_at = now() where id = new.dm_thread_id;
    select case when user_a = new.sender_id then user_b else user_a end
      into other from public.dm_threads where id = new.dm_thread_id;
    if other is not null then
        insert into public.notifications (recipient_id, actor_id, type, target_type, target_id, extra)
        values (other, new.sender_id, 'dm', null, new.dm_thread_id, jsonb_build_object('msg_id', new.id));
    end if;
    return new;
end;
$$;
drop trigger if exists dm_messages_insert_trigger on public.dm_messages;
create trigger dm_messages_insert_trigger after insert on public.dm_messages
    for each row execute function public.on_dm_message_insert();

create or replace function public.get_or_create_dm_thread(other_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid; a uuid; b uuid; thread_id uuid;
begin
    me := auth.uid();
    if me is null then raise exception 'auth required'; end if;
    if other_user_id = me then raise exception 'cannot dm yourself'; end if;
    if me < other_user_id then a := me; b := other_user_id;
    else                       a := other_user_id; b := me; end if;
    select id into thread_id from public.dm_threads where user_a = a and user_b = b;
    if thread_id is null then
        insert into public.dm_threads (user_a, user_b) values (a, b) returning id into thread_id;
    end if;
    return thread_id;
end;
$$;
grant execute on function public.get_or_create_dm_thread(uuid) to authenticated;

create or replace function public.mark_dm_thread_read(p_thread_id uuid) returns int
language sql security definer set search_path = public as $$
    with updated as (
        update public.dm_messages set read_at = now()
         where dm_thread_id = p_thread_id
           and sender_id <> auth.uid()
           and read_at is null
        returning 1
    ) select count(*)::int from updated;
$$;
grant execute on function public.mark_dm_thread_read(uuid) to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 9. ATTACHMENTS · bucket de adjuntos en hilos              ║
-- ╚═══════════════════════════════════════════════════════════╝

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "attachments public read" on storage.objects;
create policy "attachments public read" on storage.objects for select using (bucket_id = 'attachments');
drop policy if exists "attachments authed insert" on storage.objects;
create policy "attachments authed insert" on storage.objects for insert
    with check (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "attachments self delete" on storage.objects;
create policy "attachments self delete" on storage.objects for delete
    using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 9.5 KILL SWITCH · app_settings (modo mantenimiento)       ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.app_settings (
    id                   smallint primary key default 1,
    maintenance_mode     boolean not null default false,
    maintenance_message  text default 'Estamos haciendo mejoras. Volvemos pronto.',
    maintenance_until    timestamptz,
    updated_at           timestamptz not null default now(),
    updated_by           uuid references public.profiles(id),
    constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id, maintenance_mode, maintenance_message)
values (1, false, 'Estamos haciendo mejoras. Volvemos pronto.')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read" on public.app_settings for select using (true);
drop policy if exists "app_settings owner write" on public.app_settings;
create policy "app_settings owner write" on public.app_settings for update
    using (exists (select 1 from public.profiles where id = auth.uid() and is_owner = true));

create or replace function public.set_maintenance(
    p_enabled boolean, p_message text default null, p_until timestamptz default null
) returns boolean language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and is_owner = true) then
        raise exception 'Solo el owner puede activar/desactivar el modo mantenimiento';
    end if;
    update public.app_settings
       set maintenance_mode = p_enabled,
           maintenance_message = coalesce(p_message, maintenance_message),
           maintenance_until = p_until,
           updated_at = now(), updated_by = auth.uid()
     where id = 1;
    return true;
end;
$$;
grant execute on function public.set_maintenance(boolean, text, timestamptz) to authenticated;

create or replace function public.get_app_state()
returns table (maintenance_mode boolean, maintenance_message text, maintenance_until timestamptz)
language sql stable security definer set search_path = public as $$
    select maintenance_mode, maintenance_message, maintenance_until from public.app_settings where id = 1;
$$;
grant execute on function public.get_app_state() to anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 10. REALTIME · publicación de todas las tablas dinámicas  ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Algunas tablas YA podrían estar en la publicación; los ALTER fallarán
-- silenciosamente si ya están. Se hace por DO block para evitar errores fatales.
do $$
declare
    t text;
begin
    for t in select unnest(array[
        'site_stats', 'content_sections',
        'forums', 'follows',
        'bookmarks', 'reactions',
        'polls', 'poll_options', 'poll_votes',
        'forum_subscriptions', 'forum_mods', 'forum_invites',
        'notifications', 'dm_threads', 'dm_messages',
        'app_settings'
    ])
    loop
        begin
            execute format('alter publication supabase_realtime add table public.%I', t);
        exception when duplicate_object then null;
                  when others then null;
        end;
    end loop;
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 11. PROFILES EXT · frames, accent_color, avatar_style     ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.profiles add column if not exists frame text default '';
alter table public.profiles add column if not exists accent_color text default '#00d2ff';
alter table public.profiles add column if not exists avatar_style text default '';
-- frame: 'rainbow' | 'gold' | 'pulse-cyan' | '' (none)
-- avatar_style: 'lorelei' | 'adventurer' | etc. (DiceBear seed style)


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 12. ACHIEVEMENTS · sistema de badges automáticos          ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.achievements (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    code        text not null,
    granted_at  timestamptz not null default now(),
    unique (user_id, code)
);
create index if not exists achievements_user_idx on public.achievements (user_id);
alter table public.achievements enable row level security;
drop policy if exists "achievements public read" on public.achievements;
create policy "achievements public read" on public.achievements for select using (true);

-- Trigger: cuando un user crea su primer hilo → badge 'first_post'
create or replace function public.award_first_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.achievements (user_id, code)
    select new.author_id, 'first_post'
    where not exists (
        select 1 from public.achievements where user_id = new.author_id and code = 'first_post'
    );
    return new;
end;
$$;
drop trigger if exists threads_first_post on public.threads;
create trigger threads_first_post after insert on public.threads
    for each row execute function public.award_first_post();

-- Trigger: cuando un user llega a 10/100 likes recibidos → badges 'liked'/'popular'
create or replace function public.check_popular_badge() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid; cnt int;
begin
    if new.target_type <> 'thread' then return new; end if;
    select author_id into author from public.threads where id = new.target_id;
    if author is null then return new; end if;
    select count(*) into cnt from public.likes l
        join public.threads t on t.id = l.target_id
        where t.author_id = author and l.target_type = 'thread';
    if cnt >= 100 then
        insert into public.achievements (user_id, code) values (author, 'popular') on conflict do nothing;
    end if;
    if cnt >= 10 then
        insert into public.achievements (user_id, code) values (author, 'liked') on conflict do nothing;
    end if;
    return new;
end;
$$;
drop trigger if exists likes_check_popular on public.likes;
create trigger likes_check_popular after insert on public.likes
    for each row execute function public.check_popular_badge();


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 13. AMIGOS MUTUOS · view + RPCs suggested + mutual        ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace view public.mutual_follows as
    select least(a.follower_id, a.followed_id) as u1,
           greatest(a.follower_id, a.followed_id) as u2
      from public.follows a
      join public.follows b
        on a.follower_id = b.followed_id
       and a.followed_id = b.follower_id
     where a.follower_id < a.followed_id;
grant select on public.mutual_follows to anon, authenticated;

create or replace function public.mutual_friends_with(p_other uuid)
returns table (id uuid, username text, pfp text)
language sql stable security definer set search_path = public as $$
    with my_friends as (
        select case when u1 = auth.uid() then u2 else u1 end as friend_id
          from public.mutual_follows
         where u1 = auth.uid() or u2 = auth.uid()
    ),
    their_friends as (
        select case when u1 = p_other then u2 else u1 end as friend_id
          from public.mutual_follows
         where u1 = p_other or u2 = p_other
    )
    select p.id, p.username, coalesce(p.pfp, '') as pfp
      from my_friends m
      join their_friends t on m.friend_id = t.friend_id
      join public.profiles p on p.id = m.friend_id
     limit 12;
$$;
grant execute on function public.mutual_friends_with(uuid) to anon, authenticated;

create or replace function public.suggested_users(p_limit int default 8)
returns table (id uuid, username text, pfp text, mutuals_count bigint)
language sql stable security definer set search_path = public as $$
    with my_follows as (
        select followed_id from public.follows where follower_id = auth.uid()
    ),
    fof as (
        select f.followed_id as candidate,
               count(*) as mutuals
          from public.follows f
         where f.follower_id in (select followed_id from my_follows)
           and f.followed_id <> auth.uid()
           and f.followed_id not in (select followed_id from my_follows)
         group by f.followed_id
    )
    select p.id, p.username, coalesce(p.pfp, '') as pfp, fof.mutuals
      from fof
      join public.profiles p on p.id = fof.candidate
     order by fof.mutuals desc, random()
     limit p_limit;
$$;
grant execute on function public.suggested_users(int) to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 14. SCHEDULED THREADS · publicación programada            ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.threads add column if not exists scheduled_at timestamptz;
alter table public.threads add column if not exists published boolean default true;
create index if not exists threads_scheduled_idx
    on public.threads (scheduled_at) where published = false;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 15. FORUMS EXT · banner, member_count view                ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.forums add column if not exists banner_url text default '';
alter table public.forums add column if not exists long_description text default '';
alter table public.forums add column if not exists button_label text default '';
alter table public.forums add column if not exists button_color text default '';

-- View con stats por foro (members + threads)
create or replace view public.forums_with_stats as
    select f.*,
        (select count(*) from public.forum_subscriptions s where s.forum_id = f.id) as member_count,
        (select count(*) from public.threads t where t.forum_id = f.id) as thread_count,
        (select max(t.created_at) from public.threads t where t.forum_id = f.id) as last_activity
    from public.forums f;

grant select on public.forums_with_stats to anon, authenticated;

-- RPC para obtener miembros de un foro
create or replace function public.forum_members(p_forum_id uuid, p_limit int default 50)
returns table (id uuid, username text, pfp text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
    select p.id, p.username, coalesce(p.pfp,'') as pfp, p.role, s.created_at as joined_at
      from public.forum_subscriptions s
      join public.profiles p on p.id = s.user_id
     where s.forum_id = p_forum_id
     order by s.created_at desc
     limit p_limit;
$$;
grant execute on function public.forum_members(uuid, int) to anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 16. PROFILES EXT · campos sociales tipo Facebook          ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.profiles add column if not exists location      text default '';
alter table public.profiles add column if not exists work          text default '';
alter table public.profiles add column if not exists education     text default '';
alter table public.profiles add column if not exists website       text default '';
alter table public.profiles add column if not exists relationship  text default '';
alter table public.profiles add column if not exists gender        text default '';
alter table public.profiles add column if not exists pronouns      text default '';
alter table public.profiles add column if not exists social_links  jsonb default '{}'::jsonb;
-- social_links: {twitter:"@x", instagram:"@x", facebook:"x", tiktok:"@x", youtube:"@x", github:"x"}


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 17. DM MESSAGES PRO · attachments, reactions, reply, edit ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.dm_messages add column if not exists attachments  jsonb default '[]'::jsonb;
alter table public.dm_messages add column if not exists parent_id    uuid references public.dm_messages(id) on delete set null;
alter table public.dm_messages add column if not exists edited_at    timestamptz;
alter table public.dm_messages add column if not exists deleted_at   timestamptz;
alter table public.dm_messages add column if not exists message_type text default 'text';
-- message_type: 'text' | 'image' | 'voice' | 'system'

create index if not exists dm_messages_parent_idx on public.dm_messages (parent_id) where parent_id is not null;

-- Trigger: actualizar edited_at automáticamente al UPDATE de content
create or replace function public.touch_dm_edited()
returns trigger language plpgsql as $$
begin
    if new.content is distinct from old.content and old.deleted_at is null then
        new.edited_at = now();
    end if;
    return new;
end;
$$;
drop trigger if exists dm_messages_touch_edited on public.dm_messages;
create trigger dm_messages_touch_edited
    before update on public.dm_messages
    for each row execute function public.touch_dm_edited();

-- Reacciones a mensajes DM
create table if not exists public.dm_message_reactions (
    message_id uuid not null references public.dm_messages(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    emoji      text not null,
    created_at timestamptz not null default now(),
    primary key (message_id, user_id, emoji)
);
create index if not exists dm_reactions_message_idx on public.dm_message_reactions (message_id);
alter table public.dm_message_reactions enable row level security;

drop policy if exists "dm_reactions participants read" on public.dm_message_reactions;
create policy "dm_reactions participants read" on public.dm_message_reactions for select
    using (
        exists (
            select 1 from public.dm_messages m
            join public.dm_threads t on t.id = m.dm_thread_id
            where m.id = dm_message_reactions.message_id
              and (t.user_a = auth.uid() or t.user_b = auth.uid())
        )
    );

drop policy if exists "dm_reactions participants write" on public.dm_message_reactions;
create policy "dm_reactions participants write" on public.dm_message_reactions for insert
    with check (
        user_id = auth.uid() and
        exists (
            select 1 from public.dm_messages m
            join public.dm_threads t on t.id = m.dm_thread_id
            where m.id = message_id
              and (t.user_a = auth.uid() or t.user_b = auth.uid())
        )
    );

drop policy if exists "dm_reactions self delete" on public.dm_message_reactions;
create policy "dm_reactions self delete" on public.dm_message_reactions for delete
    using (user_id = auth.uid());

-- DM thread settings (mute, etc.)
create table if not exists public.dm_thread_settings (
    user_id      uuid not null references public.profiles(id) on delete cascade,
    dm_thread_id uuid not null references public.dm_threads(id) on delete cascade,
    muted        boolean default false,
    primary key (user_id, dm_thread_id)
);
alter table public.dm_thread_settings enable row level security;

drop policy if exists "dm_settings self read" on public.dm_thread_settings;
create policy "dm_settings self read" on public.dm_thread_settings for select
    using (user_id = auth.uid());
drop policy if exists "dm_settings self write" on public.dm_thread_settings;
create policy "dm_settings self write" on public.dm_thread_settings for insert
    with check (user_id = auth.uid());
drop policy if exists "dm_settings self update" on public.dm_thread_settings;
create policy "dm_settings self update" on public.dm_thread_settings for update
    using (user_id = auth.uid());
drop policy if exists "dm_settings self delete" on public.dm_thread_settings;
create policy "dm_settings self delete" on public.dm_thread_settings for delete
    using (user_id = auth.uid());

-- Columnas extra: pin, expiración, forward, custom theme
alter table public.dm_messages add column if not exists pinned_at      timestamptz;
alter table public.dm_messages add column if not exists expires_at     timestamptz;
alter table public.dm_messages add column if not exists forwarded_from uuid references public.dm_messages(id) on delete set null;

create index if not exists dm_messages_pinned_idx on public.dm_messages (dm_thread_id, pinned_at desc nulls last) where pinned_at is not null;
create index if not exists dm_messages_expires_idx on public.dm_messages (expires_at) where expires_at is not null;

-- thread_settings: theme + auto-delete duration
alter table public.dm_thread_settings add column if not exists accent_color text default '';
alter table public.dm_thread_settings add column if not exists background_url text default '';
alter table public.dm_thread_settings add column if not exists auto_delete_after_hours int default 0;

-- RPC: purgar mensajes expirados (cron-friendly · llamar desde Edge Function periódica)
create or replace function public.purge_expired_dms() returns int
language sql security definer set search_path = public as $$
    with deleted as (
        delete from public.dm_messages
         where expires_at is not null and expires_at < now()
        returning 1
    ) select count(*)::int from deleted;
$$;
grant execute on function public.purge_expired_dms() to authenticated;

-- Habilitar realtime
do $$ begin
    alter publication supabase_realtime add table public.dm_message_reactions;
exception when duplicate_object then null;
end $$;
do $$ begin
    alter publication supabase_realtime add table public.dm_thread_settings;
exception when duplicate_object then null;
end $$;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18. NOTICIAS BOT · scraping automático de Tres Valles     ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Foro #noticias (idempotente)
insert into public.forums (slug, name, description, icon, is_system, sort_order, color) values
    ('noticias', 'Noticias', 'Lo que pasa en Tres Valles · actualizado automáticamente', 'fa-newspaper', true, 15, '#ff0844')
on conflict (slug) do update set
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color;

-- Columnas extra en threads para el bot de noticias
alter table public.threads add column if not exists source_url   text;
alter table public.threads add column if not exists source_name  text;
alter table public.threads add column if not exists source_image text;
create unique index if not exists threads_source_url_unique
    on public.threads (source_url) where source_url is not null;
create index if not exists threads_is_bot_created_idx
    on public.threads (is_bot, created_at desc) where is_bot = true;

-- Crear usuario bot "noticias_bot" si no existe.
-- Este auth.user no puede iniciar sesión (sin password), se usa sólo como author_id.
do $$
declare bot_uid uuid := '00000000-0000-0000-0000-000000000001';
begin
    if not exists (select 1 from auth.users where id = bot_uid) then
        insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at,
            raw_app_meta_data, raw_user_meta_data,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) values (
            '00000000-0000-0000-0000-000000000000',
            bot_uid,
            'authenticated', 'authenticated',
            'noticias_bot@tresvalles.local',
            '!unusable!password!',
            now(), now(), now(),
            '{"provider":"system","providers":["system"]}'::jsonb,
            jsonb_build_object('username', 'noticias_bot', 'is_bot', true),
            '', '', '', ''
        );
    end if;
    -- Asegurar profile correcto (rol bot)
    insert into public.profiles (id, username, pfp, role, is_guest, email, bio)
    values (
        bot_uid, 'noticias_bot',
        'https://api.dicebear.com/7.x/icons/svg?seed=newspaper&backgroundColor=ff0844',
        'bot', false,
        'noticias_bot@tresvalles.local',
        '🤖 Trayendo noticias de Tres Valles, Veracruz · automatizado'
    )
    on conflict (id) do update set
        role = 'bot',
        bio = excluded.bio,
        pfp = case when public.profiles.pfp = '' or public.profiles.pfp is null
                   then excluded.pfp else public.profiles.pfp end;
end $$;

-- RPC para que el bot inserte hilos de noticias (security definer · bypass RLS controlado)
-- Solo acepta el bot_uid hardcodeado y solo en el foro #noticias.
create or replace function public.bot_insert_news(
    p_secret text,
    p_content text,
    p_source_url text,
    p_source_name text default '',
    p_source_image text default ''
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
    bot_uid uuid := '00000000-0000-0000-0000-000000000001';
    expected_secret text;
    noticias_id uuid;
    new_thread_id uuid;
begin
    -- Lee el secreto del bot desde una config (lo seteas con SET o variable de entorno PG)
    -- Por simplicidad usamos un valor en app_settings.
    select coalesce(current_setting('app.bot_news_secret', true), '') into expected_secret;
    if expected_secret = '' or p_secret <> expected_secret then
        raise exception 'Secreto inválido';
    end if;
    if p_source_url is null or p_source_url = '' then
        raise exception 'source_url requerido';
    end if;
    -- Dedup: si ya existe, no duplicar
    if exists (select 1 from public.threads where source_url = p_source_url) then
        return null;
    end if;
    select id into noticias_id from public.forums where slug = 'noticias';
    insert into public.threads (author_id, content, category, forum_id, is_bot, source_url, source_name, source_image)
    values (bot_uid, p_content, 'noticias', noticias_id, true, p_source_url, p_source_name, p_source_image)
    returning id into new_thread_id;
    return new_thread_id;
end;
$$;

-- Función para que el owner pueda setear el secreto del bot (corre una sola vez):
--   select public.set_bot_secret('TU_SECRETO_AQUI');
create or replace function public.set_bot_secret(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and is_owner = true) then
        raise exception 'Solo el owner';
    end if;
    -- Persiste el secreto en una tabla privada (más seguro que current_setting que no sobrevive a reinicios)
    insert into public.app_settings (id) values (1) on conflict (id) do nothing;
    update public.app_settings set updated_at = now(), updated_by = auth.uid() where id = 1;
    -- En Supabase necesitamos otra forma · usamos una tabla aparte protegida
    perform set_config('app.bot_news_secret', p_secret, false);
end;
$$;

-- Tabla privada para el secreto del bot (persistente entre reinicios)
create table if not exists public.bot_config (
    id     smallint primary key default 1,
    secret text not null,
    constraint bot_config_singleton check (id = 1)
);
alter table public.bot_config enable row level security;
-- Solo el owner puede leer/escribir; ningún anon/authed puede acceder
drop policy if exists "bot_config owner read" on public.bot_config;
create policy "bot_config owner read" on public.bot_config for select
    using (exists (select 1 from public.profiles where id = auth.uid() and is_owner = true));
drop policy if exists "bot_config owner write" on public.bot_config;
create policy "bot_config owner write" on public.bot_config for all
    using (exists (select 1 from public.profiles where id = auth.uid() and is_owner = true))
    with check (exists (select 1 from public.profiles where id = auth.uid() and is_owner = true));

-- Re-escribimos bot_insert_news para usar la tabla en lugar de current_setting
create or replace function public.bot_insert_news(
    p_secret text,
    p_content text,
    p_source_url text,
    p_source_name text default '',
    p_source_image text default ''
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
    bot_uid uuid := '00000000-0000-0000-0000-000000000001';
    expected_secret text;
    noticias_id uuid;
    new_thread_id uuid;
begin
    select secret into expected_secret from public.bot_config where id = 1;
    if expected_secret is null or expected_secret = '' or p_secret <> expected_secret then
        raise exception 'Secreto inválido';
    end if;
    if p_source_url is null or p_source_url = '' then
        raise exception 'source_url requerido';
    end if;
    if exists (select 1 from public.threads where source_url = p_source_url) then
        return null;
    end if;
    select id into noticias_id from public.forums where slug = 'noticias';
    insert into public.threads (author_id, content, category, forum_id, is_bot, source_url, source_name, source_image)
    values (bot_uid, p_content, 'noticias', noticias_id, true, p_source_url, p_source_name, p_source_image)
    returning id into new_thread_id;
    return new_thread_id;
end;
$$;

grant execute on function public.bot_insert_news(text, text, text, text, text) to anon, authenticated;

-- RPC para configurar el secreto (sólo owner)
create or replace function public.set_bot_secret(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and is_owner = true) then
        raise exception 'Solo el owner puede configurar el bot';
    end if;
    insert into public.bot_config (id, secret) values (1, p_secret)
    on conflict (id) do update set secret = excluded.secret;
end;
$$;
grant execute on function public.set_bot_secret(text) to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.5 PUSH SUBSCRIPTIONS · Web Push (VAPID)                ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.push_subscriptions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    endpoint    text not null,
    p256dh      text not null,
    auth_key    text not null,
    user_agent  text default '',
    created_at  timestamptz not null default now(),
    last_used   timestamptz not null default now(),
    unique (user_id, endpoint)
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

-- Marcador para que el push-sender no re-envíe la misma notificación
alter table public.notifications add column if not exists pushed_at timestamptz;
create index if not exists notifications_pushed_idx on public.notifications (created_at) where pushed_at is null;

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subs self read" on public.push_subscriptions;
create policy "push_subs self read" on public.push_subscriptions for select
    using (user_id = auth.uid());
drop policy if exists "push_subs self write" on public.push_subscriptions;
create policy "push_subs self write" on public.push_subscriptions for insert
    with check (user_id = auth.uid());
drop policy if exists "push_subs self delete" on public.push_subscriptions;
create policy "push_subs self delete" on public.push_subscriptions for delete
    using (user_id = auth.uid());

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.6 STORIES 24h · publicaciones efímeras estilo IG       ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.stories (
    id          uuid primary key default gen_random_uuid(),
    author_id   uuid not null references public.profiles(id) on delete cascade,
    media_url   text not null,
    media_type  text not null default 'image' check (media_type in ('image', 'video')),
    caption     text default '',
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null default (now() + interval '24 hours')
);
-- Nota: NO usamos `where expires_at > now()` porque now() no es IMMUTABLE
-- y Postgres rechaza funciones STABLE/VOLATILE en predicates de índices.
-- El filtro `expires_at > now()` se aplica en runtime al consultar.
create index if not exists stories_active_idx on public.stories (expires_at desc);
create index if not exists stories_author_idx on public.stories (author_id, created_at desc);

alter table public.stories enable row level security;
drop policy if exists "stories public read active" on public.stories;
create policy "stories public read active" on public.stories for select
    using (expires_at > now());
drop policy if exists "stories self insert" on public.stories;
create policy "stories self insert" on public.stories for insert
    with check (author_id = auth.uid());
drop policy if exists "stories self delete" on public.stories;
create policy "stories self delete" on public.stories for delete
    using (author_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Vistas de stories (quién vio qué)
create table if not exists public.story_views (
    story_id   uuid not null references public.stories(id) on delete cascade,
    viewer_id  uuid not null references public.profiles(id) on delete cascade,
    viewed_at  timestamptz not null default now(),
    primary key (story_id, viewer_id)
);
create index if not exists story_views_story_idx on public.story_views (story_id);
alter table public.story_views enable row level security;
drop policy if exists "story_views self insert" on public.story_views;
create policy "story_views self insert" on public.story_views for insert
    with check (viewer_id = auth.uid());
drop policy if exists "story_views author or self read" on public.story_views;
create policy "story_views author or self read" on public.story_views for select
    using (
        viewer_id = auth.uid()
        or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
    );

-- RPC para purgar stories expiradas (llamar desde cron del worker)
create or replace function public.purge_expired_stories() returns int
language sql security definer set search_path = public as $$
    with deleted as (
        delete from public.stories where expires_at < now() returning 1
    ) select count(*)::int from deleted;
$$;
grant execute on function public.purge_expired_stories() to authenticated;

-- Realtime para stories
do $$ begin alter publication supabase_realtime add table public.stories; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.story_views; exception when duplicate_object then null; end $$;

-- Trigger: cuando alguien sube una story, notificar a sus seguidores
create or replace function public.notify_followers_on_story() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.notifications (recipient_id, actor_id, type, target_type, target_id, extra)
    select f.follower_id, new.author_id, 'story', 'story', new.id,
           jsonb_build_object('media_type', new.media_type)
    from public.follows f
    where f.followed_id = new.author_id
      and f.follower_id <> new.author_id;
    return new;
end;
$$;
drop trigger if exists stories_notify_followers on public.stories;
create trigger stories_notify_followers after insert on public.stories
    for each row execute function public.notify_followers_on_story();

-- Permitir tipo 'story' en notifications (si la tabla tiene el check constraint)
do $$ begin
    alter table public.notifications drop constraint if exists notifications_type_check;
    alter table public.notifications add constraint notifications_type_check
        check (type in ('new_thread','comment','like','reaction','follow','reply','mention','friend_request','dm','like_thread','story'));
exception when others then null;
end $$;

-- Bucket de stories (público porque se sirve a feeds)
insert into storage.buckets (id, name, public) values ('stories', 'stories', true)
on conflict (id) do nothing;

drop policy if exists "stories storage public read" on storage.objects;
create policy "stories storage public read" on storage.objects for select using (bucket_id = 'stories');
drop policy if exists "stories storage self insert" on storage.objects;
create policy "stories storage self insert" on storage.objects for insert
    with check (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "stories storage self delete" on storage.objects;
create policy "stories storage self delete" on storage.objects for delete
    using (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.9 DM FRIENDSHIP-GATED · DMs solo entre amigos mutuos    ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Función helper: ¿hay seguimiento mutuo entre a y b?
create or replace function public.are_mutual_friends(a uuid, b uuid)
returns boolean
language sql stable as $$
    select exists (
        select 1 from public.follows f1
        join public.follows f2 on f2.follower_id = f1.followed_id and f2.followed_id = f1.follower_id
        where f1.follower_id = a and f1.followed_id = b
    );
$$;
grant execute on function public.are_mutual_friends(uuid, uuid) to authenticated;

-- Política de envío: cualquier participante puede enviar al thread.
-- La "amistad mutua" se valida en el cliente como UX (botón deshabilitado),
-- no como hard-block en SQL · de otro modo nadie podría iniciar conversación.
-- Si quieres bloqueo duro a nivel DB, descomenta el AND de are_mutual_friends.
drop policy if exists "dm_messages participants send" on public.dm_messages;
create policy "dm_messages participants send" on public.dm_messages for insert
    with check (
        sender_id = auth.uid()
        and exists (
            select 1 from public.dm_threads t
            where t.id = dm_thread_id
              and (t.user_a = auth.uid() or t.user_b = auth.uid())
        )
    );

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.10 DM GROUPS · grupos tipo WhatsApp + channels creador  ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.dm_groups (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    description     text default '',
    avatar_url      text default '',
    kind            text not null default 'group' check (kind in ('group','channel','community')),
    -- group: chat multi-participante editable por todos (WhatsApp)
    -- channel: solo el creador (y mods) publican, miembros leen (creador → followers)
    -- community: tipo Discord, varios canales internos (futuro)
    created_by      uuid not null references public.profiles(id) on delete cascade,
    is_public       boolean not null default false,
    last_message_at timestamptz not null default now(),
    created_at      timestamptz not null default now()
);
create index if not exists dm_groups_creator_idx on public.dm_groups (created_by, created_at desc);
create index if not exists dm_groups_kind_idx on public.dm_groups (kind, last_message_at desc);

create table if not exists public.dm_group_members (
    group_id   uuid not null references public.dm_groups(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    role       text not null default 'member' check (role in ('owner','admin','member','reader')),
    joined_at  timestamptz not null default now(),
    last_read  timestamptz,
    primary key (group_id, user_id)
);
create index if not exists dm_group_members_user_idx on public.dm_group_members (user_id);

create table if not exists public.dm_group_messages (
    id            uuid primary key default gen_random_uuid(),
    group_id      uuid not null references public.dm_groups(id) on delete cascade,
    sender_id     uuid not null references public.profiles(id) on delete cascade,
    content       text default '',
    attachments   jsonb default '[]'::jsonb,
    parent_id     uuid references public.dm_group_messages(id) on delete set null,
    edited_at     timestamptz,
    deleted_at    timestamptz,
    pinned_at     timestamptz,
    created_at    timestamptz not null default now()
);
create index if not exists dm_group_msg_idx on public.dm_group_messages (group_id, created_at);

alter table public.dm_groups          enable row level security;
alter table public.dm_group_members   enable row level security;
alter table public.dm_group_messages  enable row level security;

drop policy if exists "dm_groups read" on public.dm_groups;
create policy "dm_groups read" on public.dm_groups for select using (
    is_public
    or exists (select 1 from public.dm_group_members m where m.group_id = id and m.user_id = auth.uid())
    or created_by = auth.uid()
);
drop policy if exists "dm_groups insert" on public.dm_groups;
create policy "dm_groups insert" on public.dm_groups for insert
    with check (created_by = auth.uid());
drop policy if exists "dm_groups owner update" on public.dm_groups;
create policy "dm_groups owner update" on public.dm_groups for update
    using (
        created_by = auth.uid()
        or exists (select 1 from public.dm_group_members m where m.group_id = id and m.user_id = auth.uid() and m.role in ('owner','admin'))
    );
drop policy if exists "dm_groups owner delete" on public.dm_groups;
create policy "dm_groups owner delete" on public.dm_groups for delete
    using (created_by = auth.uid());

drop policy if exists "dm_group_members read" on public.dm_group_members;
create policy "dm_group_members read" on public.dm_group_members for select
    using (
        user_id = auth.uid()
        or exists (select 1 from public.dm_group_members m2 where m2.group_id = group_id and m2.user_id = auth.uid())
        or exists (select 1 from public.dm_groups g where g.id = group_id and g.is_public)
    );
drop policy if exists "dm_group_members self join public" on public.dm_group_members;
create policy "dm_group_members self join public" on public.dm_group_members for insert
    with check (
        user_id = auth.uid()
        and exists (select 1 from public.dm_groups g where g.id = group_id and (g.is_public or g.created_by = auth.uid()))
    );
drop policy if exists "dm_group_members admin add" on public.dm_group_members;
create policy "dm_group_members admin add" on public.dm_group_members for insert
    with check (
        exists (
            select 1 from public.dm_group_members m
            where m.group_id = group_id and m.user_id = auth.uid() and m.role in ('owner','admin')
        )
    );
drop policy if exists "dm_group_members self leave" on public.dm_group_members;
create policy "dm_group_members self leave" on public.dm_group_members for delete
    using (
        user_id = auth.uid()
        or exists (select 1 from public.dm_group_members m where m.group_id = group_id and m.user_id = auth.uid() and m.role in ('owner','admin'))
    );

drop policy if exists "dm_group_messages members read" on public.dm_group_messages;
create policy "dm_group_messages members read" on public.dm_group_messages for select
    using (
        exists (select 1 from public.dm_group_members m where m.group_id = group_id and m.user_id = auth.uid())
        or exists (select 1 from public.dm_groups g where g.id = group_id and g.is_public)
    );
drop policy if exists "dm_group_messages send" on public.dm_group_messages;
create policy "dm_group_messages send" on public.dm_group_messages for insert
    with check (
        sender_id = auth.uid()
        and exists (
            select 1 from public.dm_group_members m
            where m.group_id = group_id and m.user_id = auth.uid()
              and (
                m.role <> 'reader'
                or exists (select 1 from public.dm_groups g where g.id = group_id and g.kind = 'group')
              )
        )
        -- En channels, solo owner/admin/moderator pueden publicar
        and (
            not exists (select 1 from public.dm_groups g where g.id = group_id and g.kind = 'channel')
            or exists (
                select 1 from public.dm_group_members m
                where m.group_id = group_id and m.user_id = auth.uid() and m.role in ('owner','admin')
            )
        )
    );
drop policy if exists "dm_group_messages own edit" on public.dm_group_messages;
create policy "dm_group_messages own edit" on public.dm_group_messages for update
    using (sender_id = auth.uid());

-- RPC: crear grupo y auto-añadir al creador como owner
create or replace function public.create_dm_group(
    p_name text, p_kind text default 'group', p_is_public boolean default false,
    p_description text default '', p_avatar_url text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
    if auth.uid() is null then raise exception 'No autenticado'; end if;
    if p_kind not in ('group','channel','community') then raise exception 'kind inválido'; end if;
    insert into public.dm_groups (name, description, avatar_url, kind, is_public, created_by)
    values (p_name, p_description, p_avatar_url, p_kind, p_is_public, auth.uid())
    returning id into new_id;
    insert into public.dm_group_members (group_id, user_id, role)
    values (new_id, auth.uid(), 'owner');
    return new_id;
end;
$$;
grant execute on function public.create_dm_group(text, text, boolean, text, text) to authenticated;

-- Trigger: bump last_message_at
create or replace function public.bump_dm_group_lastmsg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    update public.dm_groups set last_message_at = now() where id = new.group_id;
    return new;
end;
$$;
drop trigger if exists dm_group_msg_bump on public.dm_group_messages;
create trigger dm_group_msg_bump after insert on public.dm_group_messages
    for each row execute function public.bump_dm_group_lastmsg();

-- Realtime
do $$ begin alter publication supabase_realtime add table public.dm_groups; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.dm_group_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.dm_group_messages; exception when duplicate_object then null; end $$;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.11 THREAD COLLABORATORS · co-autores en hilos/videos    ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.thread_collaborators (
    thread_id    uuid not null references public.threads(id) on delete cascade,
    user_id      uuid not null references public.profiles(id) on delete cascade,
    role         text not null default 'collaborator' check (role in ('collaborator','contributor','featured')),
    added_at     timestamptz not null default now(),
    primary key (thread_id, user_id)
);
create index if not exists thread_collab_thread_idx on public.thread_collaborators (thread_id);
create index if not exists thread_collab_user_idx on public.thread_collaborators (user_id);

alter table public.thread_collaborators enable row level security;
drop policy if exists "thread_collab public read" on public.thread_collaborators;
create policy "thread_collab public read" on public.thread_collaborators for select using (true);
drop policy if exists "thread_collab author add" on public.thread_collaborators;
create policy "thread_collab author add" on public.thread_collaborators for insert
    with check (
        exists (select 1 from public.threads t where t.id = thread_id and t.author_id = auth.uid())
    );
drop policy if exists "thread_collab self leave or author remove" on public.thread_collaborators;
create policy "thread_collab self leave or author remove" on public.thread_collaborators for delete
    using (
        user_id = auth.uid()
        or exists (select 1 from public.threads t where t.id = thread_id and t.author_id = auth.uid())
    );

-- Realtime
do $$ begin alter publication supabase_realtime add table public.thread_collaborators; exception when duplicate_object then null; end $$;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.8 PROFILES EXT · país + account_type + business         ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.profiles add column if not exists country       text default 'MX';
alter table public.profiles add column if not exists country_name  text default '';
alter table public.profiles add column if not exists account_type  text default 'personal' check (account_type in ('personal', 'business'));
alter table public.profiles add column if not exists business_name text default '';
alter table public.profiles add column if not exists business_category text default '';
alter table public.profiles add column if not exists business_lat   double precision;
alter table public.profiles add column if not exists business_lng   double precision;
alter table public.profiles add column if not exists business_address text default '';
alter table public.profiles add column if not exists business_phone   text default '';
-- Categorías típicas: tienda, restaurante, servicios, profesional, oficio, otro

create index if not exists profiles_account_type_idx on public.profiles (account_type);

-- Cuándo se cambió cada campo "protegido" · enforce cooldown desde RPC.
alter table public.profiles add column if not exists birthdate_changed_at    timestamptz;
alter table public.profiles add column if not exists country_changed_at      timestamptz;
alter table public.profiles add column if not exists account_type_changed_at timestamptz;

-- RPC: setea/cambia un campo protegido con cooldown.
-- Primera vez = libre.  Después: bloqueado hasta que pase el cooldown.
--   birthdate    → 365 días
--   country      → 180 días
--   account_type → 30 días
create or replace function public.update_protected_field(
    p_field text, p_value text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    last_change timestamptz;
    cooldown_days int;
    cooldown_col text;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'no_session');
    end if;

    if p_field = 'birthdate' then
        cooldown_col := 'birthdate_changed_at'; cooldown_days := 365;
    elsif p_field = 'country' then
        cooldown_col := 'country_changed_at'; cooldown_days := 180;
    elsif p_field = 'account_type' then
        if p_value not in ('personal', 'business') then
            return jsonb_build_object('ok', false, 'error', 'invalid_value');
        end if;
        cooldown_col := 'account_type_changed_at'; cooldown_days := 30;
    else
        return jsonb_build_object('ok', false, 'error', 'unknown_field');
    end if;

    execute format('select %I from public.profiles where id = $1', cooldown_col)
      into last_change using uid;

    if last_change is not null
       and last_change + (cooldown_days || ' days')::interval > now() then
        return jsonb_build_object(
            'ok', false,
            'error', 'cooldown',
            'next_change_at', last_change + (cooldown_days || ' days')::interval
        );
    end if;

    if p_field = 'birthdate' then
        update public.profiles
           set birthdate = nullif(p_value, '')::date,
               birthdate_changed_at = now()
         where id = uid;
    elsif p_field = 'country' then
        update public.profiles
           set country = p_value, country_changed_at = now()
         where id = uid;
    elsif p_field = 'account_type' then
        update public.profiles
           set account_type = p_value, account_type_changed_at = now()
         where id = uid;
    end if;

    return jsonb_build_object(
        'ok', true,
        'next_change_at', now() + (cooldown_days || ' days')::interval
    );
exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;
grant execute on function public.update_protected_field(text, text) to authenticated;

-- RPC: estado de campos protegidos del usuario actual (locked/value/next)
create or replace function public.my_protected_fields_status()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    rec record;
begin
    if uid is null then return jsonb_build_object(); end if;
    select birthdate, country, account_type,
           birthdate_changed_at, country_changed_at, account_type_changed_at
      into rec from public.profiles where id = uid;
    return jsonb_build_object(
        'birthdate', jsonb_build_object(
            'value', rec.birthdate,
            'changed_at', rec.birthdate_changed_at,
            'next_change_at', case
                when rec.birthdate_changed_at is null then null
                else rec.birthdate_changed_at + interval '365 days'
            end,
            'locked', rec.birthdate_changed_at is not null
                and rec.birthdate_changed_at + interval '365 days' > now(),
            'cooldown_days', 365
        ),
        'country', jsonb_build_object(
            'value', rec.country,
            'changed_at', rec.country_changed_at,
            'next_change_at', case
                when rec.country_changed_at is null then null
                else rec.country_changed_at + interval '180 days'
            end,
            'locked', rec.country_changed_at is not null
                and rec.country_changed_at + interval '180 days' > now(),
            'cooldown_days', 180
        ),
        'account_type', jsonb_build_object(
            'value', rec.account_type,
            'changed_at', rec.account_type_changed_at,
            'next_change_at', case
                when rec.account_type_changed_at is null then null
                else rec.account_type_changed_at + interval '30 days'
            end,
            'locked', rec.account_type_changed_at is not null
                and rec.account_type_changed_at + interval '30 days' > now(),
            'cooldown_days', 30
        )
    );
end;
$$;
grant execute on function public.my_protected_fields_status() to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.17 RATE LIMITING · contra spam masivo                   ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.rate_limits (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    action     text not null,
    window_start timestamptz not null default now(),
    count      int not null default 1,
    primary key (user_id, action, window_start)
);
create index if not exists rate_limits_lookup_idx on public.rate_limits (user_id, action, window_start desc);

alter table public.rate_limits enable row level security;
drop policy if exists "rate_limits self read" on public.rate_limits;
create policy "rate_limits self read" on public.rate_limits for select using (user_id = auth.uid());

-- RPC genérico para chequear y bumpear · llamar antes de inserciones costosas.
-- Devuelve true si OK, false si excedió.
create or replace function public.check_rate_limit(
    p_action text, p_max int, p_window_minutes int default 1
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    window_key timestamptz;
    current_count int;
begin
    if uid is null then return true; end if; -- usuarios anon no rate-limited (su escritura ya está bloqueada por RLS)
    window_key := date_trunc('minute', now()) -
        (extract(minute from now())::int % p_window_minutes) * interval '1 minute';

    insert into public.rate_limits (user_id, action, window_start, count)
    values (uid, p_action, window_key, 1)
    on conflict (user_id, action, window_start) do update
        set count = public.rate_limits.count + 1
        returning count into current_count;

    -- Cleanup viejo (más de 1 día)
    delete from public.rate_limits where window_start < now() - interval '1 day';

    return current_count <= p_max;
end;
$$;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.18 VERIFICATION · cuentas verificadas (admin grant)     ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.profiles add column if not exists verified         boolean default false;
alter table public.profiles add column if not exists verified_at      timestamptz;
alter table public.profiles add column if not exists verified_by      uuid references public.profiles(id);
alter table public.profiles add column if not exists verified_reason  text default '';

-- RPC: solo admin puede verificar/desverificar
create or replace function public.admin_set_verified(p_username text, p_verified boolean, p_reason text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare target_id uuid; caller_role text;
begin
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role <> 'admin' then raise exception 'Solo admins'; end if;
    select id into target_id from public.profiles where lower(username) = lower(p_username);
    if target_id is null then return false; end if;
    update public.profiles set
        verified = p_verified,
        verified_at = case when p_verified then now() else null end,
        verified_by = case when p_verified then auth.uid() else null end,
        verified_reason = p_reason
    where id = target_id;
    return true;
end;
$$;
grant execute on function public.admin_set_verified(text, boolean, text) to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.19 FULL-TEXT SEARCH · tsvector + GIN                    ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Threads: columna tsvector + trigger para mantenerla actualizada
alter table public.threads add column if not exists search_doc tsvector;

create or replace function public.threads_update_search_doc() returns trigger
language plpgsql as $$
begin
    new.search_doc := to_tsvector('spanish',
        coalesce(new.content, '') || ' ' ||
        coalesce(new.category, '')
    );
    return new;
end;
$$;
drop trigger if exists threads_search_update on public.threads;
create trigger threads_search_update before insert or update of content, category
    on public.threads
    for each row execute function public.threads_update_search_doc();

create index if not exists threads_search_gin_idx on public.threads using gin (search_doc);

-- Rellena las filas existentes (idempotente)
update public.threads set search_doc = to_tsvector('spanish', coalesce(content, '') || ' ' || coalesce(category, ''))
where search_doc is null;

-- RPC search optimizada
create or replace function public.search_threads_fts(p_query text, p_limit int default 20)
returns table (id uuid, content text, category text, created_at timestamptz, rank real)
language sql stable security definer set search_path = public as $$
    select t.id, t.content, t.category, t.created_at,
           ts_rank(t.search_doc, websearch_to_tsquery('spanish', p_query)) as rank
      from public.threads t
     where t.search_doc @@ websearch_to_tsquery('spanish', p_query)
     order by rank desc, t.created_at desc
     limit p_limit;
$$;
grant execute on function public.search_threads_fts(text, int) to anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.20 COMMENT REACTIONS                                    ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.comment_reactions (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    comment_id uuid not null references public.comments(id) on delete cascade,
    emoji      text not null,
    created_at timestamptz not null default now(),
    primary key (user_id, comment_id, emoji)
);
create index if not exists comment_reactions_comment_idx on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;
drop policy if exists "comment_reactions public read" on public.comment_reactions;
create policy "comment_reactions public read" on public.comment_reactions for select using (true);
drop policy if exists "comment_reactions self write" on public.comment_reactions;
create policy "comment_reactions self write" on public.comment_reactions for insert
    with check (user_id = auth.uid());
drop policy if exists "comment_reactions self delete" on public.comment_reactions;
create policy "comment_reactions self delete" on public.comment_reactions for delete
    using (user_id = auth.uid());

do $$ begin alter publication supabase_realtime add table public.comment_reactions; exception when duplicate_object then null; end $$;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.21 PROFILE COMPLETENESS · vista helper                  ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace function public.profile_completeness(p_user_id uuid)
returns int language sql stable security definer set search_path = public as $$
    select greatest(0, least(100, (
        case when p.bio is not null and length(p.bio) > 20 then 15 else 0 end +
        case when p.pfp is not null and p.pfp <> '' then 15 else 0 end +
        case when p.banner is not null and p.banner <> '' then 10 else 0 end +
        case when p.location is not null and p.location <> '' then 10 else 0 end +
        case when p.birthdate is not null then 10 else 0 end +
        case when p.country is not null and p.country <> '' then 5 else 0 end +
        case when p.work is not null and p.work <> '' then 10 else 0 end +
        case when p.education is not null and p.education <> '' then 5 else 0 end +
        case when p.website is not null and p.website <> '' then 5 else 0 end +
        case when (p.social_links::jsonb <> '{}'::jsonb) then 5 else 0 end +
        case when exists (select 1 from public.follows where follower_id = p_user_id) then 5 else 0 end +
        case when exists (select 1 from public.threads where author_id = p_user_id) then 5 else 0 end
    )))::int
    from public.profiles p where p.id = p_user_id;
$$;
grant execute on function public.profile_completeness(uuid) to anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.12 MARKETPLACE · compra-venta local                     ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.marketplace_items (
    id          uuid primary key default gen_random_uuid(),
    seller_id   uuid not null references public.profiles(id) on delete cascade,
    title       text not null,
    description text default '',
    price       numeric(12,2) not null default 0,
    currency    text not null default 'MXN',
    category    text not null default 'otros' check (category in (
        'electronica','muebles','vehiculos','ropa','servicios',
        'comida','animales','inmuebles','herramientas','otros'
    )),
    condition   text default 'usado' check (condition in ('nuevo','seminuevo','usado')),
    location    text default '',
    images      jsonb default '[]'::jsonb,
    status      text not null default 'active' check (status in ('active','sold','paused','removed')),
    contact_dm  boolean default true,
    contact_phone text default '',
    views       int default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists marketplace_active_idx on public.marketplace_items (status, created_at desc) where status = 'active';
create index if not exists marketplace_seller_idx on public.marketplace_items (seller_id, created_at desc);
create index if not exists marketplace_category_idx on public.marketplace_items (category, created_at desc);

alter table public.marketplace_items enable row level security;
drop policy if exists "marketplace public read active" on public.marketplace_items;
create policy "marketplace public read active" on public.marketplace_items for select
    using (status <> 'removed' or seller_id = auth.uid());
drop policy if exists "marketplace self insert" on public.marketplace_items;
create policy "marketplace self insert" on public.marketplace_items for insert
    with check (seller_id = auth.uid());
drop policy if exists "marketplace self update" on public.marketplace_items;
create policy "marketplace self update" on public.marketplace_items for update
    using (seller_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "marketplace self delete" on public.marketplace_items;
create policy "marketplace self delete" on public.marketplace_items for delete
    using (seller_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

do $$ begin alter publication supabase_realtime add table public.marketplace_items; exception when duplicate_object then null; end $$;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.13 REPORTS · moderación de contenido                    ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.reports (
    id              uuid primary key default gen_random_uuid(),
    reporter_id     uuid not null references public.profiles(id) on delete set null,
    target_type     text not null check (target_type in ('thread','comment','profile','dm','reel','marketplace','story')),
    target_id       uuid,
    reason          text not null check (reason in ('spam','acoso','contenido_sexual','violencia','desinformacion','suplantacion','otros')),
    details         text default '',
    status          text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
    resolved_by     uuid references public.profiles(id) on delete set null,
    resolution_note text default '',
    created_at      timestamptz not null default now(),
    resolved_at     timestamptz
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

alter table public.reports enable row level security;
drop policy if exists "reports self insert" on public.reports;
create policy "reports self insert" on public.reports for insert
    with check (reporter_id = auth.uid());
drop policy if exists "reports admin read" on public.reports;
create policy "reports admin read" on public.reports for select
    using (
        reporter_id = auth.uid()
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
drop policy if exists "reports admin update" on public.reports;
create policy "reports admin update" on public.reports for update
    using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.14 DND MODE · no molestar                               ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.profiles add column if not exists dnd_mode boolean default false;
-- Cuando dnd_mode = true: no se reciben push notifs, online_status se oculta,
-- el bot de notif del UI muestra "no molestar" como aviso.


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.15 COLLABORATOR NOTIFICATIONS · invitaciones a hilos    ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Permitir tipo 'collaboration' en notifications
do $$ begin
    alter table public.notifications drop constraint if exists notifications_type_check;
    alter table public.notifications add constraint notifications_type_check
        check (type in ('new_thread','comment','like','reaction','follow','reply','mention','friend_request','dm','like_thread','story','collaboration','marketplace','report'));
exception when others then null;
end $$;

create or replace function public.notify_on_collaboration() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
    select author_id into author from public.threads where id = new.thread_id;
    if author is not null and author <> new.user_id then
        insert into public.notifications (recipient_id, actor_id, type, target_type, target_id, extra)
        values (new.user_id, author, 'collaboration', 'thread', new.thread_id, jsonb_build_object('role', new.role));
    end if;
    return new;
end;
$$;
drop trigger if exists thread_collab_notify on public.thread_collaborators;
create trigger thread_collab_notify after insert on public.thread_collaborators
    for each row execute function public.notify_on_collaboration();


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.16 ACTIVITY STATS · view para gráficas en perfil        ║
-- ╚═══════════════════════════════════════════════════════════╝

-- RPC: hilos por mes de un usuario (últimos 12 meses)
create or replace function public.user_monthly_activity(p_user_id uuid)
returns table (month text, thread_count int, comment_count int)
language sql stable security definer set search_path = public as $$
    with months as (
        select to_char(generate_series(
            date_trunc('month', now()) - interval '11 months',
            date_trunc('month', now()),
            interval '1 month'
        ), 'YYYY-MM') as month
    ),
    threads_m as (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as c
        from public.threads where author_id = p_user_id
          and created_at >= date_trunc('month', now()) - interval '11 months'
        group by 1
    ),
    comments_m as (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as c
        from public.comments where author_id = p_user_id
          and created_at >= date_trunc('month', now()) - interval '11 months'
        group by 1
    )
    select m.month,
           coalesce(t.c, 0) as thread_count,
           coalesce(cm.c, 0) as comment_count
      from months m
      left join threads_m t on t.month = m.month
      left join comments_m cm on cm.month = m.month
      order by m.month;
$$;
grant execute on function public.user_monthly_activity(uuid) to anon, authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 18.7 DAILY STREAK · racha de actividad diaria              ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.user_streaks (
    user_id        uuid primary key references public.profiles(id) on delete cascade,
    current_streak int  not null default 0,
    longest_streak int  not null default 0,
    last_active    date,
    updated_at     timestamptz not null default now()
);

alter table public.user_streaks enable row level security;
drop policy if exists "streaks public read" on public.user_streaks;
create policy "streaks public read" on public.user_streaks for select using (true);
drop policy if exists "streaks self write" on public.user_streaks;
create policy "streaks self write" on public.user_streaks for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RPC para pingear la racha (llamar cuando el usuario haga alguna acción)
create or replace function public.tick_streak() returns table (current_streak int, longest_streak int)
language plpgsql security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    today date := (now() at time zone 'America/Mexico_City')::date;
    prev date;
    cur int;
    longest int;
begin
    if uid is null then raise exception 'No autenticado'; end if;
    select last_active, current_streak, longest_streak
      into prev, cur, longest
      from public.user_streaks where user_id = uid;
    if prev is null then
        insert into public.user_streaks (user_id, current_streak, longest_streak, last_active)
        values (uid, 1, 1, today);
        return query select 1::int, 1::int;
        return;
    end if;
    if prev = today then
        return query select cur, longest;
        return;
    elsif prev = today - 1 then
        cur := cur + 1;
    else
        cur := 1;
    end if;
    if cur > longest then longest := cur; end if;
    update public.user_streaks set
        current_streak = cur,
        longest_streak = longest,
        last_active = today,
        updated_at = now()
    where user_id = uid;
    return query select cur, longest;
end;
$$;
grant execute on function public.tick_streak() to authenticated;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 19. WEBRTC CALLS · señalización para llamadas voz/video   ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Sesiones activas de llamada (un row por llamada)
create table if not exists public.call_sessions (
    id            uuid primary key default gen_random_uuid(),
    caller_id     uuid not null references public.profiles(id) on delete cascade,
    callee_id     uuid not null references public.profiles(id) on delete cascade,
    kind          text not null default 'audio' check (kind in ('audio', 'video')),
    status        text not null default 'ringing' check (status in ('ringing', 'accepted', 'rejected', 'missed', 'ended', 'failed')),
    started_at    timestamptz,
    ended_at      timestamptz,
    created_at    timestamptz not null default now(),
    constraint call_sessions_distinct check (caller_id <> callee_id)
);
create index if not exists call_sessions_callee_idx on public.call_sessions (callee_id, created_at desc);
create index if not exists call_sessions_caller_idx on public.call_sessions (caller_id, created_at desc);

alter table public.call_sessions enable row level security;

drop policy if exists "call_sessions participants read" on public.call_sessions;
create policy "call_sessions participants read" on public.call_sessions for select
    using (caller_id = auth.uid() or callee_id = auth.uid());
drop policy if exists "call_sessions caller insert" on public.call_sessions;
create policy "call_sessions caller insert" on public.call_sessions for insert
    with check (caller_id = auth.uid());
drop policy if exists "call_sessions participants update" on public.call_sessions;
create policy "call_sessions participants update" on public.call_sessions for update
    using (caller_id = auth.uid() or callee_id = auth.uid());

-- Habilitar realtime para call_sessions
do $$ begin
    alter publication supabase_realtime add table public.call_sessions;
exception when duplicate_object then null;
end $$;


-- =============================================================
-- ¡Listo! Schema completo del PoC instalado.
-- Promueve tu primer admin:
--     UPDATE profiles SET role='admin' WHERE username='TU_USERNAME';
-- Configurar bot de noticias (logueado como owner):
--     SELECT public.set_bot_secret('cambia-esto-por-algo-largo-y-random');
-- =============================================================
