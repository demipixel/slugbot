const Discord = require('discord.js');
const config = require('config');
const fs = require('fs');

const client = new Discord.Client();

let classes;
const classStrings = {};

try {
  classes = JSON.parse(fs.readFileSync('./classdata.json'));
} catch (e) {
  console.log('You need to fetch the classes! Run fetchclasses.js');
  process.exit(1);
}

Object.keys(classes).forEach(classId => {
  const classData = classes[classId];
  if (!classStrings[classData.name.toLowerCase()]) classStrings[classData.name.toLowerCase()] = classId;
  const fullShortName = classData.fullName.split(' ').slice(0, 4).join(' ');
  classStrings[fullShortName.toLowerCase()] = classId;
  classStrings[fullShortName.toLowerCase().replace(' -', '')] = classId;
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('message', msg => {
  if (msg.content.indexOf('!class') == 0) {
    const match = msg.content.match(/!class (.+)/);
    if (!match) msg.reply(`Invalid usage! Try \`!class <class name or number>\` (e.g. \`!class ams 3\`)`)
    const classData = classes[match[1]] || classes[classStrings[match[1].toLowerCase()]];
    if (!classData) msg.reply(`Could not find that class!`);
    else msg.channel.send('', {embed: getClassEmbed(classData)});
  } else if (msg.content[0] == '!' && (classes[msg.content.slice(1)] || classes[classStrings[msg.content.slice(1).toLowerCase()]])) {
    const classData = classes[msg.content.slice(1)] || classes[classStrings[msg.content.slice(1).toLowerCase()]];
    msg.channel.send('', {embed: getClassEmbed(classData)});
  } else if (msg.content == '!github') {
    msg.reply('https://github.com/demipixel/slugbot');
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

client.login(config.get('discord.token'));
