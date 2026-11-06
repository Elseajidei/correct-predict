
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "games.json");

let games = [];

if (fs.existsSync(DATA_FILE)) {
  try {
    games = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    games = [];
  }
}

function saveGames() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2));
}

const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
const SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_PASS || !SECRET) {
  console.error("ADMIN_PASSWORD and ADMIN_SECRET are required.");
  process.exit(1);
}

// Create secure session tokens
function createToken(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    expires: Date.now() + 12 * 60 * 60 * 1000
  })).toString("base64url");

  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");

  return payload + "." + signature;
}

// Verify administrator
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const parts = token.split(".");

  if (parts.length !== 2) {
    return res.status(401).json({ message: "Login required" });
  }

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(parts[0])
    .digest();

  let supplied;

  try {
    supplied = Buffer.from(parts[1], "base64url");
  } catch {
    return res.status(401).json({ message: "Invalid login" });
  }

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    return res.status(401).json({ message: "Invalid login" });
  }

  try {
    const data = JSON.parse(
      Buffer.from(parts[0], "base64url").toString()
    );

    if (
      data.username !== ADMIN_USER ||
      data.expires < Date.now()
    ) {
      return res.status(401).json({ message: "Session expired" });
    }

    next();
  } catch {
    return res.status(401).json({ message: "Invalid session" });
  }
}

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({
      message: "Incorrect username or password"
    });
  }

  res.json({
    message: "Login successful",
    token: createToken(username)
  });
});

// Add one game manually
app.post("/api/admin/games", requireAdmin, (req, res) => {
  const { homeTeam, awayTeam, league, date, time } = req.body;

  if (!homeTeam || !awayTeam) {
    return res.status(400).json({
      message: "Both teams are required"
    });
  }

  const game = {
    id: crypto.randomUUID(),
    homeTeam,
    awayTeam,
    league: league || "Unknown League",
    date: date || "",
    time: time || "",
    status: "pending",
    prediction: null,
    correctScore: null,
    overUnder: null,
    btts: null
  };

  games.push(game);
  saveGames();

  res.json({ message: "Game saved", game });
});

// Upload multiple converted games
app.post("/api/admin/games/bulk", requireAdmin, (req, res) => {
  const uploaded = req.body.games;

  if (!Array.isArray(uploaded) || uploaded.length === 0) {
    return res.status(400).json({
      message: "No valid games supplied"
    });
  }

  const added = uploaded
    .filter(g => g.homeTeam && g.awayTeam)
    .map(g => ({
      id: crypto.randomUUID(),
      homeTeam: String(g.homeTeam),
      awayTeam: String(g.awayTeam),
      league: String(g.league || "Unknown League"),
      date: String(g.date || ""),
      time: String(g.time || ""),
      status: "pending",
      prediction: null,
      correctScore: null,
      overUnder: null,
      btts: null
    }));

  games.push(...added);
  saveGames();

  res.json({
    message: added.length + " games saved successfully",
    count: added.length
  });
});

// View all admin games
app.get("/api/admin/games", requireAdmin, (req, res) => {
  res.json({ games });
});

// Delete a game
app.delete("/api/admin/games/:id", requireAdmin, (req, res) => {
  const oldLength = games.length;

  games = games.filter(g => g.id !== req.params.id);

  if (games.length === oldLength) {
    return res.status(404).json({ message: "Game not found" });
  }

  saveGames();
  res.json({ message: "Game deleted" });
});

// Approve a game for publishing
app.post("/api/admin/games/:id/approve", requireAdmin, (req, res) => {
  const game = games.find(g => g.id === req.params.id);

  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }

  game.status = "approved";
  saveGames();

  res.json({ message: "Game approved" });
});

// Prediction engine connection
app.post("/api/admin/predict", requireAdmin, (req, res) => {
  res.status(501).json({
    message: "Fixture storage is ready. The real football statistics and prediction engine must be connected before predictions can be generated."
  });
});

// Publish approved games only
app.post("/api/admin/publish", requireAdmin, (req, res) => {
  const approved = games.filter(g => g.status === "approved");

  approved.forEach(g => {
    g.status = "published";
  });

  saveGames();

  res.json({
    message: approved.length + " approved games published"
  });
});

// Customer predictions
app.get("/api/public/predictions", (req, res) => {
  const published = games.filter(g => g.status === "published");

  res.json({ games: published });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "online", service: "CORRECT PREDICT" });
});

// Website home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("CORRECT PREDICT running on port " + PORT);
});
