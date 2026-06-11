const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const db = require('./config/db');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: 'withher-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Auto-login from remember me cookie
app.use((req, res, next) => {
  if (!req.session.userId && req.cookies.remember_me) {
    const userId = req.cookies.remember_me;
    const db = require('./config/db');
    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
      if (!err && results.length > 0) {
        req.session.userId = results[0].id;
        req.session.userName = results[0].full_name;
      }
      next();
    });
  } else {
    next();
  }
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const authRoutes = require('./routes/authRoutes');
const symptomRoutes = require('./routes/symptomRoutes');
const forumRoutes = require('./routes/forumRoutes');
const sosRoutes = require('./routes/sosRoutes');
app.use('/', authRoutes);
app.use('/', symptomRoutes);
app.use('/', forumRoutes);
app.use('/', sosRoutes);


app.get('/education', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('education');
});
// History route
app.get('/history', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('history');
});


// Health Tips route
app.get('/tips', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('tips');
});
// History data route
app.get('/history/data', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const db = require('./config/db');
  db.query(
    'SELECT * FROM symptom_checks WHERE user_id = ? ORDER BY created_at DESC',
    [req.session.userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Could not load history' });
      res.json(results);
    }
  );
});

// Profile route
app.get('/profile', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const db = require('./config/db');

    db.query('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, users) => {
        if (err) return res.redirect('/dashboard');
        const user = users[0];

        db.query('SELECT COUNT(*) as count FROM symptom_checks WHERE user_id = ?', [req.session.userId], (err, s) => {
            db.query('SELECT COUNT(*) as count FROM forum_posts WHERE user_id = ?', [req.session.userId], (err, f) => {
                db.query('SELECT COUNT(*) as count FROM emergency_contacts WHERE user_id = ?', [req.session.userId], (err, e) => {
                    res.render('profile', {
                        user,
                        stats: {
                            symptomChecks: s[0].count,
                            forumPosts: f[0].count,
                            emergencyContacts: e[0].count
                        }
                    });
                });
            });
        });
    });
});

// Home route
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('dashboard', { userName: req.session.userName });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ WithHer running on http://localhost:${PORT}`);
});