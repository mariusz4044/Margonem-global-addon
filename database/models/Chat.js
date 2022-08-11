const mongoose = require("mongoose");

const Chat = mongoose.model("Chat", {
  nickname: {
    type: String,
  },
  message: {
    type: String,
  },
  userID: {
    type: Number,
  },
  addressIP: {
    type: String,
  },
  gaddonWorld: {
    type: String,
    default: "orvidia",
  },
  guest: {
    type: Number,
  },
  timestamp: {
    type: Number,
  },
  time: {
    type: String,
  },
  permission: {
    type: Number,
  },
  visible: {
    type: Boolean,
    default: true,
  },
});

module.exports = Chat;
