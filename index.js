const Discord = require('discord.js');
const config = require('config');
const fs = require('fs');
const emojiLib = require('node-emoji');
const fetchclasses = require('./fetchclasses');
const CleverBot = require('cleverbot-node');

const EXTERNAL = [require('./counting.js')];

const clever = new CleverBot();
clever.configure({ botapi: config.get('cleverbotApiKey') })
try {
  CleverBot.prepare(function() {
    console.log('CleverBot is online');
  });
} catch (err) {
  console.log('Cannot put CleverBot online!');
}

if (!fs.existsSync('./gold.json')) {
  fs.writeFileSync('./gold.json', '{}');
}

const goldData = JSON.parse(fs.readFileSync('./gold.json'));

const client = new Discord.Client();

const classes = {};
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
  keycap_ten: '🔟'
};

const MAJORS = { "UND": "Undeclared", "UNON": "Non Degree", "ANTH": "Anthropology", "APPH": "Applied Physics", "ART": "Art", "ARTG": "Art And Design: Games And Playable Media", "ARTH": "See History Of Art And Visual Culture", "BENG": "Bioengineering", "BIOC": "Biochemistry And Molecular Biology", "BINF": "Bioinformatics", "BIOL": "Biology", "BMEC": "Business Management Economics", "CHEM": "Chemistry", "CLST": "Classical Studies", "CMMU": "Community Studies", "CMPE": "Computer Engineering", "CMPS": "Computer Science", "CMPG": "Computer Science: Computer Game Design", "COGS": "Cognitive Science", "CRES": "Critical Race And Ethnic Studies", "EART": "Earth Sciences", "ECEV": "Ecology And Evolution", "ECON": "Economics", "EE": "Electrical Engineering", "ENVS": "Environmental Studies", "FMST": "Feminist Studies", "FIDM": "Film And Digital Media", "GMST": "German Studies", "GLEC": "Global Economics", "HBIO": "Human Biology", "HIS": "History", " HAVC": "History Of Art And Visual Culture", "ITST": "Italian Studies", "JWST": "Jewish Studies", "LANG": "Language Studies", "LALS": "Latin American And Latino Studies", "LGST": "Legal Studies", "LING": "Linguistics", "LIT": "Literature", "MABI": "Marine Biology", "MATH": "Mathematics", "MCDB": "Molecular, Cell, And Developmental Biology", "MUSC": "Music", "NDT": "Network And Digital Technology", "NBIO": "Neuroscience", "PHIL": "Philosophy", "PHYE": "Physics Education", "PHYS": "Physics", "ASPH": "Physics (astrophysics)", "PLNT": "Plant Sciences", "POLI": "Politics", "PSYC": "Psychology", "ROBO": "Robotics Engineering", "SOCI": "Sociology", "SPST": "Spanish Studies", "TIM": "Technology And Information Management", "THEA": "Theater Arts", "PRFM": "Pre-film And Digital Media", "XESA": "Earth Sciences/anthropology", "XEBI": "Environmental Studies/biology", "XEEA": "Environmental Studies/earth Sciences", "XEEC": "Environmental Studies/economics", "XEMA": "Economics/mathematics", "XLPT": "Latin American And Latino Studies/politics", "XLSY": "Latin American And Latino Studies/sociology" }

try {
  const info = JSON.parse(fs.readFileSync('./classdata.json', 'utf8'));
  lastUpdated = info.lastUpdated;
  classes.current = info.classes;
} catch (e) {
  // Will fetch classes
}

config.get('classSearch.previousQuarters').forEach(classKey => {
  if (fs.existsSync(`./classdata-${classKey}.json`)) {
    classes[classKey] = JSON.parse(fs.readFileSync(`./classdata-${classKey}.json`, 'utf8')).classes;
  }
});

setTimeout(() => {
  const gotClasses = returnedClasses => {
    classes.current = returnedClasses;
    createClassStrings();
  }
  fetchclasses(config.get('classSearch.term'), gotClasses);
  setInterval(() => {
    fetchclasses(config.get('classSearch.term'), gotClasses);
  }, config.get('classSearch.interval') * 1000);
}, Math.max(config.get('classSearch.interval') * 1000 - (Date.now() - lastUpdated), 0));

function createClassStrings() {
  classStrings = {};
  Object.keys(classes).forEach(quarter => {
    Object.keys(classes[quarter]).forEach(classId => {
      const classData = classes[quarter][classId];
      const prefix = quarter == 'current' ? '' : quarter + ' ';
      if (!classData.name) return console.log('Could not find name for class', classData);
      if (!classStrings[prefix + classData.name.toLowerCase()]) classStrings[prefix + classData.name.toLowerCase()] = classData;
      const nameArr = classData.fullName.split(' ').slice(0, 4);

      classStrings[prefix + nameArr.join(' ').toLowerCase()] = classData;
      classStrings[prefix + nameArr.join(' ').toLowerCase().replace(' -', '')] = classData;

      if (parseInt(nameArr[3]) < 10) {
        classStrings[prefix + classData.name.toLowerCase() + ' - ' + nameArr[3].slice(1)] = classData;
        classStrings[prefix + classData.name.toLowerCase() + ' ' + nameArr[3].slice(1)] = classData;
      }
    });
  });
}

