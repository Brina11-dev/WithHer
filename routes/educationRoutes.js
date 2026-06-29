const express = require('express');
const router = express.Router();
const https = require('https');

// GET /education
router.get('/', (req, res) => {
    res.render('education');
});

// GET /education/search?query=...
router.get('/search', async (req, res) => {
    const query = req.query.query || '';
    if (!query) return res.json({ results: [] });

    const searchQuery = encodeURIComponent(query + ' reproductive health');
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=5&origin=*`;

    https.get(url, (apiRes) => {
        let rawData = '';
        apiRes.on('data', chunk => rawData += chunk);
        apiRes.on('end', () => {
            try {
                const parsed = JSON.parse(rawData);
                const items = parsed.query?.search || [];

                const results = items.map(item => ({
                    title: item.title,
                    snippet: item.snippet.replace(/<[^>]+>/g, ''), // strip HTML tags
                    link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`
                }));

                res.json({ results });
            } catch (e) {
                res.json({ results: [] });
            }
        });
    }).on('error', () => {
        res.json({ results: [] });
    });
});

// GET /education/recommended
router.get('/recommended', (req, res) => {
    if (!req.session || !req.session.lastSymptoms) {
        return res.json({ keywords: [] });
    }

    // Map symptom keywords to article IDs
    const symptoms = req.session.lastSymptoms.toLowerCase();
    const keywords = [];

    if (symptoms.includes('bleed') || symptoms.includes('period')) keywords.push(2, 5);
    if (symptoms.includes('pelvic') || symptoms.includes('discharge')) keywords.push(3);
    if (symptoms.includes('pregnant') || symptoms.includes('pregnancy')) keywords.push(1, 9);
    if (symptoms.includes('irregular') || symptoms.includes('missed')) keywords.push(5, 8);
    if (symptoms.includes('pain') || symptoms.includes('cramp')) keywords.push(7);
    if (symptoms.includes('sti') || symptoms.includes('infection')) keywords.push(4);

    res.json({ keywords: [...new Set(keywords)] }); // remove duplicates
});

module.exports = router;