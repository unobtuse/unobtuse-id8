const express = require('express');
const router = express.Router();
const ogs = require('open-graph-scraper');

router.get('/', async (req, res) => {
    const {
        url
    } = req.query;

    if (!url) {
        return res.status(400).json({
            error: 'URL is required'
        });
    }

    try {
        const {
            result
        } = await ogs({
            url
        });

        // Extract relevant fields
        const data = {
            title: result.ogTitle || result.twitterTitle || result.dcTitle || null,
            description: result.ogDescription || result.twitterDescription || result.dcDescription || null,
            image: (result.ogImage && result.ogImage[0] && result.ogImage[0].url) || (result.twitterImage && result.twitterImage[0] && result.twitterImage[0].url) || null,
            url: result.ogUrl || url,
            siteName: result.ogSiteName || null,
        };

        res.json(data);
    } catch (error) {
        console.error('OG fetch error:', error);
        res.status(500).json({
            error: 'Failed to fetch OG data'
        });
    }
});

module.exports = router;