const db = require('../config/db');

// Helper: extract health keywords from symptom text
function extractKeywords(text) {
    if (!text) return [];
    const t = text.toLowerCase();
    const keywordMap = [
        { keywords: ['ectopic', 'tube', 'one side pain'], tag: 'ectopic' },
        { keywords: ['bleeding', 'heavy period', 'abnormal bleed'], tag: 'bleeding' },
        { keywords: ['pid', 'pelvic', 'discharge', 'pelvic pain'], tag: 'pid' },
        { keywords: ['sti', 'std', 'chlamydia', 'gonorrhea', 'sexually transmitted'], tag: 'sti' },
        { keywords: ['period', 'menstrual', 'cycle', 'irregular period'], tag: 'menstrual' },
        { keywords: ['endometriosis', 'painful period', 'severe cramp'], tag: 'endometriosis' },
        { keywords: ['pcos', 'polycystic', 'irregular', 'hormonal'], tag: 'pcos' },
        { keywords: ['pregnant', 'pregnancy', 'maternal', 'antenatal'], tag: 'pregnancy' },
        { keywords: ['family planning', 'contraceptive', 'birth control'], tag: 'family_planning' },
        { keywords: ['mental', 'anxiety', 'depression', 'stress', 'mood'], tag: 'mental_health' },
        { keywords: ['nutrition', 'diet', 'eating', 'food', 'weight'], tag: 'nutrition' },
        { keywords: ['bloating', 'nausea', 'fatigue', 'tired'], tag: 'general' },
        { keywords: ['cramp', 'pain', 'lower abdomen'], tag: 'pain' },
    ];

    const found = [];
    keywordMap.forEach(({ keywords, tag }) => {
        if (keywords.some(kw => t.includes(kw))) found.push(tag);
    });
    return found;
}

// Show forum page
const showForum = (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('forum');
};

// Get all posts + symptom-matched posts at top
const getPosts = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    // Fetch user's latest symptom check first
    db.query(
        'SELECT symptoms, ai_response FROM symptom_checks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.session.userId],
        (err, symptomResults) => {
            // Get all posts regardless
            db.query(`
                SELECT fp.id, fp.user_id, fp.content, fp.is_anonymous, fp.created_at, fp.likes, fp.tags, u.full_name
                FROM forum_posts fp
                JOIN users u ON fp.user_id = u.id
                ORDER BY fp.created_at DESC
            `, (err, posts) => {
                if (err) return res.status(500).json({ error: 'Could not load posts' });

                // If no symptom history, just return all posts normally
                if (!symptomResults || symptomResults.length === 0) {
                    return res.json({ posts, relatedPosts: [], userTags: [] });
                }

                const symptomText = symptomResults[0].symptoms + ' ' + symptomResults[0].ai_response;
                const userTags = extractKeywords(symptomText);

                // Find posts whose tags overlap with user's symptom tags
                const relatedPosts = posts.filter(post => {
                    if (!post.tags) return false;
                    const postTags = post.tags.split(',').map(t => t.trim());
                    return postTags.some(tag => userTags.includes(tag));
                });

                res.json({ posts, relatedPosts, userTags });
            });
        }
    );
};

// Create new post (auto-tag based on content)
const createPost = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { content, is_anonymous } = req.body;
    if (!content.trim()) return res.status(400).json({ error: 'Content is required' });

    // Auto-tag the post based on its content
    const tags = extractKeywords(content).join(',');

    db.query(
        'INSERT INTO forum_posts (user_id, content, is_anonymous, tags) VALUES (?, ?, ?, ?)',
        [req.session.userId, content, is_anonymous, tags || null],
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

// Get comments for a post
const getComments = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { postId } = req.params;

    db.query(`
        SELECT c.id, c.content, c.is_anonymous, c.created_at, u.full_name
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    `, [postId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Could not load comments' });
        res.json(results);
    });
};

// Add a comment
const addComment = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { postId } = req.params;
    const { content, is_anonymous } = req.body;

    if (!content.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

    db.query(
        'INSERT INTO comments (post_id, user_id, content, is_anonymous) VALUES (?, ?, ?, ?)',
        [postId, req.session.userId, content, is_anonymous],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Could not add comment' });

            // Return the new comment with user info
            db.query(`
                SELECT c.id, c.content, c.is_anonymous, c.created_at, u.full_name
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = ?
            `, [result.insertId], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error' });
                res.json({ success: true, comment: rows[0] });
            });
        }
    );
};
module.exports = { showForum, getPosts, createPost, likePost, getComments, addComment };