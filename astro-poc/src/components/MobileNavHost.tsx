import { useState } from 'preact/hooks';
import MobileBottomNav from './MobileBottomNav';
import ComposeModal from './ComposeModal';

export default function MobileNavHost() {
    const [composeOpen, setComposeOpen] = useState(false);
    return (
        <>
            <MobileBottomNav onCompose={() => setComposeOpen(true)} />
            {composeOpen && (
                <ComposeModal
                    defaultForum={null}
                    onClose={() => setComposeOpen(false)}
                    onPosted={() => setComposeOpen(false)}
                />
            )}
        </>
    );
}
