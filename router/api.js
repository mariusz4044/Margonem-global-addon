const express = require("express");
const router = express.Router();
const getProfile = require("./getProfile");
const Accounts = require("../database/models/Accounts");
const Players = require("../database/models/Players");
const chat = require("../database/models/Chat");

const crypto = require("crypto");
const path = require("path");
const Chat = require("../database/models/Chat");

const findUser = require("../router/user").findUser;

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const badPasswords = [
  "123456",
  "1234567910",
  "123455",
  "123456789",
  "111111",
  "666666",
  "julkachalwa",
  "chalwa",
];

const tempCodes = {};

router.post("/register", async (req, res) => {
  const { user_id, password, nickname } = req.body;
  let codeStatus = false;
  let isGuest = false;

  if (!user_id || !password || !nickname) {
    return res.json({ error: "Wypełnij wszystkie pola." });
  }

  if (password.length < 6) {
    return res.json({ error: "Hasło musi posiadać minimum 6 znaków." });
  }

  if (password.length > 21) {
    return res.json({ error: "Hasło musi posiadać maksymalnie 21 znaków." });
  }

  if (badPasswords.includes(password)) {
    return res.json({ error: `Hasło "${password}" nie jest bezpieczne (:` });
  }
  const checkUserId = await Accounts.findOne({ userID: user_id });

  if (checkUserId) {
    return res.json({
      error: "Rejestracja odrzucona -  konto jest już zarejestrowane!",
    });
  }

  if (tempCodes[user_id]) {
    const playerProfile = await getProfile(user_id, "orvidia");

    if (!playerProfile) {
      return res.json({
        error: "Nie zmieniaj swojego ID konta!",
      });
    }

    const charsOrvi = Object.values(playerProfile.charList).find(
      (el) => el.world === "orvidia"
    );

    if (!charsOrvi) {
      return res.json({
        error: "Rejestracja odrzucona -  Brak postaci na świecie!",
      });
    }

    if (playerProfile.profile.includes(tempCodes[user_id].code)) {
      codeStatus = playerProfile.charList;
      isGuest = playerProfile.guest;
    }

    if (tempCodes[user_id].time > Date.now() && !codeStatus) {
      return res.json({
        success: "Wstaw poniższy kod na profil:",
        code: tempCodes[user_id].code,
      });
    }
    delete tempCodes[user_id];
  }

  if (!tempCodes[user_id] && !codeStatus) {
    tempCodes[user_id] = {
      code: `tuczemp${makeid(10)}`,
      time: Date.now() + 5 * 60 * 1000,
    };

    return res.json({
      success: "Wstaw poniższy kod na profil:",
      code: tempCodes[user_id].code,
    });
  }

  try {
    const newAcc = await new Accounts({
      userID: user_id,
      nickname: nickname,
      password: crypto.createHash("sha256").update(password).digest("base64"),
      charList: codeStatus,
      session: "",
      guest: isGuest,
      addressIP: req.socket.remoteAddress,
      lastUpdateCharList: Date.now(),
    });

    await newAcc.save();
  } catch (e) {
    console.log(e);
    return res.json({ error: e });
  }

  return res.json({
    success: "Rejestracja konta do dodatków globalnych przebiegła pomyślnie!",
  });
});

router.post("/login", async (req, res) => {
  let { user_id, password } = req.body;

  if (!user_id && !password) {
    return res.json({ error: "Wypełnij wszystkie pola." });
  }

  password = crypto.createHash("sha256").update(password).digest("base64");
  const account = await Accounts.findOne({ userID: user_id, password });

  if (!account) {
    return res.json({ error: "Błędne hasło lub brak konta w systemie." });
  }

  const session = makeid(16);

  try {
    await Accounts.updateOne({ userID: user_id }, { $set: { session } });
  } catch (e) {
    console.log(e);
    return res.json({ error: e });
  }

  return res.json({
    session,
    charList: account.charList,
  });
});

router.post("/getSession", async (req, res) => {
  let { user_id, session } = req.body;

  const user = await findUser(user_id, session);

  if (user.error) {
    return res.json(user);
  }

  const guestChars = await Players.findOne({ guest: user.account.userID });

  for (let i in user.account.charList) {
    delete user.account.charList[i].eq;
  }

  if (!guestChars) {
    return res.json({
      charList: user.account.charList,
      owner: user.account.userID,
    });
  }

  for (let i in guestChars.charList) {
    delete guestChars.charList[i].eq;
  }

  let data = {
    charList: user.account.charList,
    guest: guestChars.charList,
    guestID: guestChars.userID,
    owner: user.account.userID,
  };

  return res.json(data);
});

router.get("/chat", async (req, res) => {
  return res.sendFile(path.join(__dirname, "../assets/logowanie.html"));
});

router.post("/chatLogs", async (req, res) => {
  const commands = ["/gmute", "/lock", "/unlock", "/gmenu"];

  const LasteMessages = await Chat.find({
    visible: true,
    // timestamp: { $gt: Date.now() / 1000 - 24 * 60 * 60 },
  }).sort({ $natural: -1 });

  let lastMsg = [];

  LasteMessages.reverse();
  for (let i in LasteMessages) {
    const msg = LasteMessages[i];

    lastMsg.push(`[${msg.time}] ${msg.nickname}: ${msg.message}`);
  }

  return res.json(lastMsg);
});

module.exports = router;
