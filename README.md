✍️ Work Log — Your Daily Productivity Sidekick
Capture your day, organize your tasks, and boost your productivity—all in one smart little app.

What’s the Buzz?
Jot down your day’s raw notes, and watch the app transform them into clear, concise, dated bullet points: Done, Pending, and Problems. It even tells you who needs follow-up and unpacks your week or month with smart insights and personalized summaries. Think of it as your digital productivity coach, guiding your daily grind!

🚀 Quick Launch: Deploy on Vercel in ~10 Minutes
Get your Anthropic API key:
Head to console.anthropic.com to grab your API key. Keep it handy!

Upload to GitHub:
Spin up a new repo and push all the files—including the crucial api folder.

Import to Vercel:
On the Vercel dashboard, create a new project by selecting your repo. Pick the Other framework preset and hit Deploy (leave other settings as is).

Hook up your database:
In Vercel, add Upstash Redis from the Storage tab or Marketplace. The free plan does the trick. Connect it—Vercel handles the rest with environment variables.

Set your environment variables:
In Project Settings > Environment Variables, add:

ANTHROPIC_API_KEY = (your API key)
APP_PASSWORD = (your secret password for access)
Optional: ANTHROPIC_MODEL = (custom Claude model, defaults to claude-sonnet-5)
Redeploy:
Redeploy from the latest Deployment tab to activate your settings.

Start logging!
Open your Vercel URL, enter the password, and you’re ready. Pro tip: add it to your phone’s home screen for instant access.

🎯 How to Use — Simple Daily Rituals
Morning (Just 1 Minute)
Open the Today tab.
Jot down your top 3 priorities.
Click Save without summary to lock them in.
Evening (3 Minutes Window)
Write your day’s rough notes.
Rate your productivity and energy (1-5 scale). Your rating guides the app’s smart insights.
Hit Summarize and save to get:
Your wins, done tasks, pending work, and problems
Reasons for lost time
Priority status (Done, Partly, Not Done)
Work done beyond your priorities
Who needs your follow-up
Weekly or Monthly Wrap-up
Visit the Report tab.

Select the period and click Analyze.

Receive a rich analysis with:

Productivity and energy patterns by day
Your best and worst days—and why
Common themes on top productivity days
Main time-wasters
How well you stuck to your priorities
Energy ebbs and flows
New rules to try next period
Suggested top priorities for the future
Use Copy report to paste it easily into emails or documents.

Heads up: The app shines brightest after about two weeks of consistent use.

📁 Behind the Scenes: Key Files
index.html — Your sleek, user-friendly interface
api/summarize.js — Magic that turns notes into actionable summaries
api/report.js — Generates insightful patterns and statistics
api/entries.js — Handles saving, loading, and deleting entries
api/_lib.js — Security, database talk, and AI calls
🔒 Important Notes
Your notes are safely stored in your private Upstash database and are only sent to Anthropic’s API for smart summarizing. Avoid sharing passwords or sensitive customer data in your notes.
Need to secure your app? Change the APP_PASSWORD in Vercel anytime to lock out previous sessions.
Start logging. Stay sharp. Own your day.
