const express = require('express');
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();

// ====== MULTER (2GB SAFE) ======
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, file.originalname),
  }),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB
  }
});

// ====== ENV ======
const token = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const port = process.env.PORT || 5000;
const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASS || "password";

// ====== TELEGRAM BOT ======
const bot = new TelegramBot(token, { polling: false });

// ====== MIDDLEWARE ======
app.use(session({
  secret: 'super_secret_key_odisha',
  resave: false,
  saveUninitialized: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== STATIC ======
app.use(express.static(path.join(__dirname, 'public')));

// ====== LOGIN ======
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === adminUser && password === adminPass) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false });
});

// ====== UPLOAD (DIRECT → TELEGRAM) ======
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(403).json({ success: false });
  }
  if (!req.file) {
    return res.status(400).json({ success: false });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;

  try {
    const msg = await bot.sendDocument(
      channelId,
      fs.createReadStream(filePath),
      {},
      { filename: originalName }
    );

    fs.unlinkSync(filePath);

    const fileId = msg.document.file_id;
    const safeName = encodeURIComponent(originalName);

    // IMPORTANT: proxy sirf redirect karega
    const link = `${req.protocol}://${req.get('host')}/dl/${fileId}/${safeName}`;

    res.json({ success: true, link });

  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success: false });
  }
});

// ====== DOWNLOAD (DIRECT TELEGRAM CDN) ======
app.get('/dl/:file_id/:filename', async (req, res) => {
  try {
    const file = await bot.getFile(req.params.file_id);
    const tgUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // PROXY BYPASS — direct redirect
    res.redirect(tgUrl);
  } catch (e) {
    res.status(500).send("Download failed");
  }
});

// ====== START ======
app.listen(port, () => {
  console.log("Server running on port", port);
});
