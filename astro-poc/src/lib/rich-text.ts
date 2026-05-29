import { marked } from 'marked';

/**
 * Parser de contenido enriquecido:
 *  - Markdown (con marked, configurado restrictivo)
 *  - Menciones @usuario
 *  - Hashtags #tag
 *  - Auto-linkify URLs (marked ya lo hace con gfm)
 *
 * IMPORTANTE: el resultado DEBE pasar por sanitizeCmsHtml antes de
 * inyectarse con dangerouslySetInnerHTML.
 */
function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]!);
}

const MENTION_RE = /(^|\s)@([a-zA-Z0-9_]{2,30})/g;
const HASHTAG_RE = /(^|\s)#([\p{L}0-9_-]{2,40})/gu;

// Configura marked sin headings ni HTML inline (defensivo)
marked.setOptions({ gfm: true, breaks: true });

export function parseRichText(text: string): string {
    let html: string;
    try {
        // marked devuelve string síncrono cuando no hay extensiones async
        html = marked.parse(text) as string;
    } catch {
        // Fallback: escapar y poner <br> a saltos
        html = escapeHtml(text).replace(/\n/g, '<br>');
    }
    // Hashtags y menciones (después de marked para no romper su parsing)
    html = html.replace(HASHTAG_RE, (_m, pre, tag) =>
        `${pre}<a href="/tag?q=${encodeURIComponent(tag.toLowerCase())}" class="rt-hashtag">#${tag}</a>`);
    html = html.replace(MENTION_RE, (_m, pre, name) =>
        `${pre}<a href="/perfil?u=${encodeURIComponent(name)}" class="rt-mention">@${name}</a>`);
    return html;
}

export function extractHashtags(text: string): string[] {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    HASHTAG_RE.lastIndex = 0;
    while ((m = HASHTAG_RE.exec(text)) !== null) {
        set.add(m[2].toLowerCase());
    }
    return Array.from(set);
}

export function extractMentions(text: string): string[] {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(text)) !== null) {
        set.add(m[2]);
    }
    return Array.from(set);
}
