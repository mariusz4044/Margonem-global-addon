const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bodyParser = require("body-parser");
const path = require("path");
const rateLimit = require("express-rate-limit");
const api = require("./router/api");

require("dotenv").config();
require("./database/connect-db");

const limiter = rateLimit({
  windowMs: 1000,
  max: 1,
  message: `Odczekaj chwilę przed kolejną próbą.`,
});

const sockets = require("./socket/socket");

const app = express();
const server = require("http").createServer(app);

app.use(bodyParser.json({ limit: "5mb" }));
app.use(cors({ origin: "https://orvidia.margonem.pl", credentials: true }));

sockets.socketEngine(server);

app.use("/", limiter);

app.use("/", function (req, res, next) {
  if (
    (!req.body.session || !req.body.user_id) &&
    req.originalUrl.includes("getSession")
  ) {
    return res.json({ error: `Brak wymaganych danych dla ${req.originalUrl}` });
  }

  next();
});

app.use("/api", api);

app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "./assets/404.html"));
});

app.post("/", async (req, res) => {
  const ip = req.socket.remoteAddress;

  res.json({
    error: `Twoje działania zostały zgłoszone do administratora dodatków globalnych.`,
    browser: req.headers["user-agent"],
    ip,
  });
});

const port = process.env.PORT || 8080;

server.listen(port, () => {
  console.log(`http://localhost:${port}/`);
});
