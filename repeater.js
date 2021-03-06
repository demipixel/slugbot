const fs = require('fs');

const COMBO_FILE = './combo.json';

let highestCombo = {
  count: 0,
  msg: '',
  link: '',
};

const messageTrackers = {};

const TrackerResponse = {
  NONE: 0,
  RESET: 1,
  CLEAR: 2,
};

module.exports = {
  ready: client => {
    try {
      highestCombo = JSON.parse(fs.readFileSync(COMBO_FILE, 'utf8'));
    } catch (e) {
      console.log('No highest combo found!');
    }
  },

  message: (client, msg) => {
    const validTrackerChannel = !msg.channel.name.startsWith('counting');

    if (msg.content === '!combo') {
      const highestMessage =
        highestCombo.msg.length > 80
          ? highestCombo.msg.slice(0, 70) + '...'
          : highestCombo.msg;
      msg.channel.send(
        `${highestMessage} (${highestCombo.count})\n${highestCombo.link}`,
      );
    } else if (validTrackerChannel && !msg.content.startsWith('!')) {
      const tracker = messageTrackers[msg.channel.name];
      if (tracker) {
        const response = tracker.receiveMessage(msg);
        if (response === TrackerResponse.RESET) {
          messageTrackers[msg.channel.name] = new Tracker(msg);
        } else if (response === TrackerResponse.CLEAR) {
          delete messageTrackers[msg.channel.name];
        }
      } else {
        messageTrackers[msg.channel.name] = new Tracker(msg);
      }
    }
  },
};

class Tracker {
  constructor(firstMessage) {
    this.msgObj = firstMessage;
    this.str = firstMessage.content;
    this.users = new Set();
    this.users.add(firstMessage.member.user.id);
  }

  /**
   * Handle a new message sent in the same channel
   * @param {*} msg Full message object
   * @returns True if tracker should be kept, false if tracker should be set to null
   */
  receiveMessage(msg) {
    const fromUserId = msg.member.user.id;

    if (msg.content !== this.str) {
      if (this.users.size > 3) {
        this.sendFinishMessage(msg, false);
        this.saveIfHighScore();
        return TrackerResponse.CLEAR;
      } else {
        return TrackerResponse.RESET;
      }
    } else if (this.users.has(fromUserId)) {
      if (this.users.size < 3) {
        return TrackerResponse.RESET;
      } else {
        this.sendFinishMessage(msg, true);
        this.saveIfHighScore();
        return TrackerResponse.CLEAR;
      }
    } else {
      this.users.add(fromUserId);
      if (this.users.size === 3) {
        msg.channel.send(msg.content);
        this.users.add('me');
      }
      return TrackerResponse.NONE;
    }
  }

  sendFinishMessage(msg, showDuplicateUserMessage) {
    const finalMessage =
      this.users.size > highestCombo.count
        ? `New high score of ${this.users.size}! (Old high score: ${highestCombo.count})`
        : this.users.size === highestCombo.count
        ? `SO CLOSE! We *tied* the high score of ${highestCombo.count} (type !combo for the current high score)`
        : `Unfortunately ${this.users.size} does not beat the record of ${highestCombo.count} (type !combo for the current high score)`;

    const duplicateUser = showDuplicateUserMessage
      ? ' (you already participated in this chain)'
      : '';

    msg.channel.send(
      `${'C-'.repeat(
        this.users.size - 1,
      )}Combo Breaker${duplicateUser}! ${finalMessage}`,
    );
  }

  saveIfHighScore() {
    if (this.users.size > highestCombo.count) {
      highestCombo.count = this.users.size;
      highestCombo.msg = this.str;
      highestCombo.link = `https://discordapp.com/channels/${this.msgObj.guild.id}/${this.msgObj.channel.id}/${this.msgObj.id}`;
      fs.writeFileSync(COMBO_FILE, JSON.stringify(highestCombo));
    }
  }
}
