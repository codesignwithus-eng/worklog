# Work Log — Rule-Based Edition

A single-user daily work log with deterministic summaries and Upstash Redis storage. This version does not use Anthropic, other AI APIs, or any external AI service.

## Features

- Daily notes, three priorities, productivity and energy ratings.
- Rule-based categorization into wins, done, pending, problems, causes, and follow-ups.
- Priority checks based on text matching.
- Automatic save and summarization after you pause editing.
- Weekly/monthly reports calculated locally by the server from stored entries and ratings.
- Follow-up completion state preserved when summaries are regenerated.

## Deploy to Vercel

1. Push the contents of this folder to a GitHub repository.
2. Import the repository into Vercel. The project uses a static `index.html` and Node.js functions in lowercase `api/`.
3. Create or connect an Upstash Redis database.
4. Add these environment variables in Vercel Project Settings → Environment Variables:
   - `APP_PASSWORD`: a strong, unique password for this private single-user app.
   - `UPSTASH_REDIS_REST_URL`: the Upstash REST URL.
   - `UPSTASH_REDIS_REST_TOKEN`: the Upstash REST token.
5. Redeploy after setting environment variables.
6. Open the deployment URL, enter your password, and test saving, loading, deleting, and reporting.

The app also recognizes `KV_REST_API_URL` and `KV_REST_API_TOKEN` for existing Vercel integrations.

## Local checks

Requires Node.js 20 or newer.

```sh
npm test
```

The test suite covers deterministic parsing. The application still requires a deployed Redis instance and configured environment variables for end-to-end testing.

## How automatic summaries work

When you edit notes, priorities, or ratings, the browser waits 1.6 seconds after the latest edit. It saves the entry first, then calls `/api/summarize`. The summary endpoint applies local keyword and checkbox rules, saves the summary with the entry, and returns it to the UI. No AI API key is required. The manual “Summarize and save” button remains available as a fallback.

## Parsing rules

- **Done:** `[x]`, `done:`, or common completion terms such as completed, sent, resolved, and delivered.
- **Problems:** `[!]` or keywords such as issue, blocked, problem, bug, delay, waiting on, and stuck.
- **Follow-ups:** `@name`, follow up, call, email, reply to, contact, remind, and related terms.
- **Pending:** lines that are not otherwise classified as completed, problems, or follow-ups.
- **Priority status:** deterministic text matching against completed and mentioned lines. This is a heuristic, not semantic understanding; check results and edit notes for clarity.

## Security notes

- Keep all Upstash credentials in server-side environment variables. Never put them in `index.html`.
- The current single-password gate is intentionally simple. The browser currently retains the password in `localStorage`; this is a known trade-off, not equivalent to a secure session-cookie authentication system. Use a strong password, do not use a shared/public computer, and consider a server-side session with an `HttpOnly`, `Secure`, `SameSite` cookie before exposing the app beyond personal use.
- Configure rate limiting before exposing the URL publicly. The shared password check alone does not prevent brute-force attempts.
- Back up Redis data periodically. This app does not currently implement automated backup/restore.

## Storage format

Entries are stored in the Redis hash `worklog`, with each field named `YYYY-MM-DD`. Each value is a JSON string containing raw notes, priorities, ratings, summary categories, and update timestamp.
