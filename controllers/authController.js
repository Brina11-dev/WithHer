const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Show register page
const showRegister = (req, res) => {
  res.render('register', { error: null });
};

// Handle register form
const register = (req, res) => {
  const { full_name, phone, email, password, confirm_password, age, county, remember_me } = req.body;

  // Check passwords match
  if (password !== confirm_password) {
    return res.render('register', { error: 'Passwords do not match' });
  }

  // Check if phone already exists
  db.query('SELECT * FROM users WHERE phone = ?', [phone], (err, results) => {
    if (err) return res.render('register', { error: 'Something went wrong' });

    if (results.length > 0) {
      return res.render('register', { error: 'Phone number already registered' });
    }

    // Encrypt password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Save user to database
    db.query(
      'INSERT INTO users (full_name, phone, email, password, age, county) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, phone, email, hashedPassword, age, county],
      (err, result) => {
        if (err) return res.render('register', { error: 'Registration failed' });

        // Save session
        req.session.userId = result.insertId;
        req.session.userName = full_name;

        // Remember me cookie
        if (remember_me) {
          res.cookie('remember_me', result.insertId, { maxAge: 30 * 24 * 60 * 60 * 1000 });
        }

        res.redirect('/dashboard');
      }
    );
  });
};

// Show login page
const showLogin = (req, res) => {
  res.render('login', { error: null });
};

// Handle login form
const login = (req, res) => {
  const { phone, password, remember_me } = req.body;

  // Find user by phone
  db.query('SELECT * FROM users WHERE phone = ?', [phone], (err, results) => {
    if (err) return res.render('login', { error: 'Something went wrong' });

    if (results.length === 0) {
      return res.render('login', { error: 'Phone number not found' });
    }

    const user = results[0];

    // Check password
    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.render('login', { error: 'Incorrect password' });
    }

    // Save session
    req.session.userId = user.id;
    req.session.userName = user.full_name;

    // Remember me cookie
    if (remember_me) {
      res.cookie('remember_me', user.id, { maxAge: 30 * 24 * 60 * 60 * 1000 });
    }

    res.redirect('/dashboard');
  });
};

// Logout
const logout = (req, res) => {
  req.session.destroy();
  res.clearCookie('remember_me');
  res.redirect('/login');
};

module.exports = { showRegister, register, showLogin, login, logout };