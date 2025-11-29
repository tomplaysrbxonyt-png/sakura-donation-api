import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Background local
const BACKGROUND = "./background.png";

// ----------------------
// GET ROBLOX NAME
// ----------------------
async function getRobloxName(id) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    const data = await res.json();
    return data.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

// ----------------------
// GET ROBLOX AVATAR (HEADSHOT)
// API FIABLE SUR RENDER !
// ----------------------
async function getHeadshot(id) {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
    );
    const data = await res.json();

    if (!data.data || !data.data[0] || !data.data[0].imageUrl) {
      console.error("❌ Headshot introuvable pour id:", id);
      return null;
    }

    return data.data[0].imageUrl;
  } catch (err) {
    console.error("❌ Erreur fetch headshot:", err);
    return null;
  }
}

app.post("/render", async (req, res) => {
  const { donorId, receiverId, amount, webhook } = req.body;

  try {
    console.log("➡️ Requête reçue", req.body);

    const donorName = await getRobloxName(donorId);
    const receiverName = await getRobloxName(receiverId);

    const donorHeadshotURL = await getHeadshot(donorId);
    const receiverHeadshotURL = await getHeadshot(receiverId);

    if (!donorHeadshotURL || !receiverHeadshotURL) {
      console.error("❌ Avatar non chargé !");
      return res.status(500).json({ error: "Unable to load Roblox avatar" });
    }

    // Chargement des images
    const background = await loadImage(BACKGROUND);
    const avatarDonor = await loadImage(donorHeadshotURL);
    const avatarReceiver = await loadImage(receiverHeadshotURL);

    // ---------------------
    // CREATION CANVAS
    // ---------------------
    const canvas = createCanvas(800, 350);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, 800, 350);

    // Donor avatar (cercle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 175, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarDonor, 70, 95, 160, 160);
    ctx.restore();

    // Receiver avatar (cercle)
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
    ctx.fillText(
      `@${donorName} donated ${amount} to @${receiverName}`,
      400,
      170
    );

    // Noms en dessous
    ctx.font = "28px Arial";
    ctx.fillText(`@${donorName}`, 150, 300);
    ctx.fillText(`@${receiverName}`, 650, 300);

    const buffer = canvas.toBuffer("image/png");

    // ----------------------
    // ENVOI À DISCORD (MULTIPART)
    // ----------------------
    const form = new FormData();

    form.append(
      "payload_json",
      JSON.stringify({
        content: "", // Tu peux mettre un texte si tu veux
      })
    );

    form.append("file", buffer, {
      filename: "donation.png",
      contentType: "image/png"
    });

    const webhookResp = await fetch(webhook, {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    });

    if (!webhookResp.ok) {
      console.error("❌ Discord webhook error:", webhookResp.status);
      console.error(await webhookResp.text());
      return res.status(500).json({
        error: "Discord webhook failed",
        status: webhookResp.status
      });
    }

    console.log("✅ Image envoyée à Discord !");
    res.json({ success: true });

  } catch (err) {
    console.error("🔥 ERREUR SERVER :", err);
    res.status(500).json({ error: "Server error", details: err.toString() });
  }
});

// Serveur OK
app.listen(PORT, () => console.log("🚀 API running on port", PORT));

