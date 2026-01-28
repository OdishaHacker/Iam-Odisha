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

// Local Server hat gaya, toh ab hum Official Telegram API use karenge
// (Max 50MB File Size)
const bot = new TelegramBot(token, { polling: false });

app.use(session({
    secret: 'super_secret_key_odisha',
    resave: false,
    saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SMART PATH FIX (Ye website ko chalne mein madad karega) ---
// Ye check karega ki index.html 'public' folder mein hai ya bahar
const publicPath = path.join(__dirname, 'public');
const rootPath = __dirname;

if (fs.existsSync(path.join(publicPath, 'index.html'))) {
    app.use(express.static(publicPath));
} else {
    app.use(express.static(rootPath));
}

app.get('/', (req, res) => {
    let htmlFile = path.join(publicPath, 'index.html');
    if (!fs.existsSync(htmlFile)) {
        htmlFile = path.join(rootPath, 'index.html');
    }
    res.sendFile(htmlFile);
});

// --- API ROUTES ---

// 1. Login Logic
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

// 2. Upload Logic
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
        const safeName = encodeURIComponent(originalName);
        const downloadLink = `${req.protocol}://${req.get('host')}/dl/${fileId}/${safeName}`;

        res.json({ success: true, link: downloadLink });

    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error("Upload Error:", error.message);
        res.status(500).json({ success: false, message: "Upload Failed (File > 50MB requires Local Server)" });
    }
});

// 3. Download Logic
app.get('/dl/:file_id/:filename', async (req, res) => {
    try {
        const fileId = req.params.file_id;
        const filename = decodeURIComponent(req.params.filename);

        const fileLink = await bot.getFileLink(fileId);
        
        const response = await axios({
            url: fileLink,
            method: 'GET',
            responseType: 'stream'
        });

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        
        response.data.pipe(res);
    } catch (error) {
        res.status(404).send("File too big for direct download or Link Expired.");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
