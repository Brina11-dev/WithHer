const db = require('../config/db');
const fs = require('fs');
const path = require('path');


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
    res.render('forum' ,{ userId: req.session.userId });
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
                SELECT fp.id, fp.user_id, fp.content, fp.is_anonymous, fp.created_at, fp.likes, fp.tags, fp.media_url, fp.media_type, u.full_name
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

const deletePost = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { id } = req.params;
    const userId = req.session.userId;

    // Step 1: fetch the post first — need media_url AND user_id
    db.query('SELECT user_id, media_url FROM forum_posts WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error' });
        if (results.length === 0) return res.status(404).json({ error: 'Post not found' });

        const post = results[0];

        // Step 2: ownership check
        if (post.user_id !== userId) {
            return res.status(403).json({ error: 'Not your post' });
        }

        // Step 3: delete child rows first — comments, then likes
        db.query('DELETE FROM comments WHERE post_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: 'Error' });

            db.query('DELETE FROM post_likes WHERE post_id = ?', [id], (err) => {
                if (err) return res.status(500).json({ error: 'Error' });

                // Step 4: delete the post itself
                db.query('DELETE FROM forum_posts WHERE id = ?', [id], (err) => {
                    if (err) return res.status(500).json({ error: 'Error' });

                    // Step 5: if there was media, delete the file from disk
                    if (post.media_url) {
                        const filePath = path.join(__dirname, '..', 'public', post.media_url);
                        fs.unlink(filePath, (err) => {
                            if (err) console.error('Could not delete media file:', err.message);
                            // don't fail the request over this — post is already deleted from DB
                        });
                    }

                    res.json({ success: true });
                });
            });
        });
    });
};

// Like/unlike a post (toggle) + track who liked
const likePost = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { id } = req.params;
    const userId = req.session.userId;

    // Check if already liked
    db.query(
        'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
        [id, userId],
        (err, existing) => {
            if (err) return res.status(500).json({ error: 'Error' });

            if (existing.length > 0) {
                // Already liked — unlike it
                db.query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [id, userId], (err) => {
                    if (err) return res.status(500).json({ error: 'Error' });

                    db.query('UPDATE forum_posts SET likes = GREATEST(0, likes - 1) WHERE id = ?', [id], (err) => {
                        if (err) return res.status(500).json({ error: 'Error' });

                        db.query('SELECT likes FROM forum_posts WHERE id = ?', [id], (err, results) => {
                            res.json({ success: true, likes: results[0].likes, liked: false });
                        });
                    });
                });
            } else {
                // Not liked yet — like it
                db.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [id, userId], (err) => {
                    if (err) return res.status(500).json({ error: 'Error' });

                    db.query('UPDATE forum_posts SET likes = COALESCE(likes, 0) + 1 WHERE id = ?', [id], (err) => {
                        if (err) return res.status(500).json({ error: 'Error' });

                        db.query('SELECT likes FROM forum_posts WHERE id = ?', [id], (err, results) => {
                            if (err) return res.status(500).json({ error: 'Error' });

                            res.json({ success: true, likes: results[0].likes, liked: true });

                            // Notify post owner
                            db.query('SELECT user_id FROM forum_posts WHERE id = ?', [id], (err, posts) => {
                                if (!err && posts.length > 0 && posts[0].user_id !== userId) {
                                    db.query('SELECT full_name FROM users WHERE id = ?', [userId], (err, users) => {
                                        if (!err && users.length > 0) {
                                            global.createNotification(
                                                posts[0].user_id,
                                                'support',
                                                `${users[0].full_name} supported your post 💗`,
                                                `/forum`
                                            );
                                        }
                                    });
                                }
                            });
                        });
                    });
                });
            }
        }
    );
};

// Get who liked a post
const getPostLikes = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { id } = req.params;

    db.query(`
        SELECT u.full_name, u.id,
               pl.created_at
        FROM post_likes pl
        JOIN users u ON pl.user_id = u.id
        WHERE pl.post_id = ?
        ORDER BY pl.created_at DESC
    `, [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error' });
        res.json(results);
    });
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

            db.query(`
                SELECT c.id, c.content, c.is_anonymous, c.created_at, u.full_name,
                       fp.user_id as post_owner_id
                FROM comments c
                JOIN users u ON c.user_id = u.id
                JOIN forum_posts fp ON fp.id = ?
                WHERE c.id = ?
            `, [postId, result.insertId], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error' });

                const comment = rows[0];

                // Send response FIRST
                res.json({ success: true, comment });

                // THEN handle notification (after response is sent)
                if (comment.post_owner_id !== req.session.userId) {
                    const commenterName = comment.is_anonymous ? 'Someone' : comment.full_name;
                    global.createNotification(
                        comment.post_owner_id,
                        'comment',
                        `${commenterName} commented on your post`,
                        `/forum`
                    );
                }
            });
        }
    );
};

const createPost = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { content } = req.body;
    const is_anonymous = req.body.is_anonymous === 'true' || req.body.is_anonymous === true ? 1 : 0;
    if (!content && !req.file) return res.status(400).json({ error: 'Post cannot be empty' });

    const tags = extractKeywords(content || '').join(',');
    const mediaUrl = req.file ? '/uploads/' + req.file.filename : null;
    const mediaType = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : null;

    db.query(
        'INSERT INTO forum_posts (user_id, content, is_anonymous, tags, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)',
        [req.session.userId, content || '', is_anonymous, tags || null, mediaUrl, mediaType],
        (err, result) => {
           if (err) {
        console.error('DB createPost error:', err.message);
         return res.status(500).json({ error: 'Could not create post' });
         }
            res.json({ success: true, id: result.insertId });
        }
    );
};

module.exports = { showForum, getPosts, createPost, likePost, getComments, addComment, getPostLikes, deletePost };