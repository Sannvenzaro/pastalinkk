import { initializePage, apiFetch, escapeHTML } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initializePage();

    const list = document.getElementById('notification-list');
    if (!list) return;

    try {
        const notifications = await apiFetch('/api/notifications');
        if (notifications.length > 0) {
            list.innerHTML = notifications.map(n => {
                let message = '';
                const fromUserLink = `<a href="/u/${escapeHTML(n.from)}"><strong>${escapeHTML(n.from)}</strong></a>`;
                if (n.type === 'mention') {
                    message = `${fromUserLink} menyebut Anda di sebuah <a href="/${n.pasteId}">paste</a>.`;
                } else if (n.type === 'follow') {
                    message = `${fromUserLink} mulai mengikuti Anda.`;
                }
                return `<div class="notification-item ${n.read ? 'read' : ''}">${message} <span class="time">${new Date(n.createdAt).toLocaleString('id-ID')}</span></div>`;
            }).join('');
            apiFetch('/api/notifications/mark-read', { method: 'POST' });
        } else { list.innerHTML = '<p>Tidak ada notifikasi baru.</p>'; }
    } catch (err) {
        list.innerHTML = '<p>Gagal memuat notifikasi.</p>';
    }
});