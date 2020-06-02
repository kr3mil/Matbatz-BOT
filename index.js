var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var unirest = require("unirest");
var req = unirest("GET", "https://deezerdevs-deezer.p.rapidapi.com/search");
var exec = require('child_process').exec;

const request = require('request');
const ytdl = require("ytdl-core-discord");
const yts = require('yt-search');
const Discord = require('discord.js');
const bot = new Discord.Client();
const config = require('./config.json');
const Http = new XMLHttpRequest();
const fs = require('fs');

const pastaMembers = ['206797799260553216', '240611985287413760', '264852817464786945', '121675133185294339'];
const retardMembers = ['206797799260553216'];

var servers = {};
var currentSong;
var currentMsg;

bot.on('ready', () => {
    console.log('Online!');
})

async function showCurrent(message){
    const embed = new Discord.MessageEmbed()
    .setTitle(`Currently playing`)
    .addField('Title', currentSong.title)
    .setThumbnail(last(currentSong.player_response.videoDetails.thumbnail.thumbnails)['url'])
    .setColor(0xF1C40F)
    .setFooter(currentSong.video_url)

    return message.channel.send(embed);
}

function last(array) {
    return array[array.length - 1];
}

async function play(connection, message) {
    let server = servers[message.guild.id];

    currentSong = server.queue[0];
    server.dispatcher = connection.play(await ytdl.downloadFromInfo(currentSong, {type: 'opus', quality: 'highestaudio', filter: 'audioonly', requestOptions: { maxReconnects: 15, maxRetries: 5}}));
    currentMsg = await showCurrent(message);

    server.queue.shift();

    server.dispatcher.on("finish", function() {
        currentSong = undefined;
        currentMsg.delete();
        console.log('Songs left: ' + server.queue.length);
        if(server.queue[0]){
            play(connection, message);
        }else{
            // Change so it disconnects after a while?
            connection.disconnect();
        }
    });

    server.dispatcher.on("reconnect", function() {
        console.log('Tried to reconnect?');
    });

    server.dispatcher.on("retry", function() {
        console.log('Tried to retry?');
    })
}

async function getUrl(message, args){
    const validate = await ytdl.validateURL(args[1]);
    if(validate) {
        return playUrl(message, args[1]);
    }
    console.log('Url not valid, looking for video');
    const searchTerm = args.splice(1).join(' ');
    yts(searchTerm, function(err, r){
        try{
            const videos = r.videos;
            //console.log(videos);
            playUrl(message, videos[0]['url']);
        }
        catch(exception){
            console.log('video not found');
            // TODO display error
        }
    });
}

async function search(message, args){
    const searchTerm = args.splice(1).join(' ');
    yts(searchTerm, function(err, r){
        try{
            const videos = r.videos;
            let msg = "```" + "Top 5 YouTube results:\n";
            for(let i = 0; i < 5; i++){
                msg += "  " + videos[i]['title'] + " - " + videos[i]['url'] + "\n";
            }
            msg += "```";
            return message.channel.send(msg);
        }
        catch{
            // TODO display error
        }
    });
}

async function playUrl(message, url){
    console.log('got url');
    console.log(url);
    const song = await ytdl.getInfo(url);

    let server = servers[message.guild.id];
    console.log('Queue size: ' + server.queue.length);
    server.queue.push(song);
    message.channel.send(`'${song.title}' has been added to the queue.`);
    console.log('Queue size: ' + server.queue.length);

    if(message.guild.voice){
        if(message.guild.voice.connection) return;
    }
    
    message.member.voice.channel.join().then(function(connection){
        console.log('Bot not in voice channel, connecting');
        play(connection, message);
        });
}

function embedFaceit(message, args){
    const headers = {
        'accept': 'application/json',
        'Authorization': `Bearer ${config.FaceITApiKey}`
    };

    const options = {
        url: `https://open.faceit.com/data/v4/players?nickname=${args[1]}&game=csgo`,
        headers: headers
    };
    
    request(options, function(err, r, body){
        if(!err && r.statusCode == 200){
            const json = JSON.parse(body);
            try{
                const embed = new Discord.MessageEmbed()
                .setTitle(`Faceit: ${json['nickname']}`)
                .addField('Level', json['games']['csgo']['skill_level'], true)
                .addField('Elo', json['games']['csgo']['faceit_elo'], true)
                .setThumbnail(json['avatar'])
                .setColor(0xF1C40F)
                .setFooter(json['new_steam_id'], `https://www.countryflags.io/${json['country']}/flat/64.png`)
    
                return message.channel.send(embed);
            }
            catch{

            }
        }
    });
}

