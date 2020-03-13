const previousInfected = {};

module.exports = {
  ready: function(client) {},

  message: function(client, msg) {
    if (previousInfected[msg.channel.name] && !isInfected(msg.member)) {
      if (Math.random() < 0.005) {
        msg.member.addRole(
          client.guilds.first().roles.find(role => role.name === 'Infected'),
        );
      }
    }

    if (msg.member) {
      previousInfected[msg.channel.name] = isInfected(msg.member);
    }
  },
};

function isInfected(member) {
  return member.roles.some(role => role.name === 'Infected');
}
