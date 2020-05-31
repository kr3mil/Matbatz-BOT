var unirest = require("unirest");

var req = unirest("GET", "https://deezerdevs-deezer.p.rapidapi.com/search");

const ytdl = require("ytdl-core");
const Discord = require('discord.js');
const bot = new Discord.Client();
const config = require('./config.json');

var servers = {};

bot.on('ready', () => {
    console.log('Online!');
})

function play(connection, message) {
    var server = servers[message.guild.id];

    server.dispatcher = connection.play(ytdl(server.queue[0], {filter: "audio"}));

    server.queue.shift();

    server.dispatcher.on("debug", function() {
        console.log('debug');
    });

    server.dispatcher.on("finish", function() {
        console.log('Songs left: ' + server.queue.length);
        if(server.queue[0]){
            play(connection, message);
        }else{
            connection.disconnect();
        }
    });
}

bot.on('message', message => {
    if(message.content[0] !== config.Prefix) return;
    let args = message.content.substring(config.Prefix.length).split(" ");

    switch(args[0]){
        case 'search':
            if(!args[1]) return message.reply('Error, please enter a search term');
        
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
                var msg = "```" + "Top 5 results:\n";
                for(var i = 0; i < 5; i++){
                    msg += `  ${json['data'][i+1]['artist']['name']} - ${json['data'][i+1]['title_short']}\n`;
                }
                msg += "```";
                return message.channel.send(msg);
            });
            break;
        case 'play':
            if(!args[1]){
                message.channel.send("You need to provide a link!");
                return;
            }
            //change here
            if(!message.member.voice.channel){
                message.channel.send("You must be in a channel to play the bot.");
                return;
            }
            
            //queues
            if(!servers[message.guild.id]){
                console.log('Adding server to servers array');
                servers[message.guild.id] = {
                queue: []
            }}

            var server = servers[message.guild.id];
            console.log('Queue size: ' + server.queue.length);
            server.queue.push(args[1]);
            console.log('Song added to queue');
            console.log('Queue size: ' + server.queue.length);
            if(!message.guild.voice) message.member.voice.channel.join().then(function(connection){
                console.log('Bot not in voice channel');
                play(connection, message);
            });
            break;
        case 'skip':
            var server = servers[message.guild.id];
            if(server.dispatcher) server.dispatcher.end();
            break;
        case 'help':
            break;
        default:
            break;
    }
})

bot.login(config.Token);