async function top5(message, args){
    let searchTerm = args.slice(1).join(' ');

    req.query({
        "q": searchTerm
    });

    req.headers({
        "x-rapidapi-host": "deezerdevs-deezer.p.rapidapi.com",
        "x-rapidapi-key": config.RapidAPIKey,
        "useQueryString": true
    });

    req.end(function (res) {
        if (res.error) throw new Error(res.error);

        let json = res.body;
        let msg = "```" + "Top 5 Deezer results:\n";
        for(var i = 0; i < 5; i++){
            try{
                msg += `  ${json['data'][i]['artist']['name']} - ${json['data'][i]['title_short']}\n`;
            }
            catch{
                console.log('no result');
            }
        }
        msg += "```";
        return message.channel.send(msg);
    });
}

bot.on('message', message => {
    if(message.member != null){
        if(retardMembers.includes(message.member.id)){
            // 5% chance to call him a retard
            if(Math.ceil(Math.random() * 20) == 1) message.channel.send('retard');
    
            // 5% chance to send dm featuring a copypasta
            if(Math.ceil(Math.random() * 20) == 1) dmCopypasta(message);
        }
        // Sharky
        else if(pastaMembers.includes(message.member.id)){
            // 5% chance to send dm featuring a copypasta
            if(Math.ceil(Math.random() * 20) == 1) dmCopypasta(message);
        }
        console.log(`Member id: ` + message.member.id);
    }

    if(message.content[0] !== config.Prefix) return;
    let args = message.content.substring(config.Prefix.length).split(" ");

    const cmd = args[0].toLowerCase();
    const server = servers[message.guild.id];
    switch(cmd){
        case 'top5':
            if(!args[1]) return message.reply('Error, please enter a search term');
        
            top5(message, args);
            break;
        case 'search':
            if(!args[1]) return message.reply('Error, please enter a search term');

            search(message, args);
            break;
        case 'clear':
            server.queue = [];
            if(server.dispatcher) server.dispatcher.end();
            break;
        case 'play':
            if(!args[1]){
                message.channel.send("You need to provide a link!");
                return;
            }

            if(!message.member.voice.channel){
                message.channel.send("You must be in a channel to play the bot.");
                return;
            }
            
            if(!servers[message.guild.id]){
                console.log('Adding server to servers array');
                servers[message.guild.id] = {
                queue: []
            }}

            getUrl(message, args);
            break;
        case 'skip':
            if(server.dispatcher) server.dispatcher.end();
            break;
        case 'elo':
            embedFaceit(message, args);
            break;
        case 'lookup':
            if(!args[1]) return message.reply('Error, please enter a character name');

            if(args[1].includes('-')){
                let charRealm = args[1].split('-');
                const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/${charRealm[1].toLowerCase()}/${charRealm[0].toLowerCase()}?namespace=profile-eu${config.AccessEnding}${config.AccessToken}`;
                Http.open("GET", characterUrl);
            }
            else{
                const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/thunderhorn/${args[1].toLowerCase()}?namespace=profile-eu${config.AccessEnding}${config.AccessToken}`;
                Http.open("GET", characterUrl);
            }
            Http.send();
            
            Http.onreadystatechange = (e) => {
                if(Http.readyState == 4){
                    if(Http.status == 200){
                        console.log('received character');
                        const characterJS = JSON.parse(Http.responseText);

                        // Get avatar
                        const avatarHttp = new XMLHttpRequest();
                        const avatarURL = characterJS['media']['href'] + config.AccessEnding + config.AccessToken;
                        avatarHttp.open("GET", avatarURL);
                        avatarHttp.send();

                        avatarHttp.onreadystatechange = (a) => {
                            if(avatarHttp.readyState == 4){
                                const avatarJS = JSON.parse(avatarHttp.responseText);
                                return message.channel.send(generateCharacterEmbed(characterJS, avatarJS));
                            }
                        }
                    }
                    else if(Http.status == 404){
                        return message.channel.send("Character '" + args[1] + "' does not exist.");
                    }
                    else{
                        console.log(Http.responseText);
                    }
                }
            }
            break;
        case 'render':
            if(!args[1]) return message.reply('Error, please enter a character name');
            if(args[1].includes('-')){
                let charRealm = args[1].split('-');
                const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/${charRealm[1].toLowerCase()}/${charRealm[0].toLowerCase()}/character-media?namespace=profile-eu${config.AccessEnding}${config.AccessToken}`;
                Http.open("GET", characterUrl);
            }
            else{
                const characterUrl = `https://eu.api.blizzard.com/profile/wow/character/thunderhorn/${args[1].toLowerCase()}/character-media?namespace=profile-eu${config.AccessEnding}${config.AccessToken}`;
                Http.open("GET", characterUrl);
            }
            Http.send();

            Http.onreadystatechange = (e) => {
                if(Http.readyState == 4){
                    if(Http.status == 200){
                        var avatarJS = JSON.parse(Http.responseText);

                        return message.channel.send({files: [avatarJS['render_url']]});
                    }
                }
            }
            break;
        case 'roll':
            let upperLimit = 10;
            if(args[1]){
                upperLimit = parseInt(args[1]);
            }
            return message.reply(`you rolled a ${Math.ceil(Math.random() * upperLimit)} (1 - ${upperLimit})`);
        case 'gettoken':
            if (message.member.hasPermission("ADMINISTRATOR")){
                getAuthToken();
                return message.reply('Refreshed auth token.');
            }
            return message.reply('This command is only for Admins.');
        case 'joke':
            dadJoke(message);
            break;
        case 'queue':
            displayQueue(message);
            break;
        case 'current':
            if(currentSong != undefined){
                message.channel.send(`Current song: ${currentSong.title}`);
            }
            break;
        case 'remove':
            if(!args[1]) return message.reply('Error, please enter a song title');
            let searchTerm = args.slice(1).join(' ');
            console.log(`searching for ${searchTerm} in ${server.queue.length} songs`);
            let index = server.queue.findIndex(x => x.title.toLowerCase().includes(searchTerm.toLowerCase()));
            if(index > -1){
                let removedSong = server.queue[index];
                server.queue.splice(index, 1);
                return message.channel.send(`${removedSong.title} removed from queue`);
            }
            break;
        case 'help':
            break;
        default:
            break;
    }
})

