const db = require('../config/db');

// Show forum page
const showForum = (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('forum');
};

// Get all posts
const getPosts = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    db.query(`
        SELECT fp.id, fp.content, fp.is_anonymous, fp.created_at, fp.likes, u.full_name
        FROM forum_posts fp
        JOIN users u ON fp.user_id = u.id
        ORDER BY fp.created_at DESC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: 'Could not load posts' });
        res.json(results);
    });
};

// Create new post
const createPost = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { content, is_anonymous } = req.body;

    if (!content.trim()) return res.status(400).json({ error: 'Content is required' });

    db.query(
        'INSERT INTO forum_posts (user_id, content, is_anonymous) VALUES (?, ?, ?)',
        [req.session.userId, content, is_anonymous],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Could not create post' });
            res.json({ success: true, id: result.insertId });
        }
    );
};

// Like a post
const likePost = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { id } = req.params;

    db.query(
        'UPDATE forum_posts SET likes = COALESCE(likes, 0) + 1 WHERE id = ?',
        [id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Could not like post' });

            db.query('SELECT likes FROM forum_posts WHERE id = ?', [id], (err, results) => {
                if (err) return res.status(500).json({ error: 'Error' });
                res.json({ success: true, likes: results[0].likes });
            });
        }
    );
};

module.exports = { showForum, getPosts, createPost, likePost };