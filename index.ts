import * as config from 'config';
import * as Discord from 'discord.js';
import * as fs from 'fs';
import * as emojiLib from 'node-emoji';

const fetchclasses = require('./fetchclasses');
const Cleverbot = require('./cleverbot');
const EXTERNAL: {
  ready: (client: Discord.Client) => Promise<unknown>;
  message: (
    client: Discord.Client,
    message: Discord.Message,
  ) => Promise<unknown>;
}[] = [
  require('./counting.ts'),
  require('./gold.ts'),
  // require('./virus.js'),
];

const clever = new Cleverbot();
const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILD_MEMBERS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
});

const classes: { [key: string]: any } = {};
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
  keycap_ten: '🔟',
};

const MAJORS = {
  UND: 'Undeclared',
  UNON: 'Non Degree',
  ANTH: 'Anthropology',
  APPH: 'Applied Physics',
  ART: 'Art',
  ARTG: 'Art And Design: Games And Playable Media',
  ARTH: 'See History Of Art And Visual Culture',
  BENG: 'Bioengineering',
  BIOC: 'Biochemistry And Molecular Biology',
  BINF: 'Bioinformatics',
  BIOL: 'Biology',
  BMEC: 'Business Management Economics',
  CHEM: 'Chemistry',
  CLST: 'Classical Studies',
  CMMU: 'Community Studies',
  CMPE: 'Computer Engineering',
  CMPS: 'Computer Science',
  CMPG: 'Computer Science: Computer Game Design',
  COGS: 'Cognitive Science',
  CRES: 'Critical Race And Ethnic Studies',
  EART: 'Earth Sciences',
  ECEV: 'Ecology And Evolution',
  ECON: 'Economics',
  EE: 'Electrical Engineering',
  ENVS: 'Environmental Studies',
  FMST: 'Feminist Studies',
  FIDM: 'Film And Digital Media',
  GMST: 'German Studies',
  GLEC: 'Global Economics',
  HBIO: 'Human Biology',
  HIS: 'History',
  ' HAVC': 'History Of Art And Visual Culture',
  ITST: 'Italian Studies',
  JWST: 'Jewish Studies',
  LANG: 'Language Studies',
  LALS: 'Latin American And Latino Studies',
  LGST: 'Legal Studies',
  LING: 'Linguistics',
  LIT: 'Literature',
  MABI: 'Marine Biology',
  MATH: 'Mathematics',
  MCDB: 'Molecular, Cell, And Developmental Biology',
  MUSC: 'Music',
  NDT: 'Network And Digital Technology',
  NBIO: 'Neuroscience',
  PHIL: 'Philosophy',
  PHYE: 'Physics Education',
  PHYS: 'Physics',
  ASPH: 'Physics (astrophysics)',
  PLNT: 'Plant Sciences',
  POLI: 'Politics',
  PSYC: 'Psychology',
  ROBO: 'Robotics Engineering',
  SOCI: 'Sociology',
  SPST: 'Spanish Studies',
  TIM: 'Technology And Information Management',
  THEA: 'Theater Arts',
  PRFM: 'Pre-film And Digital Media',
  XESA: 'Earth Sciences/anthropology',
  XEBI: 'Environmental Studies/biology',
  XEEA: 'Environmental Studies/earth Sciences',
  XEEC: 'Environmental Studies/economics',
  XEMA: 'Economics/mathematics',
  XLPT: 'Latin American And Latino Studies/politics',
  XLSY: 'Latin American And Latino Studies/sociology',
};

try {
  const info = JSON.parse(fs.readFileSync('./classdata.json', 'utf8'));
  lastUpdated = info.lastUpdated;
  classes.current = info.classes;
} catch (e) {
  // Will fetch classes
}

(config.get('classSearch.previousQuarters') as string[]).forEach(classKey => {
  if (fs.existsSync(`./classdata-${classKey}.json`)) {
    classes[classKey] = JSON.parse(
      fs.readFileSync(`./classdata-${classKey}.json`, 'utf8'),
    ).classes;
  }
});

const classSearchInterval: number = config.get('classSearch.interval');
setTimeout(() => {
  const gotClasses = returnedClasses => {
    classes.current = returnedClasses;
    createClassStrings();
  };
  fetchclasses(config.get('classSearch.term'), gotClasses);
  setInterval(() => {
    fetchclasses(config.get('classSearch.term'), gotClasses);
  }, classSearchInterval * 1000);
}, Math.max(classSearchInterval * 1000 - (Date.now() - lastUpdated), 0));

