const express = require('express');
const router = express.Router();
const { showForum, getPosts, createPost, likePost, getComments, addComment, getPostLikes } = require('../controllers/forumController');

router.get('/forum', showForum);
router.get('/forum/posts', getPosts);
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
        cb(new Error('Only images and videos allowed'));
    }
});
router.post('/forum/post', upload.single('media'), createPost);
router.post('/forum/like/:id', likePost);
router.get('/forum/likes/:id', getPostLikes);
router.get('/forum/comments/:postId', getComments);
router.post('/forum/comment/:postId', addComment);

module.exports = router;