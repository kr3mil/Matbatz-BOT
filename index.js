const Discord = require('discord.js');
const bot = new Discord.Client();
const config = require('./config.json');
const package = require('./package.json')

const PREFIX = '!';

bot.on('ready', () => {
    console.log('Online!');
})

bot.on('message', message => {
    let args = message.content.substring(PREFIX.length).split(" ");

    console.log(args[0]);

    switch(args[0]){
        default:
            break;
    }
})

bot.login(config.Token);