createClassStrings();

let selectorMessages = null;
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.channels.find('id', config.get('classSelectorChannel')).fetchMessages({ limit: 100 })
  client.channels.find('id', config.get('selectorChannel')).fetchMessages({ limit: 100 })
    .then(messages => {
      console.log('Got selectorChannel messages!');
      selectorMessages = messages;
      messages.filter(m => m.author.id != client.user.id).forEach(m => m.delete());
    })
    .catch(e => console.log('Error getting selectorChannel messages', e));

  const guild = client.channels.find('id', config.get('selectorChannel')).guild;
  Object.values(MAJORS).forEach(major => {
    const guild = client.guilds.first();
    if (!guild.roles.find('name', major)) {
      guild.createRole({
        name: major
      }).then(role => console.log(`Created ${role.name} major role.`));
    }
  });

  EXTERNAL.forEach(e => {
    if (e.ready) e.ready(client);
  });
});

const repeatMessage = {};

client.on('message', msg => {
  console.log(msg.author + ': ' + msg.content);
  if (msg.author.id == client.user.id) return;
  else if (!msg.member) return;

  if (!repeatMessage[msg.channel.name]) repeatMessage[msg.channel.name] = { msg: '' };

  if (!msg.channel.name.startsWith('counting')) {
    if (msg.content != repeatMessage[msg.channel.name].msg) {
      repeatMessage[msg.channel.name] = { msg: msg.content, users: new Set([msg.member.user.id]) }
    } else if (repeatMessage[msg.channel.name].users) {
      repeatMessage[msg.channel.name].users.add(msg.member.user.id);
      if (repeatMessage[msg.channel.name].users.size == 3) {
        msg.channel.send(msg.content);
        repeatMessage[msg.channel.name] = null;
      }
    }
  }

  /*if (msg.content.includes(':thinking:') || msg.content.includes('🤔')) {
    msg.delete();
    return;
  }*/

  if (msg.content == '!majors' && msg.member.roles.find('name', config.get('adminRoleName'))) {
    let str = 'In order to assign yourself a major role, type your major code below (e.g. `cmps`). Major codes can be found at:\n';
    str += 'https://registrar.ucsc.edu/navigator/section3/declaring/majors-list.html\n';
    str += 'To remove a major, begin your message with "rm" (e.g. `rm cmps`)';
    msg.channel.send(str);
  } else if (msg.channel.id == config.get('selectorChannel') && !msg.member.roles.find('name', config.get('adminRoleName'))) {
    const major = MAJORS[msg.content.replace('rm ', '').toUpperCase()];
    if (!major && !msg.member.roles.find('name', config.get('adminRoleName'))) {
      msg.delete();
      msg.author.send(`"${msg.content.replace('rm ', '')}" is not a valid major!`);
    } else if (major) {
      setTimeout(() => msg.delete(), 500);
      if (msg.content.startsWith('rm')) {
        msg.member.removeRole(msg.guild.roles.find('name', major));
        msg.author.send(`Successfully removed "${major}"`);
      } else {
        msg.member.addRole(msg.guild.roles.find('name', major));
        msg.author.send(`Successfully added "${major}"`);
      }
    }
  } else if (msg.content.indexOf('!class') == 0) {
    if (msg.channel.name != 'commands') {
      msg.channel.send('You can only use this in '+client.channels.find('id', config.get('commandsChannel')));
      return;
    }

    const match = msg.content.match(/!class (.+)/);
    if (!match) return msg.reply(`Invalid usage! Try \`!class <class name or number>\` (e.g. \`!class ams 3\`)`)
    const classData = classes.current[match[1]] || classStrings[match[1].toLowerCase()];
    if (!classData) msg.reply(`Could not find that class!`);
    else msg.channel.send('', { embed: getClassEmbed(classData) });
  } else if (classes.current && msg.content[0] == '!' && (classes.current[msg.content.slice(1)] || classStrings[msg.content.slice(1).toLowerCase()])) {
    if (msg.channel.name != 'commands') {
      msg.channel.send('You can only use this in '+client.channels.find('id', config.get('commandsChannel')));
      return;
    }
    
    const classData = classes.current[msg.content.slice(1)] || classStrings[msg.content.slice(1).toLowerCase()];
    msg.channel.send('', { embed: getClassEmbed(classData) });
  } else if (msg.content == '!github') {
    msg.reply('https://github.com/demipixel/slugbot');
  } else if (msg.content.startsWith('!haha ')) {
    const msg = msg.content.slice(6);
    const funky = msg.split('').map((c,i) => i % 2 == 0 ? c.toLowerCase() : c.toUpperCase()).join('');
    msg.channel.send(funky);
  } else if (msg.content.indexOf('!selector') == 0) {
    const match = msg.content.match(/!selector ([^ ]+)( forever)?/);
    if (!match) return msg.reply('Invalid usage! Try `!selector <name of selector>`');
    const selectorType = match[1];
    if (!config.get('emojis')[selectorType]) return msg.reply('Invalid selector type!');
    let message = config.get('messages.emojiSelectors')[selectorType] + '\n';
    message += Object.keys(config.get('emojis')[selectorType]).map(emoji => {
      return (msg.guild.emojis.find('name', emoji) || ':' + emoji + ':') + ' ' + config.get('emojis')[selectorType][emoji];
    }).join('\n');
    msg.channel.send(message).then(msgObj => {
      Object.keys(config.get('emojis')[selectorType]).forEach((emoji, index) => {
        const emote = msg.guild.emojis.find('name', emoji) || EMOJI_MAPPING[emoji] || emojiLib.get(emoji);
        setTimeout(() => msgObj.react(emote), index * 500);
      });
      if (!match[2] || !msg.member.roles.find('name', config.get('adminRoleName'))) setTimeout(() => msgObj.react('🗑'), Object.keys(config.get(
        'emojis')[selectorType]).length * 500);
    }).catch(err => {
      console.log('Error sending message', err);
    });
  } else if (msg.mentions.users.find(user => user.id == client.user.id) && !msg.channel.name.startsWith('counting')) {
    clever.write(msg.content.replace(client.user.toString(), '').trim(), (resp) => {
      if (!resp || resp.error) {
        msg.reply('I don\'t know how to respond...');
      } else msg.reply(resp.message.replace(/\*/g, '\\*'));
    });
  }

  EXTERNAL.forEach(e => {
    if (e.message) e.message(client, msg);
  });
});

