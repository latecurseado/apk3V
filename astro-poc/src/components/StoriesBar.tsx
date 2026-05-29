import { useEffect, useState } from 'preact/hooks';
import { useSession } from '../lib/auth';
import { fetchActiveStories, type Story } from '../lib/stories';
import StoryComposer from './StoryComposer';
import StoryViewer from './StoryViewer';
import Avatar from './Avatar';

interface AuthorBundle {
    author: { id: string; username: string; pfp: string | null };
    stories: Story[];
}

/**
 * Strip horizontal de Stories estilo Instagram al inicio del feed.
 * Primer item = "Tu story" (crea/agrega).
 */
export default function StoriesBar() {
    const { user } = useSession();
    const [bundles, setBundles] = useState<AuthorBundle[]>([]);
    const [composerOpen, setComposerOpen] = useState(false);
    const [viewer, setViewer] = useState<{ bundleIndex: number; storyIndex: number } | null>(null);

    const refresh = async () => {
        const b = await fetchActiveStories();
        setBundles(b);
    };

    useEffect(() => { refresh(); }, [user?.id]);

    const myBundleIdx = user ? bundles.findIndex(b => b.author.id === user.id) : -1;
    const myBundle = myBundleIdx >= 0 ? bundles[myBundleIdx] : null;

    return (
        <>
            <section class="stories-bar">
                {/* Tu story · siempre primero si hay usuario */}
                {user && (
                    <button
                        class="story-card mine"
                        onClick={() => {
                            if (myBundle) setViewer({ bundleIndex: myBundleIdx, storyIndex: 0 });
                            else setComposerOpen(true);
                        }}
                    >
                        <div class={`story-ring ${myBundle ? 'active' : 'empty'}`}>
                            <Avatar user={{ id: user.id, username: user.user_metadata?.username || 'tu' } as any} size={56} />
                            {!myBundle && (
                                <span class="story-add-badge"><i class="fas fa-plus"></i></span>
                            )}
                        </div>
                        <small>{myBundle ? 'Tu story' : 'Tu story'}</small>
                    </button>
                )}

                {/* Stories de otros */}
                {bundles.map((b, i) => {
                    if (b.author.id === user?.id) return null;
                    return (
                        <button
                            key={b.author.id}
                            class="story-card"
                            onClick={() => setViewer({ bundleIndex: i, storyIndex: 0 })}
                        >
                            <div class="story-ring active">
                                <Avatar user={b.author as any} size={56} />
                            </div>
                            <small>@{b.author.username || 'anon'}</small>
                        </button>
                    );
                })}

                {bundles.length === 0 && !user && (
                    <p class="stories-empty">
                        <i class="fas fa-circle-notch fa-spin"></i> Cargando stories…
                    </p>
                )}

                {bundles.length === 0 && user && !composerOpen && (
                    <span class="stories-hint">
                        Aún no hay stories · sé el primero
                    </span>
                )}
            </section>

            {composerOpen && (
                <StoryComposer
                    onClose={() => setComposerOpen(false)}
                    onPosted={() => { refresh(); }}
                />
            )}

            {viewer && (
                <StoryViewer
                    bundles={bundles}
                    initialBundleIndex={viewer.bundleIndex}
                    initialStoryIndex={viewer.storyIndex}
                    onClose={() => setViewer(null)}
                    onAllSeen={refresh}
                />
            )}
        </>
    );
}
