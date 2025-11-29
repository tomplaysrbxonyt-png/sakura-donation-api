import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKGROUND = "./background.png";

// Récupération du pseudo Roblox
async function getRobloxName(id) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    const data = await res.json();
    return data.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

// Récupération du headshot Roblox
async function getHeadshot(id) {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
    );
    const data = await res.json();
    return data.data[0].imageUrl;
  } catch {
    return null;
  }
}

// Fonction pour dessiner avatar avec glow pulsant
function drawAvatar(ctx, x, y, avatar, glowColor = "#6C43FF") {
  // Ombre pulsante
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

  // Contour néon
  ctx.beginPath();
  ctx.arc(x, y, 82, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = glowColor;
  ctx.stroke();
}

// Fonction pour texte principal stylé avec outline
function drawMainText(ctx, text, x, y) {
  ctx.font = "bold 46px Arial";
  ctx.textAlign = "center";

  // Outline noir pour lisibilité
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(text, x, y);

  // Texte avec gradient néon
  const gradient = ctx.createLinearGradient(x - 200, y - 20, x + 200, y + 20);
  gradient.addColorStop(0, "#FF00FF");
  gradient.addColorStop(0.5, "#6C43FF");
  gradient.addColorStop(1, "#00FFFF");

  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);
}

app.post("/render", async (req, res) => {
  const { donorId, receiverId, amount, webhook } = req.body;

  try {
    const donorName = await getRobloxName(donorId);
    const receiverName = await getRobloxName(receiverId);

    const donorURL = await getHeadshot(donorId);
    const receiverURL = await getHeadshot(receiverId);

    if (!donorURL || !receiverURL) {
      return res.status(500).json({ error: "Failed to load avatars" });
    }

    const donorAvatar = await loadImage(donorURL);
    const receiverAvatar = await loadImage(receiverURL);
    const background = await loadImage(BACKGROUND);

    const canvas = createCanvas(800, 350);
    const ctx = canvas.getContext("2d");

    // Fond
    ctx.drawImage(background, 0, 0, 800, 350);

    // Cercle derrière texte principal pour effet flare
    ctx.save();
    const circleGradient = ctx.createRadialGradient(400, 175, 10, 400, 175, 180);
    circleGradient.addColorStop(0, "rgba(108,67,255,0.4)");
    circleGradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = circleGradient;
    ctx.beginPath();
    ctx.arc(400, 175, 180, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Avatars avec glow
    drawAvatar(ctx, 150, 175, donorAvatar);
    drawAvatar(ctx, 650, 175, receiverAvatar, "#FF00FF");

    // Texte principal
    drawMainText(ctx, `donated ${amount} to`, 400, 180);

    // Pseudos sous les avatars
    ctx.font = "28px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(`@${donorName}`, 150, 300);
    ctx.fillText(`@${receiverName}`, 650, 300);

    // Buffer PNG
    const buffer = canvas.toBuffer("image/png");

    // Envoi à Discord
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "" }));
    form.append("file", buffer, { filename: "donation.png", contentType: "image/png" });

    const webhookRes = await fetch(webhook, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!webhookRes.ok) {
      return res.status(500).json({ error: "Discord webhook failed", status: webhookRes.status });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Render error:", err);
    res.status(500).json({ error: "Server crashed", details: err.toString() });
  }
});

app.listen(PORT, () => console.log("🚀 Neon Premium API running on port", PORT));