function getClassEmbed(classData) {
  return {
    title: classData.fullName,
    type: 'rich',
    color: '16040514', // #f4c242
    description: classData.description,
    fields: [
      { name: 'Status', value: classData.status[0].toUpperCase() + classData.status.slice(1), inline: true },
      { name: 'Credits', value: classData.credits + ' units', inline: true },
      { name: 'Career', value: classData.career[0].toUpperCase() + classData.career.slice(1), inline: true },
      { name: 'Gen Ed', value: classData.generalEducation.toUpperCase() || 'None', inline: true },
      { name: 'Enrollment', value: classData.enrolled + '/' + classData.enrollmentCapacity, inline: true },
      { name: 'Wait List', value: classData.waitListTotal + '/' + classData.waitListCapacity, inline: true },
      { name: 'Instructor', value: classData.meeting.instructor, inline: true },
      { name: 'Time', value: classData.meeting.time, inline: true },
      { name: 'Location', value: classData.meeting.room, inline: true },
      { name: 'Requirements', value: classData.requirements || 'None' },
      { name: 'Notes', value: classData.notes || 'None' }
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

  const { roleName, type } = getRoleFromReaction(reactionObj);
  const emojiToRole = config.get('emojis')[type];

  if (roleName) {
    const allRoles = Object.values(emojiToRole);
    reactionObj.message.guild.fetchMember(user).then(member => {
      setTimeout(() => reactionObj.remove(user), 200);

      if (member.roles.find('name', roleName)) {
        member.removeRoles(member.roles.filterArray(role => role.name == roleName));
        user.send('Removed role.');
        return;
      }

      if (type != 'classes')  {
        // Remove roles relating to message
        member.removeRoles(member.roles.filterArray(role => allRoles.includes(role.name)));
      }
      const roleToAdd = reactionObj.message.guild.roles.find('name', roleName);
      setTimeout(() => {
        member.addRole(roleToAdd)
          .then(() => user.send('Successfully added role ' + roleName))
          .catch(err => user.send('Failed to add role ' + roleName) && console.log(err));
      }, 100);
    }).catch(err => {
      console.log(err);
      user.send('There was an error getting your member object! Could not change roles.');
    });
  }
});

client.on('messageReactionRemove', (reactionObj, user) => {
  if (!reactionObj.message.guild) return;
  if (user == client.user) return;
  /*const {roleName, type} = getRoleFromReaction(reactionObj);
  const emojiToRole = config.get('emojis')[type];

  if (roleName) {
    reactionObj.message.guild.fetchMember(user).then(member => {
      member.removeRole(reactionObj.message.guild.roles.find('name', roleName));
    }).catch(err => {
      console.log(err);
      user.send('There was an error getting your member object! Could not change roles.');
    });
  }*/
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

  return { role: null, type: null };
}

function emojiNameToSymbol(str) {
  return Object.values(EMOJI_MAPPING).includes(str) ?
    Object.keys(EMOJI_MAPPING)[Object.values(EMOJI_MAPPING).indexOf(str)] :
    str;
}

client.login(config.get('discord.token'));
