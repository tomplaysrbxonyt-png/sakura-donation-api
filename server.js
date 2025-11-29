import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";  // ❗ Ajout de form-data pour le multipart

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKGROUND = "./background.png";

const headshotURL = id =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=150&height=150&format=png`;

async function getName(id) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    const data = await res.json();
    return data.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

app.post("/render", async (req, res) => {
  const { donorId, receiverId, amount, webhook } = req.body;

  try {
    const donorName = await getName(donorId);
    const receiverName = await getName(receiverId);

    const avatarDonor = await loadImage(headshotURL(donorId));
    const avatarReceiver = await loadImage(headshotURL(receiverId));
    const background = await loadImage(BACKGROUND);

    const canvas = createCanvas(800, 350);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, 800, 350);

    // Avatar donateur
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 175, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarDonor, 70, 95, 160, 160);
    ctx.restore();

    // Avatar receveur
    ctx.save();
    ctx.beginPath();
    ctx.arc(650, 175, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarReceiver, 570, 95, 160, 160);
    ctx.restore();

    // Texte principal
    ctx.font = "38px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(`@${donorName} donated ${amount} to @${receiverName}`, 400, 175);

    // Pseudos en dessous
    ctx.font = "28px Arial";
    ctx.fillText(`@${donorName}`, 150, 300);
    ctx.fillText(`@${receiverName}`, 650, 300);

    const buffer = canvas.toBuffer("image/png");

    // Création du formulaire multipart
    const form = new FormData();
    form.append("file", buffer, {
      filename: "donation.png",
      contentType: "image/png"
    });

    // Optionnel : tu peux ajouter un content / embed JSON ici dans payload_json
    const payload = {
      content: "",         // message texte si tu veux
      embeds: [],          // ou des embeds si tu veux
      // tu peux ajouter d'autres champs si besoin
    };
    form.append("payload_json", JSON.stringify(payload));

    // Envoi au webhook
    const resp = await fetch(webhook, {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    });

    if (!resp.ok) {
      console.error("Discord webhook responded:", resp.status, await resp.text());
      return res.status(500).json({ error: "Discord webhook failed", status: resp.status });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error in render:", err);
    res.status(500).json({ error: "Internal error", details: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log("API running on port", PORT);
});
