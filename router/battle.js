const Battle = require("../database/models/Battle");
const Chat = require("../database/models/Chat");
const findUser = require("../router/user").findUser;
const Players = require("../database/models/Players");

const sanitizer = require("sanitizer");

const ranking = require("../router/ranking");

const crypto = require("crypto");

let tempHash = {};

const newBattle = async (data) => {
  const {
    user_id,
    session,
    battle,
    map,
    ipaddr,
    globalSocket,
    nickname,
    winner,
  } = data;
  if (!user_id || !session || !battle || !map || !nickname || !winner) {
    return { error: "Wysłano błędne dane podczas dodawania walki.. #1" };
  }

  if (winner.split("winner=")[1].length < 3) {
    return { error: "Wysłano błędne dane podczas dodawania walki.. #3" };
  }

  for (let i in battle) {
    const p = battle[i];

    if (!p.icon || !p.lvl || !p.name || !p.prof) {
      return { error: "Wysłano błędne dane podczas dodawania walki.. #2" };
    }
  }

  const user = await findUser(user_id, session);

  if (user.error) {
    return user;
  }

  let point = true;

  const battleHash = crypto
    .createHash("sha256")
    .update(Object.keys(battle).join("|"))
    .digest("base64");

  if (tempHash[battleHash] && tempHash[battleHash] > Date.now()) {
    return { error: "Taka sama walka została dodana przed chwilką." };
  }

  tempHash[battleHash] = Date.now() + 3 * 1000;

  const findBattle = await Battle.find({ hash: battleHash, point: true })
    .sort({
      _id: -1,
    })
    .limit(1)
    .lean();

  if (findBattle.length !== 0) {
    if (findBattle[0].timestamp + 10 * 60 * 1000 > Date.now()) {
      point = false;
    }
  }

  const teams = {
    team1: {},
    team2: {},
  };

  const isNpc = Object.values(battle).find((el) => {
    return el.npc === 1;
  });

  if (isNpc) {
    return {
      success: `?`,
    };
  }

  let clanString = ``;

  const clans = {
    team1: [],
    team2: [],
  };

  let winClansInFight = [];

  for (let i in battle) {
    const team = battle[i].team;
    const team_id = `team${team}`;

    const player = await Players.findOne({
      $text: { $search: battle[i].id },
    });

    const char = Object.values(player.charList).find((el) => {
      return el.id === battle[i].id;
    });

    if (!player || !char) continue;

    if (char.clan) {
      if (!clans[team_id].includes(char.clan)) {
        clanString += `${char.clan}|`;
        clans[team_id].push(char.clan);
      }
    }

    if (!["b", "h", "w", "m", "t", "p"].includes(battle[i].prof)) {
      return { error: "??" };
    }

    if (+battle[i].lvl > 500 || +battle[i].lvl < 1) {
      return { error: "???" };
    }

    teams[team_id][i] = {
      name: sanitizer.escape(char.nickname),
      lvl: sanitizer.escape(battle[i].lvl),
      prof: sanitizer.escape(battle[i].prof),
      icon: battle[i].dead ? char.image : sanitizer.escape(battle[i].icon),
      clan: char.clan || "",
      profileID: player.userID,
      eq: char.eq,
    };

    if (winner.includes(battle[i].name) && battle[i].hpp > 0) {
      teams[team_id][i].winner = true;
    }

    if (battle[i].hpp === 0) {
      teams[team_id][i].dead = true;
    }

    if (
      Object.values(battle).length === 2 &&
      teams[team_id][i].winner &&
      point
    ) {
      const res = await ranking.updatePlayerPoints(char.id);
    }
  }

  const deadsNumber = {
    team1: Object.values(teams["team1"]).filter((el) => el.dead).length,
    team2: Object.values(teams["team2"]).filter((el) => el.dead).length,
  };

  if (deadsNumber.team1Deads === 0 && deadsNumber.team2Deads === 0) {
    return {
      error:
        "Chcesz ze mnie kpić? Nie poczułem nic, daj bis Nie powiedziałeś tego w ryj To nie powiedziałeś nic. #4",
    };
  }

  if ((clans["team1"].length > 0 || clans["team1"].length > 0) && point) {
    clans["team1"].forEach(async (el) => {
      if (deadsNumber["team2"] !== 0) {
        const res = await ranking.updateClanPoints(el, deadsNumber["team2"]);
      }
    });

    clans["team2"].forEach(async (el) => {
      if (deadsNumber["team1"] !== 0) {
        const res = await ranking.updateClanPoints(el, deadsNumber["team1"]);
      }
    });
  }

  try {
    let battleType = "group";

    if (
      Object.values(teams.team1).length === 1 &&
      Object.values(teams.team2).length === 1
    ) {
      battleType = "pvp";
    }

    const newBat = await new Battle({
      userID: user_id,
      nickname: nickname,
      addressIP: ipaddr,
      map: map,
      team1: teams["team1"],
      team2: teams["team2"],
      guest: user.guest ? 1 : 0,
      timestamp: Date.now(),
      time: new Date().toLocaleString(),
      battleType: battleType,
      clanString: clanString,
      hash: battleHash,
      point,
    });

    await newBat.save();
  } catch (e) {
    console.log(e);
    return { error: e };
  }

  if (
    Object.values(teams.team1).length === 1 &&
    Object.values(teams.team2).length === 1
  ) {
    //Pvp 1 vs 1
    globalSocket.emit("newBattle", {
      newBattle: true,
      team1: teams.team1,
      team2: teams.team2,
    });
  }

  return { success: "Walka zapisana poprawnie." };
};

async function inits() {
  const battles = await Battle.find({ battleType: "pvp" })
    .sort({ $natural: -1 })
    .limit(4);

  let lastBattles = [];
  battles.reverse();

  for (let i in battles) {
    const battle = battles[i];

    lastBattles.push({ team1: battle.team1, team2: battle.team2 });
  }

  return lastBattles;
}

module.exports = {
  newBattle,
  inits,
};
