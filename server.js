import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKGROUND = "./background.png";

// Récupère le pseudo Roblox
async function getRobloxName(id) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`
    const data = await res.json();
    return data.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

// Récupère un headshot Roblox fiable
async function getHeadshot(id) {
  try {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`;
    const res = await fetch(url);
    const data = await res.json();
    return data.data[0].
  } catch {
    return null;
  }
}

app.post("/render", async (req, res) => {
  const { donorId, receiverId, amount, webhook } = req.body;

  try {
    const donorName = await getRobloxName(donorId);
    const receiverName = await getRobloxName(receiverId);

    const donorURL = await getHeadshot(donorId);
    const receiverURL = await getHeadshot(receiverId);

    if (!donorURL || !receiverURL) {
      return res.status(500).json({ error: "Failed to load headshots" });
    }

    const donorAvatar = await loadImage(donorURL);
    const receiverAvatar = await loadImage(receiverURL);
    const background = await loadImage(BACKGROUND);

    const canvas = createCanvas(800, 350);
    const ctx = canvas.getContext("2d");

    // Arrière-plan
    ctx.drawImage(background, 0, 0, 800, 350);

    // Dégradé néon derrière le texte principal
    const gradient = ctx.createLinearGradient(0, 150, 800, 200);
    gradient.addColorStop(0, "rgba(108,67,255,0.6)");
    gradient.addColorStop(1, "rgba(255,0,255,0.6)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 140, 800, 70);

    // Fonction d’affichage avatar stylé
    function drawAvatar(x, y, avatar) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.arc(x, y, 80, 0, Math.PI * 2);
      ctx.fillStyle = "#000000";
      ctx.fill();
      ctx.clip();

      ctx.drawImage(avatar, x - 80, y - 80, 160, 160);

      ctx.restore();

      // Glow violet
      ctx.beginPath();
      ctx.arc(x, y, 82, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#6C43FF";
      ctx.stroke();
    }

    drawAvatar(150, 175, donorAvatar);
    drawAvatar(650, 175, receiverAvatar);

    // Texte principal stylé sans pseudo
    ctx.font = "bold 44px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 8;
    ctx.fillText(`donated ${amount} to`, 400, 187);

    // Textes des pseudos
    ctx.font = "28px Arial";
    ctx.shadowBlur = 3;
    ctx.fillStyle = "white";
    ctx.fillText(`@${donorName}`, 150, 300);
    ctx.fillText(`@${receiverName}`, 650, 300);

    // Conversion en PNG
    const buffer = canvas.toBuffer("image/png");

    // Envoi Discord via FormData
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "" }));
    form.append("file", buffer, {
      filename: "donation.png",
      contentType: "image/png",
    });

    const webhookRes = await fetch(webhook, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!webhookRes.ok) {
      return res.status(500).json({
        error: "Webhook failed",
        status: webhookRes.status,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Render error:", err);
    res.status(500).json({ error: "Serv
});

app.listen(PORT, () => console.log("🔥 Stylized API running on port", PORT));

