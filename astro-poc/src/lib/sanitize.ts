import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML antes de renderizar con dangerouslySetInnerHTML.
 * Permite tags básicos + estructura del CMS (clases hub-*, stat-pill, etc.).
 */
export function sanitizeCmsHtml(html: string): string {
    if (typeof window === 'undefined') return html; // SSR: confia y dejalo
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'div', 'span', 'br', 'hr',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'b', 'strong', 'i', 'em', 'u', 's', 'del', 'small', 'sub', 'sup', 'mark',
            'a', 'ul', 'ol', 'li',
            'blockquote', 'code', 'pre',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'img', 'figure', 'figcaption',
            'iframe',
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'href', 'target', 'rel', 'title',
            'src', 'alt', 'width', 'height', 'loading',
            'style', 'colspan', 'rowspan',
            'allow', 'allowfullscreen', 'frameborder',
            'data-color',
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ['target'],
    });
}

/**
 * Sanitiza HTML para comentarios y respuestas del foro.
 * Más restrictivo que CMS: nada de iframe/img/table — sólo formato de texto + links.
 * Soporta: bold, italic, underline, strike, code, headings, lists, blockquote, highlight, align.
 */
export function sanitizeCommentHtml(html: string): string {
    if (typeof window === 'undefined') return html;
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'br', 'span',
            'h2', 'h3',
            'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'code', 'sub', 'sup',
            'a', 'ul', 'ol', 'li',
            'blockquote', 'pre',
        ],
        ALLOWED_ATTR: [
            'href', 'target', 'rel', 'title',
            'style', 'class',
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ['target'],
    });
}
