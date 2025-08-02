// home.js

import { initializePage, apiFetch, escapeHTML, renderBadges } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { loggedInUser, defaultPic } = await initializePage();

    const sidebar = document.querySelector('.sidebar');
    const userPanel = document.getElementById('user-panel');

    // Sesuai permintaan: Sembunyikan panel profil jika user sudah login.
    // Tampilkan hanya jika user belum login.
    if (loggedInUser) {
        if (sidebar) sidebar.style.display = 'none';
        
        // Juga sesuaikan layout utama agar konten mengisi ruang
        const mainContent = document.querySelector('.main-content');
        if(mainContent) mainContent.style.flexGrow = '1';

    } else {
        if (sidebar) sidebar.style.display = 'block';
        userPanel.innerHTML = `
            <div class="user-panel-login">
                <h3>Selamat Datang!</h3>
                <p>Login untuk membuat paste, follow pengguna lain, dan naik di leaderboard!</p>
                <a href="/login" class="btn btn-primary">Login atau Daftar</a>
            </div>`;
    }

    const pasteContainer = document.getElementById('paste-list-container');
    try {
        const pastes = await apiFetch('/api/pastes/latest');
        if (pastes && pastes.length > 0) {
            // Desain ulang tampilan list paste
            pasteContainer.innerHTML = pastes.map(p => `
                <a href="/${p.id}" class="paste-list-item">
                    <img 
                        src="${escapeHTML(p.author.profilePicture) || defaultPic}" 
                        alt="${escapeHTML(p.author.username)}" 
                        class="paste-author-avatar"
                        onclick="event.preventDefault(); event.stopPropagation(); window.location.href='/u/${escapeHTML(p.author.username)}';"
                    >
                    <div class="paste-content">
                        <h3>${escapeHTML(p.title) || 'Untitled Paste'}</h3>
                        <div class="author-line">
                            <span>${escapeHTML(p.author.username)}</span>
                            ${renderBadges(p.author, true)}
                            <span class="text-muted">• ${new Date(p.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                    </div>
                </a>`).join('');
        } else {
            pasteContainer.innerHTML = '<p>Belum ada paste publik yang dibuat.</p>';
        }
    } catch (err) {
        console.error('Error fetching pastes:', err);
        pasteContainer.innerHTML = '<p>Gagal memuat paste. Coba muat ulang halaman.</p>';
    }
});