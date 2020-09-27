var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var unirest = require("unirest");
var req = unirest("GET", "https://deezerdevs-deezer.p.rapidapi.com/search");
var exec = require("child_process").exec;

const request = require("request");
const ytdl = require("ytdl-core-discord");
var config =
  process.env.username !== "theor" ? process.env : require("./config.json");
const yts = require("yt-search");
const Discord = require("discord.js");
const bot = new Discord.Client();
const Http = new XMLHttpRequest();
const fs = require("fs");
const Jimp = require("jimp");
const lyrics = require("solenolyrics");
const lyricsIfMedia = require("lyrics-finder");

const quiz = require("./quiz.js");
const { split } = require("ffmpeg-static");

const pastaMembers = [
  "206797799260553216",
  "240611985287413760",
  "264852817464786945",
  "121675133185294339",
  "82996854853206016",
];
const retardMembers = ["206797799260553216"];
const admins = ["121675133185294339"];
var servers = {};
var currentSong;
var currentMsg;
var previousSong;
var ytdlStream;

bot.on("ready", () => {
  console.log("Online!");
});

async function deepFry(message) {
  if (message.attachments.size > 0) {
    console.log("message has image");

    let pixelValue = Math.floor(Math.random() * 2 + 2);
    let imageUrl = message.attachments.array()[0].url;
    await Jimp.read(imageUrl).then((image) =>
      image
        .pixelate(pixelValue)
        .contrast(0.95)
        .posterize(8)
        .write("deepfry.png")
    );
    await message.channel.send({ files: ["deepfry.png"] });
  }
}

function createEmbed(song, title) {
  const embed = new Discord.MessageEmbed()
    .setTitle(title)
    .addField("Title", song.song.videoDetails.title)
    .addField("Requester", song.req)
    .setThumbnail(
      last(song.song.player_response.videoDetails.thumbnail.thumbnails)["url"]
    )
    .setColor(0xf1c40f)
    .setFooter(song.song.videoDetails.video_url);

  return embed;
}

async function showCurrent(message) {
  return message.channel.send(createEmbed(currentSong, "Currently playing"));
}

function last(array) {
  return array[array.length - 1];
}

async function play(connection, message) {
  try {
    let server = servers[message.guild.id];

    currentSong = server.queue[0];
    //ytdlStream = await ytdl.downloadFromInfo(currentSong.song, {type: 'opus', quality: 'highestaudio', filter: 'audioonly', requestOptions: { maxReconnects: 15, maxRetries: 5}});
    // TODO add reconects back in ect
    ytdlStream = await ytdl(currentSong.song.videoDetails.video_url);
    server.dispatcher = connection.play(ytdlStream, { type: "opus" });
    currentMsg = await showCurrent(message);

    server.queue.shift();

    server.dispatcher.on("finish", function () {
      previousSong = currentSong;
      currentSong = undefined;
      ytdlStream = undefined;
      currentMsg.delete();
      console.log("Songs left: " + server.queue.length);
      if (server.queue[0]) {
        play(connection, message);
      } else {
        // Change so it disconnects after a while?
        connection.disconnect();
      }
    });

    server.dispatcher.on("reconnect", function () {
      console.log("Tried to reconnect?");
    });

    server.dispatcher.on("retry", function () {
      console.log("Tried to retry?");
    });
  } catch {
    console.log("error playing song, skipping");
    if (server.dispatcher) server.dispatcher.end();
    else {
      currentSong = undefined;
      ytdlStream = undefined;
      if (currentMsg) currentMsg.delete();
      if (server.queue[0]) {
        play(connection, message);
      } else {
        // Change so it disconnects after a while?
        connection.disconnect();
      }
    }
  }
}

async function ytPlaylistSearch(message, opts, attempts = 0) {
  if (attempts < 5) {
    console.log("Attempting to get playlist (ytPlaylistSearch) " + attempts);
    await yts(opts, function (err, r) {
      console.log("yts finished");
      try {
        const videos = r.videos;
        console.log(r);
        if (videos != undefined) {
          console.log(
            "found playlist, adding " + videos.length + " songs to queue"
          );
          playPlaylist(message, videos);
        }
      } catch (exception) {
        console.log("playlist not found, attempt " + attempts);
        ytPlaylistSearch(message, opts, attempts++);
      }
    });
  }
}

