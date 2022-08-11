import request from "request-promise";
import crypto from "crypto";

import { randomInteger, sleep } from "../../Untilled/default.js";

export const margoLogin = async (login, password, proxy) => {
  const passhash = "mleczko";
  const sha1 = crypto.createHash("sha1");
  sha1.update(`${passhash}${password}`); //Password to sha1.
  const url = "https://www.margonem.pl/ajax/login";

  try {
    const response = await request({
      proxy,
      url,
      method: "post",
      form: `l=${login}&ph=${sha1.digest("hex")}&t=&h2=&security=true`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      resolveWithFullResponse: true,
      json: true,
    });

    const res = response.body;

    if (!res) return { e: "Brak response podczas losowania." };

    if (res.ok !== 1) {
      return res;
    }

    if (response.headers["set-cookie"].length > 3) {
      response.headers["set-cookie"] = response.headers["set-cookie"].splice(3);
    }

    const getCookie = (name) => {
      for (const cookie of response.headers["set-cookie"]) {
        if (!cookie.includes(name)) {
          continue;
        }
        return cookie.split(";")[0].split("=")[1];
      }
    };

    return {
      chash: getCookie("chash"),
      user_id: getCookie("user_id"),
      hs3: getCookie("hs3"),
      ok: 1,
    };
  } catch (e) {
    console.log(`[Error] Błąd proxy podczas logowania: ${proxy}`);
    return { e };
  }
};
