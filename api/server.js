
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_FOOTBALL_KEY;

app.get("/", (req, res) => {
  res.json({
    status: "CORRECT PREDICT API is running"
  });
});

app.get("/fixtures", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "API key is missing"
      });
    }

    const response = await axios.get(
      "https://v3.football.api-sports.io/fixtures",
      {
        params: {
          date: new Date().toISOString().slice(0, 10)
        },
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Unable to fetch football fixtures"
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`CORRECT PREDICT API running on ${PORT}`);
});
