const request = require("request-promise");
const cheerio = require("cheerio");

//mariusz11 do cookie.

async function getRanking(world) {
  let profile = null;

  try {
    profile = await request(
      `https://www.margonem.pl/ladder/players,${world}?page=1`,
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      }
    );
  } catch (e) {
    return false;
  }

  let $ = cheerio.load(profile);
  let pagesCount = parseInt($(".total-pages").text());

  let ids = [];

  for (let i = 1; i <= pagesCount; i++) {
    try {
      let p = await request(
        `https://www.margonem.pl/ladder/players,${world}?page=${i}`,
        {
          headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
        }
      );

      let $ = cheerio.load(p);
      let players = $(".long-clan a");

      players.each(function (index, e) {
        const profID = e.attribs["href"].split(",")[1].split("#")[0];
        ids.push(profID);
      });
    } catch (e) {
      return false;
    }
  }

  return {
    profiles: ids,
  };
}

module.exports = {
  getRanking,
};
