const express = require("express");
const multer = require("multer");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const app = express();

/* ================= UPLOAD (2GB) ================= */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

/* ================= ENV ================= */
const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_SESSION);
const channelId = process.env.CHANNEL_ID;
const port = process.env.PORT || 5000;

/* ================= TELEGRAM USER CLIENT ================= */
const tg = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5
});

(async () => {
  await tg.connect();
  console.log("Telegram USER connected");
})();

/* ================= EXPRESS ================= */
app.use(express.json({ limit: "2gb" }));
app.use(express.urlencoded({ extended: true, limit: "2gb" }));

app.use(session({
  secret: "odisha-secret",
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, "public")));

/* ================= UPLOAD ================= */
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });

  try {
    const result = await tg.sendFile(channelId, {
      file: req.file.path,
      caption: req.file.originalname
    });

    fs.unlinkSync(req.file.path);

    const msgId = result.id;
    const link = `${req.protocol}://${req.get("host")}/dl/${msgId}`;

    res.json({ success: true, link });

  } catch (e) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ================= DOWNLOAD ================= */
app.get("/dl/:msgId", async (req, res) => {
  try {
    const msg = await tg.getMessages(channelId, { ids: Number(req.params.msgId) });
    const file = msg[0].media.document;
    const url = await tg.getFileLink(file);
    res.redirect(url);
  } catch (e) {
    res.status(500).send("Download failed");
  }
});

/* ================= START ================= */
app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port", port);
});
