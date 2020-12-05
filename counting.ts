import * as fs from 'fs';
import * as Discord from 'discord.js';

let COUNTING_MUTE_ROLE: Discord.Role = null;
let HIGHEST_COUNTER_ROLE: Discord.Role = null;
let LAST_COUNTER_ROLE: Discord.Role = null;

let lastNumber: number | null = null;
let lastMember: Discord.GuildMember | null = null;

const COUNTER_FILE = './counter.json';
let TOTAL_COUNTS = null;

let highestCounter: Discord.GuildMember | null = null;

const LAST_FIVE_MESSAGES = [];
let lastFiveIndex = 0;

let lastMessageTimeout: NodeJS.Timeout | null = null;

module.exports = {
  ready: async (client: Discord.Client) => {
    const guild = client.guilds.cache.first();
    COUNTING_MUTE_ROLE = guild.roles.cache.find(
      role => role.name === 'Counting Mute',
    );
    HIGHEST_COUNTER_ROLE = guild.roles.cache.find(role =>
      role.name.startsWith('Highest Counter'),
    );
    LAST_COUNTER_ROLE = guild.roles.cache.find(
      role => role.name === 'Last Counter',
    );

    // Remove anyone with mute role on startup
    await Promise.all(
      COUNTING_MUTE_ROLE.members
        .array()
        .map(member => member.roles.remove(COUNTING_MUTE_ROLE)),
    );

    TOTAL_COUNTS = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    let highestId = null;
    Object.keys(TOTAL_COUNTS).forEach(userId => {
      // Check to make sure user exists and that they're the new highest
      if (
        !highestId ||
        (TOTAL_COUNTS[userId] > TOTAL_COUNTS[highestId] &&
          guild.members.cache.find(member => member.id === userId))
      ) {
        highestId = userId;
      }
    });
    highestCounter = guild.members.cache.find(
      member => member.id === highestId,
    );
    if (highestCounter) await highestCounter.roles.add(HIGHEST_COUNTER_ROLE);

    // Prevent user from deleting messages (fix if needed)
    client.on('messageDelete', async msg => {
      if (
        msg.channel.type !== 'text' ||
        !msg.channel.name.startsWith('counting')
      )
        return;

      for (let i = 0; i < 5; i++) {
        if (LAST_FIVE_MESSAGES[i] && LAST_FIVE_MESSAGES[i].id === msg.id)
          return; // Deleted by bot
      }

      const numberMatch = msg.content.match(/^([1-9]\d*)/);

      if (numberMatch && parseInt(numberMatch[1], 10) === lastNumber) {
        await msg.channel.send(numberMatch[1]);
      }
      await reactDeleteMute(msg, 30 * 1000);
      msg.member.user
        .send(
          'Do not delete your messages! You have been muted for 30 seconds.',
        )
        .catch(err => console.error(err));
    });

    // Prevent users from editing messages (fix if needed)
    client.on('messageUpdate', async (oldMsg, newMsg) => {
      if (newMsg.channel.type !== 'text') return;
      if (!newMsg.channel.name.startsWith('counting')) return;

      const numberMatch = oldMsg.content.match(/^([1-9]\d*)/);
      const newNumberMatch = newMsg.content.match(/^([1-9]\d*)/);

      if (
        !newNumberMatch ||
        !numberMatch ||
        newNumberMatch[1] !== numberMatch[1]
      ) {
        await reactDeleteMute(newMsg, 5000, ['🔢', '❓', '🚫']);
        if (numberMatch && parseInt(numberMatch[1], 10) === lastNumber)
          await oldMsg.channel.send(numberMatch[1]);
      } else if (newMsg.content.length > 60) {
        await reactDeleteMute(newMsg, 5000, ['6⃣', '0⃣', '🚫']);
        if (numberMatch && parseInt(numberMatch[1], 10) === lastNumber)
          await oldMsg.channel.send(numberMatch[1]);
      }
    });
  },
  message: async (client: Discord.Client, msg: Discord.Message) => {
    if (msg.channel.type !== 'text') {
      return;
    } else if (msg.content === '!highestcounter') {
      await msg.channel.send(highestCounter.user.username);
      return;
    } else if (msg.content === '!counter') {
      await reactDeleteMute(msg);
      await msg.channel
        .send(
          `Last number: ${lastNumber} from ${
            lastMember || 'an admin (forced)'
          }`,
        )
        .then(cmdMsg => {
          setTimeout(() => cmdMsg.delete(), 3000);
        });
      return;
    }

    if (!msg.channel.name.startsWith('counting')) return;

    if (
      msg.content.match(/^!force \d+$/) &&
      msg.member.roles.cache.find(role => role.name === 'Moderator')
    ) {
      const forcedNum = msg.content.match(/^!force (\d+)$/)[1];
      await updateNumber(forcedNum, null, msg);
      await msg.react('✅');
      setTimeout(() => {
        LAST_FIVE_MESSAGES[lastFiveIndex++] = msg;
        lastFiveIndex %= 5;

        msg
          .delete()
          .catch(err => console.error('Error deleting !force message', err));
      }, 2000);
      return;
    }

    if (!msg.content.match(/^[1-9]\d*/)) {
      await reactDeleteMute(msg, 5000, ['🔢', '❓', '🚫']);
      return;
    } else if (msg.content.length > 60) {
      await reactDeleteMute(msg, 5000, ['6⃣', '0⃣', '🚫']);
      return;
    }

    const num = msg.content.match(/^([1-9]\d*)/)[1];

    if (lastNumber !== null && num !== (lastNumber + 1).toString()) {
      await reactDeleteMute(msg);
      return;
    }

    if (lastMember === msg.member) {
      await reactDeleteMute(msg);
      return;
    }

    // Update number
    await updateNumber(
      lastNumber ? lastNumber + 1 : parseInt(num, 10),
      msg.member,
      msg,
    );

    // Increase counter for user
    if (!TOTAL_COUNTS[msg.member.user.id]) TOTAL_COUNTS[msg.member.user.id] = 0;
    TOTAL_COUNTS[msg.member.user.id]++;

    // Change role holder if needed
    if (
      !highestCounter ||
      TOTAL_COUNTS[msg.member.user.id] > TOTAL_COUNTS[highestCounter.user.id]
    ) {
      if (highestCounter) {
        await highestCounter.roles.remove(HIGHEST_COUNTER_ROLE);
      }
      highestCounter = msg.member;
      await highestCounter.roles.add(HIGHEST_COUNTER_ROLE);
    }
    await updateHighestCounterRole(); // Update role name if needed

    if (lastNumber % 5 === 0) saveFile(); // Save TOTAL_COUNTS every 5 messages

    if (lastMessageTimeout) clearTimeout(lastMessageTimeout);
    lastMessageTimeout = setTimeout(() => {
      if (
        lastMember &&
        !lastMember.roles.cache.find(r => r.name === LAST_COUNTER_ROLE.name)
      ) {
        Promise.all(
          LAST_COUNTER_ROLE.members
            .array()
            .map(member => member.roles.remove(LAST_COUNTER_ROLE)),
        )
          .catch(err => console.error('Error removing last counter roles', err))
          .finally(() => lastMember.roles.add(LAST_COUNTER_ROLE))
          .catch(err => console.error('Error adding last counter role', err));
      }

      lastMessageTimeout = null;
    }, 15 * 60 * 1000);
  },
};