async function ytVidSearch(message, opts, attempts = 0) {
  if (attempts < 5) {
    await yts(opts, function (err, r) {
      try {
        const videos = r.videos;
        console.log(videos);
        playUrl(message, videos[0]["url"]);
      } catch (exception) {
        console.log("video not found, attempt " + attempts);
        attempts++;
        ytVidSearch(message, opts, attempts++);
      }
    });
  } else {
    message.channel.send(
      "Could not find video with search term: " + opts.query
    );
  }
}

async function getUrl(message, args) {
  const validate = await ytdl.validateURL(args[1]);
  if (validate) {
    return playUrl(message, args[1]);
  }
  console.log("Url not valid, looking for video");
  const searchTerm = args.slice(1).join(" ");
  console.log("Search term: " + searchTerm);

  if (searchTerm.includes("?list=")) {
    let playlistId = searchTerm.split("list=")[1];
    console.log("playlist: " + playlistId);
    const opts = {
      listId: playlistId,
    };

    await ytPlaylistSearch(message, opts);
  } else {
    const opts = {
      query: searchTerm,
      pageStart: 1,
      pageEnd: 2,
    };

    await ytVidSearch(message, opts);
  }
}

async function search(message, args, attempts = 0) {
  const searchTerm = args.slice(1).join(" ");
  console.log(`searching for: ${searchTerm}`);
  if (attempts < 5) {
    await yts(searchTerm, function (err, r) {
      if (err) {
        console.log("ERROR SEARCHING");
        console.log(err);
        return;
      }
      try {
        console.log(r);
        const videos = r.videos;
        let msg = "```" + "Top 5 YouTube results:\n";
        for (let i = 0; i < 5; i++) {
          msg += "  " + videos[i]["title"] + " - " + videos[i]["url"] + "\n";
        }
        msg += "```";
        return message.channel.send(msg);
      } catch {
        // TODO display error
        console.log("Error searching, attempt " + attempts);
        search(message, args, attempts++);
      }
    });
  } else {
    message.channel.send(
      "Could not find any videos using the search term: " + searchTerm
    );
  }
}

async function playPlaylist(message, videos) {
  console.log("Time to add playlist");
  let server = servers[message.guild.id];
  let itemsAdded = 0;
  for (let i = 0; i < videos.length; i++) {
    try {
      console.log("trying to get song");
      const song = await ytdl.getInfo(
        "https://www.youtube.com/watch?v=" + videos[i].videoId
      );
      if (song != undefined) {
        console.log("got song (playPlaylist)");
        if (song.player_response.playabilityStatus.status != "OK") {
          console.log("video unavailable, not adding");
          continue;
        }
        let name = message.member.nickname;
        if (name == undefined) {
          name = message.member.user.username;
        }
        server.queue.push({ song: song, req: name });
        itemsAdded++;
        console.log(`video ${itemsAdded} added to queue`);
        if (message.guild.voice) {
          if (message.guild.voice.connection) continue;
        }

        message.member.voice.channel.join().then(function (connection) {
          console.log("Bot not in voice channel, connecting");
          play(connection, message);
        });
      }
    } catch (err) {
      console.log("Error getting video");
    }
  }
  message.channel.send(`${itemsAdded} songs added to queue`);
}

async function playUrl(message, url) {
  console.log("got url");
  console.log(url);
  const song = await ytdl.getInfo(url);

  if (song.player_response.playabilityStatus.status != "OK") {
    return channel.message.send("Video unavailable");
  } else {
    let server = servers[message.guild.id];
    console.log("Queue size: " + server.queue.length);
    let name = message.member.nickname;
    if (name == undefined) {
      name = message.member.user.username;
    }
    server.queue.push({ song: song, req: name });
    message.channel.send(
      `'${song.videoDetails.title}' has been added to the queue.`
    );
    console.log("Queue size: " + server.queue.length);

    if (message.guild.voice) {
      if (message.guild.voice.connection) return;
    }

    message.member.voice.channel.join().then(function (connection) {
      console.log("Bot not in voice channel, connecting");
      play(connection, message);
    });
  }
}

function embedFaceit(message, args) {
  if (!args[1]) return message.reply("Error, please enter a faceit name");
  console.log("Getting elo on player: " + args[1]);
  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${config.FaceITApiKey}`,
  };

  const options = {
    url: `https://open.faceit.com/data/v4/players?nickname=${args[1]}&game=csgo`,
    headers: headers,
  };

  request(options, function (err, r, body) {
    if (!err && r.statusCode == 200) {
      const json = JSON.parse(body);
      try {
        const embed = new Discord.MessageEmbed()
          .setTitle(`Faceit: ${json["nickname"]}`)
          .addField("Level", json["games"]["csgo"]["skill_level"], true)
          .addField("Elo", json["games"]["csgo"]["faceit_elo"], true)
          .setThumbnail(json["avatar"])
          .setColor(0xf1c40f)
          .setFooter(
            json["new_steam_id"],
            `https://www.countryflags.io/${json["country"]}/flat/64.png`
          );

        return message.channel.send(embed);
      } catch {
        console.log("error getting faceit stats");
      }
    } else {
      console.log("error getting faceit stats");
      console.log(body);
    }
  });
}

