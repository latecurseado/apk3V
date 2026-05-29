interface Props {
    variant?: 'thread' | 'comment' | 'profile' | 'message' | 'card' | 'avatar' | 'line' | 'block';
    count?: number;
    width?: string;
    height?: string;
}

export default function Skeleton({ variant = 'block', count = 1, width, height }: Props) {
    const items = Array.from({ length: count });

    if (variant === 'thread') {
        return (
            <>
                {items.map(() => (
                    <div class="skel-thread">
                        <div class="skel-thread-head">
                            <div class="skel skel-avatar"></div>
                            <div class="skel-thread-meta">
                                <div class="skel skel-line short"></div>
                                <div class="skel skel-line tiny"></div>
                            </div>
                        </div>
                        <div class="skel skel-line"></div>
                        <div class="skel skel-line"></div>
                        <div class="skel skel-line medium"></div>
                        <div class="skel-thread-actions">
                            <div class="skel skel-pill"></div>
                            <div class="skel skel-pill"></div>
                            <div class="skel skel-pill"></div>
                        </div>
                    </div>
                ))}
            </>
        );
    }

    if (variant === 'comment') {
        return (
            <>
                {items.map(() => (
                    <div class="skel-comment">
                        <div class="skel skel-avatar small"></div>
                        <div class="skel-comment-body">
                            <div class="skel skel-line short"></div>
                            <div class="skel skel-line"></div>
                        </div>
                    </div>
                ))}
            </>
        );
    }

    if (variant === 'profile') {
        return (
            <div class="skel-profile">
                <div class="skel skel-banner"></div>
                <div class="skel-profile-id">
                    <div class="skel skel-avatar-big"></div>
                    <div class="skel-profile-info">
                        <div class="skel skel-line long"></div>
                        <div class="skel skel-line"></div>
                        <div class="skel-profile-stats">
                            <div class="skel skel-pill"></div>
                            <div class="skel skel-pill"></div>
                            <div class="skel skel-pill"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (variant === 'message') {
        return (
            <>
                {items.map((_, i) => (
                    <div class={`skel-message ${i % 2 ? 'mine' : 'other'}`}>
                        <div class="skel skel-bubble" style={`width: ${40 + Math.random() * 40}%`}></div>
                    </div>
                ))}
            </>
        );
    }

    if (variant === 'card') {
        return (
            <>
                {items.map(() => (
                    <div class="skel-card">
                        <div class="skel skel-line short"></div>
                        <div class="skel skel-line"></div>
                        <div class="skel skel-line medium"></div>
                    </div>
                ))}
            </>
        );
    }

    if (variant === 'avatar') {
        return <div class="skel skel-avatar" style={width || height ? `width:${width};height:${height}` : ''}></div>;
    }

    return (
        <>
            {items.map(() => (
                <div class="skel skel-line" style={width || height ? `width:${width};height:${height}` : ''}></div>
            ))}
        </>
    );
}
