const Chat = require("../database/models/Chat");
const Accounts = require("../database/models/Accounts");
const Players = require("../database/models/Players");
const Battle = require("../database/models/Battle");

const crypto = require("crypto");
const getProfile = require("./getProfile");

const findUser = require("../router/user").findUser;

const getRanking = require("../router/getRanking").getRanking;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const chatOptions = {
  block: false,
  blockAllow: ["System"],
  slowmode: false,
};

const cenzure = [
  /k(u|ó){1,}r{1,}(v|w){1,}a{1,}/gi,
  /bit(h|ch)/gi,
  /wtf/gi,
  /(ch|h)wdp/gi,
  /(|o)cip/gi,
  /(|o)(ch|h)(u|ó)j(|a)/gi,
  /(|do|na|po|do|prze|przy|roz|u|w|wy|za|z|matko)jeb(|a|c|i|n|y)/gi,
  /(|do|na|naw|od|pod|po|prze|przy|roz|spie|roz|poroz|s|u|w|za|wy)pierd(a|o|u)/gi,
  /fuck/gi,
  /(|po|s|w|za)(ku|q)r(w|ew|e|w)(i|y|a|s|o)*/gi,
  /k(ó|u)tas/gi,
  /(|po|wy)rucha/gi,
  /motherfucker/gi,
  /piczk/gi,
  /(|w)pi(z|ź)d/gi,
  /ciot./gi,
  /cwel.?/gi,
];

let lastUpdateProfiles = 0;
let ranking = null;

let isUpdate = false;

updatePlayers = async (id) => {
  let profile = await getProfile(id, "orvidia");
  if (!profile) return;

  const isUser = await Players.findOne({ userID: id });

  if (isUser) {
    await Players.updateMany(
      { userID: id },
      {
        $set: {
          userID: +id,
          nickname: profile.nickname,
          guest: profile.guest,
          charList: profile.charList,
          clan: profile.clan,
          charsID: profile.charString,
          chars: Object.keys(profile.charList).join("|"),
        },
      }
    );

    return;
  }

  try {
    const newPlayer = await new Players({
      userID: +id,
      nickname: profile.nickname,
      guest: profile.guest,
      charList: profile.charList,
      clan: profile.clan,
      charsID: profile.charString,
      chars: Object.keys(profile.charList).join("|"),
    });

    await newPlayer.save();
  } catch (e) {
    console.log(e);
    return { error: e };
  }
};

updateRanking = async () => {
  if (lastUpdateProfiles > Date.now()) return;
  if (isUpdate) return;

  if (ranking === null) {
    isUpdate = true;
    ranking = await getRanking("orvidia");
    ranking = ranking.profiles;
  }

  if (!ranking) {
    isUpdate = false;
    return;
  }

  let pro = {};
  isUpdate = true;

  let time = Date.now();

  let index = 0;
  let profileList = [];

  for (let i in ranking) {
    let userID = ranking[i];
    if (profileList.includes(userID) || !ranking[i]) continue;

    updatePlayers(ranking[i]);
    profileList.push(userID);

    if (index % 10 === 0) await sleep(1000);
    index++;
  }

  console.log(`Pobrano ${profileList.length} profili w ${Date.now() - time}ms`);

  isUpdate = false;
  ranking = null;
  lastUpdateProfiles = Date.now() + 4 * 60 * 60 * 1000;
};

async function updateCharList(session, user_id, socket) {
  try {
    const user = await findUser(user_id, session);

    if (user.error) {
      return user;
    }

    if (user.account.lastUpdateCharList < Date.now()) {
      const res = await getProfile(user.account.userID, "orvidia");
      if (!res) {
        return socket.emit("info", {
          error: "Nie udało się zaktualizować postaci.",
        });
      }

      const dbSave = await Accounts.updateMany(
        { userID: user.account.userID },
        {
          $set: {
            lastUpdateCharList: Date.now() + 4 * 60 * 60 * 1000,
            charList: res.charList,
          },
        }
      );
      console.log(
        `Zaktualizowano pomyślnie postaci gracza ${user.account.nickname}.`
      );
    }

    return { success: "Zaktualizowano postacie pomyślnie." };
  } catch (e) {
    return socket.emit("info", {
      error: "Wystąpił błąd podczas wczytywania danych na socket." + e,
    });
  }
}

