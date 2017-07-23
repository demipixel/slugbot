const request = require('request');
const fs = require('fs');

if (process.argv.length < 3) {
  console.log('Usage: node fetchclasses.js <term>');
  console.log('Term is in the format 2{$year}{$quarter} where $year is the last two digits of the current year');
  console.log('and $quarter is either 0, 2, 4, or 8 for winter, spring, summer, and fall respectively.');
  console.log('E.g. 2178 for Fall of 2017');
  process.exit(1);
}

const classes = {};

function fetchPages(term) {
  console.log('Fetching for term '+term);
  request.post('https://pisa.ucsc.edu/class_search/index.php', {form: {action: 'results', 'binds[:term]': term, rec_dur: 50000} }, (err, http, body) => {
    const classNumbers = [];
    const re = /id="class_title_(\d+)/g;
    let m;

    do {
      m = re.exec(body);
      if (m && classNumbers[classNumbers.length-1] != m[1]) classNumbers.push(m[1].replace(/&amp;/g, '&'));
    } while (m);

    console.log('Got '+classNumbers.length+' classes for term '+term);
    fetchClasses(term, classNumbers, allDone);
  });
}

function fetchClasses(term, classNumbers, cb) {
  let doneCount = 0;
  const done = () => {
    doneCount++;
    console.log(`[Term ${term}] ${Math.round(doneCount/classNumbers.length*100)}% complete`);
    if (classNumbers[nextToFetch]) {
      fetch(classNumbers[nextToFetch]);
      nextToFetch++;
    }
    if (doneCount == classNumbers.length) cb();
  }

  let nextToFetch = 20;

  const fetch = (number) => {
    request.post('https://pisa.ucsc.edu/class_search/', {form: {action: 'detail', 'class_data[:STRM]': term, 'class_data[:CLASS_NBR]': number}}, (err, http, body) => {
      if (err) console.log('Error fetching '+link, err);
      else {
        const classData = parseClass(body);
        classes[classData.classNumber] = classData;
      }

      done();
    });
  };

  classNumbers.slice(0, nextToFetch).forEach(number => {
    fetch(number);
  });
}

function parseClass(classBody) {
  classBody = classBody.replace(/&nbsp;/g, ' ')
  const classData = {};

  let re = /<dt>(.+?)<\/dt><dd>(.+?)<\/dd>/g;
  let m;

  do {
    m = re.exec(classBody);
    if (m) classData[convertToCamelCase(m[1])] = m[2].toLowerCase().replace(/<\/span>/g, '');
  } while (m);

  // Fix information in <dt> and <dd>
  classData.status = (classData.status.match(/alt="(.+?)"/) || ['', 'unknown'])[1];
  classData.credits = parseInt((classData.credits.match(/\d+/) || [-1])[0]);

  // Get name
  classData.fullName = classBody.match(/<h2 style="margin:0px;">([^]+?)<\/h2>/)[1].trim().replace(/ +/g, ' ');
  classData.name = classData.fullName.split('-')[0];

  // Get other information from larger sections
  classData.description = (classBody.match(/Description[^]+?<div class="panel-body">([^]+?)<\/div>/) || ['', ''])[1];
  classData.requirements = (classBody.match(/Requirements[^]+?<div class="panel-body" >([^]+?)<\/div>/) || ['', ''])[1];
  classData.notes = (classBody.match(/Notes[^]+?<div class="panel-body" >([^]+?)<\/div>/) || ['', ''])[1];
  classData.meeting = {};

  re = /<td>(.+?)<\/td>/g;
  m = null;
  let index = 0;
  const indexToKey = {
    0: 'time',
    1: 'room',
    2: 'instructor',
    3: 'dates'
  };

  do {
    m = re.exec(classBody);
    if (m) {
      classData.meeting[indexToKey[index]] = m[1];
      index++;
    }
  } while (m);

  Object.keys(classData).forEach(key => {
    if (typeof classData[key] == 'string') classData[key] = classData[key].trim();
  });

  return classData;
}

let doneCount = 0;
function allDone() {
  doneCount++;
  if (doneCount == process.argv.length - 2) {
    fs.writeFileSync('./classdata.json', JSON.stringify(classes));
    console.log('Done and saved!');
  }
}

function convertToCamelCase(str) {
  return str.toLowerCase().split(' ').map((word, index) => index == 0 ? word : word[0].toUpperCase() + word.slice(1)).join('');
}

process.argv.slice(2).forEach(term => fetchPages(term));
