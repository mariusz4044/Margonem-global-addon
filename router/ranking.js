const RankingPlayers = require("../database/models/RankingPlayers");
const RankingClans = require("../database/models/RankingClans");

const Accounts = require("../database/models/Accounts");
const Players = require("../database/models/Players");
const Battle = require("../database/models/Battle");

const updatePlayerPoints = async (char_id) => {
  const findUser = await RankingPlayers.findOne({ charID: char_id });

  if (!findUser) {
    try {
      const p = new RankingPlayers({
        charID: char_id,
        points: 1,
      });

      p.save();
      return { success: "Pomyślnie dodano punkty" };
    } catch (e) {
      return { error: "Wystąpił błąd podczas dodawania punktów" + e };
    }
  }

  try {
    await RankingPlayers.updateOne(
      { charID: char_id },
      { $inc: { points: 1 } }
    );
    return { success: "Pomyślnie dodano punkty" };
  } catch (e) {
    return { error: "Wystąpił błąd podczas dodawania punktów" + e };
  }
};

const updateClanPoints = async (clanName, kills) => {
  const findUser = await RankingClans.findOne({ clanName: clanName });

  if (!findUser) {
    try {
      const p = new RankingClans({
        clanName: clanName,
        points: kills,
      });

      p.save();
      return { success: "Pomyślnie dodano punkty" };
    } catch (e) {
      return { error: "Wystąpił błąd podczas dodawania punktów do klanu" + e };
    }
  }

  try {
    await RankingClans.updateOne(
      { clanName: clanName },
      { $inc: { points: kills } }
    );
    return { success: "Pomyślnie dodano punkty do klanu" };
  } catch (e) {
    return { error: "Wystąpił błąd podczas dodawania punktów do klanu" + e };
  }
};

const getRanking = async () => {
  console.time("Pobieranie rankingu graczy: ");

  const rank = await RankingPlayers.find()
    .sort({
      points: -1,
    })
    .limit(7)
    .lean();

  let res = {};
  let top = 1;

  for (let i in rank) {
    const player = await Players.findOne({
      $text: { $search: rank[i].charID },
    });

    if (!player) continue;

    const char = Object.values(player.charList).find(
      (el) => el.id == rank[i].charID
    );

    res[`top-${top}`] = {
      char: char,
      points: rank[i].points,
      rank: top,
    };

    top++;
  }

  console.timeEnd("Pobieranie rankingu graczy: ");
  return res;
};

const getRankingClan = async () => {
  console.time("Pobieranie rankingu klanów: ");

  const rank = await RankingClans.find()
    .sort({
      points: -1,
    })
    .limit(7)
    .lean();

  let res = {};
  let top = 1;

  for (let i in rank) {
    res[`top-${top}`] = {
      clanName: rank[i].clanName,
      points: rank[i].points,
    };
    top++;
  }

  console.timeEnd("Pobieranie rankingu klanów: ");
  return res;
};

module.exports = {
  updatePlayerPoints,
  updateClanPoints,
  getRanking,
  getRankingClan,
};