bot.login(config.Token);

function dmCopypasta(message){
    let req = new XMLHttpRequest();
    req.open('GET', 'https://www.reddit.com/r/copypasta/.json', true);

    req.send();

    req.onreadystatechange = (e) => {
        if(req.readyState == 4 && req.status >= 200 && req.status < 400){
            try{
                const data = JSON.parse(req.responseText);
                const posts = data.data.children;
                const postNr = Math.floor(Math.random() * posts.length);
                const post = posts[postNr].data;
                console.log('-');
                console.log('-');
                console.log('-');
                console.log('POST HERE:');
                console.log(post);
                const msg = post.selftext;
                message.author.send(msg);
                console.log('DMd copypasta to: ' + message.author);
            }
            catch(err){
                console.log(err);
                console.log('Tried to dm a copypasta but something failed.');
            }
        }
    };
}

function displayQueue(message){
    let server = servers[message.guild.id];
    let msg = "```Queue: " + server.queue.length + "\n";
    for(let i = 0; i < server.queue.length; i++){
        msg += "  " + server.queue[i].title + "\n";
    }
    return message.channel.send(msg += "```");
}

function dadJoke(message){
    const headers = {
        'Accept': 'application/json'
    };
    
    const options = {
        url: 'https://icanhazdadjoke.com/',
        headers: headers
    };

    request(options, function(err, r, body){
        if (!err && r.statusCode == 200) {
            const json = JSON.parse(body);
            message.channel.send(json['joke']);
        }
    });
}

function generateCharacterEmbed(characterJS, avatarJS){
    const embed = new Discord.MessageEmbed()
    .setTitle(characterJS['name'])
    .addField('Level', characterJS['level'], true)
    .addField('iLvl', characterJS['equipped_item_level'], true)
    .addField('Guild', characterJS['guild']['name'], true)
    .addField('Race', characterJS['race']['name'], true)
    .addField('Spec', characterJS['active_spec']['name'], true)
    .addField('Class', characterJS['character_class']['name'], true)
    .setThumbnail(avatarJS['avatar_url'])
    .setColor(0xF1C40F)
    .setFooter(characterJS['realm']['name'])

    return embed;
}

function getAuthToken(){
    const command = `curl -u ${config.ClientID}:${config.ClientSecret} -d grant_type=client_credentials https://us.battle.net/oauth/token`;

    child = exec(command, function(error, stdout, stderr){
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);

        if(error !== null){
            console.log('exec error: ' + error)
        }

        let json = JSON.parse(stdout);
        if(json !== null){
            let token = json["access_token"];
            if(token !== null){
                console.log('set token to: ' + token);
                config.AccessToken = token;
            }
        }
    });
    
}