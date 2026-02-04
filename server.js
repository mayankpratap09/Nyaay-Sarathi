const express = require("express");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 8080;

const REMINDERS_FILE = path.join(__dirname, "reminders.json");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Ensure reminders file exists
if (!fs.existsSync(REMINDERS_FILE)) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify([]));
}

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Add reminder
app.post("/add-reminder", (req, res) => {
  const { clientName, clientEmail, caseTitle, reminderTime } = req.body;

  if (!clientEmail || !reminderTime) {
    return res.status(400).send("Email and time required");
  }

  const reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE));

  reminders.push({
    id: Date.now(),
    clientName,
    clientEmail,
    caseTitle,
    reminderTime,
    sent: false,
  });

  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
  res.send("Reminder saved successfully");
});

// Cron job – runs every minute
cron.schedule("* * * * *", () => {
  const reminders = JSON.parse(fs.readFileSync(REMINDERS_FILE));
  const now = new Date();

  reminders.forEach((r) => {
    if (!r.sent && new Date(r.reminderTime) <= now) {
      transporter.sendMail(
        {
          from: process.env.EMAIL,
          to: r.clientEmail,
          subject: "Case Reminder",
          text: `Hello ${r.clientName || "Client"},
          
This is a reminder for your case:
${r.caseTitle || "Scheduled Case"}

Time: ${r.reminderTime}

– Nyay-Sarathi`,
        },
        (err) => {
          if (!err) {
            r.sent = true;
            fs.writeFileSync(
              REMINDERS_FILE,
              JSON.stringify(reminders, null, 2)
            );
            console.log("Email sent to", r.clientEmail);
          }
        }
      );
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
