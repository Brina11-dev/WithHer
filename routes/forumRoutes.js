const express = require('express');
const router = express.Router();
const { showForum, getPosts, createPost, likePost } = require('../controllers/forumController');

router.get('/forum', showForum);
router.get('/forum/posts', getPosts);
router.post('/forum/post', createPost);
router.post('/forum/like/:id', likePost);

module.exports = router;