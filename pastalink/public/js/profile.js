// profile.js (Diperbaiki)

import { initializePage, apiFetch, escapeHTML, renderBadges, showNotificationModal, setupModal } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { loggedInUser, defaultPic } = await initializePage();
    const path = window.location.pathname;
    const username = path.split('/')[2];
    const container = document.getElementById('profile-page-container');
    if (!container) return;

    try {
        const { user, pastes } = await apiFetch(`/api/user/${username}`);
        document.title = `Profil ${escapeHTML(user.username)}`;
        
        // FIX: Menggunakan struktur HTML yang lebih robust untuk diisi
        container.innerHTML = `
            <header class="profile-header">
                <img id="profile-pic" src="${user.profilePicture || defaultPic}" alt="Foto profil ${escapeHTML(user.username)}" class="profile-pic-large">
                <div class="profile-info">
                    <div class="profile-username">
                        <h1>${escapeHTML(user.username)}</h1>
                        <div class="badge-container-wrapper">${renderBadges(user)}</div>
                    </div>
                    <div id="profile-actions" class="profile-actions"></div>
                    <p id="bio" class="profile-bio">${user.bio ? escapeHTML(user.bio) : 'Tidak ada bio.'}</p>
                </div>
            </header>
            <div class="profile-stats">
                <div id="post-count-stat" class="stat-item"><strong>${pastes.length}</strong><span>Postingan</span></div>
                <div id="followers-stat" class="stat-item"><strong>${user.followerCount}</strong><span>Pengikut</span></div>
                <div id="following-stat" class="stat-item"><strong>${user.followingCount}</strong><span>Mengikuti</span></div>
                <div id="views-stat" class="stat-item"><strong>${user.totalViews}</strong><span>Dilihat</span></div>
            </div>
            <div class="profile-content">
                <h2 id="post-count-header">Postingan (${pastes.length})</h2>
                <div id="paste-grid" class="paste-grid"></div>
            </div>
        `;
        
        const actionsContainer = container.querySelector('#profile-actions');
        if (loggedInUser && loggedInUser.id === user.id) {
            actionsContainer.innerHTML = `<button id="edit-profile-btn" class="btn">Edit Profil</button><button id="change-password-btn" class="btn">Ganti Password</button>`;
            
            // FIX: Pemanggilan setupModal sekarang akan berfungsi dengan benar
            const editProfileModal = setupModal('edit-profile-modal', 'edit-profile-btn', () => {
                const bioTextarea = document.getElementById('modal-bio');
                if(bioTextarea) bioTextarea.value = user.bio || '';
            });

            document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    await apiFetch('/profile/update', { method: 'POST', body: new FormData(e.target) });
                    window.location.reload();
                } catch(err) { showNotificationModal('Gagal', err.error || 'Gagal memperbarui profil.'); }
            });

            const changePasswordModal = setupModal('change-password-modal', 'change-password-btn');
            document.getElementById('change-password-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.target));
                if (data.newPassword !== data.confirmNewPassword) return showNotificationModal('Gagal', 'Konfirmasi password baru tidak cocok.');
                try {
                    await apiFetch('/profile/change-password', { method: 'POST', body: data });
                    if (changePasswordModal) changePasswordModal.classList.remove('show'); // FIX: Sekarang ini akan berfungsi
                    showNotificationModal('Sukses', 'Password Anda berhasil diubah.');
                } catch (err) {
                    showNotificationModal('Gagal', 'Password Anda saat ini salah.');
                }
            });
        } else if (loggedInUser) {
            const isFollowing = loggedInUser.following.includes(user.id);
            actionsContainer.innerHTML = `<button id="follow-btn" class="btn ${isFollowing ? '' : 'btn-primary'}">${isFollowing ? 'Unfollow' : 'Follow'}</button>`;
            document.getElementById('follow-btn').addEventListener('click', async (e) => {
                try {
                    const result = await apiFetch(`/api/user/${username}/follow`, { method: 'POST' });
                    e.target.textContent = result.isFollowing ? 'Unfollow' : 'Follow';
                    e.target.classList.toggle('btn-primary', !result.isFollowing);
                    window.location.reload(); // Reload untuk update jumlah follower
                } catch (err) { showNotificationModal('Gagal', 'Gagal melakukan aksi follow/unfollow.'); }
            });
        }

        const pasteGrid = container.querySelector('#paste-grid');
        if (pastes.length > 0) {
            pasteGrid.innerHTML = pastes.map(p => `<a href="/${p.id}" class="grid-item"><pre>${escapeHTML(p.content?.substring(0, 200) || '')}</pre><div class="grid-item-overlay"><span class="grid-item-title">${escapeHTML(p.title) || 'Untitled Paste'}</span></div></a>`).join('');
        } else {
            pasteGrid.innerHTML = '<p class="text-muted" style="text-align:center; padding: 2rem;">Pengguna ini belum membuat postingan publik.</p>';
        }
    } catch (err) { container.innerHTML = '<h1>404 - User Tidak Ditemukan</h1><p>Pengguna yang Anda cari tidak ada atau URL salah.</p>'; }
});