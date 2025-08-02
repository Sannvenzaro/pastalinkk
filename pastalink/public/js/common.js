// common.js (Diperbaiki dan Di-upgrade)

// --- Utility Functions (Tidak ada perubahan) ---
export function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function getCsrfToken() {
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
        const [name, value] = cookie.split('=');
        if (name === 'XSRF-TOKEN') return decodeURIComponent(value);
    }
    return null;
}

export async function apiFetch(url, options = {}) {
    const defaultHeaders = { 'X-CSRF-Token': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' };
    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
        body: (options.body && !(options.body instanceof FormData)) ? JSON.stringify(options.body) : options.body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw data;
    return data;
}

// --- Modal Functions (UPGRADE DI SINI) ---

/**
 * UPGRADE: setupModal sekarang lebih canggih.
 * - Menerima callback opsional yang dijalankan saat modal dibuka.
 * - Mengembalikan elemen modal agar bisa dimanipulasi.
 * @param {string} modalId - ID dari elemen modal.
 * @param {string} triggerBtnId - ID dari tombol yang akan membuka modal.
 * @param {Function | null} onOpenCallback - Fungsi yang akan dijalankan saat modal dibuka.
 * @returns {HTMLElement | null} Elemen modal atau null jika tidak ditemukan.
 */
export function setupModal(modalId, triggerBtnId, onOpenCallback = null) {
    const modal = document.getElementById(modalId);
    const triggerBtn = document.getElementById(triggerBtnId);
    if (!modal || !triggerBtn) return null;

    const closeBtn = modal.querySelector(".close-btn");
    
    const openModal = () => {
        // Jalankan callback jika ada
        if (typeof onOpenCallback === 'function') {
            onOpenCallback();
        }
        modal.classList.add('show');
    };
    
    const closeModal = () => modal.classList.remove('show');

    triggerBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    // Kembalikan elemen modal
    return modal;
}

export function showNotificationModal(title, message) {
    const modal = document.getElementById("notification-modal");
    if (!modal) return;
    modal.querySelector("#modal-title").textContent = title;
    modal.querySelector("#modal-message").textContent = message;
    modal.classList.add('show');
    const span = modal.querySelector(".close-btn");
    const close = () => modal.classList.remove('show');
    span.onclick = close;
    window.addEventListener('click', (event) => {
        if (event.target == modal) close();
    });
}

export function showInfoModal(title, message) {
    const modal = document.getElementById("info-modal");
    if (!modal) {
        showNotificationModal(title, message);
        return;
    }
    modal.querySelector("#info-modal-title").textContent = title;
    modal.querySelector("#info-modal-message").textContent = message;
    modal.classList.add('show');
    const span = modal.querySelector(".close-btn");
    const close = () => modal.classList.remove('show');
    span.onclick = close;
    window.addEventListener('click', (event) => { if (event.target == modal) close(); });
}

// --- Rendering & Initialization Functions (Tidak ada perubahan) ---
export function renderBadges(user, isSmall = false) {
    let badgesHTML = '<div class="badge-container">';
    const badgeSizeClass = isSmall ? 'small' : '';
    if (user.isSFamily) badgesHTML += `<img class="badge gold-badge ${badgeSizeClass}" src="/images/gold-verified.png" title="S Family" data-badge-type="s-family">`;
    if (user.isVerified) badgesHTML += `<img class="badge verified-badge ${badgeSizeClass}" src="/images/verified.png" title="Verified" data-badge-type="verified">`;
    badgesHTML += '</div>';
    setTimeout(() => {
        document.querySelectorAll('.badge').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const type = e.target.dataset.badgeType;
                if (type === 's-family') showInfoModal('S Family', 'Pengguna ini adalah bagian dari S Family, anggota inti dan tepercaya dari komunitas ini.');
                else if (type === 'verified') showInfoModal('Terverifikasi', 'Pengguna ini telah diverifikasi oleh tim kami, biasanya karena kontribusi positif atau memenangkan leaderboard mingguan.');
            });
        });
    }, 0);
    return badgesHTML;
}

export async function initializePage() {
    const loggedInUser = await fetch('/api/user/me').then(res => res.json()).catch(() => null);
    const defaultPic = '/uploads/default.png';
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const leftSection = `<div class="navbar-left-section"><a href="/"><button class="btn">Home</button></a><a href="/leaderboard"><button class="btn">Leaderboard</button></a></div>`;
        let rightContent = '';
        if (loggedInUser) {
            const notifCount = loggedInUser.unreadNotifications > 0 ? `<span id="notification-count">${loggedInUser.unreadNotifications}</span>` : '';
            rightContent = `<a href="/notifications" id="notification-bell" title="Notifikasi"><span class="icon"></span>${notifCount}</a><a href="/new"><button class="btn btn-primary">Buat Paste</button></a><div class="profile-dropdown-container"><button id="profile-dropdown-btn" class="btn profile-nav-btn"><img src="${escapeHTML(loggedInUser.profilePicture) || defaultPic}" class="navbar-profile-pic"></button><div id="profile-dropdown-menu" class="profile-dropdown-menu"><div class="profile-dropdown-header"><span class="username">${escapeHTML(loggedInUser.username)}</span></div><a href="/u/${escapeHTML(loggedInUser.username)}">Lihat Profil</a><a href="/logout">Logout</a></div></div>`;
        } else {
            rightContent = `<div class="navbar-auth-buttons"><a href="/login"><button class="btn">Login</button></a><a href="/register"><button class="btn btn-primary">Daftar</button></a></div>`;
        }
        navbar.innerHTML = `${leftSection}<div class="navbar-right-section">${rightContent}</div>`;
        if (document.querySelector('.profile-dropdown-container')) {
            const profileBtn = document.getElementById('profile-dropdown-btn');
            const profileMenu = document.getElementById('profile-dropdown-menu');
            profileBtn.addEventListener('click', (event) => { event.stopPropagation(); profileMenu.classList.toggle('show'); });
            window.addEventListener('click', (event) => { if (!profileMenu.contains(event.target) && !profileBtn.contains(event.target) && profileMenu.classList.contains('show')) { profileMenu.classList.remove('show'); } });
        }
    }
    return { loggedInUser, defaultPic };
}