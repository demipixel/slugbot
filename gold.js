const config = require('config');

const EMOJI_NAME = config.get('gold.emoji');
const ADD_TO_BOARD = config.get('gold.add_to_board');
const MIN_TO_KEEP = config.get('gold.min_to_keep');

// Maps a gold message id to a board message
const goldToBoard = {};

module.exports = {
  ready: function(client) {
    const boardChannel = client.channels.find(
      ch => ch.id === config.get('gold.board_channel_id'),
    );

    client.on('messageReactionAdd', msgReaction => {
      if (msgReaction.emoji.name !== EMOJI_NAME) return;
      const msg = msgReaction.message;

      if (msgReaction.count >= ADD_TO_BOARD) {
        if (!goldToBoard[msg.id]) {
          boardChannel
            .send('', { embed: getBoardEmbed(msg, msgReaction.count) })
            .then(boardMessage => {
              goldToBoard[msg.id] = boardMessage;
            })
            .catch(err => console.error('Could not send message', err));
        } else {
          goldToBoard[msg.id].edit('', {
            embed: getBoardEmbed(msg, msgReaction.count),
          });
        }
      }
    });

    client.on('messageReactionRemove', msgReaction => {
      if (msgReaction.emoji.name !== EMOJI_NAME) return;
      const msg = msgReaction.message;

      if (goldToBoard[msg.id]) {
        if (msgReaction.count < MIN_TO_KEEP) {
          goldToBoard[msg.id].delete();
          delete goldToBoard[msg.id];
        } else {
          goldToBoard[msg.id].edit('', {
            embed: getBoardEmbed(msg, msgReaction.count),
          });
        }
      }
    });

    client.on('messageUpdate', (oldMsg, msg) => {
      if (goldToBoard[msg.id]) {
        goldToBoard[msg.id].edit('', {
          embed: getBoardEmbed(
            msg,
            msg.reactions.find(r => r.emoji.name === 'gold').count,
          ),
        });
      }
    });
  },
};

function getBoardEmbed(msg, count) {
  const firstAttachment = msg.attachments.first();
  return {
    type: 'rich',
    color: '15970383', // #f3b04f
    timestamp: msg.createdAt,
    description:
      msg.content.length > 1000
        ? msg.content.slice(0, 1000) + '...'
        : msg.content,
    thumbnail: { url: msg.author.avatarURL },
    image:
      firstAttachment && firstAttachment.height !== undefined
        ? { url: firstAttachment.url }
        : undefined,
    fields: [
      {
        name: 'Jump To Message',
        value: `[Click Here](https://discordapp.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id})`,
      },
    ],
    footer: { text: `${count} golds` },
  };
}
