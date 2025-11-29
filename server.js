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

// Draw avatar with neon glow
function drawAvatar(ctx, x, y, radius, avatar, glowColor = "#6C43FF") {
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatar, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();

  // Neon outline
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = glowColor;
  ctx.stroke();
}

// Draw main text with neon gradient and outline
function drawMainText(ctx, text, x, y, canvasWidth) {
  ctx.save();
  ctx.font = `bold ${Math.floor(canvasWidth * 0.05)}px Arial`;
  ctx.textAlign = "center";

  // Outline
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(text, x, y);

  // Gradient neon
  const gradient = ctx.createLinearGradient(x - canvasWidth * 0.25, y - 10, x + canvasWidth * 0.25, y + 10);
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
    if (!donorURL || !receiverURL) return res.status(500).json({ error: "Failed to load avatars" });

    const donorAvatar = await loadImage(donorURL);
    const receiverAvatar = await loadImage(receiverURL);
    const background = await loadImage(BACKGROUND);

    const width = background.width;
    const height = background.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.drawImage(background, 0, 0, width, height);

    // Proportional positions
    const donorX = width * 0.1875; // 150/800
    const donorY = height * 0.714; // 250/350
    const receiverX = width * 0.8125; // 650/800
    const receiverY = donorY;

    const mainTextY = height * 0.47; // 165/350
    const donorTextY = height * 0.95; // sous avatars
    const receiverTextY = donorTextY;

    const bannerX = width * 0.1875;
    const bannerY = height * 0.371;
    const bannerWidth = width * 0.625;
    const bannerHeight = height * 0.143;

    const avatarRadius = Math.floor(width * 0.1); // proportionnel

    // Bandeau derrière texte (translucide)
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight);

    // Texte principal
    drawMainText(ctx, `donated ${amount} to`, width / 2, mainTextY, width);

    // Avatars
    drawAvatar(ctx, donorX, donorY, avatarRadius, donorAvatar, "#6C43FF");
    drawAvatar(ctx, receiverX, receiverY, avatarRadius, receiverAvatar, "#FF00FF");

    // Pseudos sous avatars
    ctx.font = `${Math.floor(width * 0.035)}px Arial`;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(`@${donorName}`, donorX, donorTextY);
    ctx.fillText(`@${receiverName}`, receiverX, receiverTextY);

    // Convert to PNG
    const buffer = canvas.toBuffer("image/png");

    // Send to Discord
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "" }));
    form.append("file", buffer, { filename: "donation.png", contentType: "image/png" });

    const webhookRes = await fetch(webhook, { method: "POST", body: form, headers: form.getHeaders() });
    if (!webhookRes.ok) return res.status(500).json({ error: "Discord webhook failed", status: webhookRes.status });

    res.json({ success: true });
  } catch (err) {
    console.error("Render error:", err);
    res.status(500).json({ error: "Server crashed", details: err.toString() });
  }
});

app.listen(PORT, () => console.log("🚀 Clean proportional donation API running on port", PORT));





