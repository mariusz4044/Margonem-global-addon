const Accounts = require("../database/models/Accounts");
const Players = require("../database/models/Players");

const findUser = async (user_id, session) => {
  let account = await Accounts.findOne({ userID: user_id, session }).lean();

  let isGuest = null;

  if (!account) {
    isGuest = await Players.findOne({ userID: user_id }).lean();

    if (!isGuest) {
      return {
        error: `Sessja dodatków globalnych wygasła, odśwież strone oraz zaloguj się ponownie!`,
      };
    }

    account = await Accounts.findOne({ userID: isGuest.guest, session }).lean();
  }

  if (!account) {
    return {
      error: `Sessja dodatków globalnych wygasła, odśwież strone oraz zaloguj się ponownie!`,
    };
  }

  if (account.rang === "banned") {
    return {
      error: `Twoje konto jest zablokowane w dodatkach globalnych!`,
      banned: 1,
    };
  }

  const player = await Players.findOne({ userID: account.userID }).lean();

  if (player) {
    account["charList"] = player.charList;
  } else {
    account["charList"] = {};
  }

  return {
    account,
    guest: isGuest,
  };
};

module.exports = {
  findUser,
};