async function newMessage(data) {
  let { nickname, message, ipaddr, user_id, session } = data;

  if (!nickname || !message || !user_id || !session) {
    return {
      error: `Wysłane dane nie sa zgodnie z formularzem!`,
    };
  }

  if (message.length > 300) {
    return {
      error: `Maksymalna ilość znaków to 300! Twoja wiadomość "${message}" (możesz skopiować).`,
    };
  }

  const user = await findUser(user_id, session);

  if (user.error) {
    return user;
  }

  if (
    chatOptions.block &&
    !chatOptions.blockAllow.includes(nickname) &&
    user.account.rang !== "admin"
  ) {
    return {
      error: `Chat jest aktualnie zablokowany!`,
    };
  }

  if (!user.account.charList[nickname] && !user.guest?.charList[nickname]) {
    return {
      error: `Niestety z powodu wykrycia nowej postaci, nie możesz udzielać się na chacie globalnym.
      <br><br>
      Wkrótce Twoje dane konta w dodatku globalnym zostaną zaktualizowane! (maksymalnie 4h).`,
    };
  }

  if (user.account.chatMute > Date.now()) {
    return {
      error: `Jesteś wyciszony na dodatkach globalnych do ${new Date(
        user.account.chatMute
      ).toLocaleString()}!`,
    };
  }

  let permission = 0;
  if (user.guest?.charList[nickname].rang === "SM") permission = 4;
  if (user.guest?.charList[nickname].rang === "MC") permission = 32;

  cenzure.forEach((el) => {
    message = message.replaceAll(el, "kruci");
  });

  try {
    const newMsg = await new Chat({
      userID: user_id,
      nickname: nickname,
      message: message,
      guest: user.guest ? 1 : 0,
      addressIP: ipaddr,
      permission: permission,
      timestamp: Date.now() / 1000,
      time: new Date().toLocaleString(),
    });

    await newMsg.save();
  } catch (e) {
    console.log(e);
    return { error: e };
  }

  return {
    success: `Pomyślnie napisano wiadomość!`,
    message: {
      k: 4,
      n: nickname,
      t: message,
      ts: Date.now() / 1000,
      created_id: user_id,
      permission: permission,
      s: "",
      guest: user.guest ? 1 : 0,
    },
  };
}

async function messageInits(data) {
  const commands = ["/gmute", "/lock", "/unlock", "/gmenu"];

  const LasteMessages = await Chat.find({
    visible: true,
    timestamp: { $gt: Date.now() / 1000 - 60 * 60 },
  })
    .sort({ $natural: -1 })
    .limit(10);

  let lastMsg = [
    {
      k: 4,
      n: `System`,
      t: `Na chacie globalnym piszemy poprzez dodanie /c "wiadomość".`,
      ts: 1,
      created_id: "1",
      permission: 0,
      s: "",
      guest: 0,
    },
  ];

  LasteMessages.reverse();
  for (let i in LasteMessages) {
    const msg = LasteMessages[i];

    lastMsg.push({
      k: 4,
      n: msg.nickname,
      t: msg.message,
      ts: msg.timestamp,
      created_id: msg.userID,
      permission: msg.permission,
      s: msg.nickname === "System" ? "sys_red" : "",
      guest: msg.guest,
    });
  }

  return lastMsg;
}

async function systemMessage({ message, adresat, ipaddr }) {
  try {
    const newMsg = await new Chat({
      userID: adresat,
      nickname: `System`,
      message: message,
      guest: 0,
      addressIP: ipaddr,
      permission: 0,
      timestamp: Date.now() / 1000,
      time: new Date().toLocaleString(),
    });
    await newMsg.save();
  } catch (e) {
    console.log(e);
    return { error: e };
  }
}

