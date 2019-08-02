const request = require('request');
const md5 = require('md5');

const ENDPOINT = 'https://www.cleverbot.com/webservicemin?uc=UseOfficialCleverbotAPI';

class Cleverbot {
  constructor() {
    this.messages = [];
    this.internalId = null;
    this.LOWER_MD5 = null;
    this.UPPER_MD5 = null;
    this.cookie = null;

    this.sendingMessage = false;
    this.queue = [];

    this.getCookie();
    request('https://www.cleverbot.com/extras/conversation-social-min.js', (err, http, body) => {
      const match = body.match(/md5\([^)]+substring\((\d+),(\d+)\)/);
      if (!match) {
        console.error('Issue fetching script!');
      } else {
        this.LOWER_MD5 = parseInt(match[1]);
        this.UPPER_MD5 = parseInt(match[2]);
      }
    });
  }

  getCookie() {
    request('https://www.cleverbot.com/', (err, http, body) => {
      this.cookie = http.headers['set-cookie'][0];
      this._sendNextInQueue();
    });
  }

  send(msg, cb) {
    if (this.sendingMessage) {
      this.queue.push({ msg, cb });
    } else {
      this._send(msg, cb);
    }
  }

  _sendNextInQueue() {
    this.sendingMessage = false;
    if (this.queue.length > 0) {
      const item = this.queue.shift();
      this._send(item.msg, item.cb);
    }
  }

  _send(msg, cb) {
    if (!this.LOWER_MD5 || !this.cookie) {
      return cb('I\'m not ready to talk yet!');
    }
    this.sendingMessage = true;

    let body = 'stimulus=' + encodeForSending(msg);
    for (let i = 0; i < this.messages.length; i++) {
      body += '&vText' + (i+2) + '=' + encodeForSending(this.messages[i]);
    }
     body += '&cb_settings_language=en';
    body += '&cb_settings_scripting=no';
    if (this.internalId) body += '&sessionid=' + this.internalId;
    body += '&islearning=1';
    body += '&icognoid=wsf';
    body += '&icognocheck=' + md5(body.substring(this.LOWER_MD5, this.UPPER_MD5));

    console.log(body);

    request.post({
      url: ENDPOINT,
      timeout: 5000,
      body,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:7.0.1) Gecko/20100101 Firefox/7.0',
        'Referer': 'https://www.cleverbot.com',
        'Origin': 'https://www.cleverbot.com',
        'Cookie': this.cookie
      }
    }, (err, http, body) => {
      if (err) {
        console.error(err);
        return cb('Houston, we have a problem.');
      }
      const lines = body.split('\r');
      if (http.statusCode == 404) {
        return this.getCookie();
      } else if (!body || lines.length == 1 ||  http.statusCode != 200) {
        console.log(body, http);
        return cb('I don\'t know what to say...');
      }

      this.internalId = lines[1];
      cb(lines[0]);
      this.messages.unshift(msg);
      this.messages.unshift(lines[0]);

      while (this.messages.length >= 10) {
        this.messages.pop();
      }

      this._sendNextInQueue();
    });
  }
}

// Pulled from cleverbot's site
function encodeForSending(a) {
  var f = "";
  var d = "";
  a = a.replace(/[|]/g, "{*}");
  for (var b = 0; b <= a.length; b++) {
      if (a.charCodeAt(b) > 255) {
          d = escape(a.charAt(b));
          if (d.substring(0, 2) == "%u") {
              f += "|" + d.substring(2, d.length)
          } else {
              f += d
          }
      } else {
          f += a.charAt(b)
      }
  }
  f = f.replace("|201C", "'").replace("|201D", "'").replace("|2018", "'").replace("|2019", "'").replace("`", "'").replace("%B4", "'").replace("|FF20", "").replace("|FE6B", "");
  return escape(f)
}

module.exports = Cleverbot;