function createClassStrings() {
  classStrings = {};
  Object.keys(classes).forEach(quarter => {
    Object.keys(classes[quarter]).forEach(classId => {
      const classData = classes[quarter][classId];
      const prefix = quarter === 'current' ? '' : quarter + ' ';
      if (!classData.name)
        return console.log('Could not find name for class', classData);
      if (!classStrings[prefix + classData.name.toLowerCase()])
        classStrings[prefix + classData.name.toLowerCase()] = classData;
      const nameArr = classData.fullName.split(' ').slice(0, 4);

      classStrings[prefix + nameArr.join(' ').toLowerCase()] = classData;
      classStrings[prefix + nameArr.join(' ').toLowerCase().replace(' -', '')] =
        classData;

      if (parseInt(nameArr[3], 10) < 10) {
        classStrings[
          prefix + classData.name.toLowerCase() + ' - ' + nameArr[3].slice(1)
        ] = classData;
        classStrings[
          prefix + classData.name.toLowerCase() + ' ' + nameArr[3].slice(1)
        ] = classData;
      }
    });
  });
}

createClassStrings();

client.on('ready', () =>
  clientReady().catch(err => console.error('Error on ready', err)),
);

async function clientReady() {
  console.log(`Logged in as ${client.user.tag}`);
  // await (client.channels.cache.find(
  //   channel => channel.id === config.get('classSelectorChannel'),
  // ) as Discord.TextChannel).messages.fetch({ limit: 100 });
  (
    client.channels.cache.find(
      channel => channel.id === config.get('selectorChannel'),
    ) as Discord.TextChannel
  )?.messages
    .fetch({ limit: 100 })
    .then(messages => {
      console.log('Got selectorChannel messages!');
      Promise.all(
        messages
          .filter(m => m.author.id !== client.user.id)
          .map(m => m.delete()),
      ).catch(err =>
        console.error('Error deleting selector channel messages', err),
      );
    })
    .catch(e => console.log('Error getting selectorChannel messages', e));

  const guild = client.guilds.cache.first();

  await guild.roles.fetch();
  await guild.channels.fetch();

  Object.values(MAJORS).forEach(major => {
    if (!guild.roles.cache.find(role => role.name === major)) {
      guild.roles
        .create({
          name: major,
        })
        .then(role => console.log(`Created ${role.name} major role.`))
        .catch(err => console.error('Could not create role for ' + major, err));
    }
  });

  EXTERNAL.forEach((e, index) => {
    if (e.ready)
      e.ready(client).catch(err =>
        console.error('Error setting up external ' + index, err),
      );
  });
}

client.on('messageCreate', msg => {
  onMessage(msg).catch(err => console.error('Error on message', err));
});

