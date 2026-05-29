-- =============================================================
-- Tres Valles · Tokens de push NATIVO (app Capacitor: FCM/APNs)
-- -------------------------------------------------------------
-- El push web (VAPID) usa public.push_subscriptions. La app nativa
-- usa tokens FCM (Android) / APNs (iOS) distintos → tabla aparte.
-- Para ENVIAR a estos tokens hace falta un sender FCM/APNs (Firebase
-- Admin / APNs) — separado del push-sender web actual.
-- Idempotente. Ejecutar en Supabase Dashboard -> SQL Editor -> Run.
-- =============================================================

create table if not exists public.device_push_tokens (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    token      text not null,
    platform   text not null default 'android',   -- 'android' | 'ios'
    updated_at timestamptz not null default now(),
    primary key (user_id, token)
);
create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;
drop policy if exists "device tokens self" on public.device_push_tokens;
create policy "device tokens self" on public.device_push_tokens for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
