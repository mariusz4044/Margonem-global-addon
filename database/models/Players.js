const mongoose = require("mongoose");

const Player = mongoose.model("Player", {
  nickname: {
    type: String,
  },
  userID: {
    type: Number,
  },
  chars: {
    type: Object,
  },
  charsID: {
    type: String,
  },
  charList: {
    type: Object,
  },
  guest: {
    type: Number,
  },
  battleType: {
    type: String,
  },
  clan: {
    type: String,
  },
  rang: {
    type: String,
  },
});

module.exports = Player;