async function top5(message, args) {
  let searchTerm = args.slice(1).join(" ");

  req.query({
    q: searchTerm,
  });

  req.headers({
    "x-rapidapi-host": "deezerdevs-deezer.p.rapidapi.com",
    "x-rapidapi-key": config.RapidAPIKey,
    useQueryString: true,
  });

  req.end(function (res) {
    if (res.error) throw new Error(res.error);

    let json = res.body;
    let msg = "```" + "Top 5 Deezer results:\n";
    for (var i = 0; i < 5; i++) {
      try {
        msg += `  ${json["data"][i]["artist"]["name"]} - ${json["data"][i]["title_short"]}\n`;
      } catch {
        console.log("no result");
      }
    }
    msg += "```";
    return message.channel.send(msg);
  });
}

async function attack(message, args) {
  if (!args[1]) return;

  let req = new XMLHttpRequest();
  req.open("GET", "https://insult.mattbas.org/api/insult.txt?who=DEL", true);

  console.log(encodeURI(args[1]));

  req.send();

  req.onreadystatechange = (e) => {
    if (req.readyState == 4 && req.status >= 200 && req.status < 400) {
      try {
        message.channel.send(`${args[1]}${req.responseText.substr(3)}`);
      } catch (err) {
        //console.log(err);
        console.log("Failed to get insult");
      }
    }
  };
}

