import { initializePage, apiFetch, escapeHTML, renderBadges } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { defaultPic } = await initializePage();

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
});