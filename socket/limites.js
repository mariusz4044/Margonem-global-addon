const { RateLimiterMemory } = require("rate-limiter-flexible");

const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 points
  duration: 1, // per second
});

const requestOrder = {};
let limiterWarning = {};

const limiter = async (ip) => {
  if (!limiterWarning[ip]) {
    limiterWarning[ip] = `${Date.now()}|0`;
  }

  const [date, warnings] = limiterWarning[ip].split("|");

  limiterWarning[ip] = `${date}|${parseInt(warnings) + 1}`;

  if (Date.now() - parseInt(date) < 10_000 && warnings >= 100) {
    return { detected: true };
  }

  if (Date.now() - parseInt(date) > 10_000 && warnings < 100) {
    limiterWarning[ip] = `${Date.now()}|0`;
    //console.log("Reset mineło 10 sekund bez 100 requestów");
  }

  // console.log(date, warnings);

  try {
    await rateLimiter.consume(ip);
    return true;
  } catch {
    return { error: `Odczekaj chwilę...` };
  }
};

const requestQueue = async (socket) => {
  const clientIP =
    socket.handshake.headers["cf-connecting-ip"] ||
    socket.handshake.address.replace("::ffff:", "");

  if (requestOrder[clientIP]) {
    if (limiterWarning[clientIP]) {
      const [date, warnings] = limiterWarning[clientIP].split("|");
      limiterWarning[clientIP] = `${date}|${parseInt(warnings) + 1}`;
      //
      if (warnings > 100 && socket) {
        console.log(`Wykryto spam ${clientIP}, blokuje!`);
        socket.disconnect();
      }
    }

    return {
      error:
        "Poprzednie zapytanie jest jeszcze przetwarzane! Odśwież stronę w przypadku dalszych komunikatów.",
    };
  }

  requestOrder[clientIP] = true;
  //LIMITER
  let regLimiter = await limiter(clientIP);

  if (regLimiter.error) {
    delete requestOrder[clientIP];
    return regLimiter;
  }

  if (regLimiter.detected) {
    socket.disconnect();
  } //LIMITER END
};

module.exports = {
  requestOrder,
  limiterWarning,
  limiter,
  requestQueue,
};
