# YG Hub — next round (capability map)

Requested 2026-10-04. Each module ships and is tested on its own, in the build order below.
Every rule is enforced on the server (Supabase RLS + the action functions), the same way the hub works today.

| Module id | What it does | Depends on |
|---|---|---|
| delete-client | Admin can delete a client (see decision D4) | — |
| departments | Each person and each task/project/post gets a department (Video, Design, Social, Website, Packaging, Office). People see their own department's work plus anything handed to them; admins see everything (decision D1) | — |
| overdue | Overdue work has to be resolved, not ignored (proposal below) | departments |
| urgent-home | Home opens on one list, most urgent first: overdue → due today → waiting on you → due this week. Everything else comes below it, filtered to your department | departments, overdue |
| leave | Apply for leave; the admin approves. Work due on leave days must be finished early or handed off before approval. Approved leave shows on the calendar, and nobody gets an overdue mark for those days | overdue |
| email | Real email: a welcome mail with the login link when someone is added (decision D3) | — |
| reminders | Daily morning email per person: overdue, due today, waiting for your check. Overdue escalates to the admins after 2 days | email, overdue, leave |
| recurring | Ongoing / retainer projects with no end date, plus repeating tasks (weekly or monthly): finishing one creates the next | departments |
| excel-import | Upload the content-calendar .xlsx and it becomes posts on the Content page, with a preview before saving | departments |
| marks | One clear mark on every piece of work (task, post, deliverable): Due, Overdue, Done or Delivered, Undelivered. Marking a client post or deliverable Undelivered opens a compensation owed to that client | overdue |
| compensation | Per-client list of what we owe for work promised and not delivered, e.g. "1 extra reel for the missed 12 Oct reel". Each has what we'll give, by when, and an owner, tracked until it's given. Admins and the owner see it, and the client sees it once the admin shares it | marks |

Build order: delete-client → departments → overdue → urgent-home → leave → email → reminders → recurring → excel-import → marks → compensation

## Overdue resolution (proposal)
1. When a due date passes, the task turns red and goes to the top of the owner's Home with three buttons:
   - **Done**
   - **Need more time**: pick a new date and give a reason; it goes to the admin to approve
   - **Hand off**: pass it to someone else with a note
2. The owner gets an email that morning. If it's still unresolved 2 days later, the admins get an email too.
3. Every overdue item is recorded against the person: how many days late, and whether the extension was approved. That record feeds `marks`.
4. Days on approved leave never count as late.

## Decisions (user, 2026-10-04)
- D1 Visibility: **hard block**, enforced on the server.
  - Admins, and anyone in the "All" department (Yukti, PA), see everything.
  - A member sees their department's work, plus anything they're assigned, created, lead or are on.
  - Social sees every content post, because they caption and publish all of them.
  - Freelancers keep today's rule.
  - The activity log becomes admin-only.
  - Members see only the meetings they're invited to.
- D2 Marks = the delivery status of every piece of work. Compensation = what we owe clients for undelivered posts, reels and other work. It is not a staff score or pay.
- D3 Email from **hub@ygdigitals.com** via Resend. This needs DNS records added in Cloudflare.
- D4 Delete client = **delete everything**: projects, tasks, posts, deliverables, project chats and client logins. You confirm by typing the client's name.

## Boundaries
- Always: server-side checks for every rule, tests for store logic, and a browser check at real size before saying done.
- Ask first: new dependencies (SheetJS for .xlsx), DNS changes in Cloudflare, anything that emails real people.
- Never: commit secrets, email clients without the admin turning it on, or delete data without a confirmation step.

## Success criteria
- Each module: `npm test` passes, the server access checks pass, and it is verified in the browser as admin, member and freelancer.
- A member in Video sees only Video work plus their own tasks (if D1 = hard).
- An overdue task can't sit unresolved for more than 2 days without the admins being emailed.

## Changes asked for on 2026-10-05
- **Ask for more time: removed.** A task's date is still set only by a supervisor, the project lead or whoever gave the task. The person doing it sees "Need more time? Tell <name>." Overdue escalation to supervisors after 2 days stays.
- **Owner: a new level above Supervisor** (`people.owner`, a supervisor with a flag, so every supervisor rule covers owners). Their Home shows only:
  1. Late: every late task, post and compensation, with who has it.
  2. Today, done or not.
  3. Coming up this week.
  Their morning email skips approvals and leave. "Admin" is now called "Supervisor" everywhere.
- **Plain language for the team and freelancers:**
  - Their Home is one list of their work, most urgent first, plus today's meetings and announcements.
  - Wording: "Given to" (was Owner), "Hand over" (was Hand off), "Ready to check" (was Review), "Compensation" (was Make-up).
- **Bell** closes on a tap anywhere else (pointer events, so phones count too).
- **excel-import: done** (src/xlsx.js, no new dependency: the browser unzips the .xlsx).
  - Content plan › Import from Excel shows a preview, then adds the posts.
  - Columns are found by header: Date, plus Topic and/or Content Type; Festival, Script / Reference, Platform and Status are optional.
  - Posts already in the plan (same client, day and title) are skipped.
  - Script / reference / festival go into a new post field, `brief` ("What to make").

