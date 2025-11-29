import express from "express";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Background
const BACKGROUND = "./background.png";

// Roblox headshot URL
const headshotURL = (id) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=150&height=150&format=png`;

// Fetch Roblox name
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

    // Donor avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 175, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarDonor, 70, 95, 160, 160);
    ctx.restore();

    // Receiver avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(650, 175, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarReceiver, 570, 95, 160, 160);
    ctx.restore();

    // Main text
    ctx.font = "38px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(
      `@${donorName} donated ${amount} to @${receiverName}`,
      400,
      175
    );

    // Usernames
    ctx.font = "28px Arial";
    ctx.fillText(`@${donorName}`, 150, 300);
    ctx.fillText(`@${receiverName}`, 650, 300);

    const buffer = canvas.toBuffer("image/png");

    // Send to webhook
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "",
        embeds: [],
        files: [
          {
            name: "donation.png",
            attachment: buffer.toString("base64")
          }
        ]
      })
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error rendering image." });
  }
});

app.listen(PORT, () => console.log("API running"));
