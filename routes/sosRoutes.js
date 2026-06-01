const express = require('express');
const router = express.Router();
const { showSOS, getContacts, addContact, deleteContact, sendSOS } = require('../controllers/sosController');

router.get('/sos', showSOS);
router.get('/sos/contacts', getContacts);
router.post('/sos/contacts/add', addContact);
router.delete('/sos/contacts/delete/:id', deleteContact);
router.post('/sos/send', sendSOS);

module.exports = router;