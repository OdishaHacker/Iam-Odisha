const express = require('express');
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// ================= ENV =================
const token = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const port = process.env.PORT || 5000;
const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASS || "password";

// ================= LOCAL BOT API SERVER CONFIG =================
// 'tg-server' wahi naam hai jo aapne Coolify application settings mein rakha hai
const bot = new TelegramBot(token, { 
    polling: false,
    baseApiUrl: "http://tg-server:8081" 
});

// ================= MIDDLEWARE =================
app.use(session({
    secret: 'super_secret_key_odisha',
    resave: false,
    saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= STATIC =================
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

// ================= AUTH =================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminUser && password === adminPass) {
        req.session.loggedIn = true;
        return res.json({ success: true });
    }
    res.json({ success: false, message: "Invalid Credentials" });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ loggedIn: req.session.loggedIn || false });
});

// ================= UPLOAD (50MB+ Supported Now) =================
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    try {
        const msg = await bot.sendDocument(
            channelId,
            fs.createReadStream(filePath),
            {},
            {
                filename: originalName,
                contentType: req.file.mimetype
            }
        );

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        const fileId = msg.document.file_id;
        const safeName = encodeURIComponent(originalName);

        const downloadLink =
            `${req.protocol}://${req.get('host')}/dl/${fileId}/${safeName}`;

        res.json({
            success: true,
            link: downloadLink
        });

    } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error("Upload Error Details:", err);
        res.status(500).json({ success: false, message: "Upload failed: " + err.message });
    }
});

// ================= DOWNLOAD (LOCAL SERVER UPDATED) =================
app.get('/dl/:file_id/:filename', async (req, res) => {
    try {
        const fileId = req.params.file_id;
        const file = await bot.getFile(fileId);

        // Jab Local Server use karte hain, toh file_path seedha system path hota hai
        // Isliye humein local server ke base URL se file download karni hogi
        const localDownloadUrl = `http://tg-server:8081/file/bot${token}/${file.file_path}`;

        return res.redirect(localDownloadUrl);

    } catch (err) {
        console.error("Download Error:", err);
        res.status(500).send("Download failed");
    }
});

// ================= START =================
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
