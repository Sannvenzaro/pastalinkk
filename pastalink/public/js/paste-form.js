import { initializePage, apiFetch, escapeHTML, showNotificationModal } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initializePage();
    const path = window.location.pathname;

    // Handle Create Form
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

    // Handle Edit Form
    const editPasteForm = document.getElementById('edit-paste-form');
    if(editPasteForm) {
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
    }
});