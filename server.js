import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";
import GIFEncoder from "gifencoder";

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

// Draw avatar with glow
function drawAvatar(ctx, x, y, avatar, glowColor = "#6C43FF") {
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(x, y, 80, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.clip();
  ctx.drawImage(avatar, x - 80, y - 80, 160, 160);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, 82, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = glowColor;
  ctx.stroke();
}

// Draw main text with scale effect
function drawMainText(ctx, text, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = "bold 46px Arial";
  ctx.textAlign = "center";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(text, 0, 0);

  const gradient = ctx.createLinearGradient(-200, -20, 200, 20);
  gradient.addColorStop(0, "#FF00FF");
  gradient.addColorStop(0.5, "#6C43FF");
  gradient.addColorStop(1, "#00FFFF");

  ctx.fillStyle = gradient;
  ctx.fillText(text, 0, 0);
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

    const width = 800;
    const height = 350;

    const encoder = new GIFEncoder(width, height);
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(50); // 20fps
    encoder.setQuality(10);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Animation frames
    for (let i = 0; i < 10; i++) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(background, 0, 0, width, height);

      // Pulsation scale
      const scale = 1 + 0.05 * Math.sin((i / 10) * Math.PI * 2);

      // Flare derrière texte
      ctx.save();
      const circleGradient = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, 180);
      circleGradient.addColorStop(0, "rgba(108,67,255,0.4)");
      circleGradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = circleGradient;
      ctx.beginPath();
      ctx.arc(width/2, height/2, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawAvatar(ctx, 150, 175, donorAvatar);
      drawAvatar(ctx, 650, 175, receiverAvatar, "#FF00FF");

      drawMainText(ctx, `donated ${amount} to`, width/2, 180, scale);

      // Pseudos
      ctx.font = "28px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(`@${donorName}`, 150, 300);
      ctx.fillText(`@${receiverName}`, 650, 300);

      encoder.addFrame(ctx);
    }

    encoder.finish();
    const buffer = encoder.out.getData();

    // Envoi Discord
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "" }));
    form.append("file", buffer, { filename: "donation.gif", contentType: "image/gif" });

    const webhookRes = await fetch(webhook, { method: "POST", body: form, headers: form.getHeaders() });
    if (!webhookRes.ok) return res.status(500).json({ error: "Discord webhook failed", status: webhookRes.status });

    res.json({ success: true });
  } catch (err) {
    console.error("Render error:", err);
    res.status(500).json({ error: "Server crashed", details: err.toString() });
  }
});

app.listen(PORT, () => console.log("🚀 Neon Animated GIF API running on port", PORT));
