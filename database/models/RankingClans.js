const mongoose = require("mongoose");

const RankingClans = mongoose.model("RankingClans", {
  clanName: {
    type: String,
  },
  points: {
    type: Number,
  },
});

module.exports = RankingClans;
