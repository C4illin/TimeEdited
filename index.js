import ical2json from "ical2json";
import fs from "node:fs";
import got from "got";
import express from "express";
import compression from "compression";
import ShortUniqueId from "short-unique-id";
const app = express();
const port = 3000;
const uid = new ShortUniqueId({ length: 8 });

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = JSON.parse(
	fs.readFileSync(resolve(__dirname, "./config/config.json"), "utf-8"),
);

app.use(express.static("public"));
app.use(
	express.urlencoded({
		extended: true,
	}),
);
app.use(compression());
app.set("view engine", "ejs");

app.get("/", (req, res) => {
	res.sendFile(join(__dirname, "/public/index.html"));
});

app.get("/register", (req, res) => {
	const url = req.query.timeEditUrl;
	if (url.startsWith("https://cloud.timeedit.net/") && url.endsWith(".ics")) {
		const userid = uid();
		config[userid] = {};
		config[userid].url = url;
		fs.writeFileSync("./config/config.json", JSON.stringify(config, null, 2));
		res.redirect(`/config/${userid}`);
	} else {
		res.send("Invalid URL, make sure it is an .ics feed from TimeEdit");
	}
});

app.post("/config/:user/save", (req, res) => {
	const user = req.params.user;
	console.log(req.body);

	if (req.body.option1 && req.body.option1 === "option1") {
		config[user].option1 = true;
	} else {
		config[user].option1 = false;
	}

	if (req.body.option2 && req.body.option2 === "option2") {
		config[user].option2 = true;
	} else {
		config[user].option2 = false;
	}

	if (req.body.removeCourses && typeof req.body.removeCourses === "string") {
		config[user].removeCourses = req.body.removeCourses
			.replaceAll(" ", "")
			.split(",");
	}

	res.redirect(`/config/${user}`);
	fs.writeFileSync("./config/config.json", JSON.stringify(config, null, 2));
});

app.get("/config/:user", (req, res) => {
	const user = req.params.user;
	let url = "error";
	if (config[user].url) {
		url = config[user].url;
	}

	let removeCourses = "";
	if (config[user].removeCourses) {
		removeCourses = config[user].removeCourses.join(", ");
	}

	let option1 = true;
	if (config[user].option1) {
		option1 = config[user].option1;
	}

	let option2 = false; // Default to false
	if (config[user].option2) {
		option2 = config[user].option2;
	}

	res.render("config", {
		url: url,
		user: user,
		removeCourses: removeCourses,
		option1: option1,
		option2: option2,
	});
});

app.get("/cal/:user.ics", async (req, res) => {
	const user = req.params.user;
	console.log(user);
	console.log(config[user]);
	console.log(config[user].url);
	if (config[user]?.url) {
		const toSend = await fetchyFilter(config[user]);
		res.set({
			"Content-Disposition": `attachment; filename=${user}.ics`,
			"Content-type": "text/calendar",
		});
		res.send(toSend);
	} else {
		res.send(`${user} not found`);
	}
});

app.listen(port, () => {
	console.log(`Listening at http://localhost:${port}`);
});

const filterEvents = (events, user) => {
	const removeCourses = user?.removeCourses || [];
	// Plaintext Replacement
	let plaintext = JSON.stringify(events);

	plaintext = plaintext.replaceAll("Kurskod\\\\, Kursnamn: ", "");
	plaintext = plaintext.replaceAll("Course name: ", "");
	plaintext = plaintext.replaceAll(
		'";CUTYPE=INDIVIDUAL;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:invalid:nomail',
		"",
	);
	plaintext = plaintext.replaceAll(
		"VIDUAL;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:invalid:nomail",
		"",
	);

	let filteredEvents = JSON.parse(plaintext);

	// JSON Filtering
	if (user?.option1) {
		filteredEvents = filteredEvents.filter(
			(event) =>
				!event.SUMMARY.startsWith("CHARM") &&
				!event.SUMMARY.startsWith("Tentaanmälan") &&
				!event.SUMMARY.startsWith("Tentamen") &&
				!event.SUMMARY.startsWith("Självstudier") &&
				!event.SUMMARY.includes("Holiday") &&
				!event.SUMMARY.includes("Omtentamen") &&
				!event.SUMMARY.includes("Anmälan omtenta"),
		);
	}

	if (user?.option2) {
		// copy location to title and title to location
		filteredEvents = filteredEvents.map((event) => {
      const temp = event.SUMMARY;
			event.SUMMARY = event.LOCATION;
			event.LOCATION = temp;
			return event;
		});
	}

	for (let i = 0, l = removeCourses.length; i < l; i++) {
		filteredEvents = filteredEvents.filter(
			(event) => !event.LOCATION.includes(removeCourses[i]),
		);
	}

	return filteredEvents;
};

// Fetch and filter and to serve it back to the client
const fetchyFilter = async (user) => {
	const url = user.url;
	try {
		const response = await got(url);
		if (response.statusCode !== 200) {
			console.error("Failed to fetch calendar");
			return "Failed to fetch calendar";
		}
		const output = ical2json.convert(response.body);
		output.VCALENDAR[0].PRDOID = "-//TimeEditEd\\\\\\, //TimeEditEd//EN";
		output.VCALENDAR[0]["X-WR-CALNAME"] = output.VCALENDAR[0][
			"X-WR-CALNAME"
		].replace("TimeEdit-", "");
		const events = output.VCALENDAR[0].VEVENT;
		const filteredEvents = await filterEvents(events, user);
		output.VCALENDAR[0].VEVENT = filteredEvents;
		const result = ical2json.revert(output);
		return result;
	} catch (error) {
		console.error(error);
		return "Failed to fetch calendar";
	}
};
