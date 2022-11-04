import ical2json from 'ical2json';
import fs from 'fs';
import got from 'got';
import express from 'express';
import compression from "compression"
import helmet from "helmet"
import ShortUniqueId from 'short-unique-id';
import config from './config.json' assert { type: "json" };
const app = express()
const port = 3000
const uid = new ShortUniqueId({ length: 8 });

app.use(express.static('public'))
app.use(compression())
app.use(helmet())
app.set("view engine", "ejs")

//const url = 'https://cloud.timeedit.net/chalmers/web/public/ri6Y036mZ55Z6hQ1W55865615Q40y4Q6Zt680ZZZX46Q627695y0nZ65QZA1D6C7tZCD595CQ4A122t17E7Q5DFB18367dF20538338.ics';

//const removeCourses = ['EDA452', 'RRY125', 'EEM021', 'FUF045', 'MVE550', 'TME055', 'TMA690', 'FTF131', "MVE370"];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'));
})

app.get("/register",(req, res) => {
  let url = req.query.timeEditUrl
  if (url.startsWith("https://cloud.timeedit.net/")) {
    let userid = uid()
    res.redirect("/config/" + userid)
    config[userid] = {}
    config[userid]["url"] = url
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  } else {
    res.send("Invalid URL")
  }
})

app.get("/config/:user", (req, res) => {
  let user = req.params["user"]
  let url = config[user]["url"]
  res.render("config", {url: url, user: user})
});

app.get("/cal/:user.ics", async (req, res) => {
  let user = req.params["user"]
  console.log(user)
  if(config.user && config.user.url){
    let toSend = await fetchyFilter(config.user)
    res.set({"Content-Disposition":"attachment; filename=" + user + ".ics",'Content-type': 'text/calendar'});
    res.send(toSend);
  } else {
    res.send(user + " not found")
  }
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

const filterEvents = (events, user) => {
  const removeCourses = user.removeCourses;
  // Plaintext Replacement
  let plaintext = JSON.stringify(events);

  plaintext = plaintext.replaceAll('Kurskod\\\\, Kursnamn: ', '');
  plaintext = plaintext.replaceAll('Rum\\\\, Hus: ', '');
  plaintext = plaintext.replaceAll('\\\\, Tentamen', '');

  let filteredEvents = JSON.parse(plaintext);

  // JSON Filtering
  filteredEvents = filteredEvents.filter((event) => !event.DESCRIPTION.startsWith('Tentamen') && !event.DESCRIPTION.startsWith('Självstudier') && !event.DESCRIPTION.includes('Holiday') && !event.DESCRIPTION.includes('Omtentamen'));
  
  for (let i = 0, l = removeCourses.length; i < l; i++){
    filteredEvents = filteredEvents.filter((event) => !event.SUMMARY.includes(removeCourses[i]));
  }

  filteredEvents = filteredEvents.map((event) => {
    if (event.SUMMARY == 'Tentamen') {
      if (event.DESCRIPTION.includes('Information inför val av kandidatarbete')) {
        event.SUMMARY = 'Information inför val av kandidatarbete';
      }
      if (event.DESCRIPTION.includes('Halv dag/ Half day')) {
        event.SUMMARY = 'Halv dag';
      }
    }
    return event;
  });

  return filteredEvents;
};

// Fetch and filter and to serve it back to the client
const fetchyFilter = async (user) => {
  const url = user.url;
  try {let response = await got(url);
    if (response.statusCode != 200) {
      console.error('Failed to fetch calendar');
      return('Failed to fetch calendar');
    }
    const output = await ical2json.convert(response.body);
    output.VCALENDAR[0].PRDOID = "-//TimeEditEd\\\\\\, //TimeEditEd//EN";
    output.VCALENDAR[0]["X-WR-CALNAME"] = output.VCALENDAR[0]["X-WR-CALNAME"].replace('TimeEdit-', '');
    const events = output.VCALENDAR[0].VEVENT;
    const filteredEvents = await filterEvents(events, user);
    output.VCALENDAR[0].VEVENT = filteredEvents;
    // fs.writeFileSync('events.json', JSON.stringify(events, null, 2));
    // fs.writeFileSync('eventsfilter.json', JSON.stringify(filteredEvents, null, 2));
    const result = await ical2json.revert(output);
    return result
  } catch (error) {
    console.error(error);
    return('Failed to fetch calendar');
  }
};

// fetchyFilter(url)