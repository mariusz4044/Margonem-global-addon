(async () => {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  ((old) => {
    displayChatMsg = (a, b) => {
      const msg = a[0];
      if (b.s !== "entertown") msg.setAttribute("data-ts", b.ts);
      return old(a, b);
    };
  })(displayChatMsg);

  class TuczempAddons {
    constructor() {
      this.baseURL = `https://margokantor.pl:2222/api/`;
      this.session = localStorage.getItem("tucz_session");
      this.socket = null;
      this.oldMessages = [];
      this.charList = null;
      this.guestChars = null;
      this.isGuestChars = false;
      this.guestID = null;
      this.ownerID = null;
      this.oldBattles = [];
      this.online = 0;
      this.onlineSM = [];
      this.ranking = {};
      this.rankingClans = {};
      this.tipFocus = "out";
      this.logs = [];
      this.initLoaded = false;
      this.addonLoaded = false;
      this.initGuestChars = false;
      this.aid = getCookie("user_id");
    }

    async inits() {
      const startLoadAddon = Date.now();

      if (!this.styleInits) this.loadStyles();

      if (!this.session) {
        this.log(`Nie znaleziono sessji w dodatkach.`);
        return this.showLoginForm();
      }

      const loginStatus = await this.getSession();

      if (loginStatus.error) {
        return localStorage.removeItem("tucz_session");
        this.showLoginForm();
        return;
      }

      let tries = 0;

      this.charList = loginStatus.charList;
      this.ownerID = loginStatus.owner;

      if (loginStatus.guest) {
        this.log(`Wykryto zastępce do reloggera ${loginStatus.guestID}.`);
        this.guestChars = loginStatus.guest;
        this.guestID = loginStatus.guestID;
      }

      while (g?.init < 2) {
        this.log("Czekam na załadowanie init1.");
        await sleep(50);
      }

      this.connectSocket();

      while ((!this.socket?.connected && tries < 10) || !this.initLoaded) {
        this.log(`Czekam na połączenie z socketem.`);
        await sleep(50);
      }

      if (!this.socket?.connected) {
        return this.showAlert(`Nie udało się połączyc z dodatkami. #1`);
      }

      await this.waitForGame();
      this.initGFunction();
      await this.waitForChat();
      this.loadOldMessages();

      this.createRelogger();

      setTimeout(() => {
        this.addonLoaded = true;
      }, 2000);

      this.log(`Załadowano dodatek w ${Date.now() - startLoadAddon}ms.`);
      console.info(`%c ${this.logs.join("\n")}`, "color: #bada55");
    }

    log(t) {
      const d = new Date();

      let date = `${d.getMilliseconds()}`;

      if (this.logs.length > 50) {
        this.logs.shift();
      }

      this.logs.push(`[${date}] ${t}`);
    }

    sortChars(data, attr) {
      var arr = [];
      for (var prop in data) {
        if (data.hasOwnProperty(prop)) {
          var obj = {};
          obj[prop] = data[prop];
          obj.tempSortName = data[prop][attr].toLowerCase();
          arr.push(obj);
        }
      }

      arr.sort(function (a, b) {
        var at = a.tempSortName,
          bt = b.tempSortName;
        return at > bt ? 1 : at < bt ? -1 : 0;
      });

      var result = [];
      for (var i = 0, l = arr.length; i < l; i++) {
        var obj = arr[i];
        delete obj.tempSortName;
        for (var prop in obj) {
          if (obj.hasOwnProperty(prop)) {
            var id = prop;
          }
        }
        var item = obj[id];
        result.push(item);
      }
      return result;
    }

    async findEq(charID) {
      let settings = {
        method: "GET",
      };
      let url = `https://mec.garmory-cdn.cloud/pl/orvidia/${
        charID % 128
      }/${charID}.json`;

      try {
        const fetchResponse = await fetch(`${url}`, settings);
        const data = await fetchResponse.json();
        return data;
      } catch (e) {
        return {};
      }
    }

    async createNewBattle(data, animation) {
      const team1ID = Object.keys(data.team1)[0];
      const team2ID = Object.keys(data.team2)[0];

      const team1 = data.team1[team1ID];
      const team2 = data.team2[team2ID];

      let winner = team1.winner ? team1 : team2;

      const element = $(`<div class='tucz-battle-box'>
        <div class="tucz-pvp-info">
        <div class="tucz-player ${
          team1.winner ? "tucz-winner-t" : "tucz-losser"
        }">${team1.name} </div>
        <div class="tucz-vs"><div class="${
          team1.winner ? "tucz-winner-t" : "tucz-losser"
        }">(${team1.lvl}${team1.prof})</div> <b>VS</b> <div class="${
        team2.winner ? "tucz-winner-t" : "tucz-losser"
      }">(${team2.lvl}${team2.prof})</div></div>
        <div class="tucz-player ${
          team2.winner ? "tucz-winner-t" : "tucz-losser"
        }"> ${team2.name}</div>
        </div>
      </div>`);

      const icon = $('<div id="tucz-winner"></div>');

      let winnerString = `<b>${winner.name}</b>${winner.lvl}${winner.prof}`;

      if (winner.clan) {
        winnerString += `<i>${winner.clan}</i>`;
      }

      icon.css({
        backgroundImage: `url('${winner.icon}')`,
      });

      const equs = {};

      let team1EQ = team1.eq;
      let team2EQ = team2.eq;

      let teamsEQ = {
        1: team1EQ,
        2: team2EQ,
      };

      const htmlEQ = {
        1: {},
        2: {},
      };

      const weaponCL = [1, 3, 4, 2, 6];
      const secondWeaponCl = [7, 5, 14, 21];

      for (let i in teamsEQ) {
        for (let x in teamsEQ[i]) {
          let teamID = i == 1 ? team1ID : team2ID;

          const _item = teamsEQ[i][x];

          let rang = "none";

          if (_item.stat.includes("legendary")) rang = "legendary";
          if (_item.stat.includes("upgraded")) rang = "upgraded";
          if (_item.stat.includes("heroic")) rang = "heroic";
          if (_item.stat.includes("unique")) rang = "unique";

          let calcCl = _item.cl;
          if (weaponCL.includes(_item.cl)) calcCl = "weapon";
          if (secondWeaponCl.includes(_item.cl)) calcCl = "secondWeapon";

          const itemStats = parseItemStat(_item.stat);

          let enchant = false;

          if (itemStats.enhancement_upgrade_lvl) {
            enchant = `<div class='tucz-enchant'>${itemStats.enhancement_upgrade_lvl}</div>`;
          }

          const tip = `${itemTip(_item)}`.replaceAll("''", `\"`);

          htmlEQ[i][calcCl] = `
            <div class="tucz-${rang} tucz-item" tip='${tip.toString()}' ctip="t_item">
              <img src='https://micc.garmory-cdn.cloud/obrazki/itemy/${
                _item.icon
              }' class="tucz-eq-img"/>
              ${enchant ? enchant : ""}
            </div>`;
        }
      }

      const eqDiv = $(`<div class="tucz-eq" id="tucz-meno">
        <div class="tucz-eq-${team1ID}" id="eq1">
         <b class="${team1.winner ? "tucz-winner-t" : "tucz-losser"}">${
        team1.name
      } (${team1.lvl}${team1.prof})
      </b>
        <div class="first-eq tucz-e">
         ${htmlEQ[1][9] || '<div class="tucz-item"></div>'}
        </div>
        <div class="second-eq tucz-e">
        ${htmlEQ[1][12] || '<div class="tucz-item"></div>'}
        ${htmlEQ[1][13] || '<div class="tucz-item"></div>'}
        ${htmlEQ[1][11] || '<div class="tucz-item"></div>'}
        </div>
        <div class="third-eq tucz-e">
         ${htmlEQ[1][`weapon`] || '<div class="tucz-item"></div>'}
        ${htmlEQ[1][8] || '<div class="tucz-item"></div>'}
        ${htmlEQ[1][`secondWeapon`] || '<div class="tucz-item"></div>'}
        </div>
        <div class="fourth-eq tucz-e">
         ${htmlEQ[1][10] || '<div class="tucz-item"></div>'}
        </div>
        </div>
        <b class="tucz-v">VS</b>
        <div class="tucz-eq-${team2ID}" id="eq2">
        <b class="${team2.winner ? "tucz-winner-t" : "tucz-losser"}">${
        team2.name
      } (${team2.lvl}${team2.prof})
      </b>
        <div class="first-eq tucz-e">
        ${htmlEQ[2][9] || '<div class="tucz-item"></div>'}
        </div>
        <div class="second-eq tucz-e">
        ${htmlEQ[2][12] || '<div class="tucz-item"></div>'}
        ${htmlEQ[2][13] || '<div class="tucz-item"></div>'}
        ${htmlEQ[2][11] || '<div class="tucz-item"></div>'}
        </div>
        <div class="third-eq tucz-e">
        ${htmlEQ[2][`weapon`] || '<div class="tucz-item"></div>'}
        ${htmlEQ[2][8] || '<div class="tucz-item"></div>'}
        ${htmlEQ[2][`secondWeapon`] || '<div class="tucz-item"></div>'}
        </div>
        <div class="fourth-eq tucz-e">
        ${htmlEQ[2][10] || '<div class="tucz-item"></div>'}
        </div>
        </div>
      </div>`);

      $(eqDiv).hide();

      $(eqDiv).mouseenter((e, e1) => {
        if (e.currentTarget.className === "tucz-eq") {
          this.tipFocus = "tip";
        }
      });

      $(eqDiv).mouseleave((e, e1) => {
        if (
          e.currentTarget.className === "tucz-eq" &&
          e.relatedTarget.id !== "tip"
        ) {
          setTimeout(() => {
            $(eqDiv).stop().fadeOut(200);
          }, 200);
        }

        $("#tip").css({
          display: "none",
        });

        this.tipFocus = "out";
      });

      $(icon).mouseover(() => {
        setTimeout(() => {
          $(eqDiv).stop().fadeIn(200);
        }, 200);
      });

      $(icon).mouseleave(() => {
        setTimeout(() => {
          if (this.tipFocus === "out") $(eqDiv).stop().fadeOut(200);
        }, 200);
      });

      $(element).append(eqDiv);
      $(element).append(icon);

      if (!animation) {
        element.prependTo("#tucz-last-battle");
        return;
      }

      element.css({
        opacity: "0",
        marginTop: "-100px",
        position: `absolute`,
      });

      if (document.querySelectorAll(".tucz-battle-box").length > 0) {
        document.querySelectorAll(".tucz-battle-box").forEach((el, i) => {
          if (i == 3) $(el).animate({ opacity: 0 }, 300);

          $(el).animate(
            {
              left: "+=125px",
            },
            500
          );
        });
      }

      setTimeout(() => {
        element.prependTo("#tucz-last-battle").animate(
          {
            marginTop: "4px",
            opacity: "1",
          },
          500,
          () => {
            const elementLength =
              document.querySelectorAll(".tucz-battle-box").length;
            if (elementLength > 4) {
              document
                .querySelectorAll(".tucz-battle-box")
                [elementLength - 1].remove();
            }
            element.css({
              position: "relative",
            });
            document.querySelectorAll(".tucz-battle-box").forEach((el, i) => {
              if (i !== 0)
                $(el).css({
                  left: "0px",
                });
            });
          }
        );
      }, 510);
    }

    hideRightPanel() {
      if ($("#tucz-right-bar").css("right") !== "3px") {
        localStorage.setItem("tucz-right", false);
        $("#tucz-right-bar").animate(
          {
            right: "3px",
          },
          1000
        );
      } else {
        localStorage.removeItem("tucz-right", false);
        $("#tucz-right-bar").animate(
          {
            right: "-124px",
          },
          1000
        );
      }
    }

    createLastBattleBar() {
      const p = {
        w: "Wojownik",
        m: "Mag",
        b: "Tancerz ostrzy",
        h: "Łowca",
        t: "Tropiciel",
        p: "Paladyn",
      };

      const topBar = $('<div id="tucz-top-bar"></div>');
      const rightBar = $(
        `<div id="tucz-right-bar">
             <div class="tucz-online" tip="Pokaż moderatorów online <img src='https://margokantor.pl/obrazki/left-click.png'>">
             <div class="online-img">
                <span class="tucz-online-value">${this.online}</span>
                <span class="tucz-online-sm-value">${this.onlineSM.length}</span>
            </div>
            </div>
             <div class="tucz-ranking-players"></div>
             <div class="tucz-ranking-clans"></div>
             <div class="tucz-arrow"></div>
        </div>`
      );

      $("#centerbox2").append(topBar);
      $("#centerbox2").append(rightBar);

      for (let i in this.ranking) {
        const l = this.ranking[i];

        const element = $(`<div class="tucz-rank">
                <b class="tucz-${i}">${l.char.nickname}</b>
                <div class="tucz-fragi">${l.char.lvl} ${p[l.char.prof]} - ${
          l.points
        } <div class="tucz-sword" tip="Zwyciężone walki"></div></div>
        </div>`);
        element.appendTo(`.tucz-ranking-players`);

        element.click(() => {
          const win = window.open(
            `https://www.margonem.pl/profile/view,${l.char.profileID}#char_${l.char.id},orvidia`,
            "_blank"
          );
        });

        element.attr("tip", "Kliknij aby pokazać profil.");
      }

      for (let i in this.rankingClans) {
        const clan = this.rankingClans[i];

        const element = $(`<div class="tucz-rank">
                <b class="tucz-${i}">${clan.clanName}</b>
                <div class="tucz-fragi">Zabójst - ${clan.points} <div class="tucz-sword" tip="Fragi klanu."></div></div>
        </div>`);

        element.appendTo(`.tucz-ranking-clans`);
      }

      if (localStorage.getItem("tucz-right")) {
        $("#tucz-right-bar").css({
          right: "3px",
        });
      }

      $(".tucz-arrow").click(() => this.hideRightPanel());

      const sm = this.onlineSM.map((el) => {
        return `<div class='tucz-sm' onClick="chatTo('${el}','')">@${el}</div>`;
      });

      $(".tucz-online").click(() => {
        this.showAlert(`
          Moderatorzy online na świecie:<br>
          ${sm.join("\n")}
        `);
      });
    }

    createRelogger() {
      $("#tucz-reloger").remove();

      const relogerDiv = $("<div id='tucz-reloger'></div>");

      const guestIcon = $(
        `<img id="tucz-guest-btn" src="https://margokantor.pl/obrazki/ttt.png">`
      );

      guestIcon.attr("tip", "Pokaż postacie zastępcy.");

      guestIcon.click(() => {
        $(".tucz-char").fadeOut(500);
        guestIcon.addClass("rotate360");
        this.isGuestChars = this.isGuestChars ? false : true;
        setTimeout(() => {
          return this.createRelogger();
        }, 500);
      });

      if (+getCookie("user_id") === this.guestID && !this.initGuestChars) {
        this.initGuestChars = true;
        this.isGuestChars = true;
      }

      if (this.guestID) relogerDiv.append(guestIcon);

      let sorted = this.sortChars(this.charList, "lvl").reverse();

      if (this.isGuestChars) {
        sorted = this.sortChars(this.guestChars, "lvl").reverse();
      }

      for (let i in sorted) {
        const char = sorted[i];

        const charBox = $(
          `<div class='tucz-char' ctip="t_other" tip="<b>${char.nickname}</b>${char.lvl}${char.prof}"></div>`
        );
        const img = $(`<div class="tucz-char-img" ></div>`);
        const perfix = $(
          `<div class="tucz-char-text gfont" name="${char.lvl}${char.prof}">${char.lvl}${char.prof}</div>`
        );

        img.css("background-image", `url(${char.image})`);
        img.css("width", "32px");
        img.css("height", "48px");

        charBox.append(img);
        charBox.append(perfix);
        relogerDiv.append(charBox);

        charBox.click(() => {
          if (this.isGuestChars) this.relog(char.id, this.guestID);
          else this.relog(char.id, this.ownerID);
        });
      }

      $(relogerDiv).prependTo("#tucz-top-bar");
    }

    createLastBattlesElement() {
      let d = Date.now();
      this.log(`Rozpoczynam ładowanie ostatni walk.`);
      const element = $("<div id='tucz-last-battle'></div>");

      $("#tucz-top-bar").append(element);

      for (let i in this.oldBattles) {
        this.createNewBattle(this.oldBattles[i], false);
      }
      this.log(`Załadowano ostatnie walki w ${Date.now() - d}ms.`);
    }

    async relog(charID, aid) {
      let d = new Date();
      d.setTime(d.getTime() + 3600000 * 24 * 30);

      if (charID == hero.id)
        return message("Jesteś zalogowany na tej postaci!");
      let url;

      if (hero.guest === 1) url = "https://www.margonem.pl/ajax/logout";
      else url = "https://www.margonem.pl/ajax/loginSubstitute";

      if (aid == g.aid) {
        deleteCookie("mchar_id");
        deleteCookie("user_id");
        setCookie("user_id", aid, d, "/", "margonem.pl");
        setCookie("mchar_id", charID, d, "/", "margonem.pl");
        return location.reload();
      }

      fetch(url, {
        body: "h2=" + getCookie("hs3") + "&security=true",
        method: "POST",
        mode: "no-cors",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        credentials: "include",
      }).then(() => {
        deleteCookie("user_id");
        deleteCookie("mchar_id");
        setCookie("user_id", aid, d, "/", "margonem.pl");
        setCookie("mchar_id", charID, d, "/", "margonem.pl");
        location.reload();
      });
    }

    connectSocket() {
      let xdd = Date.now();
      $.getScript("https://margokantor.pl/addons/socketOrvi.js", async () => {
        this.log(`Wczytano bibliotekę socket.io w ${Date.now() - xdd}ms`);

        this.socket = orviIO.connect("wss://margokantor.pl:2222/orvidia", {
          query: {
            user_id: getCookie("user_id"),
            session: this.session,
            guest: hero.guest || 0,
            char: hero.id,
            nickname: hero.nick,
          },
        });

        this.socket.on("newMessage", (res) => {
          if (res.error) return this.showAlert(res.error);

          if (res.profile) {
            return this.showProfileAction(res);
          }

          this.writeNewMessage(res);
        });

        this.socket.on("getChat", (res) => {
          if (res.error) return this.showAlert(res.error);
          this.oldMessages = res;

          for (let i in this.oldMessages) {
            this.writeNewMessage(this.oldMessages[i]);
            delete this.oldMessages[i];
          }
        });

        this.socket.on("online", (res) => {
          this.online = res.usersOnline;
          this.onlineSM = res.connectSM;

          if ($(".tucz-online-value").length !== 0) {
            $(".tucz-online-value").text(res.usersOnline);
            $(".tucz-online-sm-value").text(res.connectSM.length);
          }
        });

        this.socket.on("exit", (res) => {
          message(res.message);
        });

        this.socket.on("newBattle", (res) => {
          if (res.team1) this.createNewBattle(res, true);
        });

        this.socket.on("info", (res) => {
          if (res.error) this.showAlert(res.error, true);
        });

        this.socket.on("inits", (res) => {
          if (res.error) return this.showAlert(res.error);

          this.oldMessages = res.chatMessages;
          this.oldBattles = res.lastBattles;
          this.ranking = res.rankingInits;
          this.rankingClans = res.rankingInitsClans;
          this.initLoaded = true;
        });

        this.socket.on("info", (res) => {
          if (res.message) return this.showAlert(res.message);
        });
      });
    }

    loadOldMessages() {
      const d = Date.now();

      this.log(`Rozpoczynam ładowanie chatu globalnego.`);
      for (let i in this.oldMessages) {
        this.writeNewMessage(this.oldMessages[i]);
        delete this.oldMessages[i];
      }

      this.sortMessages();
      this.createLastBattlesElement();
      this.log(`Załadowano chat globalny w ${Date.now() - d}ms.`);
    }

    async writeNewMessage(res) {
      let box = [];
      box.push(res);
      newChatMsg(box);
    }

    async waitForGame() {
      try {
        while (g?.init < 5) {
          this.log(`Czekam na załadowanie init 4.`);
          await sleep(50);
        }
      } catch {
        return await this.waitForGame();
      }

      this.createLastBattleBar();
    }

    sortMessages() {
      let divList = $("#chattxt div");

      divList.sort(function (a, b) {
        return $(a).data("ts") - $(b).data("ts");
      });

      $("#chattxt").html(divList);
    }

    async waitForChat() {
      try {
        while (g?.init < 4) {
          this.log(`Czekam na załadowanie init 3.`);
          await sleep(50);
        }
      } catch {
        return await this.waitForChat();
      }

      oneChatMsg = (t) => {
        const tuczChars = `3433518`;

        var a = $("<div>"),
          e = $("<span>"),
          o = parseChatText(t),
          n = getChatStyleMsg(t),
          i = getChatInfoMsg(t);

        if ($(o).html().includes('class="link"')) {
          const isUrl = t.t
            .split(" ")
            .find(
              (el) =>
                el.includes("http") || el.includes(`http`) || el.includes("www")
            );

          const url = t.t.split("//")[1]?.split("/")[0];

          const newlink = $(
            `<u id='tucz-link' onclick=\"goToUrl('${isUrl}')\">[Zły link]</u>`
          );

          $(o).html("");
          newlink.text(`[${url}]`);
          $(o).append(newlink);
        }

        if (t.k === 4) o.addClass("global");

        if (t.k == 4 && t.n !== "System" && t.created_id != tuczChars) {
          const element = $("<span>");
          element.css({
            "margin-left": "0.5px",
            "margin-right": "0.5px",
          });
          element.addClass("global");

          if (t.permission === 4) element.text(`[SM]`);
          if (t.permission === 32) element.text(`[MC]`);
          if (t.permission !== 4) element.text(`[G]`);

          element.appendTo(a);
        }

        if (t.guest === 1 && t.n !== "System") {
          const element = $("<span>");
          element.attr("tip", "Zastępca zalogowany.");
          element.css({
            "margin-left": "0.5px",
            "margin-right": "0.5px",
          });
          element.text("[Z]");
          element.appendTo(a);
        }

        if (t.created_id == tuczChars && t.k === 4 && t.n !== "System") {
          const element = $("<span>");
          element.attr("tip", "Twórca dodatków globalnych.");
          element.css({
            "margin-left": "0.5px",
            "margin-right": "0.5px",
            "margin-top": "-0.5px",
            color: "#ce1414",
          });

          e.css({
            color: "#ce1414",
          });

          element.text("[D]");
          element.appendTo(a);
        }

        if (t.n == "System" && t.k === 4) {
          const element = $("<span>");
          element.attr("tip", "System dodatków globalnych.");

          element.text("[S]");
          element.appendTo(a);

          o.css({
            color: "rgb(255 247 0)",
            fontWeight: 300,
          });

          e.css({
            color: `#00BCD4`,
            fontWeight: 300,
          });
        }

        if (
          (a.append(e),
          a.append(o),
          a.addClass(n),
          e.text(i),
          0 == g.chat.tab && isset(t.fr) && 1 == t.fr && e.addClass("fr"),
          "" != t.n && "System" != t.n)
        ) {
          var c = t.n;
          c == hero.nick && isset(t.nd) && (c = t.nd),
            e.addClass("chnick"),
            e.attr("tip", ut_time(t.ts)),
            e.attr("c_nick", c);
        }

        return displayChatMsg(a, t), a;
      };

      updateChatLastMsg = () => {
        if (g.chat.lastMsg === null || g.chat.write) {
          return;
        }
        var c = [
          "",
          _t("[K]", null, "chat"),
          _t("[G]", null, "chat"),
          _t("[P]", null, "chat"),
          "",
        ];
        var b = $("<div>");
        b.attr("id", "lastmsg");
        var a = document.createTextNode(c[g.chat.lastMsg.kind]);
        b.append(a);
        b.append(g.chat.lastMsg.$el.children().clone());
        $("#bottxt").empty().append(b);
        if (!g.chat.write) {
          $("#lastmsg").fadeIn();
        }
      };

      newChatMsg = (b) => {
        var j = g.chat.state == 3 ? 255 : 500;
        var f = [];
        for (var c in b) {
          f[parseInt(c)] = b[c];
        }
        g.ch = f;
        if (f[0].ts > g.chat.ts || f[0].k == 4) {
          var e = [];
          var a = f[f.length - 1].n == hero.nick;
          for (var d = f.length - 1; d >= 0; d--) {
            var h = f[d];
            if (hasIgnoreChatMsg(h)) {
              continue;
            }
            g.chat.lastMsg = {
              kind: h.k,
              $el: oneChatMsg(h),
            };
            if (h.k == 3 && h.n != hero.nick && h.n != "System") {
              g.chat.lastnick = h.n;
            }
            if (!a) {
              e[h.k] = true;
            }
          }
          chatScroll(-1);
          updateChatLastMsg();
          updateChatNewMsg(e);
        }
        chatScrollbar("chattxt", j, "chatscrollbar");
      };

      displayChatMsg = (a, b) => {
        const msg = a[0];
        if (b.s !== "entertown") msg.setAttribute("data-ts", b.ts);

        if (g.chat.tabs.length == 4 && b.k == 4) {
          g.chat.tabs.push([]);
          g.chat.tabs[b.k].push(a);
        }
        if (b.k != 0) {
          g.chat.tabs[0].push(a.clone(true, true));
        }
        if (b.ts > g.chat.ts && b.k != 4) {
          g.chat.ts = b.ts;
        }
        if (b.k == g.chat.tab || g.chat.tab == 0) {
          $("#chattxt").append(a.clone(true, true));
        }
      };
    }

    async getSession() {
      const res = await this.baseRequest("getSession", {
        user_id: getCookie("user_id"),
        session: this.session,
      });

      this.log(`Pobrano getSession w ${res.ping}ms.`);

      if (res.slow) return this.showAlert(res.slow);
      if (res.error) this.showAlert(res.error);

      return res;
    }

    async sendNewMessage(message) {
      if (!this.socket) return false;

      this.socket.emit("newMessage", {
        nickname: hero.nick,
        user_id: getCookie("user_id"),
        message: message,
        session: this.session,
        permission: hero.uprawnienia,
      });
    }

    loadStyles() {
      $("#ni-promo").remove();

      $("head").append(`<style>.alert-box {
            width: 400px !important;
            height: auto !important;
            position: relative;
        }
        .tucz-eq-img {
         width: 25px;
         height: 25px;
         object-fit: cover;
        }
       .tucz-top-1 {
    color: #ffd700b0 !important;
}
.tucz-top-2 {
    color: #9b9a99b0 !important;
}
.tucz-top-3 {
    color: #a35201b0 !important;
}
        #tucz-gurnik {
    height: 100%;
    display: flex;
    width: 100%;
    justify-content: space-evenly;
    align-items: center;
    z-index: 1002;
    background: red;
        }
          .tucz-e {
       display: flex;
       justify-content: center;
          }
          .tucz-upgraded  {
    -webkit-box-shadow: 0px 0px 5px 1px #eafb08;
    box-shadow: inset 0px 0px 5px 1px #eafb08;
}

.tucz-unique {
    -webkit-box-shadow: 0px 0px 5px 1px #918817;
    box-shadow: inset 0px 0px 5px 1px #918817;
}
.tucz-heroic {
    -webkit-box-shadow: inset 0px 0px 5px 1px #177491;
    box-shadow: inset 0px 0px 5px 1px #177491;
}
.tucz-legendary {
    -webkit-box-shadow: inset 0px 0px 5px 1px #ff123b;
    box-shadow: inset 0px 0px 5px 1px #ff123b;
}
        .tucz-item {
         width: 25px;
         height: 25px;
         background: #2020208c;
         border: 1px solid #282828;
         margin: 1px;
         position: relative;
        }
        .tucz-enchant {
    position: absolute;
    bottom: 0px;
    font-size: 10px;
    background: #00000063;
    border-radius: 8px;
    left: 1px;
    color: #9d9090;
    font-family: arial;
}
        .char-t {
          margin-bottom: 6px !important;
        }
        .tucz-u b {
        color: #df5d00;
        }
        .tucz-btn {
            margin-left: 0px !important;
        }
        .tucz-kill {
        margin-bottom: 0px !important;
        height: 30px;
        }
        .tucz-select {
         color: #4bdf00;
        }
        .tucz-action input[type="number"] {
         width: 25px;
         left: 2px;
         border: none;
        }
        .tucz-online {
         width: 100%;
         height: 50px;
         position: absolute;
         display: flex;
         align-items: center;
         justify-content: center;
         font-size: 13px;
        }
        .tucz-sm {
            position: relative;
            color: #af4545;
            cursor: pointer;
            margin-bottom: 1px !important;
            margin-top: 10px !important;
        }
        .tucz-online-value {
        position: absolute;
        right: 0;
        color: #b9b9b9;
        background: #050e03ba;
         padding: 2px;
        border-radius: 8px;
        bottom: 0px;
        text-align: center;
        }
        .tucz-online-sm-value {
        position: absolute;
        left: 0;
        color: #e30000;;
        background: #050e03ba;
         padding: 2px;
        border-radius: 8px;
        bottom: 0px;
        text-align: center;
        }
        .online-img {
            width: 32px;
            height:32px;
            position: absolute;
            z-index: 99;
            background-image: url('https://margokantor.pl/obrazki/online.png');
            -webkit-background-size: cover;
            -moz-background-size: cover;
            -o-background-size: cover;
             background-size: cover;
             object-fit: cover;
             cursor:pointer;
        }
        .tucz-rank {
            font-size: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 12px;
        }
        .tucz-rank b{
            color: #059f34b8;
            font-size: 11px;
            cursor: pointer;
        }
        .tucz-ranking-players {
            width: 116px;
            height: 220px;
         position: absolute;
         top: 100px;
         right: 7px;
        }
        .tucz-ranking-clans {
            width: 116px;
         height: 220px;
         position: absolute;
         top: 378px;
         right: 7px;
        }
        .tucz-battle-box {
            display: flex;
            flex-direction: row-reverse;
            margin-left: 11px;
            width: 114px;
            height: 50px;           
            margin-top: 8px;
            min-width: 114px;
            margin-bottom: 5px;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .tucz-eq {
    width: 250px;
    height: 161px;
    background: #171817ed;
    position: absolute;
    top: -130px;
    left: 34px;
    border: 1px solid #636262;
    z-index: 402;
    box-shadow: 5px 5px 10px rgb(0 0 0 / 20%);
    border-radius: 4px;
    display: flex;
    justify-content: space-evenly;
    font-family: Arial;
    align-items: center;
        }
        .tucz-winner-t {
            color: #34b300;
        }
        #eq2 b, #eq1 b {
         font-size: 10px;
    margin-top: 7px;
    display: flex;
    flex-direction: column;
    margin-bottom: 10px;
    width: 100px;
    height: 10px;
    word-break: break-word;
    justify-content: center;
    align-items: center;
    text-align: center;
        }
        .tucz-v {
         margin-top: 30px;
    color: gold;
    font-size: 13px;
        }
        .tucz-pvp-info {
         font-size: 9px;
            margin-top: 4px;
            color: #b4b4b4;
            display: flex;
            flex-direction: column;
            align-items: center;
            sletter-spacing: 0.1px;
        }
        .tucz-vs {
            padding: 2px;
            text-align: center;
            display: flex;
            font-weight: 600;
        }
        .tucz-vs  b {
           color: #f9c500;
           margin-right: 5px;
           margin-left: 5px;
        }
        #tucz-winner{
           width: 25px !important;
           height: 38px;
           background-size: 100px;
           margin-top: 2px;
        }
        #tucz-last-battle {
    width: 50px;
    height: 50px;
    display: flex;
    position: relative;
    top: 10px;
    width: 500px;
    align-items: flex-end;
        }
        #tucz-guest-btn {
            width: 25px !important;
            height: 25px !important;
            margin-right: 10px;
            margin-top: 2px
            transition: all 1s ease-out;
        }
        
        .alert-box main div {
           text-align: center;
           margin-bottom: 20px;
           font-weight: 100;
           padding: 5px;
        }
        .alert-box button {
            margin-bottom: 20px;
        }  
        .tucz-char-text {
         position: absolute;
         margin-top: -15px;
         font-size: 14px;
         background: rgba(0,0,0,0.46);
        }
        .tucz-data-error {
    background: #2c2c2c;
    padding: 10px;
    margin-top: 20px;
        }
        .tucz-char {
         margin-top: 5px;
         cursor: pointer;
          display: flex;
         flex-direction: column-reverse;
          align-items: center;
        }
        #tucz-reloger {
         width: 280px;
         height: 50px;
         z-index: 402;
         position: absolute;
         right: 8px;
         margin-top: 3px;
         display: flex;
         align-items: center;
         justify-content: flex-start;
         grid-gap: 6px;
        }
        .alert-box {
    border-radius: 8px;
    color: #cccccc;
    font-family: Arial, Helvetica, sans-serif;
    display: flex;
    flex-direction: column;
    box-shadow: 5px 5px 10px rgb(0 0 0 / 20%);
    margin-bottom: 50px;
    z-index: 1001;
    position: absolute;
    left: calc(50% - 200px);
    top: calc(50% - 200px);
        border: 1px solid #605f5e;
    cursor: grab;
    background: url(https://margokantor.pl/obrazki/bg.jpg) no-repeat center center fixed;
    -webkit-background-size: cover;
    -moz-background-size: cover;
    -o-background-size: cover;
    background-size: cover;
    opacity: 0.99;
        }    
        
        .alert-box:active {
         cursor: grabbing;
        }   
        .tucz-login-form {
            width: 300px;
            height: 260px;
            background: #1f1f1f;
            border-radius:8px;
            color: #cccccc;
            font-family: Arial, Helvetica, sans-serif;
            display : flex;
            flex-direction: column;
            box-shadow: 5px 5px 10px rgba(0, 0, 0, 0.199);
            margin-bottom: 50px;
            z-index: 1000;
            position: absolute;
            left: calc(50% - 150px);
            top: calc(50% - 130px);
            border: 1px solid #636262;
        }
        .tucz-window header {
            text-transform: uppercase;
            font-weight: bold;
            text-align: center;
            width: 100%;
            display:flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 10px;
        }
        .tucz-window header:first-child {
            margin-top: 8px
        }
        .tucz-char {
        cursor: pointer !important;
        }
        .under-header {
            width: 95%;
            height: 0.5px;
            background: #181717;
            -webkit-box-shadow: 1px 1px 1px 7px #000000;
            box-shadow: 0px 0px 1px 0.1px #494747;
            margin-top: 8px;
        }
        .tucz-subtitle {
            position: relative;
            left: 40px;
            font-size: 13px;
            color: rgba(177, 177, 177, 0.3);
        }
        .tucz-window main {
            margin-top: 5px;
            width: 100%;
            display: flex;
            flex-direction: column;
        }
        .tucz-window main button:active  {
         transform: scale(0.9);
        }
        .tucz-window main input {
            border: none;
            border-bottom: solid rgb(143, 143, 143) 1px;
            margin-bottom: 30px;
            background: none;
            color: rgba(255, 255, 255, 0.555);
            height: 25px;
            width: 200px;
            position: relative;
            left: 40px;
            outline: none;
        }
        .tucz-window main button {
            cursor: pointer;
            border: none;
            border-radius: 8px;
            box-shadow: 2px 2px 7px rgba(211, 180, 56, 0.44);
            background: #b98120;
            color: rgba(255, 255, 255, 0.8);
            width: 80%;
            padding: 5px;
            transition: all 200ms;
            outline: none;
            margin-left: 10%;
        }
        .tucz-window bottom b {
            top: 10px;
            position: relative;
            font-size: 11px;
            color: #a1a0a0;
        }
        .tucz-window bottom {
           text-align: center;
           width: 100%;
        }
        .small-window {
            height: 190px !important;
        } 
        .close-windows-ga {
         position: absolute;
         right: 20px;
         cursor: pointer;
        }
        .tucz-wait-btn {
          font-weight: bold;
          animation: tucz-spin 1s ease-in-out infinite;
        }
        .profile-code {
          text-align: center;
          background-color: #4b4a48;
          padding: 10px;
          margin-bottom: 20px;
        }
        .small-info-profile-code {
         text-align: center;
         margin-bottom: 20px;
         font-size: 13px;
        }
        .global {
         color: #00BCD4;
        }  
        .rotate360 {
            transition: transform 500ms;
            transform: rotate(360deg)
            }
        @keyframes tucz-spin {
            0% {transform:rotate(360deg)}
        }
        #tucz-top-bar {
          width: 800px;
    height: 60px;
    position: absolute;
    z-index: 400;
    top: -65px;
    left: -6px;
    background-image: url(https://margokantor.pl/obrazki/belka_gora.png);
    -webkit-background-size: cover;
    -moz-background-size: cover;
    -o-background-size: cover;
    background-size: cover;
    object-fit: cover;
        } 
        .tucz-fragi {
         display: flex;
    color: #9595958c;
        }
        .tucz-sword {
            width: 10px;
            height:10px;
            background-image: url('https://margokantor.pl/obrazki/sword.png');
            -webkit-background-size: cover;
            -moz-background-size: cover;
            -o-background-size: cover;
             background-size: cover;
             object-fit: cover;
             margin-left: 5px;
        } 
        .tucz-arrow {
             width: 16px;
         height: 16px;
         position: absolute;
         z-index: 402;
         margin-top: 310px;
             /* margin-left: -6px; */
         background-image: url(https://margokantor.pl/obrazki/arrow.png);
         -webkit-background-size: cover;
            -moz-background-size: cover;
         -o-background-size: cover;
            background-size: cover;
         object-fit: cover;
            right: -16px;
            cursor: pointer;
            }   
        #tucz-right-bar {
               width: 133px;
    height: 607px;
    position: absolute;
    right: -124px;
    top: -65px;
    background-image: url(https://margokantor.pl/obrazki/belka_prawo.png);
    -webkit-background-size: cover;
    -moz-background-size: cover;
    -o-background-size: cover;
    background-size: cover;
    object-fit: cover;
    z-index: 200;
}
        
        </style>`);
    }

    showWaitBtn() {
      $(".tucz-register")
        .html("<div class='tucz-wait-btn'>☼</div>")
        .prop("disabled", true);
      $(".tucz-login")
        .html("<div class='tucz-wait-btn'>☼</div>")
        .prop("disabled", true);
    }

    endWaitBtn() {
      $(".tucz-register").text("Zarejestruj").prop("disabled", false);
      $(".tucz-login").text("Zaloguj").prop("disabled", false);
    }

    showCodeAlert(text, code) {
      $(".alert-box").remove();
      $(`<div class="alert-box tucz-window">
        <header>
            <b>Uwaga</b>
            <div class="under-header"></div>
        </header>
        <main>
            <div>${text}</div>
            <div class="profile-code">${code}</div>
            <div class="small-info-profile-code">Następnie zamnij okono oraz ponownie przystąp do rejestracji.</div>
            <button class="alert-close">Zamknij</button>
        </main>
       </div>`).appendTo($("body"));

      $(".alert-box button").click(() => {
        $(".alert-box").fadeOut("fast", () => {
          $(".alert-box").remove();
        });
      });
    }

    showProfileAction(data) {
      $(".alert-box").remove();
      $(`<div class="alert-box tucz-window">
        <header>
            <b>Uwaga</b>
            <div class="under-header"></div>
        </header>
        <main>
            <div class="tucz-u">Wyszukano: <b>${data.nickname}</b></div>
            <div class="tucz-mc-chars">
             
            </div>
            <div class="tucz-action">
            <div class="tucz-kill">Ilość godzin killa: <input type="number" value="24"></div><br>
            <button class="tucz-btn" id="tucz-s-a">Zaznacz wszystkie</button>
            <button class="tucz-btn" id="tucz-s-k">Zabij zaznaczone</button>
            <button class="tucz-btn" id="tucz-s-u" >UnZabij zaznaczone</button>
            </div>
            <button class="alert-close">Zamknij</button>
        </main>
       </div>`).appendTo($("body"));

      for (let i in data.charList) {
        const char = data.charList[i];

        const el = $(`<div class='char-t'>
            <span>${char.nickname}</span>
        </div>`);

        el.click(() => {
          if (el.attr("class").includes("tucz-select")) {
            el.removeClass("tucz-select");
          } else {
            el.addClass("tucz-select");
          }
        });

        el.appendTo(".tucz-mc-chars");
      }

      $("#tucz-s-a").click(() => {
        $(".char-t").each(function () {
          $(this).addClass("tucz-select");
        });
      });

      $("#tucz-s-k").click(async () => {
        const list = [];

        $(".tucz-select span").each(function () {
          list.push($(this).text());
        });

        for (let i in list) {
          console.log(`/kill ${$(".tucz-kill input").val()} ${list[i]}`);

          webSocket.send(
            JSON.stringify({
              g: `browser_token=${g.browser_token}&ev=${g.ev}&t=chat`,
              p: JSON.stringify({
                c: `/kill ${$(".tucz-kill input").val()} ${list[i]}`,
              }),
            })
          );

          await sleep(250);
        }
      });

      $("#tucz-s-u").click(async () => {
        const list = [];

        $(".tucz-select span").each(function () {
          list.push($(this).text());
        });

        for (let i in list) {
          webSocket.send(
            JSON.stringify({
              g: `browser_token=${g.browser_token}&ev=${g.ev}&t=chat`,
              p: JSON.stringify({
                c: `/unkill ${list[i]}`,
              }),
            })
          );

          await sleep(250);
        }
      });

      $(".alert-box .alert-close").click(() => {
        $(".alert-box").fadeOut("fast", () => {
          $(".alert-box").remove();
        });
      });
    }

    async baseRequest(task, data) {
      let time = Date.now();

      const settings = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      };

      try {
        if ($(".tucz-window").length > 0) this.showWaitBtn();
        const fetchResponse = await fetch(`${this.baseURL}${task}`, settings);
        if ($(".tucz-window").length > 0) this.endWaitBtn();

        if (fetchResponse.status === 429) {
          return {
            slow: "Odczekaj trochę przed kolejną próbą.",
          };
        }

        let data = await fetchResponse.json();
        data.ping = Date.now() - time;
        return data;
      } catch (e) {
        if ($(".tucz-window").length > 0) this.endWaitBtn();
        return {
          error: e,
        };
      }
    }

    showLoginForm() {
      $(".tucz-login-form").remove();
      $(`<div class="tucz-login-form small-window tucz-window">
         <header>
            <b>Logowanie</b>
            <div class="under-header"></div>
            <div class="close-windows-ga">X</div>
        </header>
        <main>
            <div class="tucz-subtitle">Podaj hasło:</div>
            <input id="tucz-login-password" type="password">
            <button class="tucz-login">Zaloguj</button>
        </main>
        <bottom>
            <b class="bottom-links">Nie posiadasz konta?</b>
        </bottom>
       </div>`).appendTo($("body"));

      $(".tucz-login-form .close-windows-ga").click(() => {
        this.hideForms();
      });

      $(".tucz-login-form .bottom-links").click(() =>
        this.showRegisterWindow()
      );

      $(".tucz-login").click(() => this.login());
    }
    async register() {
      if ($("#tucz-password").val() === "") {
        return this.showAlert(`Uzupełnij wszystkie pola!`);
      }

      if ($("#tucz-password").val() !== $("#tucz-password2").val()) {
        return this.showAlert(`Podane hasła są różne!`);
      }

      const res = await this.baseRequest("register", {
        user_id: getCookie("user_id"),
        password: $("#tucz-password").val(),
        nickname: hero.nick,
      });

      if (res.slow) return this.showAlert(res.slow);
      if (res.error) return this.showAlert(res.error);

      if (res.code) {
        return this.showCodeAlert(res.success, res.code);
      }

      if (res.success) {
        this.showAlert(res.success);
        this.showLoginForm();
      }
    }

    async parseCommand(value) {
      if (value.includes("/c")) {
        if (value.substring(0, 2) === "/c") {
          this.sendNewMessage(value.replace("/c ", ""));
        }
      }

      if (value.substring(0, 6) === "/lock") {
        this.sendNewMessage(value);
      }

      if (value.substring(0, 8) === "/unlock") {
        this.sendNewMessage(value);
      }

      if (value.substring(0, 6) === "/gmute") {
        this.sendNewMessage(value);
      }

      if (value.substring(0, 6) === "/gmenu") {
        if (value === "/gmenu") {
          value += ` ${g.other[Object.keys(g.other)[0]].nick}`;
        }

        this.sendNewMessage(value);
      }
    }

    async initGFunction() {
      ((oldChatSend) => {
        chatSend = (key, value) => {
          if (key.includes("/")) {
            this.parseCommand(key);
          }
          return oldChatSend(key, value);
        };
      })(chatSend);

      ((OldParseInput) => {
        parseInput = (key, value) => {
          if (key.event_done && this.addonLoaded) {
            this.socket.emit("getChat");
          }
          return OldParseInput(key, value);
        };
      })(parseInput);
    }

    async login() {
      if ($("#tucz-login-password").val() === "") {
        return this.showAlert(`Uzupełnij wszystkie pola!`);
      }

      const res = await this.baseRequest("login", {
        user_id: getCookie("user_id"),
        password: $("#tucz-login-password").val(),
      });

      if (res.slow) return this.showAlert(res.slow);
      if (res.error) return this.showAlert(res.error);

      if (res.code) {
        return this.showCodeAlert(res.success, res.code);
      }

      if (res.session) {
        this.session = res.session;
        localStorage.setItem("tucz_session", res.session);
        this.hideForms();
        await sleep(1000);
        return this.inits();
      }
    }

    hideForms() {
      $(".tucz-login-form").fadeOut("fast", () => {
        $(".tucz-login-form").remove();
      });

      $(".tucz-register-form").fadeOut("fast", () => {
        $(".tucz-register-form").remove();
      });
    }

    showRegisterWindow() {
      $(".tucz-login-form").remove();
      $(`<div class="tucz-login-form tucz-window">
        <header>
            <b>Rejestracja</b>
            <div class="under-header"></div>
            <div class="close-windows-ga">X</div>
        </header>
        <main>
            <div class="tucz-subtitle">Podaj hasło:</div>
            <input id="tucz-password" type="password">
            <div class="tucz-subtitle">Podaj ponownie hasło:</div>
            <input id="tucz-password2" type="password">
            <button class="tucz-register">Zarejestruj</button>
        </main>
        <bottom>
            <b class="bottom-links">Posiadasz juz konto?</b>
        </bottom>
       </div>`).appendTo($("body"));

      $(".tucz-login-form .close-windows-ga").click(() => {
        this.hideForms();
      });

      $(".tucz-login-form .bottom-links").click(() => this.showLoginForm());
      $(".tucz-register").click(() => this.register());
    }

    showAlert(text) {
      $(".alert-box").remove();
      $(`<div class="alert-box tucz-window">
        <header>
            <b>Uwaga</b>
            <div class="under-header"></div>
        </header>
        <main>
            <div>${text}</div>
            <button class="alert-close">Zamknij</button>
        </main>
       </div>`)
        .appendTo($("body"))
        .draggable({
          containment: "body",
          start: function () {
            g.lock.add("alert-box");
          },
          stop: function () {
            g.lock.remove("alert-box");
          },
        });

      $(".alert-box button").click(() => {
        $(".alert-box").fadeOut("fast", () => {
          $(".alert-box").remove();
        });
      });
    }
  }

  const TuczAddons = new TuczempAddons();
  await TuczAddons.inits();

  (function (_lx) {
    battleMsg = function (bk, v) {
      if (bk.search("winner=") > -1) {
        const parseBattleF = {};

        for (let i in g.battle.f) {
          parseBattleF[i] = g.battle.f[i];
        }

        TuczAddons.socket.emit("newBattle", {
          battle: parseBattleF,
          map: map.name,
          user_id: getCookie("user_id"),
          session: localStorage.getItem("tucz_session"),
          nickname: hero.nick,
          winner: bk,
        });
      }
      return _lx(bk, v);
    };
  })(battleMsg);
})();
