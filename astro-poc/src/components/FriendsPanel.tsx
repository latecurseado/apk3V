import { useEffect, useState } from 'preact/hooks';
import { supabase } from '../lib/supabase';
import { useSession, userLabel } from '../lib/auth';
import {
    searchProfiles, fetchFollowing, follow, unfollow,
    fetchSuggestedUsers, fetchMyMutualFollows,
} from '../lib/friends';
import { subscribePresence } from '../lib/presence';
import type { Profile } from '../lib/forum';
import Avatar from './Avatar';

export default function FriendsPanel() {
    const { user, ready } = useSession();
    const [q, setQ] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [following, setFollowing] = useState<Profile[]>([]);
    const [friends, setFriends] = useState<Profile[]>([]);
    const [suggested, setSuggested] = useState<Array<Profile & { mutuals_count: number }>>([]);
    const [searching, setSearching] = useState(false);
    const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

    useEffect(() => subscribePresence(setOnlineIds), []);

    // Carga inicial: mis follows + sugeridos (perfiles aleatorios)
    useEffect(() => {
        if (!user) { setFollowing([]); setFriends([]); return; }
        fetchFollowing(user.id).then(setFollowing);
        fetchMyMutualFollows().then(setFriends);
    }, [user?.id]);

    useEffect(() => {
        // Sugeridos inteligentes con friends-of-friends + fallback a perfiles recientes
        (async () => {
            if (user) {
                const smart = await fetchSuggestedUsers(8);
                if (smart.length > 0) { setSuggested(smart); return; }
            }
            // Fallback: últimos perfiles registrados
            const { data } = await supabase
                .from('profiles')
                .select('id, username, pfp, role')
                .order('created_at', { ascending: false })
                .limit(8);
            const list = ((data || []) as Profile[])
                .filter(p => p.id !== user?.id)
                .map(p => ({ ...p, mutuals_count: 0 }));
            setSuggested(list);
        })();
    }, [user?.id]);

    // Búsqueda en vivo (debounced)
    useEffect(() => {
        const t = q.trim();
        if (t.length < 1) { setResults([]); return; }
        setSearching(true);
        const id = setTimeout(async () => {
            const list = await searchProfiles(t);
            setResults(list.filter(p => p.id !== user?.id));
            setSearching(false);
        }, 250);
        return () => clearTimeout(id);
    }, [q, user?.id]);

    const isFollowingId = (id: string) => following.some(f => f.id === id);

    const toggle = async (p: Profile) => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('tv:auth-required', { detail: { action: 'seguir a usuarios' } }));
            return;
        }
        if (isFollowingId(p.id)) {
            await unfollow(p.id);
            setFollowing(fs => fs.filter(f => f.id !== p.id));
        } else {
            await follow(p.id);
            setFollowing(fs => [p, ...fs]);
        }
    };

    return (
        <div class="friends-panel">
            <div class="fp-search">
                <i class="fas fa-magnifying-glass"></i>
                <input
                    type="search"
                    placeholder="Buscar usuarios…"
                    value={q}
                    onInput={(e: any) => setQ(e.currentTarget.value)}
                />
                {q && (
                    <button class="fp-clear" onClick={() => setQ('')} aria-label="Limpiar">
                        <i class="fas fa-xmark"></i>
                    </button>
                )}
            </div>

            {/* Resultados de búsqueda */}
            {q.trim() && (
                <FriendsList
                    title="Resultados"
                    icon="fa-magnifying-glass"
                    items={results}
                    loading={searching}
                    emptyMsg="Sin coincidencias"
                    isFollowing={isFollowingId}
                    onToggle={toggle}
                    canFollow={!!user}
                    onlineIds={onlineIds}
                />
            )}

            {/* Amigos mutuos (follow recíproco) */}
            {!q.trim() && user && friends.length > 0 && (
                <FriendsList
                    title={`💞 Amigos · ${friends.length}`}
                    icon="fa-people-arrows"
                    items={friends}
                    emptyMsg="Sin amigos todavía."
                    isFollowing={() => true}
                    onToggle={toggle}
                    canFollow={true}
                    compact
                    onlineIds={onlineIds}
                />
            )}

            {/* Siguiendo */}
            {!q.trim() && user && (
                <FriendsList
                    title={`Siguiendo · ${following.length}`}
                    icon="fa-user-group"
                    items={following}
                    emptyMsg="Aún no sigues a nadie. Busca usuarios arriba."
                    isFollowing={() => true}
                    onToggle={toggle}
                    canFollow={true}
                    compact
                    onlineIds={onlineIds}
                />
            )}

            {/* Sugeridos estilo Instagram */}
            {!q.trim() && (
                <FriendsList
                    title="Sugeridos para ti"
                    icon="fa-star"
                    items={suggested.filter(s => !isFollowingId(s.id))}
                    emptyMsg="Sin sugerencias por ahora."
                    isFollowing={isFollowingId}
                    onToggle={toggle}
                    canFollow={!!user}
                    onlineIds={onlineIds}
                />
            )}

            {!user && ready && !q.trim() && (
                <p class="fp-hint">
                    <i class="fas fa-info-circle"></i>
                    Inicia sesión arriba para seguir usuarios y armar tu red.
                </p>
            )}
        </div>
    );
}

function FriendsList({ title, icon, items, loading, emptyMsg, isFollowing, onToggle, canFollow, compact, onlineIds }: {
    title: string;
    icon: string;
    items: Profile[];
    loading?: boolean;
    emptyMsg: string;
    isFollowing: (id: string) => boolean;
    onToggle: (p: Profile) => void;
    canFollow: boolean;
    compact?: boolean;
    onlineIds?: Set<string>;
}) {
    return (
        <div class="fp-section">
            <h4><i class={`fas ${icon}`}></i> {title}</h4>
            {loading && <div class="fp-empty">Buscando…</div>}
            {!loading && items.length === 0 && <div class="fp-empty">{emptyMsg}</div>}
            <ul class={`fp-list ${compact ? 'compact' : ''}`}>
                {items.map((p: any) => {
                    const f = isFollowing(p.id);
                    const online = onlineIds?.has(p.id);
                    const mutuals = p.mutuals_count || 0;
                    return (
                        <li class="fp-item" key={p.id}>
                            <a href={`/perfil?u=${p.username}`} class={`fp-avatar-link ${online ? 'online' : ''}`}>
                                <Avatar user={p} size={36} />
                            </a>
                            <div class="fp-info">
                                <strong>{p.username || 'Anónimo'}</strong>
                                {mutuals > 0 ? (
                                    <small class="fp-mutuals">
                                        <i class="fas fa-user-group"></i> {mutuals} en común
                                    </small>
                                ) : (
                                    <small>{p.role === 'admin' ? 'Admin' : 'Miembro'}</small>
                                )}
                            </div>
                            {canFollow && (
                                <button
                                    class={`fp-btn ${f ? 'following' : 'follow'}`}
                                    onClick={() => onToggle(p)}
                                >
                                    {f ? 'Siguiendo' : 'Seguir'}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
