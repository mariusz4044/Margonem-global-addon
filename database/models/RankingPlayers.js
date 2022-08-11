const mongoose = require("mongoose");

const RankingPlayers = mongoose.model("RankingPlayers", {
  charID: {
    type: Number,
  },
  points: {
    type: Number,
  },
});

module.exports = RankingPlayers;
