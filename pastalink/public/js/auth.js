// auth.js (Diperbaiki)

// FIX: Mengimpor 'showInfoModal' dari common.js dan memberinya alias 'showNotificationModal'
// agar sesuai dengan sisa kode di file ini.
import { initializePage, apiFetch, showInfoModal as showNotificationModal } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Tidak ada perubahan yang diperlukan pada baris ini, karena initializePage tidak ada di halaman login/register
    // await initializePage(); 
    
    const params = new URLSearchParams(window.location.search);

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
    };
    const notificationKey = params.get('error') || params.get('success');
    if (notificationMessages[notificationKey]) {
        // Sekarang pemanggilan ini valid karena kita sudah menggunakan alias
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
});