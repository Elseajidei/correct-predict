
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.FOOTBALL_API_KEY;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "CORRECT PREDICT API"
  });
});

app.get("/fixtures", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "Football API key is not configured"
      });
    }

    const date = req.query.date ||
      new Date().toISOString().slice(0, 10);

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${date}`,
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Football provider request failed"
      });
    }

    res.json({
      count: data.results || 0,
      fixtures: data.response || []
    });

  } catch (error) {
    res.status(500).json({
      error: "Unable to retrieve football fixtures"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CORRECT PREDICT API running on ${PORT}`);
});
