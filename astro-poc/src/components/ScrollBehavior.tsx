import { useHideOnScroll } from '../lib/hooks';

/**
 * Componente sin UI. Aplica el hook de hide-topbar-on-scroll
 * cuando se monta (en BaseLayout, client:idle).
 */
export default function ScrollBehavior() {
    useHideOnScroll(80);
    return null;
}
