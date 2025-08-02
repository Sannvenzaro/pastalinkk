/**
 * Sanitizes a string to prevent XSS attacks.
 * @param {string} str The string to escape.
 * @returns {string} The escaped string.
 */
window.escapeHTML = function (str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
};

/**
 * Retrieves the CSRF token from cookies.
 * @returns {string|null} The CSRF token.
 */
function getCsrfToken() {
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
        const [name, value] = cookie.split('=');
        if (name === 'XSRF-TOKEN') return decodeURIComponent(value);
    }
    return null;
}

/**
 * A wrapper for the Fetch API that includes CSRF token and handles JSON responses.
 * @param {string} url The URL to fetch.
 * @param {object} options Fetch options.
 * @returns {Promise<any>} The JSON response data.
 */
async function apiFetch(url, options = {}) {
    const defaultHeaders = { 'X-CSRF-Token': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' };
    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        body: (options.body && !(options.body instanceof FormData)) ? JSON.stringify(options.body) : options.body
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw data;
    }
    return data;
}

/**
 * Shows a generic notification modal.
 * @param {string} title The modal title.
 * @param {string} message The modal message.
 */
function showNotificationModal(title, message) {
    const modal = document.getElementById("notification-modal");
    if (!modal) return;
    modal.querySelector("#modal-title").textContent = title;
    modal.querySelector("#modal-message").textContent = message;
    modal.classList.add('show');
    const span = modal.querySelector(".close-btn");
    const closeAll = () => {
        modal.classList.remove('show');
        if (window.location.search) window.history.replaceState({}, document.title, window.location.pathname);
    };
    span.onclick = closeAll;
    window.addEventListener('click', (event) => { if (event.target == modal) closeAll(); });
}

/**
 * Shows an informational modal for things like badges.
 * @param {string} title The modal title.
 * @param {string} message The modal message.
 */
function showInfoModal(title, message) {
    const modal = document.getElementById("info-modal");
    if (!modal) return;
    modal.querySelector("#info-modal-title").textContent = title;
    modal.querySelector("#info-modal-message").textContent = message;
    modal.classList.add('show');
    const span = modal.querySelector(".close-btn");
    const close = () => modal.classList.remove('show');
    span.onclick = close;
    window.addEventListener('click', (event) => { if (event.target == modal) close(); });
}

/**
 * Sets up the open/close logic for a modal.
 * @param {string} modalId The ID of the modal element.
 * @param {string} buttonId The ID of the button that opens the modal.
 * @param {function} onOpen A callback function to run when the modal opens.
 * @returns {HTMLElement|null} The modal element.
 */
function setupModal(modalId, buttonId, onOpen = () => {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return null;
    const btn = document.getElementById(buttonId);
    if (!btn) return modal;
    const span = modal.querySelector(".close-btn");

    btn.onclick = () => {
        onOpen();
        modal.classList.add('show');
    };
    span.onclick = () => modal.classList.remove('show');
    window.addEventListener('click', (event) => { if (event.target == modal) modal.classList.remove('show'); });
    return modal;
}

/**
 * Renders user badges (S-Family, Verified).
 * @param {object} user The user object.
 * @param {boolean} isSmall Whether to use small badges.
 * @returns {string} The HTML string for the badges.
 */
function renderBadges(user, isSmall = false) {
    let badgesHTML = '<div class="badge-container">';
    const badgeSizeClass = isSmall ? 'small' : '';
    if (user.isSFamily) badgesHTML += `<img class="badge gold-badge ${badgeSizeClass}" src="/images/gold-verified.png" title="S Family" data-badge-type="s-family">`;
    if (user.isVerified) badgesHTML += `<img class="badge verified-badge ${badgeSizeClass}" src="/images/verified.png" title="Verified" data-badge-type="verified">`;
    badgesHTML += '</div>';
    
    // Add event listeners after a delay to ensure elements are in the DOM.
    setTimeout(() => {
        document.querySelectorAll('.badge').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const type = e.target.dataset.badgeType;
                if (type === 's-family') showInfoModal('S Family', 'Pengguna ini adalah bagian dari S Family, anggota inti dan tepercaya dari komunitas ini.');
                else if (type === 'verified') showInfoModal('Terverifikasi', 'Pengguna ini telah diverifikasi oleh tim kami, biasanya karena kontribusi positif atau memenangkan leaderboard mingguan.');
            });
        });
    }, 0);
    return badgesHTML;
}

// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const loggedInUser = await fetch('/api/user/me').then(res => res.json()).catch(() => null);
    const defaultPic = '/uploads/default.png';

    // --- Global Components ---
    const navbar = document.getElementById('navbar');
    if (navbar) {
        let navLinks = `<a href="/"><button class="btn">Home</button></a><a href="/leaderboard"><button class="btn">Leaderboard</button></a>`;
        let rightSection = '';
        if (loggedInUser) {
            const notifCount = loggedInUser.unreadNotifications > 0 ? `<span id="notification-count">${loggedInUser.unreadNotifications}</span>` : '';
            rightSection = `
                <a href="/notifications" id="notification-bell" title="Notifikasi">
                    <span class="icon"></span>${notifCount}
                </a>
                <a href="/new"><button class="btn btn-primary">Buat Paste</button></a>
                <div class="profile-dropdown-container">
                    <button id="profile-dropdown-btn" class="btn profile-nav-btn">
                        <img src="${escapeHTML(loggedInUser.profilePicture) || defaultPic}" class="navbar-profile-pic">
                        <span>Profil</span>
                    </button>
                    <div id="profile-dropdown-menu" class="profile-dropdown-menu">
                        <div class="profile-dropdown-header"><span class="username">${escapeHTML(loggedInUser.username)}</span></div>
                        <a href="/u/${escapeHTML(loggedInUser.username)}">Lihat Profil</a>
                        <a href="/logout">Logout</a>
                    </div>
                </div>`;
        } else {
            rightSection = `<div class="navbar-auth-buttons"><a href="/login"><button class="btn">Login</button></a><a href="/register"><button class="btn btn-primary">Daftar</button></a></div>`;
        }
        navbar.innerHTML = navLinks + `<div class="navbar-right-section">${rightSection}</div>`;
        
        if(document.querySelector('.profile-dropdown-container')){
            const profileBtn = document.getElementById('profile-dropdown-btn');
            const profileMenu = document.getElementById('profile-dropdown-menu');
            profileBtn.addEventListener('click', (event) => { event.stopPropagation(); profileMenu.classList.toggle('show'); });
            window.addEventListener('click', (event) => { if (!profileMenu.contains(event.target) && !profileBtn.contains(event.target) && profileMenu.classList.contains('show')) profileMenu.classList.remove('show'); });
        }
    }

    // --- Page-Specific Logic ---
    const pageHandlers = {
        // --- Auth Pages ---
        handleAuthForms: () => {
            const notificationMessages = {
                'invalid': { title: 'Login Gagal', message: 'Username atau password salah.' },
                'username_taken': { title: 'Register Gagal', message: 'Username sudah dipakai.' },
                'email_taken': { title: 'Register Gagal', message: 'Email sudah dipakai.' },
                'invalid_input': { title: 'Input Tidak Valid', message: 'Pastikan semua field diisi dengan benar.' },
                'email_fail': { title: 'Sistem Error', message: 'Gagal mengirim email. Hubungi admin.' },
                'not_verified': { title: 'Login Gagal', message: 'Akun Anda belum diverifikasi. Silakan cek email Anda.' },
                'registered': { title: 'Register Berhasil!', message: 'Link verifikasi telah dikirim ke email Anda. Silakan cek inbox (atau spam).' },
                'verified': { title: 'Verifikasi Berhasil!', message: 'Akun Anda telah diverifikasi. Silakan login.'},
                'invalid_token': { title: 'Proses Gagal', message: 'Token tidak valid atau sudah kedaluwarsa.'},
                'password_reset': { title: 'Password Disimpan', message: 'Password baru Anda telah disimpan. Silakan login.' },
                'reset_sent': { title: 'Cek Email Anda', message: 'Jika email terdaftar, kami telah mengirimkan link untuk mereset password.'},
                'current_password_invalid': { title: 'Gagal', message: 'Password Anda saat ini salah.'},
            };
            const notificationKey = params.get('error') || params.get('success');
            if (notificationMessages[notificationKey]) {
                showNotificationModal(notificationMessages[notificationKey].title, notificationMessages[notificationKey].message);
            }

            const registerForm = document.getElementById('register-form');
            if (registerForm) {
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(new FormData(registerForm).entries());
                    try {
                        await apiFetch('/register', { method: 'POST', body: data });
                        window.location.href = '/login?success=registered';
                    } catch (err) {
                        const errorInfo = notificationMessages[err.errorKey] || { title: 'Error', message: err.error || 'Terjadi kesalahan.' };
                        showNotificationModal(errorInfo.title, errorInfo.message);
                    }
                });
            }

            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                const p = loginForm.querySelector('p');
                if (p && !p.previousElementSibling?.matches('.link-muted')) {
                    p.insertAdjacentHTML('beforebegin', '<a href="/forgot-password" class="link-muted">Lupa password?</a>');
                }
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(new FormData(loginForm).entries());
                    try {
                        const result = await apiFetch('/login', { method: 'POST', body: data });
                        if (result.success) window.location.href = result.redirectUrl;
                    } catch (err) {
                        const errorInfo = notificationMessages[err.errorKey] || { title: 'Error', message: err.error || 'Terjadi kesalahan.' };
                        showNotificationModal(errorInfo.title, errorInfo.message);
                    }
                });
            }
            
            const forgotPasswordForm = document.getElementById('forgot-password-form');
            if(forgotPasswordForm) {
                forgotPasswordForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(new FormData(forgotPasswordForm).entries());
                    try {
                        await apiFetch('/forgot-password', { method: 'POST', body: data });
                        showNotificationModal(notificationMessages['reset_sent'].title, notificationMessages['reset_sent'].message);
                    } catch (err) {
                        const errorInfo = notificationMessages[err.errorKey] || { title: 'Error', message: err.error || 'Terjadi kesalahan.' };
                        showNotificationModal(errorInfo.title, errorInfo.message);
                    }
                });
            }

            const resetPasswordForm = document.getElementById('reset-password-form');
            if(resetPasswordForm) {
                resetPasswordForm.addEventListener('submit', async(e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(new FormData(resetPasswordForm).entries());
                    if (data.password !== data.confirmPassword) return showNotificationModal('Error', 'Konfirmasi password tidak cocok.');
                    data.token = params.get('token');
                    try {
                        await apiFetch('/reset-password', { method: 'POST', body: data });
                        window.location.href = '/login?success=password_reset';
                    } catch(err) {
                        const errorInfo = notificationMessages[err.errorKey] || { title: 'Error', message: err.error || 'Terjadi kesalahan.' };
                        showNotificationModal(errorInfo.title, errorInfo.message);
                    }
                });
            }
        },

        // --- Paste Pages ---
        handleCreatePaste: () => {
            const createPasteForm = document.getElementById('create-paste-form');
            if(createPasteForm) {
                createPasteForm.addEventListener('submit', async(e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(new FormData(createPasteForm).entries());
                    try {
                        const result = await apiFetch('/create', { method: 'POST', body: data });
                        if (result.success) window.location.href = result.redirectUrl;
                    } catch(err) {
                        showNotificationModal('Gagal Membuat Paste', err.error || 'Konten tidak boleh kosong.');
                    }
                });
            }
        },
        handleEditPaste: async () => {
            const editPasteForm = document.getElementById('edit-paste-form');
            if(!editPasteForm) return;
            
            const pasteId = path.split('/')[1];
            const wrapper = document.getElementById('form-content-wrapper');
            document.getElementById('cancel-edit-btn').href = `/${pasteId}`;
            try {
                const data = await apiFetch(`/api/paste/${pasteId}/edit-data`);
                wrapper.innerHTML = `
                    <input type="text" name="title" placeholder="Judul Paste (opsional)" value="${escapeHTML(data.title)}">
                    <textarea name="content" placeholder="console.log('Hello, World!');" required>${escapeHTML(data.content)}</textarea>
                    <div class="form-options">
                        <div class="form-group">
                            <label for="privacy">Privasi:</label>
                            <select name="privacy" id="privacy">
                                <option value="public">Public</option> <option value="unlisted">Unlisted</option> <option value="private">Private</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="pastePassword">Password Baru (Opsional):</label>
                            <input type="password" name="pastePassword" id="pastePassword" placeholder="Isi untuk ubah, kosongkan & simpan untuk hapus">
                        </div>
                    </div>`;
                wrapper.querySelector(`select[name="privacy"]`).value = data.privacy;
            } catch(err) {
                wrapper.innerHTML = '<p>Gagal memuat data paste atau Anda tidak punya akses.</p>';
            }
            editPasteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(editPasteForm).entries());
                try {
                    const result = await apiFetch(`/paste/${pasteId}/update`, { method: 'POST', body: data });
                    if(result.success) window.location.href = result.redirectUrl;
                } catch(err) {
                    showNotificationModal('Gagal', err.error || 'Gagal menyimpan perubahan.');
                }
            });
        },
        handleViewPaste: () => {
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
        },

        // --- Profile Page ---
        handleProfilePage: async () => {
            const username = path.split('/')[2];
            const container = document.getElementById('profile-page-container');
            if (!container) return;

            try {
                const { user, pastes } = await apiFetch(`/api/user/${username}`);
                document.title = `Profil ${escapeHTML(user.username)}`;
                container.querySelector('#profile-pic').src = user.profilePicture || defaultPic;
                container.querySelector('.profile-username h1').textContent = escapeHTML(user.username);
                container.querySelector('.badge-container-wrapper').innerHTML = renderBadges(user);
                container.querySelector('#bio').textContent = user.bio || 'Tidak ada bio.';
                container.querySelector('#post-count-stat strong').textContent = pastes.length;
                container.querySelector('#followers-stat strong').textContent = user.followerCount;
                container.querySelector('#following-stat strong').textContent = user.followingCount;
                container.querySelector('#views-stat strong').textContent = user.totalViews;
                
                const actionsContainer = container.querySelector('#profile-actions');
                if (loggedInUser && loggedInUser.id === user.id) {
                    actionsContainer.innerHTML = `<button id="edit-profile-btn" class="btn">Edit Profil</button><button id="change-password-btn" class="btn">Ganti Password</button>`;
                    const editProfileModal = setupModal('edit-profile-modal', 'edit-profile-btn', () => { editProfileModal.querySelector('#modal-bio').value = user.bio || ''; });
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
                            changePasswordModal.classList.remove('show');
                            showNotificationModal('Sukses', 'Password Anda berhasil diubah.');
                        } catch (err) {
                            const errorInfo = notificationMessages[err.errorKey] || { title: 'Error', message: err.error || 'Terjadi kesalahan.' };
                            showNotificationModal(errorInfo.title, errorInfo.message);
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
                            window.location.reload(); // Reload to update follower count
                        } catch (err) { showNotificationModal('Gagal', 'Gagal melakukan aksi follow/unfollow.'); }
                    });
                }

                const pasteGrid = container.querySelector('#paste-grid');
                container.querySelector('#post-count-header').textContent = `Postingan (${pastes.length})`;
                if (pastes.length > 0) {
                    pasteGrid.innerHTML = pastes.map(p => `<a href="/${p.id}" class="grid-item"><pre>${escapeHTML(p.content?.substring(0, 200) || '')}</pre><div class="grid-item-overlay"><span class="grid-item-title">${escapeHTML(p.title) || 'Untitled Paste'}</span></div></a>`).join('');
                } else {
                    pasteGrid.innerHTML = '<p>Pengguna ini belum membuat postingan publik.</p>';
                }
            } catch (err) { container.innerHTML = '<h1>404 - User Tidak Ditemukan</h1><p>Pengguna yang Anda cari tidak ada atau URL salah.</p>'; }
        },

        // --- Other Pages ---
        handleHomePage: async () => {
            const userPanel = document.getElementById('user-panel');
            if (loggedInUser) {
                userPanel.innerHTML = `
                    <div class="user-panel-profile">
                        <a href="/u/${escapeHTML(loggedInUser.username)}"><img src="${escapeHTML(loggedInUser.profilePicture) || defaultPic}" alt="Profile Picture"></a>
                        <div class="username-line"><h3>${escapeHTML(loggedInUser.username)}</h3>${renderBadges(loggedInUser, true)}</div>
                        <div class="user-panel-stats">
                            <span><strong>${loggedInUser.followerCount}</strong> Followers</span>
                            <span><strong>${loggedInUser.followingCount}</strong> Following</span>
                        </div>
                    </div>`;
            } else {
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
                    pasteContainer.innerHTML = pastes.map(p => `
                        <a href="/${p.id}" class="paste-list-item">
                            <h3>${escapeHTML(p.title) || 'Untitled Paste'}</h3>
                            <p class="author-line">
                                dibuat oleh <a href="/u/${escapeHTML(p.author.username)}" onclick="event.stopPropagation()">${escapeHTML(p.author.username)}</a>
                                ${renderBadges(p.author, true)}
                                 • ${new Date(p.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                        </a>`).join('');
                } else { pasteContainer.innerHTML = '<p>Belum ada paste publik yang dibuat.</p>'; }
            } catch (err) { pasteContainer.innerHTML = '<p>Gagal memuat paste. Coba muat ulang halaman.</p>'; }
        },
        handleLeaderboard: async () => {
            const table = document.getElementById('leaderboard-table');
            if(!table) return;
            const tbody = table.querySelector('tbody');
            try {
                const users = await apiFetch('/api/leaderboard');
                if (users.length > 0) {
                    tbody.innerHTML = users.map((user, index) => `
                        <tr>
                            <td class="rank">${index + 1}</td>
                            <td class="user-cell">
                                <img src="${user.profilePicture || defaultPic}" alt="${escapeHTML(user.username)}" class="profile-pic-small">
                                <div><a href="/u/${escapeHTML(user.username)}">${escapeHTML(user.username)}</a>${renderBadges(user, true)}</div>
                            </td>
                            <td class="points">${user.weeklyScore}</td>
                        </tr>`).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Belum ada skor di leaderboard minggu ini.</td></tr>';
                }
            } catch (err) { 
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Gagal memuat leaderboard.</td></tr>';
            }
        },
        handleNotifications: async () => {
            const container = document.querySelector('.page-wrapper');
            container.innerHTML = '<div id="navbar"></div><div class="container"><h1>Notifikasi</h1><div id="notification-list">Memuat...</div></div>';
            // Re-render navbar since we replaced the container's innerHTML
            if (window.renderNavbar) window.renderNavbar(); 
            try {
                const notifications = await apiFetch('/api/notifications');
                const list = document.getElementById('notification-list');
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
            } catch (err) { container.querySelector('.container').innerHTML = '<h1>Notifikasi</h1><p>Gagal memuat notifikasi.</p>'; }
        }
    };

    // --- Router ---
    if (path === '/') {
        pageHandlers.handleHomePage();
    } else if (path === '/login' || path === '/register' || path === '/forgot-password' || path === '/reset-password') {
        pageHandlers.handleAuthForms();
    } else if (path === '/new') {
        pageHandlers.handleCreatePaste();
    } else if (path.endsWith('/edit')) {
        pageHandlers.handleEditPaste();
    } else if (path.startsWith('/u/')) {
        pageHandlers.handleProfilePage();
    } else if (path === '/leaderboard') {
        pageHandlers.handleLeaderboard();
    } else if (path === '/notifications') {
        pageHandlers.handleNotifications();
    } else if (/^\/[a-f0-9]{14}$/.test(path)) { // Matches paste view URL
        pageHandlers.handleViewPaste();
    }
});