async function block(data) {
  const { nickname, message, guest, ipaddr, user_id, session, socket } = data;

  if (!nickname || !message || !user_id || !session) {
    return {
      error: `Wysłane dane nie sa zgodnie z formularzem!`,
    };
  }

  if (message.length > 300) {
    return {
      error: `Maksymalna ilość znaków to 300! Twoja wiadomość "${message}" (możesz skopiować).`,
    };
  }

  const user = await findUser(user_id, session);

  if (user.error) {
    return user;
  }

  if (user.account.rang !== "admin") {
    return {
      error: `Brak uprawnien.`,
    };
  }

  chatOptions.block = true;

  const temp = {
    k: 4,
    n: `System`,
    t: `Chat został zablokwany przez ${nickname}.`,
    ts: Date.now() / 1000,
    permission: 0,
    created_id: 1,
    s: "sys_red",
    guest: 0,
  };

  await systemMessage({
    adresat: user.account.userID,
    message: `Chat został zablokwany przez ${nickname}.`,
    ipaddr: ipaddr,
  });

  return socket.emit("newMessage", temp);
}

async function unblock(data) {
  const { nickname, message, guest, ipaddr, user_id, session, socket } = data;

  if (!nickname || !message || !user_id || !session) {
    return {
      error: `Wysłane dane nie sa zgodnie z formularzem!`,
    };
  }

  const user = await findUser(user_id, session);

  if (user.error) {
    return user;
  }

  if (user.account.rang !== "admin") {
    return {
      error: `Brak uprawnien.`,
    };
  }

  chatOptions.block = false;

  const temp = {
    k: 4,
    n: `System`,
    t: `Chat został odblokowany przez ${nickname}.`,
    ts: Date.now() / 1000,
    permission: 0,
    created_id: 1,
    s: "sys_red",
    guest: 0,
  };

  await systemMessage({
    adresat: user.account.userID,
    message: `Chat został odblokowany przez ${nickname}.`,
    ipaddr: ipaddr,
  });

  return socket.emit("newMessage", temp);
}

async function gmute(data) {
  const { nickname, message, guest, ipaddr, user_id, session, socket } = data;

  if (!nickname || !message || !user_id || !session) {
    return {
      error: `Wysłane dane nie sa zgodnie z formularzem!`,
    };
  }

  const user = await findUser(user_id, session);

  if (user.error) {
    return user;
  }

  if (user.account.rang !== "admin") {
    return {
      error: `Brak uprawnien.`,
    };
  }

  const [muteID, time] = message.replace("/gmute ", "").split(" ");

  if (!muteID || !time) {
    return {
      error: `format mutowania: /gmute ID_konta czas_minuty!`,
    };
  }

  const accountMute = await Accounts.findOne({ userID: muteID });

  if (!accountMute) {
    return {
      error: `Nie znaleziono konta z ID ${muteID}!`,
    };
  }

  await await Accounts.updateOne(
    { userID: muteID },
    { $set: { chatMute: Date.now() + time * 60 * 1000 } }
  );

  const temp = {
    k: 4,
    n: `System`,
    t: `Gracz [url=https://www.margonem.pl/profile/view,${muteID}]${muteID}[/url] został zmutowany przez ${nickname}.`,
    ts: Date.now() / 1000,
    permission: 0,
    created_id: 1,
    s: "sys_red",
    guest: 0,
  };

  await systemMessage({
    adresat: user.account.userID,
    message: `Gracz [url=https://www.margonem.pl/profile/view,${muteID}]${muteID}[/url] został zmutowany przez ${nickname}.`,
    ipaddr: ipaddr,
  });

  return socket.emit("newMessage", temp);
}

async function gmenu(data) {
  const { nickname, message, ipaddr, user_id, session } = data;

  if (!nickname || !user_id || !session) {
    return {
      error: `Wysłane dane nie sa zgodnie z formularzem!`,
    };
  }

  const user = await findUser(user_id, session);

  if (user.error) {
    return user;
  }

  if (user.account.rang !== "admin") {
    return { error: "Brak uprawnien." };
  }

  if (message.includes("margonem.pl")) {
    const profileID = message.split(" ")[1].split(",")[1].split("#")[0];
    const profile = await getProfile(profileID, "orvidia");
    return profile;
  }

  const playerNick = message.replace("/gmenu ", " ").trim();

  const player = await Players.findOne({
    $text: { $search: playerNick },
  });

  if (!player) {
    return { error: `Nie odnaleziono profilu gracza ${playerNick}` };
  }

  const profile = await getProfile(player.userID, "orvidia");

  return profile;
}

module.exports = {
  newMessage,
  block,
  messageInits,
  updateCharList,
  unblock,
  gmute,
  updateRanking,
  gmenu,
};
