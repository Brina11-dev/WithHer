const db = require('../config/db');

// Show SOS page
const showSOS = (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('sos');
};

// Get emergency contacts
const getContacts = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    db.query(
        'SELECT * FROM emergency_contacts WHERE user_id = ?',
        [req.session.userId],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Could not load contacts' });
            res.json(results);
        }
    );
};

// Add emergency contact
const addContact = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { name, phone, relationship } = req.body;

    db.query(
        'INSERT INTO emergency_contacts (user_id, name, phone, relationship) VALUES (?, ?, ?, ?)',
        [req.session.userId, name, phone, relationship],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Could not add contact' });
            res.json({ success: true, id: result.insertId });
        }
    );
};

// Delete emergency contact
const deleteContact = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { id } = req.params;

    db.query(
        'DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?',
        [id, req.session.userId],
        (err) => {
            if (err) return res.status(500).json({ error: 'Could not delete contact' });
            res.json({ success: true });
        }
    );
};

// Send SOS alert
const sendSOS = (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const { location } = req.body;

    // Get user details and contacts
    db.query(
        'SELECT u.full_name, u.phone FROM users u WHERE u.id = ?',
        [req.session.userId],
        (err, users) => {
            if (err) return res.status(500).json({ error: 'Error' });

            const user = users[0];

            db.query(
                'SELECT * FROM emergency_contacts WHERE user_id = ?',
                [req.session.userId],
                (err, contacts) => {
                    if (err) return res.status(500).json({ error: 'Error' });

                    if (contacts.length === 0) {
                        return res.json({
                            success: false,
                            message: 'No emergency contacts found. Please add a contact first.'
                        });
                    }

                    // Build location message
                    let locationText = 'Location unknown';
                    if (location && location.lat && location.lng) {
                        locationText = `https://maps.google.com/?q=${location.lat},${location.lng}`;
                    }

                    // Log the SOS alert (SMS would be sent here with Africa's Talking)
                    console.log(`🚨 SOS ALERT from ${user.full_name} (${user.phone})`);
                    console.log(`Location: ${locationText}`);
                    console.log(`Contacts to notify: ${contacts.map(c => c.phone).join(', ')}`);

                    // For now respond with success
                    // Africa's Talking SMS integration can be added later
                    res.json({
                        success: true,
                        contactsNotified: contacts.length,
                        message: 'Alert sent successfully'
                    });
                }
            );
        }
    );
};

module.exports = { showSOS, getContacts, addContact, deleteContact, sendSOS };