const fs = require('fs');

let COUNTING_MUTE_ROLE = null;
let HIGHEST_COUNTER_ROLE = null;
let LAST_COUNTER_ROLE = null;

let lastNumber = null;
let lastMember = null;

const COUNTER_FILE = './counter.json';
let TOTAL_COUNTS = null;

let highestCounter = null;

const LAST_FIVE_MESSAGES = [];
let lastFiveIndex = 0;

let lastMessageTimeout = null;

module.exports = {
  ready: function(client) {
    COUNTING_MUTE_ROLE = client.guilds.first().roles.find('name', 'Counting Mute');
    HIGHEST_COUNTER_ROLE = client.guilds.first().roles.find(r => r.name.startsWith('Highest Counter'));
    LAST_COUNTER_ROLE = client.guilds.first().roles.find('name', 'Last Counter');

    // Remove anyone with mute role on startup
    COUNTING_MUTE_ROLE.members.array().forEach(member => {
      member.removeRole(COUNTING_MUTE_ROLE);
    });

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

    // Prevent user from deleting messages (fix if needed)
    client.on('messageDelete', msg => {
      if (!msg.channel.name.startsWith('counting')) return;

      for (let i = 0; i < 5; i++) {
        if (LAST_FIVE_MESSAGES[i] && LAST_FIVE_MESSAGES[i].id == msg.id) return; // Deleted by bot
      }

      const numberMatch = msg.content.match(/^([1-9]\d*)/);

      if (numberMatch && parseInt(numberMatch[1]) == lastNumber) msg.channel.sendMessage(numberMatch[1]);
      reactDeleteMute(msg, 30*1000);
      msg.member.user.send('Do not delete your messages! You have been muted for 30 seconds.').catch(err => console.error(err));
    });

    // Prevent users from editing messages (fix if needed)
    client.on('messageUpdate', (oldMsg, newMsg) => {
      if (!newMsg.channel.name.startsWith('counting')) return;

      const numberMatch = oldMsg.content.match(/^([1-9]\d*)/);
      const newNumberMatch = newMsg.content.match(/^([1-9]\d*)/);

      if (!newNumberMatch || !numberMatch || newNumberMatch[1] != numberMatch[1]) {
        reactDeleteMute(newMsg, 5000, ['🔢', '❓', '🚫']);
        if (numberMatch && parseInt(numberMatch[1]) == lastNumber) oldMsg.channel.sendMessage(numberMatch[1]);
      } else if (newMsg.content.length > 60) {
        reactDeleteMute(newMsg, 5000, ['6⃣', '0⃣', '🚫']);
        if (numberMatch && parseInt(numberMatch[1]) == lastNumber) oldMsg.channel.sendMessage(numberMatch[1]);
      }
    });
  },
  message: function(client, msg) {

    if (msg.content == '!highestcounter') {
      msg.channel.send(highestCounter.user.username);
      return;
    } else if (msg.content == '!counter') {
      reactDeleteMute(msg);
      msg.channel.send(`Last number: ${lastNumber} from ${lastMember || 'an admin (forced)'}`).then(cmdMsg => {
        setTimeout(() => cmdMsg.delete(), 3000);
      });
      return;
    }

    if (!msg.channel.name.startsWith('counting')) return;

    if (msg.content.match(/^!force \d+$/) && msg.member.roles.find('name', 'Moderator')) {
      const number = msg.content.match(/^!force (\d+)$/)[1];
      updateNumber(number, null, msg);
      msg.react('✅');
      setTimeout(() => {
        LAST_FIVE_MESSAGES[lastFiveIndex++] = msg;
        lastFiveIndex %= 5;

        msg.delete();
      }, 2000);
      return;
    }

    if (!msg.content.match(/^[1-9]\d*/)) {
      reactDeleteMute(msg, 5000, ['🔢', '❓', '🚫']);
      return;
    } else if (msg.content.length > 60) {
      reactDeleteMute(msg, 5000, ['6⃣', '0⃣', '🚫']);
      return;
    }

    const number = msg.content.match(/^([1-9]\d*)/)[1];

    if (lastNumber !== null && number != (lastNumber + 1).toString()) {
      reactDeleteMute(msg);
      return;
    }

    if (lastMember == msg.member) {
      reactDeleteMute(msg);
      return;
    }

    // Update number
    updateNumber(lastNumber ? lastNumber + 1 : parseInt(number), msg.member, msg);

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
    
    if (lastMessageTimeout) clearTimeout(lastMessageTimeout);
    lastMessageTimeout = setTimeout(() => {
      if (lastMember && !lastMember.roles.find('name', LAST_COUNTER_ROLE.name)) {
        LAST_COUNTER_ROLE.members.array().forEach(member => {
          member.removeRole(LAST_COUNTER_ROLE);
        });
        lastMember.addRole(LAST_COUNTER_ROLE);
      }

      lastMessageTimeout = null;
    }, 15*60*1000);
  }
}

function updateNumber(num, member, msg) {
  lastNumber = parseInt(num);
  lastMember = member;
  if (lastNumber % 100 == 0) {
    msg.channel.setName('counting-'+lastNumber);
  }
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

function reactDeleteMute(msg, length=0, emojis=[]) {
  LAST_FIVE_MESSAGES[lastFiveIndex++] = msg;
  lastFiveIndex %= 5;

  for (let i = 0; i < emojis.length; i++) {
    setTimeout(() => {
      msg.react(emojis[i]).catch(err => console.error(err));
    }, i*1200);
  }

  setTimeout(() => {
    if (!msg.deleted) msg.delete().catch(err => console.error(err));
  }, Math.max(500, emojis.length*1200));

  if (length) {
    msg.member.addRole(COUNTING_MUTE_ROLE);
    setTimeout(() => {
      msg.member.removeRole(COUNTING_MUTE_ROLE);
    }, length);
  }
}