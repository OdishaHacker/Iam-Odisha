const express = require('express');
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Environment Variables
const token = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const port = process.env.PORT || 5000;
const adminUser = process.env.ADMIN_USER || "admin"; 
const adminPass = process.env.ADMIN_PASS || "password"; 

// --- MAGIC FIX FOR BIG FILES (Local Server URL) ---
// Agar aapne Local Server setup kiya hai toh ye URL use hoga, nahi toh default
const telegramApiUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';

const bot = new TelegramBot(token, { 
    polling: false, 
    baseApiUrl: telegramApiUrl 
});

app.use(session({
    secret: 'super_secret_key_odisha',
    resave: false,
    saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- API ROUTES ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminUser && password === adminPass) {
        req.session.loggedIn = true;
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid Credentials" });
    }
});

app.get('/api/check-auth', (req, res) => {
    res.json({ loggedIn: req.session.loggedIn || false });
});

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.session.loggedIn) return res.status(403).json({ success: false, message: "Unauthorized" });
    
    // Fix: "Error: undefined" na aaye, isliye check
    if (!req.file) return res.status(400).json({ success: false, message: 'File too large or upload failed.' });

    const filePath = req.file.path;
    const originalName = req.file.originalname; // Isme extension (apk, jpg) hota hai

    try {
        // File bhejna
        const msg = await bot.sendDocument(channelId, fs.createReadStream(filePath), {}, {
            filename: originalName, // Ye naam Telegram par dikhega
            contentType: req.file.mimetype
        });

        fs.unlinkSync(filePath); 

        const fileId = msg.document.file_id;
        // URL encode taaki spaces ya special chars issue na karein
        const safeName = encodeURIComponent(originalName);
        const downloadLink = `${req.protocol}://${req.get('host')}/dl/${fileId}/${safeName}`;

        res.json({ success: true, link: downloadLink });

    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        // Fix: Error message ab frontend ko sahi se milega
        res.status(500).json({ success: false, message: error.message || "Upload Failed to Telegram" });
    }
});

app.get('/dl/:file_id/:filename', async (req, res) => {
    try {
        const fileId = req.params.file_id;
        // Filename decode karna
        const filename = decodeURIComponent(req.params.filename);

        const fileLink = await bot.getFileLink(fileId);
        
        const response = await axios({
            url: fileLink,
            method: 'GET',
            responseType: 'stream'
        });

        // --- FILENAME FIX ---
        // Ye browser ko batata hai ki file ka asli naam aur extension kya hai
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', response.headers['content-type']);
        
        response.data.pipe(res);
    } catch (error) {
        console.error(error);
        res.status(404).send(`
            <h2>Download Failed</h2>
            <p>Reason: ${error.message}</p>
            <p><b>Solution:</b> If file is >20MB, you MUST setup Local Telegram Server.</p>
        `);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
});

// --- API ROUTES ---

// 1. Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminUser && password === adminPass) {
        req.session.loggedIn = true;
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid Credentials" });
    }
});

// 2. Check Auth
app.get('/api/check-auth', (req, res) => {
    res.json({ loggedIn: req.session.loggedIn || false });
});

// 3. Upload Route
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.session.loggedIn) return res.status(403).json({ success: false, message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    try {
        const msg = await bot.sendDocument(channelId, fs.createReadStream(filePath), {}, {
            filename: originalName,
            contentType: req.file.mimetype
        });

        fs.unlinkSync(filePath); 

        const fileId = msg.document.file_id;
        const downloadLink = `${req.protocol}://${req.get('host')}/dl/${fileId}/${originalName}`;

        res.json({ success: true, link: downloadLink });

    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Download Proxy
app.get('/dl/:file_id/:filename', async (req, res) => {
    try {
        const fileId = req.params.file_id;
        const fileLink = await bot.getFileLink(fileId);
        
        const response = await axios({
            url: fileLink,
            method: 'GET',
            responseType: 'stream'
        });

        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        response.data.pipe(res);
    } catch (error) {
        res.status(404).send("File not found or expired.");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
