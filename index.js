import ical2json from 'ical2json';
import fs from 'fs';
import got from 'got';
import express from 'express';
import compression from "compression";
import ShortUniqueId from 'short-unique-id';
import config from './config/config.json' assert { type: "json" };
const app = express()
const port = 3000
const uid = new ShortUniqueId({ length: 8 });

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static('public'))
app.use(express.urlencoded({
  extended: true
}));
app.use(compression())
app.set("view engine", "ejs")

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '/public/index.html'));
})

app.get("/register",(req, res) => {
  let url = req.query.timeEditUrl
  if (url.startsWith("https://cloud.timeedit.net/") && url.endsWith(".ics")) {
    let userid = uid()
    config[userid] = {}
    config[userid]["url"] = url
    fs.writeFileSync('./config/config.json', JSON.stringify(config, null, 2));
    res.redirect("/config/" + userid)
  } else {
    res.send("Invalid URL, make sure it is an .ics feed from TimeEdit")
  }
})

app.post("/config/:user/save", (req, res) => {
  let user = req.params["user"]
  console.log(req.body)

  if (req.body["option1"] && req.body["option1"] == "option1") {
    config[user]["option1"] = true
  } else {
    config[user]["option1"] = false
  }

  if (req.body["removeCourses"] && typeof req.body["removeCourses"] === "string") {
    config[user]["removeCourses"] = req.body["removeCourses"].replaceAll(" ","").split(",")
  }

  res.redirect("/config/" + user)
  fs.writeFileSync('./config/config.json', JSON.stringify(config, null, 2));
})

app.get("/config/:user", (req, res) => {
  let user = req.params["user"]
  let url = "error"
  if (config[user]["url"]) {
    url = config[user]["url"]
  }

  let removeCourses = ""
  if (config[user]["removeCourses"]) {
    removeCourses = config[user]["removeCourses"].join(", ")
  }

  let option1 = true
  if (config[user]["option1"]) {
    option1 = config[user]["option1"]
  }
  
  res.render("config", {url: url, user: user, removeCourses: removeCourses, option1: option1})
});

app.get("/cal/:user.ics", async (req, res) => {
  let user = req.params["user"]
  console.log(user)
  console.log(config[user])
  console.log(config[user]["url"])
  if(config[user] && config[user]["url"]){
    let toSend = await fetchyFilter(config[user])
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
  const removeCourses = user?.removeCourses || [];
  // Plaintext Replacement
  let plaintext = JSON.stringify(events);

  // plaintext = plaintext.replaceAll('Kurskod\\\\, Kursnamn: ', '');
  // plaintext = plaintext.replaceAll('Rum\\\\, Hus: ', '');
  // plaintext = plaintext.replaceAll('\\\\, Tentamen', '');

  let filteredEvents = JSON.parse(plaintext);

  // JSON Filtering
  if (user?.option1) {
    filteredEvents = filteredEvents.filter((event) => !event.SUMMARY.startsWith('Tentamen') && !event.SUMMARY.startsWith('Självstudier') && !event.SUMMARY.includes('Holiday') && !event.SUMMARY.includes('Omtentamen'));
  }
  
  for (let i = 0, l = removeCourses.length; i < l; i++){
    filteredEvents = filteredEvents.filter((event) => !event.SUMMARY.includes(removeCourses[i]));
  }

  // filteredEvents = filteredEvents.map((event) => {
  //   if (event.SUMMARY == 'Tentamen') {
  //     if (event.DESCRIPTION.includes('Information inför val av kandidatarbete')) {
  //       event.SUMMARY = 'Information inför val av kandidatarbete';
  //     }
  //     if (event.DESCRIPTION.includes('Halv dag/ Half day')) {
  //       event.SUMMARY = 'Halv dag';
  //     }
  //   }
  //   return event;
  // });

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
    const result = await ical2json.revert(output);
    return result
  } catch (error) {
    console.error(error);
    return('Failed to fetch calendar');
  }
};

// fetchyFilter(url)