bot.on("message", (message) => {
  if (message.member != null) {
    // Copy pastas & retards
    if (retardMembers.includes(message.member.id)) {
      // 5% chance to call him a retard
      if (Math.ceil(Math.random() * 20) == 1) {
        message.channel.send("retard");
      }
    } else if (pastaMembers.includes(message.member.id)) {
      // 5% chance to send dm featuring a copypasta
      // if (Math.ceil(Math.random() * 150) == 1) dmCopypasta(message);
    }

    // Quiz messages
    if (message.member.id !== "716527028844888104") {
      quiz.handleQuizAnswer(message);
    }
    console.log(`Member id: ` + message.member.id);
  }

  if (message.content[0] !== config.Prefix) return;
  let args = message.content.substring(config.Prefix.length).split(" ");

  const cmd = args[0].toLowerCase();
  const server = servers[message.guild.id];

  // Check admin commands
  if (message.member != null && admins.includes(message.member.id)) {
    switch (cmd) {
      case "addretard":
        // TODO
        break;
      case "addpasta":
        // TODO
        break;
      default:
        break;
    }
  }

  // Normal commands
  switch (cmd) {
    case "joinquiz":
      quiz.joinQuiz(message);
      break;
    case "startquiz":
      quiz.startQuiz(message, args);
      break;
    case "quizcats":
      quiz.displayCategories(message);
    case "deepfry":
      deepFry(message);
      break;
    case "top5":
      if (!args[1]) return message.reply("Error, please enter a search term");

      top5(message, args);
      break;
    case "search":
      if (!args[1]) return message.reply("Error, please enter a search term");
      console.log(`calling search with args: ` + args);
      search(message, args);
      break;
    case "clear":
      server.queue = [];
      currentSong = [];
      if (server.dispatcher) server.dispatcher.end();
      break;
    case "insult":
      attack(message, args);
      break;
    case "p":
    case "play":
      if (!args[1]) {
        message.channel.send("You need to provide a link!");
        return;
      }

      if (!message.member.voice.channel) {
        message.channel.send("You must be in a channel to play the bot.");
        return;
      }

      if (!servers[message.guild.id]) {
        console.log("Adding server to servers array");
        servers[message.guild.id] = {
          queue: [],
        };
      }

      getUrl(message, args);
      break;
    case "skip":
      if (server.dispatcher) server.dispatcher.end();
      break;
    case "pause":
      if (server.dispatcher) {
        //ytdlStream.pause(true);
        console.log("paused");
        //console.log(ytdlStream);
        server.dispatcher.pause();
      }
      break;
    case "unpause":
    case "resume":
      if (server.dispatcher) server.dispatcher.resume();
      break;
    case "elo":
      embedFaceit(message, args);
      break;
    case "previous":
      if (previousSong != undefined) {
        return message.channel.send(createEmbed(previousSong, "Previous song"));
      }
      break;
    case "prev":
      if (previousSong != undefined) {
        return message.channel.send(createEmbed(previousSong, "Previous song"));
      }
      break;
    case "lookup":
      if (!args[1])
        return message.reply("Error, please enter a character name");

      if (args[1].includes("-")) {
        let charRealm = args[1].split("-");
        const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/${charRealm[1].toLowerCase()}/${charRealm[0].toLowerCase()}?namespace=profile-eu${
          config.AccessEnding
        }${config.AccessToken}`;
        Http.open("GET", characterUrl);
      } else {
        const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/thunderhorn/${args[1].toLowerCase()}?namespace=profile-eu${
          config.AccessEnding
        }${config.AccessToken}`;
        Http.open("GET", characterUrl);
      }
      Http.send();

      Http.onreadystatechange = (e) => {
        if (Http.readyState == 4) {
          if (Http.status == 200) {
            console.log("received character");
            const characterJS = JSON.parse(Http.responseText);

            // Get avatar
            const avatarHttp = new XMLHttpRequest();
            const avatarURL =
              characterJS["media"]["href"] +
              config.AccessEnding +
              config.AccessToken;
            avatarHttp.open("GET", avatarURL);
            avatarHttp.send();

            avatarHttp.onreadystatechange = (a) => {
              if (avatarHttp.readyState == 4) {
                const avatarJS = JSON.parse(avatarHttp.responseText);
                return message.channel.send(
                  generateCharacterEmbed(characterJS, avatarJS)
                );
              }
            };
          } else if (Http.status == 404) {
            return message.channel.send(
              "Character '" + args[1] + "' does not exist."
            );
          } else {
            console.log(Http.responseText);
          }
        }
      };
      break;
    case "render":
      if (!args[1])
        return message.reply("Error, please enter a character name");
      if (args[1].includes("-")) {
        let charRealm = args[1].split("-");
        const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/${charRealm[1].toLowerCase()}/${charRealm[0].toLowerCase()}/character-media?namespace=profile-eu${
          config.AccessEnding
        }${config.AccessToken}`;
        Http.open("GET", characterUrl);
      } else {
        const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/thunderhorn/${args[1].toLowerCase()}/character-media?namespace=profile-eu${
          config.AccessEnding
        }${config.AccessToken}`;
        Http.open("GET", characterUrl);
      }
      Http.send();

      Http.onreadystatechange = (e) => {
        if (Http.readyState == 4) {
          if (Http.status == 200) {
            var avatarJS = JSON.parse(Http.responseText);

            return message.channel.send({ files: [avatarJS["render_url"]] });
          }
        }
      };
      break;
    case "roll":
      let upperLimit = 10;
      if (args[1]) {
        upperLimit = parseInt(args[1]);
      }
      return message.reply(
        `you rolled a ${Math.ceil(
          Math.random() * upperLimit
        )} (1 - ${upperLimit})`
      );
    case "lyrics":
      getLyrics(message);
      break;
    case "gettoken":
      if (message.member.hasPermission("ADMINISTRATOR")) {
        getAuthToken();
        return message.reply("Refreshed auth token.");
      }
      return message.reply("This command is only for Admins.");
    case "joke":
      dadJoke(message);
      break;
    case "queue":
      displayQueue(message);
      break;
    case "current":
      if (currentSong != undefined) {
        message.channel.send(
          `Current song: ${currentSong.song.videoDetails.title}`
        );
      }
      break;
    case "remove":
      if (!args[1]) return message.reply("Error, please enter a song title");
      let searchTerm = args.slice(1).join(" ");
      console.log(
        `searching for ${searchTerm} in ${server.queue.length} songs`
      );
      let index = server.queue.findIndex((x) =>
        x.song.videoDetails.title
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
      if (index > -1) {
        let removedSong = server.queue[index].song;
        server.queue.splice(index, 1);
        return message.channel.send(
          `${removedSong.videoDetails.title} removed from queue`
        );
      }
      break;
    case "help":
      break;
    default:
      break;
  }
});

bot.login(config.Token);

async function getLyrics(message) {
  if (currentSong) {
    if (currentSong.song.videoDetails.media) {
      let { artist, song } = currentSong.song.videoDetails.media;
      console.log("Artist: " + artist + ", Song: " + song);
      if (artist && lyrics) {
        let foundLyrics = await lyricsIfMedia(artist, song);
        if (foundLyrics) {
          return sendLyrics(message, foundLyrics);
        }
        return getLyricsOther(message);
      }
      return getLyricsOther(message);
    } else {
      return getLyricsOther(message);
    }
  } else {
    return message.channel.send("No song currently playing");
  }
}

async function getLyricsOther(message) {
  console.log("Getting lyrics using title");
  let splitTitle = currentSong.song.videoDetails.title.split("-");
  if (splitTitle.length > 1) {
    let foundLyrics = await lyricsIfMedia(splitTitle[0], splitTitle[1]);
    if (!foundLyrics) {
      foundLyrics = await lyricsIfMedia(splitTitle[1], splitTitle[0]);
    }
    if (foundLyrics) {
      sendLyrics(message, foundLyrics);
    }
    console.log(foundLyrics);
  } else {
    console.warn("Can't get artist and song name using title");
    console.log("Maybe try finding lyrics using other lyrics api?");
  }
  // let foundLyrics = await lyrics.requestLyricsFor(
  //   currentSong.song.videoDetails.title
  // );
  // console.log(foundLyrics);
}

async function sendLyrics(message, foundLyrics) {
  let lyricsArray = foundLyrics.split("");
  let iter = 1750;
  for (let i = 0; i < lyricsArray.length; i = i + iter) {
    let temparray = lyricsArray.slice(i, i + iter);
    message.channel.send("```" + temparray.join("") + "```");
  }
  return;
}

function dmCopypasta(message) {
  try {
    let req = new XMLHttpRequest();
    req.open("GET", "https://www.reddit.com/r/copypasta/.json", true);

    req.send();

    req.onreadystatechange = (e) => {
      if (req.readyState == 4 && req.status >= 200 && req.status < 400) {
        try {
          const data = JSON.parse(req.responseText);
          const posts = data.data.children;
          const postNr = Math.floor(Math.random() * posts.length);
          const post = posts[postNr].data;
          console.log("-");
          console.log("-");
          console.log("-");
          console.log("POST HERE:");
          console.log(post);
          const msg = post.selftext;
          message.author.send(msg);
          console.log("DMd copypasta to: " + message.author);
        } catch (err) {
          //console.log(err);
          console.log("Tried to dm a copypasta but something failed.");
          message.author.send(
            "so i tried to send you a copypasta fam but something messed up sorry"
          );
        }
      }
    };
  } catch {
    message.author.send(
      "so i tried to send you a copypasta fam but something messed up sorry"
    );
  }
}

function displayQueue(message) {
  let server = servers[message.guild.id];
  let msg = "```Queue: " + server.queue.length + "\n";
  for (let i = 0; i < Math.min(server.queue.length, 5); i++) {
    msg += "  " + server.queue[i].song.videoDetails.title + "\n";
  }
  return message.channel.send((msg += "```"));
}

function dadJoke(message) {
  console.log("dad joke called");
  const headers = {
    Accept: "application/json",
  };

  const options = {
    url: "https://icanhazdadjoke.com/",
    headers: headers,
  };

  request(options, function (err, r, body) {
    if (!err && r.statusCode == 200) {
      const json = JSON.parse(body);
      message.channel.send(json["joke"]);
    }
  });
}

function generateCharacterEmbed(characterJS, avatarJS) {
  const embed = new Discord.MessageEmbed()
    .setTitle(characterJS["name"])
    .addField("Level", characterJS["level"], true)
    .addField("iLvl", characterJS["equipped_item_level"], true)
    .addField("Guild", characterJS["guild"]["name"], true)
    .addField("Race", characterJS["race"]["name"], true)
    .addField("Spec", characterJS["active_spec"]["name"], true)
    .addField("Class", characterJS["character_class"]["name"], true)
    .setThumbnail(avatarJS["avatar_url"])
    .setColor(0xf1c40f)
    .setFooter(characterJS["realm"]["name"]);

  return embed;
}

function getAuthToken() {
  const command = `curl -u ${config.ClientID}:${config.ClientSecret} -d grant_type=client_credentials https://us.battle.net/oauth/token`;

  child = exec(command, function (error, stdout, stderr) {
    console.log("stdout: " + stdout);
    console.log("stderr: " + stderr);

    if (error !== null) {
      console.log("exec error: " + error);
    }

    let json = JSON.parse(stdout);
    if (json !== null) {
      let token = json["access_token"];
      if (token !== null) {
        console.log("set token to: " + token);
        config.AccessToken = token;
      }
    }
  });
}
