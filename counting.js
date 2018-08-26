const fs = require('fs');

let COUNTING_MUTE_ROLE = null;
let HIGHEST_COUNTER_ROLE = null;

let lastNumber = null;
let lastUser = null;

const COUNTER_FILE = './counter.json';
let TOTAL_COUNTS = null;

let highestCounter = null;

module.exports = {
  ready: function(client) {
    COUNTING_MUTE_ROLE = client.guilds.first().roles.find('name', 'Counting Mute');
    HIGHEST_COUNTER_ROLE = client.guilds.first().roles.find(r => r.name.startsWith('Highest Counter'));

    TOTAL_COUNTS = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    let highestId = null;
    Object.keys(TOTAL_COUNTS).forEach(userId => {
      // Check to make sure user exists and that they're the new highest
      if (!highestId || TOTAL_COUNTS[userId] > TOTAL_COUNTS[highestId] && client.guilds.first().members.find('id', userId)) {
        highestId = userId;
      }
    });
    highestCounter = client.guilds.first().members.find('id', highestId);
    if (highestCounter) highestCounter.addRole(HIGHEST_COUNTER_ROLE);
  },
  message: function(client, msg) {
    if (!msg.channel.name.startsWith('counting')) return;

    if (msg.content.match(/^!force \d+$/) && msg.member.roles.find('name', 'Moderator')) {
      const number = msg.content.match(/^!force (\d+)$/)[1];
      updateNumber(number, null, msg);
      msg.react('✅');
      setTimeout(() => {
        msg.delete();
      }, 2000);
      return;
    }

    const num = parseInt(msg.content);

    if (isNaN(num)) {
      mute(msg, 'That is not a valid number! You have been muted for 1 minute.', 60*1000);
      return;
    }

    if (lastNumber !== null && num != lastNumber + 1) {
      mute(msg, `That is not the next number! The next number is ${lastNumber + 1}.`);
      return;
    }

    if (lastUser == msg.member.user) {
      mute(msg, `You cannot say a number twice in a row. You have been muted for 30 seconds.`, 30*1000);
      return;
    }

    // Update number
    updateNumber(lastNumber + 1, msg.member.user, msg);

    // Increase counter for user
    if (!TOTAL_COUNTS[msg.member.user.id]) TOTAL_COUNTS[msg.member.user.id] = 0;
    TOTAL_COUNTS[msg.member.user.id]++;

    // Change role holder if needed
    if (!highestCounter || TOTAL_COUNTS[msg.member.user.id] > TOTAL_COUNTS[highestCounter.user.id]) {
      if (highestCounter) highestCounter.removeRole(HIGHEST_COUNTER_ROLE);
      highestCounter = msg.member;
      highestCounter.addRole(HIGHEST_COUNTER_ROLE);
    }
    updateHighestCounterRole(); // Update role name if needed

    if (lastNumber % 5 === 0) saveFile(); // Save TOTAL_COUNTS every 5 messages
  }
}

function updateNumber(num, user, msg) {
  lastNumber = parseInt(num);
  lastUser = user;
  if (lastNumber % 1000 == 0) {
    msg.channel.setName('counting-'+(Math.floor(lastNumber/1000))+'k');
  }
}

function mute(msg, reason, length) {
  msg.delete();
  msg.author.send(reason);
  if (!length) return;
  msg.member.addRole(COUNTING_MUTE_ROLE);
  setTimeout(() => {
    msg.member.removeRole(COUNTING_MUTE_ROLE);
  }, length);
}

let currentlySaving = false;
function saveFile() {
  if (currentlySaving) return;
  currentlySaving = true;
  fs.writeFile(COUNTER_FILE, JSON.stringify(TOTAL_COUNTS), () => { currentlySaving = false; });
}

function updateHighestCounterRole() {
  const highestCount = TOTAL_COUNTS[highestCounter.user.id];
  if (highestCount % 100 === 0) {
    HIGHEST_COUNTER_ROLE.setName(`Highest Counter (${(highestCount/1000).toFixed(1)}k)`)
  }
}