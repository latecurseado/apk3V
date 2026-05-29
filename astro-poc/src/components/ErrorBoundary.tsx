import { Component } from 'preact';
import type { ComponentChildren } from 'preact';

interface Props { children: ComponentChildren; fallback?: ComponentChildren; name?: string; }
interface State { error: Error | null; }

/**
 * Atrapa errores en árbol de Preact y muestra fallback en vez de pantalla en blanco.
 * Cada isla puede envolverse para aislar fallos.
 */
export default class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: any) {
        console.error(`[ErrorBoundary${this.props.name ? ' · ' + this.props.name : ''}]`, error, info);
    }

    reset = () => this.setState({ error: null });

    render() {
        if (this.state.error) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div class="error-boundary">
                    <i class="fas fa-triangle-exclamation"></i>
                    <h3>Algo salió mal aquí</h3>
                    <p>
                        Este componente falló pero el resto del sitio sigue funcionando.
                        {this.props.name && <small style="display:block; opacity:0.7;">[{this.props.name}]</small>}
                    </p>
                    <p style="font-size:0.78rem; color:var(--text-dim);">
                        {this.state.error.message || 'Error desconocido'}
                    </p>
                    <button class="auth-btn primary small" onClick={this.reset}>
                        <i class="fas fa-rotate-right"></i> Reintentar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
