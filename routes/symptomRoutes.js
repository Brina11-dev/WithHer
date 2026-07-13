const express = require('express');
const router = express.Router();
const { showSymptoms, checkSymptoms } = require('../controllers/symptomController');

router.get('/symptoms', showSymptoms);
router.post('/symptoms/check', checkSymptoms);

module.exports = router;