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

// --- URL CLEANER (Smart Fix for 404) ---
// Agar user ne galti se last mein '/' laga diya hai, toh ye use hata dega
let rawApiUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
const telegramApiUrl = rawApiUrl.replace(/\/$/, ""); 

// Bot Setup
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

// --- PATH FIX ---
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
        res.status(500).json({ success: false, message: "Upload Failed: " + error.message });
    }
});

// --- NEW & IMPROVED DOWNLOAD LOGIC ---
app.get('/dl/:file_id/:filename', async (req, res) => {
    try {
        const fileId = req.params.file_id;
        const filename = decodeURIComponent(req.params.filename);

        // Step 1: File ka asli path mangwao
        const file = await bot.getFile(fileId);
        
        // Step 2: URL khud banao (Library par bharosa mat karo)
        // Ye Local Server aur Cloud dono ke liye kaam karega
        const fileLink = `${telegramApiUrl}/file/bot${token}/${file.file_path}`;

        console.log("Trying to download from:", fileLink); // Logs mein dikhega agar fail hua

        const response = await axios({
            url: fileLink,
            method: 'GET',
            responseType: 'stream'
        });

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        
        response.data.pipe(res);
    } catch (error) {
        console.error("Download Error Details:", error.message);
        if (error.response) {
            console.error("Server Responded With:", error.response.status);
            if(error.response.status === 404) {
                 return res.status(404).send("File Not Found on Local Server. (Try re-uploading)");
            }
        }
        res.status(500).send("Download Failed. Check Logs.");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
