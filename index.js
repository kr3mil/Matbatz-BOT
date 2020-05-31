var unirest = require("unirest");
var fs = require("fs");

var req = unirest("GET", "https://deezerdevs-deezer.p.rapidapi.com/search");

const Discord = require('discord.js');
const bot = new Discord.Client();
const config = require('./config.json');
const package = require('./package.json')

bot.on('ready', () => {
    console.log('Online!');
})

bot.on('message', message => {
    let args = message.content.substring(config.Prefix.length).split(" ");

    switch(args[0]){
        case 'search':
            if(!args[1]) return message.reply('Error, please enter a search term');
            
            req.query({
                "q": args[1]
            });

            req.headers({
                "x-rapidapi-host": "deezerdevs-deezer.p.rapidapi.com",
                "x-rapidapi-key": config.RapidAPIKey,
                "useQueryString": true
            });

            req.end(function (res) {
                if (res.error) throw new Error(res.error);

                let json = res.body;
                let top = json['data'][1];
                let msg = `!play ${top['artist']['name']} ${top['title_short']}`;
                if(msg !== null){
                    return message.channel.send(msg);
                }
            });

            break;
        case 'setPrefix':
            if (message.member.hasPermission("ADMINISTRATOR")){
                config.Prefix = args[1];
                return message.channel.send('Changed prefix to: ' + config.Prefix);
            }
            break;
        case 'help':
            break;
        default:
            break;
    }
})

bot.login(config.Token);