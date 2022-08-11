const SocketIO = require("socket.io");
const chat = require("../router/chat.js");
const findUser = require("../router/user").findUser;
//
const fs = require("fs");

let { requestOrder, limiterWarning, requestQueue } = require("./limites.js");
const Accounts = require("../database/models/Accounts");
const battles = require("../router/battle");

const ranking = require("../router/ranking");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let connectedUser = {};
let connectSM = {};

async function socketEngine(server) {
  const io = SocketIO(server, {
    cors: { origin: "https://orvidia.margonem.pl", credentials: true },
  });

  console.log(`Server IO connection.`);

  let ioOrvidia = io.of("/orvidia");

  ioOrvidia.on("connection", async (socket) => {
    const clientIP =
      socket.handshake.headers["cf-connecting-ip"] ||
      socket.handshake.address.replace("::ffff:", "");

    const query = socket.handshake.query;

    if (connectedUser[clientIP]) {
      const firstConn = connectedUser[clientIP];
      firstConn.emit("exit", { message: `Rozłączono z dodatkami.` });
      firstConn.disconnect();
    }

    if (!query.session || !query.user_id) {
      socket.emit("exit", { message: `Rozłączono z dodatkami #1` });
      socket.disconnect();
    }

    const user = await findUser(query.user_id, query.session);

    if (user.error) {
      socket.emit("exit", {
        message: `Nie wykryto konta w dodatkach #3`,
      });
      firstConn.disconnect();
    }

    connectedUser[clientIP] = socket;
    try {
      if (["SM", "MC"].includes(user.account?.charList[query.nickname]?.rang)) {
        connectSM[clientIP] = user.account.charList[query.nickname]?.nickname;
      }
    } catch {}

    if (!query.user_id || !query.session) {
      socket.emit("info", {
        message: `Rozłączono z dodatkami - nie jesteś zalogowany.`,
      });
      return socket.disconnect();
    }

    const updateRanking = chat.updateRanking();

    try {
      const lastMessage = await chat.messageInits();
      const lastBattles = await battles.inits();
      const rankingInits = await ranking.getRanking();
      const rankingInitsClans = await ranking.getRankingClan();

      socket.emit("inits", {
        chatMessages: lastMessage,
        lastBattles,
        rankingInits,
        rankingInitsClans,
      });

      ioOrvidia.emit("online", {
        usersOnline: Object.keys(connectedUser).length,
        connectSM: Object.values(connectSM),
      });
    } catch (e) {
      console.log(e);
      socket.emit("inits", {
        error: "Wystąpił błąd: " + e,
      });

      return socket.disconnect();
    }

    socket.use(async (packet, next) => {
      let limiter_ = await requestQueue(socket);
      if (limiter_) return socket.emit("info", limiter_);

      const task = packet[0];
      const data = packet[1];

      let empyData = [];

      for (let i in data) {
        if (!data[i] && data[i] !== 0) {
          empyData.push(i);
        }
      }

      if (empyData.length > 0) {
        delete requestOrder[clientIP];
        return socket.emit("info", {
          error: `Brak wymaganych danych, jeżeli błąd będzie wyskakiwać nadal po odświeżeniu gry, napisz do twórcy dodatków wraz ze screenem <br>
          <div class="tucz-data-error">task : ${task} <br> data : ${empyData.join(
            "|"
          )}</div>`,
        });
      }

      fs.writeFile(
        "lastrequest.txt",
        JSON.stringify({ task, data }, null, 2),
        (err) => {
          if (err) console.log(err);
        }
      );

      next();
    });

    socket.on("newBattle", async (data) => {
      data["ipaddr"] = clientIP;
      data["globalSocket"] = ioOrvidia;

      const res = await battles.newBattle(data);
      delete requestOrder[clientIP];

      return socket.emit("newBattle", res);
    });

    socket.on("getChat", async (data) => {
      const res = await chat.messageInits();
      delete requestOrder[clientIP];

      return socket.emit("getChat", res);
    });

    socket.on("newMessage", async (data) => {
      data["ipaddr"] = clientIP;

      if (data.message.includes("/lock")) {
        data.socket = ioOrvidia;
        const blockRes = await chat.block(data);
        delete requestOrder[clientIP];
        return socket.emit("newMessage", blockRes);
      }

      if (data.message.includes("/gmenu")) {
        const blockRes = await chat.gmenu(data);
        delete requestOrder[clientIP];
        return socket.emit("newMessage", blockRes);
      }

      if (data.message.includes("/unlock")) {
        data.socket = ioOrvidia;
        const blockRes = await chat.unblock(data);
        delete requestOrder[clientIP];
        return socket.emit("newMessage", blockRes);
      }

      if (data.message.includes("/gmute")) {
        data.socket = ioOrvidia;
        const blockRes = await chat.gmute(data);
        delete requestOrder[clientIP];
        return socket.emit("newMessage", blockRes);
      }

      const res = await chat.newMessage(data);
      delete requestOrder[clientIP];

      if (res.error) {
        return socket.emit("newMessage", res);
      }

      return ioOrvidia.emit("newMessage", res.message);
    });

    socket.on("disconnect", () => {
      if (connectedUser[clientIP]) {
        delete connectedUser[clientIP];

        ioOrvidia.emit("online", {
          usersOnline: Object.keys(connectedUser).length,
          connectSM: Object.values(connectSM),
        });

        if (connectSM[clientIP]) delete connectSM[clientIP];
      }

      //If dc delete limiter.
      if (limiterWarning[clientIP]) {
        delete limiterWarning[clientIP];
      }

      if (requestOrder[clientIP]) {
        delete requestOrder[clientIP];
      }
    });
  });
}
///COIN FLIP AREA

module.exports = {
  socketEngine,
  conn: connectedUser,
};
