const mongoose = require("mongoose");

const Battle = mongoose.model("Battle", {
  nickname: {
    type: String,
  },
  userID: {
    type: Number,
  },
  addressIP: {
    type: String,
  },
  map: {
    type: String,
  },
  team1: {
    type: Object,
  },
  team2: {
    type: Object,
  },
  guest: {
    type: Number,
  },
  battleType: {
    type: String,
  },
  point: {
    type: Boolean,
    default: true,
  },
  hash: {
    type: String,
  },
  timestamp: {
    type: Number,
  },
  time: {
    type: String,
  },
  clanString: {
    type: String,
  },
});

module.exports = Battle;
