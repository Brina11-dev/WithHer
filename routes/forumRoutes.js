const express = require('express');
const router = express.Router();
const { showForum, getPosts, createPost, likePost, getComments, addComment } = require('../controllers/forumController');

router.get('/forum', showForum);
router.get('/forum/posts', getPosts);
router.post('/forum/post', createPost);
router.post('/forum/like/:id', likePost);
router.get('/forum/comments/:postId', getComments);
router.post('/forum/comment/:postId', addComment);

module.exports = router;