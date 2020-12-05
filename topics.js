const Discord = require('discord.js');
const config = require('config');

const client = new Discord.Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  const map = {};
  client.guilds
    .first()
    .channels.array()
    .forEach(ch => {
      if (ch.topic !== undefined && ch.topic !== null && ch.topic !== '') {
        map[ch.id] = ch.topic;
      }
    });
  console.log(JSON.stringify(map));
  process.exit(0);
});

client.login(config.get('discord.token'));
