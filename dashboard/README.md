# YG Hub — the studio dashboard for YG Digitals

Where the YG team passes work to each other, and where clients log in to see progress and what's planned, and to approve work. Same brand as ygdigitals.com. Kept deliberately small: only what a 5-person studio uses every day.

```bash
cd dashboard
npm install
npm run dev      # http://localhost:5173 (or the next free port)
npm test         # the rules: client isolation, handoffs, approvals, calendar clashes, roles
npm run build    # static site in dashboard/dist
```

## Demo mode (right now)

Everything lives in the browser (localStorage), pre-filled with a made-up studio: 5 people, 5 clients, 7 projects, tasks, meetings and chat. **All people, clients and links are samples**. Replace them in Settings, or use Settings › Profile › Reset demo data (admin).

- Sign in with any sample email (e.g. `aman@ygdigitals.com`) and the password `yghub`, or click a person on the sign-in screen.
- Each browser tab has its own sign-in, and tabs sync live. Open one tab as the team and another as a client to watch approvals, chat and notifications move between them.

## Roles

| Role | Can |
|---|---|
| Admin | Everything. Adds people and clients, gives clients logins, creates projects, and **checks work before it goes to a client**. |
| Team member | Create, edit and hand off any task, submit work for a check, plan content, meetings and chat. A project's lead can also edit that project. |
| Client | Only their own projects: progress, a read-only plan of tasks, approving work and posts, the project discussion, and meetings. |

The rules live in one function, `can()` in `src/store.js`; Settings › Roles shows them as a table.

## What's in it

- **Home**: the admin sees what needs checking, tasks without an owner, overdue work, and who's got what. Team members see their own tasks and day. Clients see what's waiting for their approval, their projects, and what's coming up this week.
- **Tasks**: a board (drag to change status) or a list. Each task has an owner, due date, checklist and comments with @mentions. **Hand off** passes the task to a teammate with a note; it becomes theirs and starts again at To do.
- **Projects**: brief, people, the task board (the client sees it as a read-only **Plan**), **Approvals** (maker submits a link → admin checks it → client approves or asks for changes → new version, with full history), the client-visible **Discussion**, and meetings.
- **Calendar**: month, week and agenda views of meetings, client calls, shoots, deadlines and posts. It handles repeats (stand-up, weekly planning), Yes/No replies, clash warnings, video-call links, and "Add to Google Calendar" / `.ics` for each event.
- **Messages**: a studio channel, announcements (admin posts), one channel per project shared with the client, and direct messages.
- **Content plan**: every client's posts on a calendar or pipeline. Clients approve posts marked "Ready for approval".
- **Settings**: your profile, the team (admin adds and deactivates people), clients and their portal logins, and the roles table.

Not included on purpose: invoices (billing stays in your accounting software), time tracking, leave and reports. The full earlier version, with all of those, is commit `c9fa47a` on the `feature/yg-hub` branch.

## Going live (real logins)

Demo mode can't be shared between people's computers. To use it for real:

1. Create a Supabase project (free tier works for 5 people). Its Auth gives email invites and password resets.
2. Turn each array in `seed.js` into a table, and each branch of `can()` into a row-level-security policy. Clients only ever read rows for their own `clientId`.
3. Replace `read` / `persist` / `commit` in `store.js` with Supabase calls, and the `storage` event with Supabase Realtime for live chat and notifications. The screens don't change.
4. Back up weekly: an automatic export of all the data to Google Drive.
5. Email notifications for "waiting for your approval" and meeting invites, with the `.ics` attached so meetings land in Google Calendar on their own.
6. Deploy `dashboard/` as its own site, e.g. `team.ygdigitals.com` on Cloudflare Pages.
