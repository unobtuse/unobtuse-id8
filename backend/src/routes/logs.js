const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
    const {
        level,
        message,
        details,
        userAgent
    } = req.body;
    const timestamp = new Date().toISOString();

    console.log(`[CLIENT-LOG] [${timestamp}] [${level || 'INFO'}] ${message}`);
    if (details) {
        console.log(`[CLIENT-LOG] Details:`, typeof details === 'object' ? JSON.stringify(details, null, 2) : details);
    }
    if (userAgent) {
        console.log(`[CLIENT-LOG] UserAgent: ${userAgent}`);
    }

    res.json({
        success: true
    });
});

module.exports = router;