## Phone first (2026-10-05)
- **Deleting didn't work on phones.** Every 'are you sure?' was the browser's own confirm(), which browsers inside apps (WhatsApp, Instagram) silently answer 'no'. All 9 are now an in-app popup (`Confirm` in ui.jsx).
- **Bottom bar on phones** (under 900px): the first four of Home, Tasks, Messages, Calendar, Projects someone can open, plus More for the full menu.
- **Phones (under 720px) get lists, not boards or month grids:**
  - Tasks and a project's Tasks tab are one list, most urgent first, with filters folded behind a Filter button.
  - Content plan › Calendar is a day-by-day list.
  - A task opens with status, who and the due date first, then details and comments.
- **Touch:** buttons are at least 36px; text boxes are 16px so iPhones don't zoom; chat messages show edit / delete on a tap; Enter in chat adds a new line, and the button sends.

## Content plan and tasks in step (2026-10-05, migration 16)
- **Import makes the project first.** Step 2 of Import from Excel:
  - Pick a new project (supervisors only; name and dates come from the sheet) or one the client already has.
  - Pick the departments working on it; their people join its team.
  - Pick who makes the Reels and Shorts (Video) and who makes the rest (Design).
  - Afterwards it opens the project's Tasks tab.
- **One task per post** in its project, due the day before the post goes out:
  - Made once the post is a week away (on saving, or by the 9 am job).
  - A task someone deletes stays deleted (`posts.task_made`).
  - Plan a post has a Project field too.
- **Sync** (database triggers; the store copies them so the screen updates instantly):
  - task started → post In production; task done → post Made, to send (since migration 17, below)
  - post posted or undelivered → task done; client asks for changes → task back to To do
  - the post's day, title and maker carry over to the task
- **Anyone who can see a task can still change its status** (the user's call). Every task now shows who changed its status last and when (`tasks.status_by`, `status_at`).
- A task links to its post (`#/content/post/<id>`); a post shows its project and task.

## Made, then sent (2026-10-05, migration 17)
The user: a maker's Done isn't done for the studio — "it comes to me, I send it to the client", and both steps by email too.
- **New post stage, "Made, to send"** (`made`). A post's task marked Done moves the post there, not to the client.
  - The project's lead and the supervisors (not the owners) are told in the app and by email, with a link to the post.
  - Whoever gave the task no longer gets a separate "finished" note for a post's task.
  - Their Home lists it under Waiting on you: "Check and send …".
  - The client still sees it as "In production".
- **Check and send** (on the post; the project's lead or a supervisor — `content.send`, `private.sends_post`):
  - Send to client: the post becomes Ready for approval, and its Feedback records "Sent to the client".
    - "Email it to …" is ticked by default. It goes to the client's YG Hub logins.
    - With no login, it goes to the contact email on the client, and they reply by email.
    - Replies go to whoever sent it.
  - Send back for changes (a note is needed): the post goes back to In production and its task back to the maker's To do.
  - Only the lead or a supervisor can move a post to Ready for approval, by any route.
- **Link to the work** (`posts.link`, http(s) only): the maker sets it on their task, or anyone on the post form or the send box. It goes in both emails. The client sees it once the post is sent.
- **Reopening** a Done task while its post is Made or Ready for approval puts the post back In production.
- **A project's lead sees its posts** whatever their department (`sees_post` and the posts read rule).
- **Email:** `private.mail` queues in `private.outbox` (only once `mail_url` is set, so nothing piles up) and wakes `daily-mail` with `{outbox: true}`. The function takes the queue with `claim_outbox()` (service role only; each email is taken once) and sends through Resend. Without RESEND_API_KEY the queue is emptied and nothing is sent.
- Not done (the user didn't ask): an email when the client approves or asks for changes. That still goes in the app only.

## Video & Design make it, Social media uploads it (2026-10-08, migration 18)
The user: when a Video or Design task is done it should land straight in Social media's tasks as "upload the post"; finished tasks should leave the Tasks page after a day; Social media doesn't need Ready to check.
- **Upload task** (`private.upload_task`, `tasks.upload_of`): any Video or Design task marked Done makes one at once, whether or not it's for a post.
  - "Upload: <title>", in the same project, Social media, given to no one: the whole Social team sees it and is told ("finished … — upload it").
  - Due the day its post goes out; a task with no post: today.
  - Made by the trigger and by the store with the same id (`up-<task id>`), like a post's task.
  - Reopened before it's uploaded (sent back for changes, handed over, moved back), the upload task goes. Done again, it's made again. An upload already done stays.
  - Deleting the Video or Design task (or its post) takes its upload task too.
  - The client's approval doesn't hold it up (the user's call): Social can upload as soon as the maker is done.
- **Uploaded:** finishing the upload task marks its post Posted. A post marked Posted or Undelivered closes its upload task.
- **No Ready to check in Social media:** the database refuses it (`tasks_social_no_check`). The status menu leaves it out for Social tasks, and the board drops the column when every task on it is Social media.
- **Finished tasks leave the Tasks page after a day** (board, list, phone list and a project's Tasks tab), counted from when they were marked Done (`status_at`). It was 14 days. Nothing is deleted: project progress, marks and links to the task still work.

## Delete a project (2026-10-08, migration 19)
- **Who:** supervisors only (`project.delete`, `public.delete_project`). It's on the project page, next to Edit.
- **Confirming:** type the project's name, like deleting a client. The popup says how many tasks and pieces of work go, and how many posts stay.
- **What goes:** its tasks (with their upload tasks), its work for approval, and its discussion with the client.
- **What stays:** its posts stay in the client's content plan with no project. `task_made` is reset, so a post put into another project gets a fresh task there. Meetings stay on the calendar, unlinked.
