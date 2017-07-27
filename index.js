const Discord = require('discord.js');
const config = require('config');
const fs = require('fs');
const emojiLib = require('node-emoji');
const fetchclasses = require('./fetchclasses');

const client = new Discord.Client();

let classes = {};
let classStrings = {};
let lastUpdated = 0;

const EMOJI_MAPPING = {
  regional_indicator_a: '🇦',
  regional_indicator_b: '🇧',
  regional_indicator_c: '🇨',
  regional_indicator_d: '🇩',
  regional_indicator_e: '🇪',
  regional_indicator_f: '🇫',
  regional_indicator_g: '🇬',
  regional_indicator_h: '🇭',
  regional_indicator_i: '🇮',
  regional_indicator_j: '🇯',
  regional_indicator_k: '🇰',
  regional_indicator_l: '🇱',
  regional_indicator_m: '🇲',
  regional_indicator_n: '🇳',
  regional_indicator_o: '🇴',
  regional_indicator_p: '🇵',
  regional_indicator_q: '🇶',
  regional_indicator_r: '🇷',
  regional_indicator_s: '🇸',
  regional_indicator_t: '🇹',
  regional_indicator_u: '🇺',
  regional_indicator_v: '🇻',
  regional_indicator_w: '🇼',
  regional_indicator_x: '🇽',
  regional_indicator_y: '🇾',
  regional_indicator_z: '🇿',
  zero: '0⃣',
  one: '1⃣',
  two: '2⃣',
  three: '3⃣',
  four: '4⃣',
  five: '5⃣',
  six: '6⃣',
  seven: '7⃣',
  eight: '8⃣',
  nine: '9⃣',
  keypad_ten: '🔟'
}

try {
  const info = JSON.parse(fs.readFileSync('./classdata.json'));
  lastUpdated = info.lastUpdated;
  classes = info.classes;
} catch (e) {
  // Will fetch classes
}

setTimeout(() => {
  const gotClasses = returnedClasses => {
    classes = returnedClasses;
    createClassStrings();
  }
  fetchclasses(config.get('classSearch.term'), gotClasses);
  setInterval(() => {
    fetchclasses(config.get('classSearch.term'), gotClasses);
  }, config.get('classSearch.interval')*1000);
}, Math.max(config.get('classSearch.interval')*1000 - (Date.now() - lastUpdated), 0));

function createClassStrings() {
  classStrings = {};
  Object.keys(classes).forEach(classId => {
    const classData = classes[classId];
    if (!classStrings[classData.name.toLowerCase()]) classStrings[classData.name.toLowerCase()] = classId;
    const nameArr = classData.fullName.split(' ').slice(0, 4);

    classStrings[nameArr.join(' ').toLowerCase()] = classId;
    classStrings[nameArr.join(' ').toLowerCase().replace(' -', '')] = classId;

    if (parseInt(nameArr[3]) < 10) {
      classStrings[classData.name.toLowerCase()+' - '+nameArr[3].slice(1)] = classId;
      classStrings[classData.name.toLowerCase()+' '+nameArr[3].slice(1)] = classId;
    }
  });
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.channels.find('id', config.get('selectorChannel')).fetchMessages()
    .then(() => console.log('Got selectorChannel messages!'))
    .catch(e => console.log('Error getting selectorChannel messages', e));
});

client.on('message', msg => {
  console.log(msg.author+': '+msg.content);
  if (msg.content.indexOf('!class') == 0) {
    const match = msg.content.match(/!class (.+)/);
    if (!match) return msg.reply(`Invalid usage! Try \`!class <class name or number>\` (e.g. \`!class ams 3\`)`)
    const classData = classes[match[1]] || classes[classStrings[match[1].toLowerCase()]];
    if (!classData) msg.reply(`Could not find that class!`);
    else msg.channel.send('', {embed: getClassEmbed(classData)});
  } else if (msg.content[0] == '!' && (classes[msg.content.slice(1)] || classes[classStrings[msg.content.slice(1).toLowerCase()]])) {
    const classData = classes[msg.content.slice(1)] || classes[classStrings[msg.content.slice(1).toLowerCase()]];
    msg.channel.send('', {embed: getClassEmbed(classData)});
  } else if (msg.content == '!github') {
    msg.reply('https://github.com/demipixel/slugbot');
  } else if (msg.content.indexOf('!selector') == 0) {
    const match = msg.content.match(/!selector ([^ ]+)( forever)?/);
    if (!match) return msg.reply('Invalid usage! Try `!selector <name of selector>`');
    const selectorType = match[1];
    if (!config.get('emojis')[selectorType]) return msg.reply('Invalid selector type!');
    let message = config.get('messages.emojiSelectors')[selectorType]+'\n';
    message += Object.keys(config.get('emojis')[selectorType]).map(emoji => {
      return (msg.guild.emojis.find('name', emoji) || ':'+emoji+':')+' '+config.get('emojis')[selectorType][emoji];
    }).join('\n');
    msg.channel.send(message).then(msgObj => {
      Object.keys(config.get('emojis')[selectorType]).forEach((emoji, index) => {
        const emote = msg.guild.emojis.find('name', emoji) || EMOJI_MAPPING[emoji] || emojiLib.get(emoji);
        setTimeout(() => msgObj.react(emote), index*500);
      });
      if (!match[2] || !msg.member.roles.find('id', config.get('adminRoleId'))) setTimeout(() => msgObj.react('🗑'), Object.keys(config.get('emojis')[selectorType]).length*500);
    }).catch(err => {
      console.log('Error sending message', err);
    });
  }
});

