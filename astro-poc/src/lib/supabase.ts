import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_KEY;

if (!url || !key) {
    console.warn(
        '[supabase] Faltan PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_KEY en .env. ' +
        'Copia .env.example a .env y rellena los valores.'
    );
}

export const supabase = createClient(url ?? '', key ?? '');
