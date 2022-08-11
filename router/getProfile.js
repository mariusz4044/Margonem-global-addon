const request = require("request-promise");
const cheerio = require("cheerio");

//mariusz11 do cookie.

const prof = {
  Wojownik: "w",
  Mag: "m",
  "Tancerz ostrzy": "b",
  Łowca: "h",
  Tropiciel: "t",
  Paladyn: "p",
};

async function getProfile(id, world) {
  let profile = null;
  let time = Date.now();
  try {
    profile = await request(`https://www.margonem.pl/profile/view,${id}`, {
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        cookie: `user_id=9693481; chash=FZFP0A2itQ; hs3=FZF;`,
      },
      timeout: 10000,
    });
  } catch (e) {
    return false;
  }

  let $ = cheerio.load(profile);
  const charList = {};
  const chars = $(`[data-world="#${world}"]`);
  const profileText = $(".profile-custom-page-body").text();

  let guest = $(".profile-header-data a");

  if (guest.length > 0) guest = +guest[0].attribs["href"].split(",")[1];
  else guest = 0;

  let mainNick = $(`.profile-header h2 span`).text().trim();

  let charString = ``;

  for (let i in chars) {
    const char = chars[i].attribs;

    if (!char) continue;

    const clan = $(`[data-id="${char["data-id"]}"] .chguild`)[0].attribs[
      "value"
    ];

    const img = $(`[data-id="${char["data-id"]}"] .cimg`)
      .css("background-image")
      .replace(`url('`, "")
      .replace(`')`, "");

    let prof_ = $(`[data-id="${char["data-id"]}"] .character-prof`)
      .text()
      .replace(",", "")
      .trim();

    let rang = $(`[data-id="${char["data-id"]}"] .character-name`).text();

    let eq = JSON.parse(
      $(`[data-id="${char["data-id"]}"] .chitems`)[0].attribs["value"]
    );

    if (rang.includes("[SM]")) rang = "SM";
    else if (rang.includes("[MC]")) rang = "MC";
    else rang = "gracz";

    charString += `${char[`data-id`]}|`;

    charList[char[`data-nick`]] = {
      nickname: char[`data-nick`],
      id: char[`data-id`],
      world: char[`data-world`].replace("#", ""),
      lvl: char[`data-lvl`],
      image: img,
      prof: prof[prof_],
      clan,
      rang,
      profileID: id,
      eq,
    };
  }

  return {
    profile: profileText,
    charList,
    guest,
    nickname: mainNick,
    downloadTime: `${Date.now() - time}ms`,
    charString: charString,
  };
}

module.exports = getProfile;
