import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKGROUND = "./background.png";

// Roblox helpers
async function getRobloxName(id) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    const data = await res.json();
    return data.name || "Unknown";
  } catch { return "Unknown"; }
}

async function getHeadshot(id) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`);
    const data = await res.json();
    return data.data[0].imageUrl;
  } catch { return null; }
}

// Dessine avatar avec glow
function drawAvatar(ctx, x, y, avatar, glowColor = "#6C43FF") {
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(x, y, 80, 0, Math.PI*2);
  ctx.clip();
  ctx.drawImage(avatar, x - 80, y - 80, 160, 160);
  ctx.restore();

  // Contour néon
  ctx.beginPath();
  ctx.arc(x, y, 82, 0, Math.PI*2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = glowColor;
  ctx.stroke();
}

// Texte principal stylé
function drawMainText(ctx, text, x, y) {
  ctx.save();
  ctx.font = "bold 42px Arial";
  ctx.textAlign = "center";

  // Outline pour lisibilité
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(text, x, y);

  // Gradient néon
  const gradient = ctx.createLinearGradient(x-200, y-10, x+200, y+10);
  gradient.addColorStop(0, "#FF00FF");
  gradient.addColorStop(0.5, "#6C43FF");
  gradient.addColorStop(1, "#00FFFF");
  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);
  ctx.restore();
}

app.post("/render", async (req, res) => {
  const { donorId, receiverId, amount, webhook } = req.body;

  try {
    const donorName = await getRobloxName(donorId);
    const receiverName = await getRobloxName(receiverId);

    const donorURL = await getHeadshot(donorId);
    const receiverURL = await getHeadshot(receiverId);
    if(!donorURL || !receiverURL) return res.status(500).json({ error: "Failed to load avatars" });

    const donorAvatar = await loadImage(donorURL);
    const receiverAvatar = await loadImage(receiverURL);
    const background = await loadImage(BACKGROUND);

    const width = 800, height = 350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.drawImage(background, 0, 0, width, height);

    // Bandeau léger derrière texte principal (translucide)
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(150, 130, 500, 50);

    // Texte principal centré au-dessus des avatars
    drawMainText(ctx, `donated ${amount} to`, width/2, 165);

    // Avatars avec glow
    drawAvatar(ctx, 150, 250, donorAvatar, "#6C43FF");
    drawAvatar(ctx, 650, 250, receiverAvatar, "#FF00FF");

    // Pseudos sous les avatars
    ctx.font = "28px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(`@${donorName}`, 150, 350);
    ctx.fillText(`@${receiverName}`, 650, 350);

    // Buffer PNG
    const buffer = canvas.toBuffer("image/png");

    // Envoi Discord
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "" }));
    form.append("file", buffer, { filename: "donation.png", contentType: "image/png" });

    const webhookRes = await fetch(webhook, { method: "POST", body: form, headers: form.getHeaders() });
    if(!webhookRes.ok) return res.status(500).json({ error: "Discord webhook failed", status: webhookRes.status });

    res.json({ success: true });
  } catch(err) {
    console.error("Render error:", err);
    res.status(500).json({ error: "Server crashed", details: err.toString() });
  }
});

app.listen(PORT, () => console.log("🚀 Clean donation API running on port", PORT));



