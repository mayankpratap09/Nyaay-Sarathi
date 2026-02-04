const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const REMINDERS_FILE = path.join(__dirname, 'reminders.json');

// Ensure reminders file exists
if (!fs.existsSync(REMINDERS_FILE)) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify([]));
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Nodemailer transporter (configure with your real credentials or SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your_email@example.com',
    pass: process.env.SMTP_PASS || 'your_email_password'
  }
});

// Helper: read reminders
function readReminders() {
  const data = fs.readFileSync(REMINDERS_FILE, 'utf8');
  return JSON.parse(data);
}

// Helper: write reminders
function writeReminders(reminders) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
}

// Routes
app.post('/add-reminder', (req, res) => {
  const { clientName, clientEmail, caseDateTime, reminderDateTime } = req.body;

  if (!clientName || !clientEmail || !caseDateTime || !reminderDateTime) {
    return res.status(400).send('All fields are required.');
  }

  const reminders = readReminders();

  const newReminder = {
    id: Date.now(),
    clientName,
    clientEmail,
    caseDateTime,
    reminderDateTime,
    sent: false
  };

  reminders.push(newReminder);
  writeReminders(reminders);

  // Redirect back to home with a success flag
  res.redirect('/?success=1');
});

// Cron job: runs every minute
cron.schedule('* * * * *', () => {
  const reminders = readReminders();
  const now = new Date();

  let updated = false;

  reminders.forEach(reminder => {
    if (!reminder.sent) {
      const reminderTime = new Date(reminder.reminderDateTime);

      if (!isNaN(reminderTime.getTime()) && reminderTime <= now) {
        // Send email
        const mailOptions = {
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'your_email@example.com',
          to: reminder.clientEmail,
          subject: `Reminder for your case, ${reminder.clientName}`,
          text: `Hello ${reminder.clientName},

This is a reminder for your case scheduled at:
${reminder.caseDateTime}

Reminder time: ${reminder.reminderDateTime}

Best regards,
Your Firm`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
          } else {
            console.log('Email sent:', info.response);
          }
        });

        reminder.sent = true;
        updated = true;
      }
    }
  });

  if (updated) {
    writeReminders(reminders);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
