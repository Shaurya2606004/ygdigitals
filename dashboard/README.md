# YG Hub — the studio dashboard for YG Digitals

One place where every team at YG Digitals (Social Media, Production, Video Editing, Design, Web, E-commerce, Management) works together, and where clients log in to follow their projects and approve work. Same brand as ygdigitals.com.

```bash
cd dashboard
npm install
npm run dev      # http://localhost:5173 (or the next free port)
npm test         # the rules: permissions, approvals, handoffs, calendar clashes, invoice maths
npm run build    # static site in dashboard/dist
```

## Demo mode (right now)

Everything lives in the browser (localStorage), pre-filled with a made-up studio: 17 staff, 5 clients, 7 projects, tasks, meetings, chat, invoices. **All people, clients, numbers and links are samples**. Replace them inside the app, or use Settings › Reset demo data.

- Sign in with any sample email (e.g. `neha@ygdigitals.com`) and the password `yghub`, or click a person on the sign-in screen.
- Each browser tab has its own sign-in, and tabs sync live. Open one tab as a team member and another as a client to watch approvals, chat and notifications move between them.
- Admins can export a JSON backup from Settings.

## Roles

| Role | Who | Can |
|---|---|---|
| Admin | Founder | Everything, including making admins, editing teams and the company details printed on invoices |
| Manager | Operations / client servicing | Clients, projects, every team's tasks, invoices, people (but not admins), announcements |
| Team lead | One per team | Assign and edit their team's tasks, sign off work and send it to the client, approve their team's leave, see reports |
| Member | Everyone else | Their own tasks, picking up tasks from their team's queue, handing work to another team, logging time, submitting work, leave requests |
| Client | A brand's login | Only their own projects: progress, approving or rejecting work and posts, chatting with their team, booking meetings, viewing invoices |

The full matrix is under Settings › Roles & permissions. The rules live in one function, `can()` in `src/store.js`.

## What's in it

- **Home**: different for each role. Leadership gets studio KPIs, a "needs your attention" list (sign-offs, leave, unassigned work, overdue tasks) and team workload. Members get their tasks and day. Clients get their approvals, projects, meetings and amount due.
- **Tasks**: Kanban board (drag to change status) or a list, filtered by person, team, project or priority. Each task has a checklist, comments with @mentions, time logs and **Hand off**, which passes the task to another team's queue with a note. That team's lead is notified and assigns it.
- **Projects**: brief, progress by team, people, a task board, **Deliverables** (maker submits a link → lead signs it off → client approves or asks for changes → new version, with full history), a client-visible **Discussion** channel, and meetings.
- **Calendar**: month, week and agenda views. Shows meetings, client calls, shoots, reviews, task and project deadlines, leave and content posts, filtered to mine, my team or everyone. Supports repeating events (daily stand-up, weekly leads sync), RSVPs, warnings when someone is double-booked or on leave, video-call links, and export to Google Calendar or `.ics`.
- **Messages**: company, announcements (leadership only), one channel per team, one per project (the client can see these; it's marked), and direct messages. Includes unread counts, @mention suggestions and notifications.
- **Content plan**: every client's posts, Reels and ads on a calendar or pipeline (Idea → In production → Ready for approval → Scheduled → Posted). Clients approve posts here.
- **People & teams**: directory with live status (available, in a meeting, on leave, working from home), profiles, org structure, leave requests and approvals.
- **Clients**: accounts, services, retainer or project fee, account manager, portal logins, projects and invoices.
- **Invoices**: GST invoices with Indian FY numbering (`YG/26-27/044`), CGST/SGST split, amount in words, print/PDF, draft → sent → paid, and overdue tracking. Clients see their own.
- **Reports**: weekly timesheet (with CSV export), load against capacity, on-time delivery, first-time approval rate, hours per client.
- Also: search (Ctrl K), notifications, light/dark theme, and layouts that work on phones.

## Going live (real logins)

Demo mode can't be shared between people's computers. To use it for real:

1. Create a Supabase project (free tier works). Its Auth gives email invites and password resets.
2. Turn each array in `seed.js` into a table, and each branch of `can()` into a row-level-security policy. Clients only ever read rows for their own `client_id`.
3. Replace `read` / `persist` / `commit` in `store.js` with Supabase calls, and the `storage` event with Supabase Realtime for live chat and notifications. The screens don't change.
4. Use Supabase Storage if files should be uploaded instead of linked.
5. Deploy `dashboard/` as its own Vercel project (root directory `dashboard`), e.g. at `team.ygdigitals.com`.
