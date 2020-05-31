var unirest = require("unirest");
var req = unirest("GET", "https://deezerdevs-deezer.p.rapidapi.com/search");

const ytdl = require("ytdl-core-discord");
const Discord = require('discord.js');
const bot = new Discord.Client();
const config = require('./config.json');

const {google} = require('googleapis');
var youtubeV3 = google.youtube( { version: 'v3', auth: config.GoogleAPIKey } );

var servers = {};

bot.on('ready', () => {
    console.log('Online!');
})

async function play(connection, message) {
    var server = servers[message.guild.id];

    server.dispatcher = connection.play(await ytdl.downloadFromInfo(server.queue[0], {type: 'opus', quality: 'highestaudio', filter: 'audioonly', requestOptions: { maxReconnects: 15, maxRetries: 5}}));
    bot.user.setActivity(server.queue[0].title_short);

    server.queue.shift();

    server.dispatcher.on("finish", function() {
        console.log('Songs left: ' + server.queue.length);
        if(server.queue[0]){
            play(connection, message);
        }else{
            // Change so it disconnects after a while?
            //connection.disconnect();
            bot.user.setActivity('');
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
    let validate = await ytdl.validateURL(args[1]);
    if(validate) return playUrl(message, args[1]);
    console.log('Url not valid, looking for video');
    // Find first youtube video in search
    youtubeV3.search.list({
        part: 'snippet',
        type: 'video',
        q: args.splice(1).join(' '),
        maxResults: 1
    }, (err,response) => {
        try{
            playUrl(message, 'https://www.youtube.com/watch?v=' + response['data']['items'][0]['id']['videoId']);
        }
        catch(exception){
            console.log('video not found');
        }
    });
}

async function search(message, args){
    var searchTerm = args.splice(1).join(' ');
    youtubeV3.search.list({
        part: 'snippet',
        type: 'video',
        q: searchTerm,
        maxResults: 5
    }, (err, response) => {
        //if(err) return;
        var msg = "```" + "Top 5 YouTube results:\n";
        for(var i = 0; i < 5; i++){
            msg += "  " + response['data']['items'][i]['snippet']['title'] + "\n";
        }
        msg += "```";
        return message.channel.send(msg);
        //console.log(response['data']['items']);
    })
}

async function playUrl(message, url){
    console.log('got url');
    const song = await ytdl.getInfo(url);

    var server = servers[message.guild.id];
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
        var msg = "```" + "Top 5 Deezer results:\n";
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
    if(message.content[0] !== config.Prefix) return;
    let args = message.content.substring(config.Prefix.length).split(" ");

    switch(args[0]){
        case 'top5':
            if(!args[1]) return message.reply('Error, please enter a search term');
        
            top5(message, args);
            break;
        case 'search':
            if(!args[1]) return message.reply('Error, please enter a search term');

            search(message, args);
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