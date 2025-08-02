// --- [SECURITY] Helper function untuk mencegah XSS ---
// Versi global (bisa dipakai tanpa bundler atau module import)
window.escapeHTML = function (str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
};