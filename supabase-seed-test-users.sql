-- ============================================================
-- Tres Valles — Seed de 10 cuentas de prueba
-- ============================================================
-- Crea 10 usuarios "de relleno" para probar el feed, chat,
-- comentarios, etc. Idempotente: si ya existen, no los duplica.
--
-- Email pattern: <username>@test.tresvalles.local
-- Password (todos): test1234
--
-- Ejecuta en Supabase → SQL Editor → Run.
-- Si quieres borrarlos después:
--   delete from auth.users where email like '%@test.tresvalles.local';
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
    test_users text[][] := array[
        array['charli',       'prueba charli'],
        array['gleep',        'gleep'],
        array['jefe',         'jefe'],
        array['tio_charli',   'el tio de charli'],
        array['pancho_villa', 'pancho villa'],
        array['dona_juana',   'doña juana'],
        array['chiflado',     'el chiflado'],
        array['chismosa',     'la chismosa'],
        array['gnomo',        'gnomo mistico'],
        array['dr_facundo',   'doctor facundo']
    ];
    u text[];
    new_id uuid;
    pwd_hash text;
begin
    pwd_hash := crypt('test1234', gen_salt('bf'));
    foreach u slice 1 in array test_users loop
        -- Saltar si ya existe el email
        if exists (select 1 from auth.users where email = u[1] || '@test.tresvalles.local') then
            continue;
        end if;

        new_id := gen_random_uuid();

        insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, recovery_sent_at, last_sign_in_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) values (
            '00000000-0000-0000-0000-000000000000',
            new_id,
            'authenticated',
            'authenticated',
            u[1] || '@test.tresvalles.local',
            pwd_hash,
            now(), now(), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('username', u[2], 'is_guest', false),
            now(), now(),
            '', '', '', ''
        );

        insert into auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
        ) values (
            gen_random_uuid(),
            new_id,
            jsonb_build_object(
                'sub', new_id::text,
                'email', u[1] || '@test.tresvalles.local',
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            new_id::text,
            now(), now(), now()
        );

        -- El trigger handle_new_user ya inserta la fila en public.profiles
        -- (con el username del raw_user_meta_data). Si por alguna razón el
        -- trigger no estaba activo cuando se ejecutó este script, forzamos
        -- la inserción manual.
        if not exists (select 1 from public.profiles where id = new_id) then
            insert into public.profiles (id, username, pfp, is_guest, email, role)
            values (new_id, u[2], '', false, u[1] || '@test.tresvalles.local', 'citizen');
        end if;

        raise notice 'Creado: % (email: %)', u[2], u[1] || '@test.tresvalles.local';
    end loop;
end $$;

-- Mostrar las cuentas creadas
select username, email, role, created_at
from public.profiles
where email like '%@test.tresvalles.local'
order by created_at desc;
