import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import schedule from 'node-schedule';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const usersDbPath = path.join(__dirname, 'users.json');
const pastesDbPath = path.join(__dirname, 'pastes.json');
const reportsDbPath = path.join(__dirname, 'reports.json');
const pasteDataPath = path.join(__dirname, 'paste_data');

// DB Helpers
const readDb = async (filePath) => {
  try {
    await fs.access(filePath).catch(() => fs.writeFile(filePath, '[]'));
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading DB file ${filePath}:`, err);
    return [];
  }
};
const writeDb = (filePath, data) => fs.writeFile(filePath, JSON.stringify(data, null, 2));
const ensureDirExists = (dirPath) => fs.mkdir(dirPath, { recursive: true });

// Utils
const generateToken = (length = 16) => crypto.randomBytes(length).toString('hex');
const generatePasteId = () => crypto.randomBytes(7).toString('hex');

// Nodemailer Transport
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT, 10),
  secure: process.env.MAIL_PORT === '465',
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const username = req.session.user.username.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${username}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CDN-like caching for our static assets (CSS, JS)
app.use('/cdn', express.static(path.join(__dirname, 'public'), {
  maxAge: '1y', // Cache for 1 year
  immutable: true // Tell browser the file will not change
}));

// Serve other static files (like uploads, images) without aggressive caching
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key-for-development',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));
app.use(csurf({ cookie: true }));

app.use((req, res, next) => {
  res.cookie('XSRF-TOKEN', req.csrfToken());
  next();
});

// Auth Middleware
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(401).json({ error: 'Login diperlukan' });
    }
    return res.redirect('/login');
  }
  next();
};

// Email Functions
const sendVerificationEmail = async (user) => {
  const url = `${process.env.BASE_URL}/verify-email?token=${user.emailVerificationToken}`;
  await transporter.sendMail({
    from: `"Pastebin GGWP" <${process.env.MAIL_FROM}>`,
    to: user.email,
    subject: 'Verifikasi Akun Pastebin GGWP Anda',
    html: `Halo ${user.username},<br><br>Terima kasih telah mendaftar. Silakan klik link di bawah ini untuk memverifikasi akun Anda:<br><a href="${url}">${url}</a><br><br>Link ini akan kedaluwarsa dalam 1 jam.`
  });
};

const sendPasswordResetEmail = async (user) => {
    const url = `${process.env.BASE_URL}/reset-password?token=${user.passwordResetToken}`;
    await transporter.sendMail({
        from: `"Pastebin GGWP" <${process.env.MAIL_FROM}>`,
        to: user.email,
        subject: 'Reset Password Akun Pastebin GGWP Anda',
        html: `Halo ${user.username},<br><br>Anda meminta untuk mereset password. Silakan klik link di bawah ini:<br><a href="${url}">${url}</a><br><br>Jika Anda tidak meminta ini, abaikan email ini. Link akan kedaluwarsa dalam 1 jam.`
    });
};

// Notification Function
const addNotification = async (userId, type, fromUsername, pasteId = null) => {
    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        const notification = {
            id: generateToken(8),
            type,
            from: fromUsername,
            pasteId,
            read: false,
            createdAt: new Date().toISOString()
        };
        if (!users[userIndex].notifications) users[userIndex].notifications = [];
        users[userIndex].notifications.unshift(notification);
        await writeDb(usersDbPath, users);
    }
};

// --- API Routes ---

// Auth Routes
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ errorKey: 'invalid_input' });
    }
    const users = await readDb(usersDbPath);
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ errorKey: 'username_taken' });
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ errorKey: 'email_taken' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
        id: generateToken(8), username, email, password: hashedPassword,
        bio: "", profilePicture: null, isAdmin: false, isSFamily: false, isVerified: false,
        isEmailVerified: false, emailVerificationToken: generateToken(), emailVerificationExpires: Date.now() + 3600000,
        weeklyScore: 0, createdAt: new Date().toISOString(),
        following: [], followers: [], notifications: []
    };
    try {
        await sendVerificationEmail(newUser);
        users.push(newUser);
        await writeDb(usersDbPath, users);
        res.status(201).json({ success: true });
    } catch (error) {
        console.error("Email sending failed:", error);
        res.status(500).json({ errorKey: 'email_fail' });
    }
});

app.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.emailVerificationToken === token && u.emailVerificationExpires > Date.now());
    if (userIndex === -1) return res.redirect('/login?error=invalid_token');
    
    users[userIndex].isEmailVerified = true;
    users[userIndex].emailVerificationToken = null;
    users[userIndex].emailVerificationExpires = null;
    await writeDb(usersDbPath, users);
    res.redirect('/login?success=verified');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await readDb(usersDbPath);
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ errorKey: 'invalid' });
    }
    if (!user.isEmailVerified) return res.status(403).json({ errorKey: 'not_verified' });
    
    const { password: _, ...sessionData } = user;
    req.session.user = sessionData;
    res.json({ success: true, redirectUrl: '/' });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (userIndex !== -1) {
        users[userIndex].passwordResetToken = generateToken();
        users[userIndex].passwordResetExpires = Date.now() + 3600000; // 1 hour
        try {
            await sendPasswordResetEmail(users[userIndex]);
            await writeDb(usersDbPath, users);
        } catch (error) {
            console.error("Password reset email failed:", error);
            return res.status(500).json({ errorKey: 'email_fail' });
        }
    }
    // Always return success to prevent email enumeration attacks
    res.json({ success: true });
});

app.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ errorKey: 'invalid_input' });
    
    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.passwordResetToken === token && u.passwordResetExpires > Date.now());
    if (userIndex === -1) return res.status(400).json({ errorKey: 'invalid_token' });
    
    users[userIndex].password = await bcrypt.hash(password, 12);
    users[userIndex].passwordResetToken = null;
    users[userIndex].passwordResetExpires = null;
    await writeDb(usersDbPath, users);
    res.json({ success: true });
});

// Paste Routes
app.post('/create', requireLogin, async (req, res) => {
    const { title, content, privacy, pastePassword } = req.body;
    if (!content) return res.status(400).json({ error: 'Konten tidak boleh kosong' });

    const pastes = await readDb(pastesDbPath);
    const newPaste = {
        id: generatePasteId(),
        userId: req.session.user.id,
        title: title || 'Untitled Paste',
        privacy,
        password: pastePassword ? await bcrypt.hash(pastePassword, 10) : null,
        createdAt: new Date().toISOString(),
        views: 0,
        likes: []
    };
    
    const pasteContentPath = path.join(pasteDataPath, `${newPaste.id}.txt`);
    await fs.writeFile(pasteContentPath, content);
    pastes.push(newPaste);
    await writeDb(pastesDbPath, pastes);

    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.id === req.session.user.id);
    if (userIndex !== -1) {
        users[userIndex].weeklyScore = (users[userIndex].weeklyScore || 0) + 10;
        const mentions = [...new Set(content.match(/@([a-zA-Z0-9_]{3,20})/g) || [])];

        for (const mention of mentions) {
            const username = mention.substring(1);
            const mentionedUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (mentionedUser && mentionedUser.id !== req.session.user.id) {
                await addNotification(mentionedUser.id, 'mention', req.session.user.username, newPaste.id);
            }
        }
        await writeDb(usersDbPath, users);
    }
    
    res.json({ success: true, redirectUrl: `/${newPaste.id}` });
});

app.get('/api/paste/:id', async (req, res) => {
    const pastes = await readDb(pastesDbPath);
    const pasteIndex = pastes.findIndex(p => p.id === req.params.id);
    if (pasteIndex === -1) return res.status(404).json({ error: 'Paste tidak ditemukan' });
    
    let paste = pastes[pasteIndex];
    const users = await readDb(usersDbPath);
    const author = users.find(u => u.id === paste.userId);
    if (!author) return res.status(404).json({ error: 'Author tidak ditemukan' });

    const isOwner = req.session.user && req.session.user.id === paste.userId;
    if (paste.privacy === 'private' && !isOwner) return res.status(403).json({ error: 'Akses ditolak' });
    if (paste.password && !isOwner && !(req.session.authorizedPastes && req.session.authorizedPastes[paste.id])) {
        return res.status(401).json({ error: 'Password diperlukan', requiresPassword: true });
    }

    paste.views = (paste.views || 0) + 1;
    await writeDb(pastesDbPath, pastes);
    
    const content = await fs.readFile(path.join(pasteDataPath, `${paste.id}.txt`), 'utf8');
    const { password, ...safeAuthor } = author;
    res.json({ paste: { ...paste, content }, author: safeAuthor });
});

app.post('/api/paste/:id/verify', async (req, res) => {
    const pastes = await readDb(pastesDbPath);
    const paste = pastes.find(p => p.id === req.params.id);
    if (!paste || !paste.password) return res.status(404).json({ error: 'Paste tidak ditemukan' });
    
    const match = await bcrypt.compare(req.body.password || '', paste.password);
    if (!match) return res.status(401).json({ error: 'Password salah' });
    
    req.session.authorizedPastes = req.session.authorizedPastes || {};
    req.session.authorizedPastes[paste.id] = true;
    res.json({ success: true });
});

app.get('/api/paste/:id/edit-data', requireLogin, async (req, res) => {
    const pastes = await readDb(pastesDbPath);
    const paste = pastes.find(p => p.id === req.params.id);
    if (!paste || paste.userId !== req.session.user.id) return res.status(403).json({ error: 'Akses ditolak' });
    
    const content = await fs.readFile(path.join(pasteDataPath, `${paste.id}.txt`), 'utf8');
    res.json({ title: paste.title, content, privacy: paste.privacy });
});

app.post('/paste/:id/update', requireLogin, async (req, res) => {
    const { title, content, privacy, pastePassword } = req.body;
    if (!content) return res.status(400).json({ error: 'Konten tidak boleh kosong' });

    const pastes = await readDb(pastesDbPath);
    const pasteIndex = pastes.findIndex(p => p.id === req.params.id && p.userId === req.session.user.id);
    if (pasteIndex === -1) return res.status(403).json({ error: 'Akses ditolak' });

    pastes[pasteIndex].title = title || 'Untitled Paste';
    pastes[pasteIndex].privacy = privacy;
    if (pastePassword) {
        pastes[pasteIndex].password = await bcrypt.hash(pastePassword, 10);
    } else if (req.body.hasOwnProperty('pastePassword') && pastePassword === '') {
        pastes[pasteIndex].password = null;
    }
    
    await fs.writeFile(path.join(pasteDataPath, `${req.params.id}.txt`), content);
    await writeDb(pastesDbPath, pastes);
    res.json({ success: true, redirectUrl: `/${req.params.id}` });
});

app.post('/paste/:id/delete', requireLogin, async (req, res) => {
    const pastes = await readDb(pastesDbPath);
    const pasteIndex = pastes.findIndex(p => p.id === req.params.id && p.userId === req.session.user.id);
    if (pasteIndex === -1) return res.status(403).json({ error: 'Akses ditolak' });

    await fs.unlink(path.join(pasteDataPath, `${req.params.id}.txt`)).catch(() => {});
    pastes.splice(pasteIndex, 1);
    await writeDb(pastesDbPath, pastes);
    res.json({ success: true });
});

app.post('/api/paste/:id/like', requireLogin, async (req, res) => {
    const pastes = await readDb(pastesDbPath);
    const pasteIndex = pastes.findIndex(p => p.id === req.params.id);
    if (pasteIndex === -1) return res.status(404).json({ error: 'Paste tidak ditemukan' });

    const hasLiked = pastes[pasteIndex].likes.includes(req.session.user.id);
    if (hasLiked) {
        pastes[pasteIndex].likes = pastes[pasteIndex].likes.filter(uid => uid !== req.session.user.id);
    } else {
        pastes[pasteIndex].likes.push(req.session.user.id);
    }
    await writeDb(pastesDbPath, pastes);
    res.json({ hasLiked: !hasLiked, likeCount: pastes[pasteIndex].likes.length });
});

app.post('/api/paste/:id/report', requireLogin, async (req, res) => {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Alasan diperlukan' });

    const reports = await readDb(reportsDbPath);
    reports.push({
        reportId: generateToken(8),
        pasteId: req.params.id,
        reporterId: req.session.user.id,
        reason,
        createdAt: new Date().toISOString()
    });
    await writeDb(reportsDbPath, reports);
    res.json({ success: true });
});

// User & Profile Routes
app.post('/profile/update', requireLogin, upload.single('profilePicture'), async (req, res) => {
    const { bio } = req.body;
    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.id === req.session.user.id);
    if (userIndex === -1) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (bio) users[userIndex].bio = bio.substring(0, 150);
    if (req.file) {
        if (users[userIndex].profilePicture) {
            const oldPicPath = path.join(__dirname, 'public', users[userIndex].profilePicture);
            await fs.unlink(oldPicPath).catch(() => {});
        }
        users[userIndex].profilePicture = `/uploads/${req.file.filename}`;
    }
    await writeDb(usersDbPath, users);
    // Update session data
    const { password, ...sessionData } = users[userIndex];
    req.session.user = sessionData;
    res.json({ success: true });
});

app.post('/profile/change-password', requireLogin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.id === req.session.user.id);
    const user = users[userIndex];

    if (!await bcrypt.compare(currentPassword, user.password)) {
        return res.status(403).json({ errorKey: 'current_password_invalid' });
    }
    users[userIndex].password = await bcrypt.hash(newPassword, 12);
    await writeDb(usersDbPath, users);
    res.json({ success: true });
});

app.post('/api/user/:username/follow', requireLogin, async (req, res) => {
    const users = await readDb(usersDbPath);
    const targetUserIndex = users.findIndex(u => u.username.toLowerCase() === req.params.username.toLowerCase());
    const currentUserIndex = users.findIndex(u => u.id === req.session.user.id);
    if (targetUserIndex === -1 || currentUserIndex === -1) return res.status(404).json({ error: 'User tidak ditemukan' });

    const targetUserId = users[targetUserIndex].id;
    const currentUserId = users[currentUserIndex].id;
    if (targetUserId === currentUserId) return res.status(400).json({ error: 'Tidak bisa follow diri sendiri' });

    const isFollowing = users[currentUserIndex].following.includes(targetUserId);
    if (isFollowing) {
        users[currentUserIndex].following = users[currentUserIndex].following.filter(id => id !== targetUserId);
        users[targetUserIndex].followers = users[targetUserIndex].followers.filter(id => id !== currentUserId);
    } else {
        users[currentUserIndex].following.push(targetUserId);
        users[targetUserIndex].followers.push(currentUserId);
        await addNotification(targetUserId, 'follow', users[currentUserIndex].username);
    }
    await writeDb(usersDbPath, users);
    // Update session data
    const { password, ...sessionData } = users[currentUserIndex];
    req.session.user = sessionData;
    res.json({ isFollowing: !isFollowing });
});

// Data API Routes
app.get('/api/leaderboard', async (req, res) => {
    const users = await readDb(usersDbPath);
    const leaderboard = users
        // ✅ FIX: Filter hanya berdasarkan skor, bukan status admin/S-Family
        // Ini akan memastikan semua pengguna dengan skor muncul di leaderboard.
        .filter(u => u.weeklyScore > 0)
        .sort((a, b) => b.weeklyScore - a.weeklyScore)
        .slice(0, 100)
        .map(({ password, emailVerificationToken, passwordResetToken, ...user }) => user);
    res.json(leaderboard);
});

app.get('/api/notifications', requireLogin, async (req, res) => {
    const users = await readDb(usersDbPath);
    const user = users.find(u => u.id === req.session.user.id);
    res.json(user.notifications || []);
});

app.post('/api/notifications/mark-read', requireLogin, async (req, res) => {
    const users = await readDb(usersDbPath);
    const userIndex = users.findIndex(u => u.id === req.session.user.id);
    if (userIndex !== -1 && users[userIndex].notifications) {
        users[userIndex].notifications.forEach(n => n.read = true);
        await writeDb(usersDbPath, users);
    }
    res.json({ success: true });
});

app.get('/api/user/me', async (req, res) => {
    if (!req.session.user) return res.json(null);
    const users = await readDb(usersDbPath);
    const user = users.find(u => u.id === req.session.user.id);
    if (!user) {
        req.session.destroy();
        return res.json(null);
    }
    
    const unreadNotifications = user.notifications?.filter(n => !n.read).length || 0;
    const followerCount = user.isAdmin ? '∞' : (user.followers?.length || 0);
    const followingCount = user.following?.length || 0;

    const { password, ...sessionData } = user;
    res.json({ ...sessionData, unreadNotifications, followerCount, followingCount });
});

app.get('/api/pastes/latest', async (req, res) => {
    try {
        const pastes = await readDb(pastesDbPath);
        const users = await readDb(usersDbPath);
        const publicPastes = pastes.filter(p => p.privacy === 'public');

        const hydratedPastes = publicPastes.map(paste => {
            const author = users.find(u => u.id === paste.userId) || { username: 'Anonim', profilePicture: null };
            // ✅ FIX: Sertakan profilePicture dalam objek author yang dikirim ke client.
            return { 
                ...paste, 
                author: { 
                    username: author.username, 
                    isSFamily: author.isSFamily, 
                    isVerified: author.isVerified,
                    profilePicture: author.profilePicture // <-- Baris ini ditambahkan
                } 
            };
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json(hydratedPastes.slice(0, 50));
    } catch (error) {
        console.error("Error fetching latest pastes:", error);
        res.status(500).json({ error: "Gagal memuat data paste dari server." });
    }
});

app.get('/api/user/:username', async (req, res) => {
    const users = await readDb(usersDbPath);
    const user = users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    
    const pastesMeta = await readDb(pastesDbPath);
    let userPastesMeta = pastesMeta.filter(p => p.userId === user.id);
    
    const totalViews = userPastesMeta.reduce((sum, p) => sum + (p.views || 0), 0);
    const followerCount = user.isAdmin ? '∞' : (user.followers?.length || 0);
    const followingCount = user.following?.length || 0;

    const isOwner = req.session.user && req.session.user.id === user.id;
    if (!isOwner) {
        userPastesMeta = userPastesMeta.filter(p => p.privacy === 'public');
    }
    userPastesMeta.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const userPastes = await Promise.all(userPastesMeta.map(async (p) => {
        const content = await fs.readFile(path.join(pasteDataPath, `${p.id}.txt`), 'utf8').catch(() => '');
        return { ...p, content };
    }));

    const { password, ...safeUser } = user;
    res.json({ 
        user: { ...safeUser, totalViews, followerCount, followingCount }, 
        pastes: userPastes 
    });
});

// --- Page Serving ---
const servePage = (pageName) => (req, res) => res.sendFile(path.join(__dirname, 'views', `${pageName}.html`));

app.get('/', servePage('index'));
app.get('/new', requireLogin, servePage('new'));
app.get('/login', servePage('login'));
app.get('/register', servePage('register'));
app.get('/forgot-password', servePage('forgot-password'));
app.get('/reset-password', servePage('reset-password'));
app.get('/leaderboard', servePage('leaderboard'));
app.get('/notifications', requireLogin, servePage('notifications'));
app.get('/u/:username', servePage('profile'));
app.get('/:id/edit', requireLogin, servePage('edit'));

// This MUST be one of the last routes to act as a wildcard for paste IDs
app.get('/:id', (req, res, next) => {
    const pasteId = req.params.id.split('/')[0];
    // A simple regex to check if it looks like our paste ID (14 hex chars)
    if(/^[a-f0-9]{14}$/.test(pasteId)) {
        return res.sendFile(path.join(__dirname, 'views', 'view.html'));
    }
    // If it's not a paste ID, maybe it's a 404
    next();
});

// Error Handling
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Sesi tidak valid atau kedaluwarsa. Silakan muat ulang halaman.' });
    }
    console.error(err.stack);
    if (!res.headersSent) {
        res.status(500).send('Terjadi kesalahan internal pada server.');
    }
});

// Scheduled Jobs
schedule.scheduleJob('0 0 * * 0', async () => {
    console.log('Mereset skor mingguan...');
    const users = await readDb(usersDbPath);
    const top3 = users
        .filter(u => !u.isAdmin && !u.isSFamily)
        .sort((a, b) => b.weeklyScore - a.weeklyScore)
        .slice(0, 3);
    
    users.forEach(user => {
        if (top3.some(topUser => topUser.id === user.id)) {
            user.isVerified = true;
        }
        user.weeklyScore = 0;
    });
    
    await writeDb(usersDbPath, users);
    console.log('Skor mingguan telah direset. Pemenang telah diverifikasi.');
});

// Server Initialization
async function initializeServer() {
    await ensureDirExists(path.join(__dirname, 'public', 'uploads'));
    await ensureDirExists(pasteDataPath);
    
    const users = await readDb(usersDbPath);
    const sFamilyUsernames = (process.env.S_FAMILY_MEMBERS || '').split(',').map(u => u.trim().toLowerCase());
    const adminUsername = (process.env.ADMIN_USERNAME || '').toLowerCase();
    let needsWrite = false;

    if (adminUsername && !users.some(u => u.username.toLowerCase() === adminUsername)) {
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
        users.push({
            id: generateToken(8), username: process.env.ADMIN_USERNAME,
            email: process.env.ADMIN_EMAIL, password: hashedPassword,
            bio: "Saya adalah administrator situs ini.", profilePicture: null,
            isAdmin: true, isSFamily: true, isVerified: true, isEmailVerified: true,
            weeklyScore: 0, createdAt: new Date().toISOString(),
            following: [], followers: [], notifications: []
        });
        needsWrite = true;
    }
    
    users.forEach(user => {
        const isSFamily = sFamilyUsernames.includes(user.username.toLowerCase());
        if (user.isSFamily !== isSFamily) {
            user.isSFamily = isSFamily;
            if (isSFamily) user.isAdmin = true;
            needsWrite = true;
        }
    });

    if (needsWrite) {
        await writeDb(usersDbPath, users);
    }
}

(async () => {
    await initializeServer();
    app.listen(PORT, () => console.log(`🚀 Server GGWP v4 berjalan di http://localhost:${PORT}`));
})();