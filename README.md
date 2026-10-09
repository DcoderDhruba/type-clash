This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Accounts, leaderboard and races

- **Accounts:** sign up with an email, a public username and a password; log in with either the email or the username. Passwords are hashed with scrypt; sessions are stored in the database and sent as an httpOnly cookie. Emails are stored (lowercased) with an `email_verified` flag that is `0` until verification is built; no email is sent yet, and the email is never shown to other players.
- **Leaderboard** (`/leaderboard`, opens on the 60-second time board): each player's best score per test type, plus a race win/loss record. The top three places get a ðŸ‘‘ ðŸ¥ˆ ðŸ¥‰. Scores are saved automatically when a logged-in user finishes a test, after the server has checked them (see below). Names link to player profiles.
- **Two match types** (`/challenge`, "Start a match"): a **Challenge** is a 1 vs 1 duel â€” you share a link, one friend accepts, and it starts by itself a few seconds later. A **Race** is multiplayer: you share a link and create a lobby. Both are typed on the same words at the same time. The leaderboard has a separate tab for each (`challenges` and `races`).
- **Player profiles** (`/profile/name`): tests taken, average and best WPM, a progress chart for each test type, personal bests, recent tests, and race and challenge records. Anyone can look; the email is never shown.
- **Challenge a specific person:** from a profile or a leaderboard row, or `/challenge?to=name`. Only that player can accept it. They see it under the bell in the top bar (`/invites`) and can accept or decline; the host is told if it was declined. An unanswered challenge expires after 30 minutes.
- **Rematch:** the results screen has a **Rematch** button. For a challenge it goes to the other player; for a race it opens a new lobby, and the other players get a "Join rematch" button on their results screen.
- **Races** (multiplayer): create a race and share its link. Anyone who opens the link and joins is in, up to 8 players. Every player except the host clicks **Ready**; the host can press **Start race** once at least 2 players are in and everyone is ready. After a 5-second countdown everyone types the same words at the same time, and everyone gets a place: higher WPM wins, ties go to accuracy, equal results share a place. Nobody can join after the start, and a player who never reports a result forfeits. Players also get a random funny message and icon based on where they finish, plus a live one during the race. The messages are in `src/lib/funnyMessages.ts`, which is plain data meant to be edited: add a line to any list to add a message.

## MySQL setup

The app stores accounts, sessions, scores, tickets, races and race players in MySQL. Copy `.env.example` to `.env.local` and set `MYSQL_PASSWORD` to the password for your Aiven database. The supplied host, port, database name and username are already filled in. `.env.local` is git-ignored; never commit database credentials.

TLS certificate verification is enabled for MySQL connections. Download the CA certificate from the Aiven console and set `MYSQL_SSL_CA` in `.env.local` to the certificate file's path. In Vercel, set `MYSQL_SSL_CA` to the full PEM certificate contents (including the `BEGIN CERTIFICATE` and `END CERTIFICATE` lines). This is required to verify Aiven's certificate chain; do not disable certificate verification. The app creates its tables automatically when it first connects.

The existing SQLite files in `data/` are left untouched and are not imported. Existing accounts and results in those files will not appear in MySQL; new data is stored in MySQL after the environment variables are configured.

## Search engine setup

Set `SITE_URL` in Vercel to the canonical public URL of the deployed site, then redeploy. The app publishes `/robots.txt` and `/sitemap.xml` containing the home page, leaderboard and challenge page; the sitemap is available even if the database is temporarily offline. Public player profiles are linked from the leaderboard. Submit `https://your-domain.com/sitemap.xml` to Google Search Console and Bing Webmaster Tools to request crawling. Search engines control indexing and rankings, which may take time and are not guaranteed.

Things to know before deploying:

- Set all five `MYSQL_*` connection variables in the deployment environment. Keep the password and any CA certificate out of source control.
- Race state is in the database, but login throttling is in memory, so it is per server process.
- **Score checking.** A logged-in player's test is registered with the server at the first key (a one-time "ticket" that records the test's random seed and the server's clock). The words come from that seed, so the server can rebuild them itself. At the end the browser sends the full typing log (every word and when each key was pressed) and the server recounts the score from it, ignoring any number the browser claims. It rejects logs that were pasted, faster than a person can press keys, too regular to be a person, or that do not match how long the test really took. Race results are checked the same way against the race's own words and start time.
- **What this cannot stop.** A program that types the right words at a believable speed with human-like timing will still pass; nothing running in a browser can fully prevent that. The limits are in `src/server/verify.ts` if you want to tighten or loosen them.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
