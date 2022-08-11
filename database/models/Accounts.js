const mongoose = require("mongoose");

const Accounts = mongoose.model("Accounts", {
  nickname: {
    type: String,
  },
  password: {
    type: String,
  },
  userID: {
    type: Number,
  },
  addressIP: {
    type: String,
  },
  session: {
    type: String,
  },
  rang: {
    type: String,
    default: "user",
  },
  chatMute: {
    type: Number,
    default: 0,
  },
});

module.exports = Accounts;