async function onMessage(msg: Discord.Message) {
  console.log(msg.author + ': ' + msg.content);
  if (msg.author.id === client.user.id) return;
  else if (!msg.member) return;

  /*if (msg.content.includes(':thinking:') || msg.content.includes('🤔')) {
    msg.delete();
    return;
  }*/

  if (
    msg.content === '!majors' &&
    msg.member.roles.cache.find(
      role => role.name === config.get('adminRoleName'),
    )
  ) {
    let str =
      'In order to assign yourself a major role, type your major code below (e.g. `cmps`). Major codes can be found at:\n';
    str +=
      'https://registrar.ucsc.edu/navigator/section3/declaring/majors-list.html\n';
    str += 'To remove a major, begin your message with "rm" (e.g. `rm cmps`)';
    await msg.channel.send(str);
  } else if (
    msg.channel.id === config.get('selectorChannel') &&
    !msg.member.roles.cache.find(r => r.name === config.get('adminRoleName'))
  ) {
    const major = MAJORS[msg.content.replace('rm ', '').toUpperCase()];
    if (
      !major &&
      !msg.member.roles.cache.find(
        role => role.name === config.get('adminRoleName'),
      )
    ) {
      await msg.delete();
      await msg.author.send(
        `"${msg.content.replace('rm ', '')}" is not a valid major!`,
      );
    } else if (major) {
      setTimeout(() => msg.delete(), 500);
      if (msg.content.startsWith('rm')) {
        await msg.member.roles.remove(
          msg.guild.roles.cache.find(r => r.name === major),
        );
        await msg.author.send(`Successfully removed "${major}"`);
      } else {
        await msg.member.roles.add(
          msg.guild.roles.cache.find(r => r.name === major),
        );
        await msg.author.send(`Successfully added "${major}"`);
      }
    }
  } else if (msg.content.indexOf('!class') === 0) {
    if (msg.channel.id !== config.get('commandsChannel')) {
      await msg.channel.send(
        'You can only use this in ' +
          client.channels.cache.get(config.get('commandsChannel')),
      );
      return;
    }

    const match = msg.content.match(/!class (.+)/);
    if (!match)
      return msg.reply(
        `Invalid usage! Try \`!class <class name or number>\` (e.g. \`!class ams 3\`)`,
      );
    const classData =
      classes.current[match[1]] || classStrings[match[1].toLowerCase()];
    if (!classData) await msg.reply(`Could not find that class!`);
    else await msg.channel.send({ embeds: [getClassEmbed(classData)] });
  } else if (
    classes.current &&
    msg.content[0] === '!' &&
    (classes.current[msg.content.slice(1)] ||
      classStrings[msg.content.slice(1).toLowerCase()])
  ) {
    if (msg.channel.id !== config.get('commandsChannel')) {
      await msg.channel.send(
        'You can only use this in ' +
          client.channels.cache.get(config.get('commandsChannel')),
      );
      return;
    }

    const classData =
      classes.current[msg.content.slice(1)] ||
      classStrings[msg.content.slice(1).toLowerCase()];
    await msg.channel.send({ embeds: [getClassEmbed(classData)] });
  } else if (msg.content === '!github') {
    await msg.reply('https://github.com/demipixel/slugbot');
  } else if (msg.content.startsWith('!haha ')) {
    const str = msg.content.slice(6);
    const funky = str
      .split('')
      .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
      .join('');
    await msg.delete();
    await msg.channel.send(funky);
  } else if (msg.content.indexOf('!selector') === 0) {
    const match = msg.content.match(/!selector ([^ ]+)( forever)?/);
    if (!match)
      return msg.reply('Invalid usage! Try `!selector <name of selector>`');
    const selectorType = match[1];
    if (!config.get('emojis')[selectorType])
      return msg.reply('Invalid selector type!');
    let message = config.get('messages.emojiSelectors')[selectorType] + '\n';
    message += Object.keys(config.get('emojis')[selectorType])
      .map(emoji => {
        return (
          (msg.guild.emojis.cache.find(e => e.name === emoji)?.toString() ||
            ':' + emoji + ':') +
          ' ' +
          config.get('emojis')[selectorType][emoji]
        );
      })
      .join('\n');
    msg.channel
      .send(message)
      .then(msgObj => {
        Object.keys(config.get('emojis')[selectorType]).forEach(
          (emoji, index) => {
            const emote =
              msg.guild.emojis.cache.find(e => e.name === emoji) ||
              EMOJI_MAPPING[emoji] ||
              emojiLib.get(emoji);
            setTimeout(() => msgObj.react(emote), index * 500);
          },
        );
        if (
          !match[2] ||
          !msg.member.roles.cache.find(
            r => r.name === config.get('adminRoleName'),
          )
        )
          setTimeout(
            () => msgObj.react('🗑'),
            Object.keys(config.get('emojis')[selectorType]).length * 500,
          );
      })
      .catch(err => {
        console.log('Error sending message', err);
      });
  } else if (
    msg.mentions.users.find(user => user.id === client.user.id) &&
    msg.channel.type === 'GUILD_TEXT' &&
    !msg.channel.name.startsWith('counting')
  ) {
    clever.send(msg.content.replace(client.user.toString(), '').trim(), str => {
      if (str)
        msg
          .reply(str.replace(/\*/g, '\\*'))
          .catch(err => console.error('Error sending cleverbot response', err));
    });
  }

  EXTERNAL.forEach((e, index) => {
    if (e.message)
      e.message(client, msg).catch(err =>
        console.error('Error setting up external ' + index, err),
      );
  });
}

