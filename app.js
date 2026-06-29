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

// Education search route (Wikipedia - biased toward health sources)
app.get('/education/search', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

  const { query } = req.query;
  if (!query) return res.json({ results: [] });

  try {
    // Search Wikipedia with health-focused terms
    const searchQuery = encodeURIComponent(query + ' women health medical');
    const wikiRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=3&origin=*`
    );
    const wikiData = await wikiRes.json();
    const wikiItems = wikiData.query?.search || [];

    const wikiResults = wikiItems.map(item => ({
      title: item.title,
      snippet: item.snippet.replace(/<[^>]+>/g, ''),
      link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
      source: 'Wikipedia'
    }));

    // Trusted health sources - static curated links per topic
    const trustedSources = getTrustedSources(query);

    const results = [...trustedSources, ...wikiResults];
    res.json({ results });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

function getTrustedSources(query) {
  const q = query.toLowerCase();
  const sources = [];

  if (q.includes('ectopic')) {
    sources.push(
      { title: 'Ectopic Pregnancy — NHS', snippet: 'An ectopic pregnancy is when a fertilised egg implants itself outside of the womb. Read about symptoms, diagnosis and treatment.', link: 'https://www.nhs.uk/conditions/ectopic-pregnancy/', source: 'NHS' },
      { title: 'Ectopic Pregnancy — Mayo Clinic', snippet: 'An ectopic pregnancy occurs when a fertilized egg implants and grows outside the main cavity of the uterus.', link: 'https://www.mayoclinic.org/diseases-conditions/ectopic-pregnancy/symptoms-causes/syc-20372088', source: 'Mayo Clinic' }
    );
  }
  if (q.includes('bleeding') || q.includes('abnormal bleeding')) {
    sources.push(
      { title: 'Abnormal Uterine Bleeding — NHS', snippet: 'Heavy periods, bleeding between periods or after sex. Find out about causes and treatments.', link: 'https://www.nhs.uk/conditions/heavy-periods/', source: 'NHS' },
      { title: 'Abnormal Uterine Bleeding — Mayo Clinic', snippet: 'Abnormal uterine bleeding is bleeding that differs from normal menstrual periods.', link: 'https://www.mayoclinic.org/symptoms/vaginal-bleeding/basics/definition/sym-20050756', source: 'Mayo Clinic' }
    );
  }
  if (q.includes('pid') || q.includes('pelvic inflammatory')) {
    sources.push(
      { title: 'Pelvic Inflammatory Disease — NHS', snippet: 'PID is an infection of the female upper genital tract, including the womb, fallopian tubes and ovaries.', link: 'https://www.nhs.uk/conditions/pelvic-inflammatory-disease-pid/', source: 'NHS' },
      { title: 'PID — WHO', snippet: 'Pelvic inflammatory disease fact sheet from the World Health Organization.', link: 'https://www.who.int/news-room/fact-sheets/detail/sexually-transmitted-infections-(stis)', source: 'WHO' }
    );
  }
  if (q.includes('sti') || q.includes('sexually transmitted')) {
    sources.push(
      { title: 'STIs — World Health Organization', snippet: 'More than 1 million sexually transmitted infections are acquired every day worldwide.', link: 'https://www.who.int/news-room/fact-sheets/detail/sexually-transmitted-infections-(stis)', source: 'WHO' },
      { title: 'STIs — NHS', snippet: 'Sexually transmitted infections (STIs) are passed from one person to another through unprotected sex.', link: 'https://www.nhs.uk/conditions/sexually-transmitted-infections-stis/', source: 'NHS' }
    );
  }
  if (q.includes('menstrual') || q.includes('period') || q.includes('cycle')) {
    sources.push(
      { title: 'Menstrual Cycle — NHS', snippet: 'The menstrual cycle is the monthly series of changes a woman\'s body goes through in preparation for pregnancy.', link: 'https://www.nhs.uk/conditions/periods/', source: 'NHS' },
      { title: 'Menstruation — Mayo Clinic', snippet: 'Menstruation — Learn about what\'s normal, what\'s not and when to see a doctor.', link: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186', source: 'Mayo Clinic' }
    );
  }
  if (q.includes('endometriosis')) {
    sources.push(
      { title: 'Endometriosis — NHS', snippet: 'Endometriosis is a condition where tissue similar to the lining of the womb grows in other places.', link: 'https://www.nhs.uk/conditions/endometriosis/', source: 'NHS' },
      { title: 'Endometriosis — Mayo Clinic', snippet: 'Endometriosis is an often painful disorder in which tissue that normally lines the inside of your uterus grows outside your uterus.', link: 'https://www.mayoclinic.org/diseases-conditions/endometriosis/symptoms-causes/syc-20354656', source: 'Mayo Clinic' }
    );
  }
  if (q.includes('pcos') || q.includes('polycystic')) {
    sources.push(
      { title: 'PCOS — NHS', snippet: 'Polycystic ovary syndrome (PCOS) is a common condition that affects how a woman\'s ovaries work.', link: 'https://www.nhs.uk/conditions/polycystic-ovary-syndrome-pcos/', source: 'NHS' },
      { title: 'PCOS — Mayo Clinic', snippet: 'Polycystic ovary syndrome (PCOS) is a hormonal disorder common among women of reproductive age.', link: 'https://www.mayoclinic.org/diseases-conditions/pcos/symptoms-causes/syc-20353439', source: 'Mayo Clinic' }
    );
  }
  if (q.includes('maternal') || q.includes('pregnancy') || q.includes('pregnant')) {
    sources.push(
      { title: 'Maternal Health — WHO', snippet: 'WHO fact sheet on maternal health, covering antenatal care, safe delivery and postnatal care.', link: 'https://www.who.int/health-topics/maternal-health', source: 'WHO' },
      { title: 'Pregnancy — NHS', snippet: 'Information and support for pregnancy, from planning a baby to giving birth.', link: 'https://www.nhs.uk/pregnancy/', source: 'NHS' }
    );
  }
  if (q.includes('family planning') || q.includes('contraceptive') || q.includes('contraception')) {
    sources.push(
      { title: 'Family Planning — WHO', snippet: 'Family planning allows people to attain their desired number of children.', link: 'https://www.who.int/news-room/fact-sheets/detail/family-planning-contraception', source: 'WHO' },
      { title: 'Contraception — NHS', snippet: 'There are many methods of contraception available. Find out about your options.', link: 'https://www.nhs.uk/conditions/contraception/', source: 'NHS' }
    );
  }
  if (q.includes('mental health')) {
    sources.push(
      { title: 'Mental Health — WHO', snippet: 'WHO information on mental health, including resources and support.', link: 'https://www.who.int/health-topics/mental-health', source: 'WHO' },
      { title: 'Mental Health — NHS', snippet: 'Information and support for mental health conditions.', link: 'https://www.nhs.uk/mental-health/', source: 'NHS' }
    );
  }
  if (q.includes('nutrition')) {
    sources.push(
      { title: 'Women\'s Nutrition — WHO', snippet: 'WHO guidance on nutrition for women across all life stages.', link: 'https://www.who.int/health-topics/nutrition', source: 'WHO' }
    );
  }

  return sources;
}
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