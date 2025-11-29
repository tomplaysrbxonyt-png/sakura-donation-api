import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKGROUND = "./background.png";

// Fonction pour récupérer le pseudo Roblox
async function getRobloxName(id) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    const data = await res.json();
    return data.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

// Fonction pour récupérer le headshot Roblox
async function getHeadshot(id) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`);
    const data = await res.json();
    return data.data[0].imageUrl;
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

    if (!donorURL || !receiverURL) return res.status(500).json({ error: "Unable to load avatars" });

    const background = await loadImage(BACKGROUND);
    const donorAvatar = await loadImage(donorURL);
    const receiverAvatar = await loadImage(receiverURL);

    // CANVAS
    const canvas = createCanvas(800, 350);
    const ctx = canvas.getContext("2d");

    // Fond
    ctx.drawImage(background, 0, 0, 800, 350);

    // Dégradé derrière le texte principal
    const gradient = ctx.createLinearGradient(0, 150, 800, 200);
    gradient.addColorStop(0, "rgba(108,67,255,0.7)");
    gradient.addColorStop(1, "rgba(255,0,255,0.7)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 140, 800, 70);

    // Avatars avec contour et ombre
    function drawAvatar(x, y, avatar) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, 80, 0, Math.PI * 2);
      ctx.fillStyle = "#000000";
      ctx.fill();
      ctx.clip();
      ctx.drawImage(avatar, x - 80, y - 80, 160, 160);
      ctx.restore();

      // Contour lumineux
      ctx.beginPath();
      ctx.arc(x, y, 80, 0, Math.PI*2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#6C43FF";
      ctx.stroke();
    }

    drawAvatar(150, 175, donorAvatar);
    drawAvatar(650, 175, receiverAvatar);

    // Texte principal
    ctx.font = "bold 36px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 5;
    ctx.fillText(`@${donorName} donated ${amount} to @${receiverName}`, 400, 180);

    // Textes secondaires
    ctx.font = "28px Arial";
    ctx.shadowBlur = 2;
    ctx.fillText(`@${donorName}`, 150, 300);
    ctx.fillText(`@${receiverName}`, 650, 300);

    const buffer = canvas.toBuffer("image/png");

    // Envoi Discord
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "" }));
    form.append("file", buffer, { filename: "donation.png", contentType: "image/png" });

    const webhookResp = await fetch(webhook, { method: "POST", body: form, headers: form.getHeaders() });
    if (!webhookResp.ok) return res.status(500).json({ error: "Discord webhook failed", status: webhookResp.status });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.toString() });
  }
});

app.listen(PORT, () => console.log("API running on port", PORT));
