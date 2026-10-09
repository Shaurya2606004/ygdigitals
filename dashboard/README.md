# YG Hub — the studio dashboard for YG Digitals

Where the YG team passes work to each other, and where clients log in to see progress and what's planned, and to approve work. Same brand as ygdigitals.com. Kept deliberately small: only what a 5-person studio uses every day.

```bash
cd dashboard
npm install
cp .env.example .env.local   # then fill it in (see Backend)
npm run dev        # http://localhost:5174
npm test           # the rules, offline: client isolation, handoffs, approvals, calendar clashes, roles
npm run test:live  # the real Supabase project: sign-in, what each role loads, live updates, refusals
npm run build      # static site in dashboard/dist
```

## Backend (Supabase)

One Supabase project, **YG Hub** (region Mumbai), does everything: logins, the database, the access rules and live updates. There is no other server.

- **Logins:** Supabase Auth, email and password. Only the admin creates logins (Settings › Team / Clients), with a temporary password they share. People change it in Settings › Profile. If someone forgets theirs, the admin sets a new one.
- **Database:** `supabase/migrations/` holds the whole setup, in order:
  - `…01_schema.sql` creates the tables.
  - `…02_access.sql` sets who can read what (row-level security).
  - `…03_actions.sql` defines one server function per action.
  - `…04_realtime.sql` turns on live updates.
  - `…05` to `…08` add the two company channels, group chats, editing and deleting messages, read receipts, and the typing and online signals.
- **Access rules:** every table is read-only to the app and filtered per person. A client only ever receives their own projects, plan, sent work, meetings and project chat. Task comments, checklists and the studio's notes about clients sit in separate `*_private` tables that clients can't read at all. Every change goes through a function that re-checks the same rules as `can()` in `src/store.js`, so a modified browser can't get around them.
- **Speed:** the app loads everything a person may see in one call (`bootstrap`, about 12 ms on the server). After that, every screen is instant.
  - **Saving:** every click shows straight away and saves in the background, in order. Only the fields you changed are sent, so two people editing different fields never overwrite each other.
  - **Live updates:** everyone else's changes arrive within about half a second.
  - **Failed saves:** if one fails, a message says so and the screen goes back to what's really saved.
- **People and logins:** the `supabase/functions/people` edge function adds, edits and switches off logins. It needs Supabase's admin powers, so it runs on the server, and only for the admin.
- **Chat privacy:**
  - Group chats are for the team only.
  - The admin can read every group, including ones they aren't in. Members aren't told, so in a group they aren't in the admin can't post, never counts as having read anything, and leaves no trace.
  - Direct messages stay between the two people, admin included.
  - "Seen" only counts while the app is actually on screen.
  - Typing and online signals go over private Realtime channels with the same rules.
- **Checks:** `supabase/tests/access.sql` signs in as each role inside the database and runs 70 access checks. Paste it into the SQL editor on freshly loaded sample data; it rolls itself back.

### Sample data (development only)

`node scripts/seed-sql.mjs > seed.sql` writes SQL that loads the made-up studio from `src/seed.js` into an empty project. It covers 5 people, 4 client logins, 7 projects, tasks, meetings and chat, and gives every sample person a login: `aman@example.com`, `priya@example.com`, `rahul@example.com` … with the password `DEMO_PASSWORD` from `.env.local`.

In `npm run dev`, the sign-in screen shows one-click buttons for these accounts. Production builds never contain the buttons, the password or the sample data. **Never load the samples into the studio's real project.**

## Roles

| Role | Can |
|---|---|
| Admin | Everything. Adds people and clients, gives clients logins, creates and deletes projects, and **checks work before it goes to a client**. Can read every group chat, unseen (not other people's DMs). |
| Team member | Create, edit and hand off any task, submit work for a check, plan content, meetings and chat, and start group chats. A project's lead can also edit that project. |
| Freelancer | Like a team member, but only inside the projects they lead or are on, plus any task handed to them. No company channels, content plan, activity log or client notes. |
| Client | Only their own projects: progress, a read-only plan of tasks, approving work and posts, the project discussion, and meetings. |

The same rules are in `can()` in `src/store.js` (what the screens offer) and in the database (what's actually allowed). Settings › Roles shows them as a table.

The admin moves someone to another role with **Edit** in Settings › Team. It applies at once, and that person's open app reloads to match. Nobody can change their own role or switch themselves off, so there's always an admin left. Client logins are added and edited under their client in Settings › Clients.

## What's in it

- **Home**: the admin sees what needs checking, tasks without an owner, overdue work, and who's got what. Team members see their own tasks and day. Clients see what's waiting for their approval, their projects, and what's coming up this week.
- **Tasks**: a board (drag to change status) or a list. Each task has an owner, due date, checklist and comments with @mentions. **Hand off** passes unfinished work to a teammate with a note; it becomes theirs and starts again at To do.
  - **Sort by** due date (the default), priority, project or person, on the board, the list and phones. Each device remembers the choice.
  - Whoever sets dates moves one from the card: tap its date for Today, Tomorrow or another day.
  - A finished task stays on the board and in the list for a day, then leaves them (it isn't deleted).
  - When a Video or Design task is marked Done, a Social media task to upload it appears straight away, given to the person in Social media. Social media tasks skip Ready to check.
  - Work (a post's own task, or its upload) set past the day its post goes out moves the post to that day too.
- **Home** for a supervisor: work that's Ready to check has **Approve** and **Send back** (with a note for the maker) right on the row.
- **Projects**: brief, people, the task board (the client sees it as a read-only **Plan**), **Approvals** (maker submits a link → admin checks it → client approves or asks for changes → new version, with full history), the client-visible **Discussion**, and meetings.
  - A supervisor can delete a project by typing its name. Its tasks, work for approval and discussion go with it; its posts stay in the client's content plan, and meetings stay on the calendar.
- **Calendar**: month, week and agenda views of meetings, client calls, shoots, deadlines and posts. It handles repeats (stand-up, weekly planning), Yes/No replies, clash warnings, video-call links, and "Add to Google Calendar" / `.ics` for each event.
- **Messages**: a studio channel, announcements (admin posts), one channel per project shared with the client, team group chats, and direct messages.
  - In every conversation:
    - edit or delete your own messages (the admin can remove anyone's)
    - "Seen" / "Seen by Priya and Vikas"
    - "Priya is typing…"
    - green dots for who's online
    - a "New" line at the first unread message
    - older messages load on request
    - drafts kept while you switch conversations
  - Groups show lines like "Priya added Rahul", and anyone in a group can rename it, add or remove people, or leave.
- **Content plan**: every client's posts on a calendar or pipeline. Clients approve posts marked "Ready for approval".
- **Settings**: your profile and password, the team (admin adds, edits and deactivates people), clients and their portal logins, the roles table, and a backup download for the admin.

Not included on purpose: invoices (billing stays in your accounting software), time tracking, leave and reports. The full earlier version, with all of those, is commit `c9fa47a`.

## Before it goes online

1. Supabase › Authentication › Sign In / Providers: turn off **Allow new users to sign up**, so only the admin can create logins. Even if it's on, a stranger who signs up sees nothing, but there's no reason to allow it.
2. Email through Resend: invites, password resets, and "waiting for your approval" emails with meeting `.ics` attachments.
3. Backups: the free plan has none. Either a weekly automatic export or Supabase Pro ($25/month, daily backups).
4. Swap the sample data for the real team and clients.
5. Deploy `dashboard/` as its own site (e.g. `team.ygdigitals.com`), with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set.
