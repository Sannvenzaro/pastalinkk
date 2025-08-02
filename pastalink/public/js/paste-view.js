// paste-view.js (Diperbaiki)

// FIX: Mengimpor nama fungsi yang benar yang sekarang disediakan oleh common.js
import { initializePage, apiFetch, escapeHTML, renderBadges, showNotificationModal, setupModal } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { loggedInUser, defaultPic } = await initializePage();
    const path = window.location.pathname;
    const pasteId = path.substring(1).split('/')[0];
    const container = document.getElementById('paste-view-container');
    if(!container) return;

    const loadPaste = async (password = null) => {
        try {
            if (password) {
                await apiFetch(`/api/paste/${pasteId}/verify`, { method: 'POST', body: { password } });
            }
            const { paste, author } = await apiFetch(`/api/paste/${pasteId}`);
            document.title = `${escapeHTML(paste.title) || 'Untitled Paste'} by ${escapeHTML(author.username)}`;
            
            let ownerActions = '';
            if (loggedInUser && loggedInUser.id === author.id) {
                ownerActions = `<a href="/${paste.id}/edit" class="btn">Edit</a><button id="delete-paste-btn" class="btn btn-danger">Hapus</button>`;
            }

            const contentWithMentions = escapeHTML(paste.content).replace(/@([a-zA-Z0-9_]{3,20})/g, '<a href="/u/$1" class="mention-link">@$1</a>');
            const hasLiked = loggedInUser && paste.likes.includes(loggedInUser.id);

            container.innerHTML = `
                <header>
                    <div class="author-info">
                        <a href="/u/${escapeHTML(author.username)}"><img src="${author.profilePicture || defaultPic}" class="author-pic"></a>
                        <div class="author-details">
                            <h1><a href="/u/${escapeHTML(author.username)}">${escapeHTML(author.username)}</a>${renderBadges(author)}</h1>
                            <div class="meta-info"><span>${new Date(paste.createdAt).toLocaleString('id-ID', {dateStyle: 'long', timeStyle: 'short'})}</span> • <span>Dilihat ${paste.views} kali</span></div>
                        </div>
                    </div>
                    <div class="header-actions">${ownerActions}</div>
                </header>
                <h2>${escapeHTML(paste.title) || 'Untitled Paste'}</h2>
                <div class="paste-actions">
                    <button id="like-btn" class="like-btn ${hasLiked ? 'liked' : ''}" title="Suka"><span class="icon"></span></button>
                    <span class="like-count">${paste.likes.length} Suka</span>
                    <button id="report-btn" class="btn btn-subtle" style="margin-left: auto;">Laporkan</button>
                </div>
                <div class="code-container"><pre><code class="language-plaintext">${contentWithMentions}</code></pre></div>`;
            
            if(window.hljs) hljs.highlightElement(container.querySelector('code'));
            
            if (loggedInUser && loggedInUser.id === author.id) {
                document.getElementById('delete-paste-btn').addEventListener('click', async () => {
                    if (confirm('Apakah Anda yakin ingin menghapus paste ini? Aksi ini tidak dapat diurungkan.')) {
                        try {
                            await apiFetch(`/paste/${paste.id}/delete`, { method: 'POST' });
                            window.location.href = `/u/${loggedInUser.username}`;
                        } catch (err) { showNotificationModal('Gagal', 'Gagal menghapus paste.'); }
                    }
                });
            }

            if (loggedInUser) {
                document.getElementById('like-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    const result = await apiFetch(`/api/paste/${paste.id}/like`, { method: 'POST' });
                    btn.classList.toggle('liked', result.hasLiked);
                    container.querySelector('.like-count').textContent = `${result.likeCount} Suka`;
                });
                // Pemanggilan setupModal sekarang akan berhasil
                setupModal('report-modal', 'report-btn');
            } else {
                document.getElementById('like-btn').onclick = () => showNotificationModal('Login Diperlukan', 'Anda harus login untuk menyukai paste.');
                document.getElementById('report-btn').onclick = () => showNotificationModal('Login Diperlukan', 'Anda harus login untuk melaporkan paste.');
            }
        } catch (err) {
            if (err.requiresPassword) {
                const password = prompt('Paste ini dilindungi password. Masukkan password:');
                if (password) loadPaste(password); else container.innerHTML = '<h1>Password Diperlukan</h1><p>Anda membatalkan atau memasukkan password yang salah.</p>';
            } else {
                container.innerHTML = '<h1>404 - Paste Tidak Ditemukan</h1><p>Paste yang Anda cari mungkin tidak ada, bersifat pribadi, atau telah dihapus.</p>';
            }
        }
    };
    loadPaste();

    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(reportForm).entries());
            try {
                await apiFetch(`/api/paste/${pasteId}/report`, { method: 'POST', body: data });
                document.getElementById('report-modal').classList.remove('show');
                showNotificationModal('Terima Kasih', 'Laporan Anda telah kami terima dan akan segera ditinjau.');
            } catch (err) { showNotificationModal('Gagal', err.error || 'Gagal mengirim laporan.'); }
        });
    }
});