function getClassEmbed(classData) {
  return {
    title: classData.fullName,
    type: 'rich',
    color: '16040514', // #f4c242
    description: classData.description,
    fields: [
      {name: 'Status', value: classData.status[0].toUpperCase() + classData.status.slice(1), inline: true},
      {name: 'Credits', value: classData.credits+' units', inline: true},
      {name: 'Career', value: classData.career[0].toUpperCase() + classData.career.slice(1), inline: true},
      {name: 'Gen Ed', value: classData.generalEducation.toUpperCase() || 'None', inline: true},
      {name: 'Enrollment', value: classData.enrolled+'/'+classData.enrollmentCapacity, inline: true},
      {name: 'Wait List', value: (classData.waitListTotal - classData.waitListCapacity)+'/'+classData.waitListTotal, inline: true},
      {name: 'Instructor', value: classData.meeting.instructor, inline:true},
      {name: 'Time', value: classData.meeting.time, inline: true},
      {name: 'Location', value: classData.meeting.room, inline: true},
      {name: 'Requirements', value: classData.requirements || 'None'},
      {name: 'Notes', value: classData.notes || 'None'}
    ],
    footer: { text: 'Information from http://pisa.ucsc.edu/class_search/' }
  }
}

client.on('messageReactionAdd', (reactionObj, user) => {
  if (!reactionObj.message.guild) return;
  if (user == client.user) return;

  if (reactionObj.emoji.name == '🗑' && reactionObj.me) {
    reactionObj.message.delete();
    return;
  }

  const {roleName, type} = getRoleFromReaction(reactionObj);
  const emojiToRole = config.get('emojis')[type];

  if (roleName) {
    const allRoles = Object.values(emojiToRole);
    reactionObj.message.guild.fetchMember(user).then(member => {
      setTimeout(() => reactionObj.remove(user), 200);
      // Remove roles relating to message
      member.removeRoles(member.roles.filterArray(role => allRoles.includes(role.name)));
      setTimeout(() => member.addRole(reactionObj.message.guild.roles.find('name', roleName)), 100);
    }).catch(err => {
      console.log(err);
      user.send('There was an error getting your member object! Could not change roles.');
    });
  }
});

client.on('messageReactionRemove', (reactionObj, user) => {
  return; // Not used ATM
  if (!reactionObj.message.guild) return;
  if (user == client.user) return;
  const {roleName, type} = getRoleFromReaction(reactionObj);
  const emojiToRole = config.get('emojis')[type];

  if (roleName) {
    reactionObj.message.guild.fetchMember(user).then(member => {
      member.removeRole(reactionObj.message.guild.roles.find('name', roleName));
    }).catch(err => {
      console.log(err);
      user.send('There was an error getting your member object! Could not change roles.');
    });
  }
});

function getRoleFromReaction(reactionObj) {
  const emojiSelectors = config.get('messages.emojiSelectors');
  const emojiSelectorKeys = Object.keys(emojiSelectors);

  for (let i = 0; i < emojiSelectorKeys.length; i++) {
    const key = emojiSelectorKeys[i]
    const text = emojiSelectors[key];
    if (reactionObj.message.content.slice(0, text.length) == text) {
      let name = emojiNameToSymbol(reactionObj.emoji.name);
      return { roleName: config.get('emojis')[key][name], type: key };
    }
  }

  return {role: null, type: null};
}

function emojiNameToSymbol(str) {
  return Object.values(EMOJI_MAPPING).includes(str) ?
    Object.keys(EMOJI_MAPPING)[Object.values(EMOJI_MAPPING).indexOf(str)] :
    str;
}

client.login(config.get('discord.token'));