async function updateNumber(
  num,
  member: Discord.GuildMember,
  msg: Discord.Message,
) {
  lastNumber = parseInt(num, 10);
  lastMember = member;
  if (lastNumber % 100 === 0) {
    await (msg.channel as Discord.TextChannel).setName(
      'counting-' + lastNumber,
    );
  }
}

let currentlySaving = false;
function saveFile() {
  if (currentlySaving) return;
  currentlySaving = true;
  fs.writeFile(COUNTER_FILE, JSON.stringify(TOTAL_COUNTS), () => {
    currentlySaving = false;
  });
}

async function updateHighestCounterRole() {
  const highestCount = TOTAL_COUNTS[highestCounter.user.id];
  if (highestCount % 100 === 0) {
    await HIGHEST_COUNTER_ROLE.setName(
      `Highest Counter (${(highestCount / 1000).toFixed(1)}k)`,
    );
  }
}

async function reactDeleteMute(
  msg: Discord.Message | Discord.PartialMessage,
  length = 0,
  emojis = [],
) {
  LAST_FIVE_MESSAGES[lastFiveIndex++] = msg;
  lastFiveIndex %= 5;

  for (let i = 0; i < emojis.length; i++) {
    setTimeout(() => {
      msg
        .react(emojis[i])
        .catch(err =>
          console.error('Error sending reactDeleteMute reactions', err),
        );
    }, i * 1200);
  }

  setTimeout(() => {
    if (!msg.deleted) msg.delete().catch(err => console.error(err));
  }, Math.max(500, emojis.length * 1200));

  if (length) {
    await msg.member.roles.add(COUNTING_MUTE_ROLE);
    setTimeout(() => {
      msg.member.roles
        .remove(COUNTING_MUTE_ROLE)
        .catch(err => console.error('Error removing counting mute role', err));
    }, length);
  }
}
