import axios from 'axios';
import * as Config from 'config';
import * as Discord from 'discord.js';

let lastPing = 0;
// Only active if pinged in the last 5min
const TIME_SINCE_LAST_PING = 5 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 250;
const SPEAK_UP_IF_AFTER = 20 * 60 * 1000;

const MAX_MESSAGES_LENGTH = 2000;
const MAX_MESSAGES_COUNT = 20;

let lastMessageFromAnyoneTime = Date.now();

const MY_USERNAME = 'SlugBot';
const INITIAL_TEXT =
  'The following is a chatroom conversation between SlugBot and ' +
  'students who attend UC Santa Cruz. ' +
  'SlugBot is creative, witty, and very friendly.\n' +
  '\n' +
  "SlugBot: Hey, what's up guys?\n";

let messageHistory: { username: string; message: string; time?: number }[] = [
  { username: 'DemiPixel', message: 'Hey, who are you?' },
  { username: 'SlugBot', message: "Hey DemiPixel, I'm SlugBot!" },
  { username: 'DemiPixel', message: 'What are your favorite shows?' },
  {
    username: 'SlugBot',
    message:
      'I loved that show Queens Gambit on Netflix. And have you seen the new season of Sex Education?',
  },
  { username: 'DemiPixel', message: "I'm still in the middle, no spoilers!" },
  {
    username: 'SlugBot',
    message: "SlugBot: Ahhh alright alright, I won't spoil anything.",
  },
];
let waitingForMessage = false;
let lastMessageAt = 0;
let errorsInARow = 0;

module.exports = {
  ready: async (client: Discord.Client) => {},
  message: async (client: Discord.Client, msg: Discord.Message) => {
    if (msg.author.id === client.user.id) return;
    else if (!msg.member) return;
    else if (msg.channel.id !== Config.get('openai.chatChannelId')) return;

    if (msg.mentions.has(client.user)) {
      lastPing = Date.now();
    } else if (msg.content === 'STOP SLUGBOT') {
      lastPing = 0;
      return;
    } else if (msg.content === 'RESET SLUGBOT') {
      messageHistory = [];
      return;
    } else if (Date.now() - lastMessageFromAnyoneTime >= SPEAK_UP_IF_AFTER) {
      lastPing = Date.now();
    }

    if (Date.now() - lastPing < TIME_SINCE_LAST_PING) {
      const username =
        msg.member.displayName.replace(/[^a-zA-Z]/g, '') || 'Unknown';
      messageHistory.push({
        username: username === MY_USERNAME ? 'Unknown' : username,
        message: msg.cleanContent
          .replace(/\n/g, ' ')
          .slice(0, MAX_MESSAGE_LENGTH),
        time: Date.now(),
      });
      pruneMessageHistory();

      if (!waitingForMessage) {
        scheduleMessage(msg.channel);
      }
    }
  },
};

function scheduleMessage(channel: Discord.TextBasedChannels) {
  waitingForMessage = true;

  setTimeout(() => {
    const startTime = Date.now();
    getNextChatMessage()
      .then(msg => {
        channel.send(msg);
        lastMessageAt = Date.now();
        errorsInARow = 0;
        // See if somebody else chatted while we were in the middle of chatting.
        if (
          messageHistory.some(
            ({ username, time }) =>
              username !== MY_USERNAME && time > startTime,
          )
        ) {
          scheduleMessage(channel);
        } else {
          waitingForMessage = false;
        }
      })
      .catch(err => {
        console.error(err);
        waitingForMessage = false;

        errorsInARow++;
        if (errorsInARow >= 3) {
          lastPing = 0;
        }
      });
  }, Math.max(3_000, 10_000 - (Date.now() - lastMessageAt)));
}

// Removes messages until we have < 2k words
function pruneMessageHistory() {
  // Remove messages that are 20min old
  messageHistory = messageHistory.filter(
    ({ time }) => !time || Date.now() - time < 20 * 60 * 1000,
  );
  messageHistory = messageHistory.slice(-MAX_MESSAGES_COUNT);

  let total = 0;
  for (let i = messageHistory.length - 1; i >= 0; i--) {
    const { username, message } = messageHistory[i];
    total += username.length + 2 + message.length + 1;

    if (total >= MAX_MESSAGES_LENGTH) {
      messageHistory.splice(0, i);
      return;
    }
  }
}

async function getNextChatMessage() {
  const text = await getOpenAIResponse();
  messageHistory.push({
    username: MY_USERNAME,
    message: text,
    time: Date.now(),
  });

  return text;
}

function getOpenAIResponse() {
  const prompt =
    INITIAL_TEXT +
    messageHistory
      .map(({ username, message }) => username + ': ' + message)
      .join('\n') +
    '\n' +
    MY_USERNAME +
    ': ';

  if (Math.random() < 0.02) {
    console.log(prompt);
  }

  return axios
    .post(
      'https://api.openai.com/v1/engines/davinci-codex/completions',
      {
        prompt,
        temperature: 0.8,
        top_p: 1,
        max_tokens: 250,
        logprobs: 20,
        frequency_penalty: 0.6,
        presence_penalty: 0.2,
        best_of: 3,
        stop: ['\n', '"""'],
      },
      {
        headers: { Authorization: 'Bearer ' + Config.get('openai.secret') },
      },
    )
    .then(resp => {
      const text = resp.data?.choices?.[0]?.text;
      if (text) {
        return text;
      } else {
        console.log(resp.data);
        return 'Nothing to say, hmm...';
      }
    });
}