function getClassEmbed(classData) {
  return new Discord.MessageEmbed({
    type: 'rich',
    hexColor: '#f4c242',
    title: classData.fullName,
    description: classData.description,
    fields: [
      {
        name: 'Status',
        value: classData.status[0].toUpperCase() + classData.status.slice(1),
        inline: true,
      },
      { name: 'Credits', value: classData.credits + ' units', inline: true },
      {
        name: 'Career',
        value: classData.career[0].toUpperCase() + classData.career.slice(1),
        inline: true,
      },
      {
        name: 'Gen Ed',
        value: classData.generalEducation.toUpperCase() || 'None',
        inline: true,
      },
      {
        name: 'Enrollment',
        value: classData.enrolled + '/' + classData.enrollmentCapacity,
        inline: true,
      },
      {
        name: 'Wait List',
        value: classData.waitListTotal + '/' + classData.waitListCapacity,
        inline: true,
      },
      { name: 'Instructor', value: classData.meeting.instructor, inline: true },
      { name: 'Time', value: classData.meeting.time, inline: true },
      { name: 'Location', value: classData.meeting.room, inline: true },
      { name: 'Requirements', value: classData.requirements || 'None' },
      { name: 'Notes', value: classData.notes || 'None' },
    ],
    footer: { text: 'Information from http://pisa.ucsc.edu/class_search/' },
  });
}

client.on('messageReactionAdd', (reactionObj, user) =>
  onMessageReactionAdd(reactionObj, user),
);
async function onMessageReactionAdd(
  reactionObj: Discord.MessageReaction | Discord.PartialMessageReaction,
  user: Discord.User | Discord.PartialUser,
) {
  if (!reactionObj.message.guild) return;
  if (user === client.user) return;

  if (reactionObj.emoji.name === '🗑' && reactionObj.me) {
    await reactionObj.message.delete();
    return;
  }

  const { roleName, type } = getRoleFromReaction(reactionObj);
  const emojiToRole = config.get('emojis')[type];

  if (roleName) {
    const allRoles = Object.values(emojiToRole);
    reactionObj.message.guild.members
      .fetch({ user: user.id })
      .then(async member => {
        setTimeout(
          () =>
            reactionObj.users
              .remove(user.id)
              .catch(err => console.error('Error removing user reaction', err)),
          200,
        );

        if (member.roles.cache.find(r => r.name === roleName)) {
          await member.roles.remove(
            member.roles.cache.filter(role => role.name === roleName),
          );
          await user.send('Removed role.');
          return;
        }

        if (type !== 'classes') {
          // Remove roles relating to message
          await member.roles.remove(
            member.roles.cache.filter(role => allRoles.includes(role.name)),
          );
        }
        const roleToAdd = reactionObj.message.guild.roles.cache.find(
          r => r.name === roleName,
        );
        setTimeout(() => {
          member.roles
            .add(roleToAdd)
            .then(() => user.send('Successfully added role ' + roleName))
            .catch(async err => {
              console.log(err);
              user.send('Failed to add role ' + roleName).catch(() => false);
            });
        }, 100);
      })
      .catch(err => {
        console.log(err);
        user
          .send(
            'There was an error getting your member object! Could not change roles.',
          )
          .catch(() => false);
      });
  }
}

// client.on('messageReactionRemove', (reactionObj, user) => {
//   if (!reactionObj.message.guild) return;
//   if (user === client.user) return;
//   /*const {roleName, type} = getRoleFromReaction(reactionObj);
//   const emojiToRole = config.get('emojis')[type];

//   if (roleName) {
//     reactionObj.message.guild.fetchMember(user).then(member => {
//       member.removeRole(reactionObj.message.guild.roles.cache.find(r => r.name === roleName));
//     }).catch(err => {
//       console.log(err);
//       user.send('There was an error getting your member object! Could not change roles.');
//     });
//   }*/
// });

function getRoleFromReaction(reactionObj) {
  const emojiSelectors = config.get('messages.emojiSelectors');
  const emojiSelectorKeys = Object.keys(emojiSelectors);

  for (let i = 0; i < emojiSelectorKeys.length; i++) {
    const key = emojiSelectorKeys[i];
    const text = emojiSelectors[key];
    if (reactionObj.message.content.slice(0, text.length) === text) {
      const name = emojiNameToSymbol(reactionObj.emoji.name);
      return { roleName: config.get('emojis')[key][name], type: key };
    }
  }

  return { role: null, type: null };
}

function emojiNameToSymbol(str) {
  return Object.values(EMOJI_MAPPING).includes(str)
    ? Object.keys(EMOJI_MAPPING)[Object.values(EMOJI_MAPPING).indexOf(str)]
    : str;
}

client
  .login(config.get('discord.token'))
  .catch(err => console.error('Error logging in to Discord.js', err));
