import csurf from "csurf";

// Setup middleware csurf
// Akan digunakan di server.js (atau app.js utama)
export const csrfProtection = csurf({
  cookie: false, // pakai session, bukan cookie
});

// Helper untuk inject token ke response locals (untuk view HTML)
export function injectCsrf(req, res, next) {
  res.locals.csrfToken = req.csrfToken();
  next();
}