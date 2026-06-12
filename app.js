const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const db = require('./config/db');
const fetch = require('node-fetch');

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

// Education search route
app.get('/education/search', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  
  const { query } = req.query;
  if (!query) return res.json({ results: [] });

  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query + ' reproductive health')}&num=5`
    );
    const data = await response.json();
    
    const results = (data.items || []).map(item => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link
    }));

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Education recommendations route
app.get('/education/recommended', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  
  const db = require('./config/db');
  db.query(
    'SELECT symptoms, ai_response FROM symptom_checks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [req.session.userId],
    (err, results) => {
      if (err || results.length === 0) return res.json({ keywords: [] });
      
      const text = (results[0].symptoms + ' ' + results[0].ai_response).toLowerCase();
      
      const keywordMap = [
        { keywords: ['ectopic', 'tube', 'sharp pain', 'one side'], articleIds: [1] },
        { keywords: ['bleeding', 'blood', 'heavy period'], articleIds: [2] },
        { keywords: ['pid', 'pelvic', 'infection', 'discharge'], articleIds: [3] },
        { keywords: ['sti', 'std', 'sexually transmitted', 'chlamydia', 'gonorrhea'], articleIds: [4] },
        { keywords: ['period', 'menstrual', 'cycle', 'irregular'], articleIds: [5] },
        { keywords: ['endometriosis', 'painful period', 'severe cramp'], articleIds: [7] },
        { keywords: ['pcos', 'polycystic', 'hormone', 'irregular period'], articleIds: [8] },
        { keywords: ['pregnant', 'pregnancy', 'maternal', 'antenatal'], articleIds: [9] },
        { keywords: ['family planning', 'contraceptive', 'birth control'], articleIds: [10] },
        { keywords: ['mental', 'anxiety', 'depression', 'stress'], articleIds: [11] },
        { keywords: ['nutrition', 'diet', 'eating', 'food'], articleIds: [12] },
      ];

      const recommendedIds = new Set();
      keywordMap.forEach(({ keywords, articleIds }) => {
        if (keywords.some(kw => text.includes(kw))) {
          articleIds.forEach(id => recommendedIds.add(id));
        }
      });

      res.json({ keywords: [...recommendedIds] });
    }
  );
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ WithHer running on http://localhost:${PORT}`);
});