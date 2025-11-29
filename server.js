import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import FormData from "form-data";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BACKGROUND = "./background.png";

async function getRobloxName(id) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${id}`);
    const data = await res.json();
    return data.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

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

app.post("/render", async (req, res) => {
  const { donorId, receiverId, amount, webhook } = req.body;

  try {
    const donorName = await getRobloxName(donorId);
    const receiverName = await getRobloxName(receiverId);

    const donorURL = await getHeadshot(donorId);
    const receiverURL = await getHeadshot(receiverId);

    if (!donorURL || !receiverURL) {
      return res.status(500).json({ error: "Unable to load Roblox avatars" });
    }

    const background = await loadImage(BACKGROUND);
    const donorAvatar = await loadImage(donorURL);
    const receiverAvatar = await loadImage(receiverURL);

    const canvas = createCanvas(800, 350);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, 800, 350);

    // Donor
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 175, 80, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(donorAvatar, 70, 95, 160, 160);
    ctx.restore();

    // Receiver
    ctx.save();
    ctx.beginPath();
    ctx.arc(650, 175, 80, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(receiverAvatar, 570, 95, 160, 160);
    ctx.restore();

    // Text
    ctx.font = "38px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(`@${donorName} donated ${amount} to @${receiverName}`, 400, 175);

    ctx.font = "28px Arial";
    ctx.fillText(`@${donorName}`, 150, 300);
    ctx.fillText(`@${receiverName}`, 650, 300);

    const buffer = canvas.toBuffer("image/png");

    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: "" }));
    form.append("file", buffer, { filename: "donation.png", contentType: "image/png" });

    const webhookResp = await fetch(webhook, { method: "POST", body: form, headers: form.getHeaders() });
    if (!webhookResp.ok) {
      return res.status(500).json({ error: "Discord webhook failed", status: webhookResp.status });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.toString() });
  }
});

app.listen(PORT, () => console.log("API running on port", PORT));
