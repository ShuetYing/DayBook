# Daybook Features

This document is the source of truth for the current product functionality.

## Status

- [x] Implemented
- [ ] Planned
- [~] In progress
- [-] Rejected / removed

---

## Sidebar

Status: Implemented

### Requirement

Provide navigation to all main application features.

### Expected behaviour

Clicking a feature navigates to its dedicated page.

---

## Undo

Status: Implemented

### Requirement

Allow users to recover from accidental changes.

### Expected behaviour

The app offers one-step undo after data-changing actions such as creating, editing, importing, clearing or deleting records.

---

## Dashboard

Status: Implemented

### Requirement

Focus the user on the current week and support quick work capture.

### Expected behaviour

- Show the current date and current week range.
- Provide an entry point to the current week's Weekly Log.
- Show current-week counts for today tasks, knowledge notes, solved troubleshooting entries, open questions and expired tasks.
- Provide Quick Capture for short work notes, questions, errors or decisions.
- Allow quick captures to prefill a knowledge note, question or troubleshooting entry.
- Show task overview and latest activity.

---

## Tasks

Status: Implemented

### Requirement

Allow users to manage personal tasks and deadlines.

### Expected behaviour

Users can:
- Create, edit and delete tasks.
- Mark tasks as complete.
- Set deadlines and reminders.
- Assign tasks to a project.
- Add tags.

Task actions should update the Dashboard's latest activity.

---

## Project Management

Status: Implemented

### Requirement

Allow users to manage projects, including project details, sub-tasks and planned timelines.

### Expected behaviour

- Use the same create-button and creation interaction pattern as the Tasks page.
- Link tasks to projects as subtasks.
- Let users enter project stages with separate stage, date and detail fields.
- Display project stages as simple staged rows.

---

## Scratchpad

Status: Implemented

### Requirement

Record random reminders, thoughts, mood notes, feelings, or loose ideas that do not belong in Tasks.

### Expected behaviour

Scratchpad items support:
- One free-text entry
- Done state

Scratchpad items are separate from deadline-driven tasks.
Users can mark scratchpad items done and delete them.

---

## Glossary

Status: Implemented

### Requirement

Help a new manufacturing data scientist build domain vocabulary.

### Expected behaviour

Each glossary term contains:
- Term
- Meaning
- Details

Saved glossary terms should be sorted and grouped alphabetically.
Saved glossary terms should collapse by default and show one compact `Term : Meaning` row.
Saved glossary terms should show edit and delete icon actions only from the expanded row.

---

## Knowledge Repository

Status: Implemented

### Requirement

Store reusable, long-term personal work knowledge.

### Expected behaviour

Notes should:
- Use one standardised template covering title, tags, summary, context, details and example/command.
- Not use categories.
- Use tags as the main organisation method.
- Allow custom tags.
- Be searchable by title, body and tags.
- Collapse saved note bodies by default and show only the title first.
- Show the add-note form on the left and saved-note search/title list on the right.
- Open a selected saved note in a full-page reader with tags and edit/delete icon actions.

Recommended default tags:
- pipeline
- debugging
- sql
- python
- database
- cloud
- manufacturing
- process
- system
- troubleshooting

---

## Weekly Logs

Status: Implemented

### Requirement

Track progress, contribution and evidence of increasing independence over time.

### Expected behaviour

Each weekly log contains:
- Week start date
- Learned
- Worked on
- Problems / blockers
- Problems solved / contribution
- Next week priorities

Each section can contain multiple entries as plain text.
Weekly logs are editable after creation.
Saved weekly logs display as a Monday-to-Friday work-week range, such as `Week of 2026-08-31 to 2026-09-04`.
Saved weekly logs can be filtered by month or by a specific week.
The Generate Weekly Review Draft action uses local records created or updated during the selected week and remains editable before saving.
If DayBook is open on Friday at or after 3pm and no log exists for that week, show a local reminder once for that week.

---

## Systems

Status: Implemented

### Requirement

Document important systems, pipelines, workflows, databases and internal tools.

### Expected behaviour

Each system entry supports:
- Name
- Purpose
- Owner / team
- Data / workflow
- Common failures

The data / workflow field is plain structured text.

---

## Troubleshooting

Status: Implemented

### Requirement

Document work problems and their solutions as a searchable personal knowledge base.

### Expected behaviour

Each troubleshooting entry contains:
- Title / problem
- What happened
- Root cause
- Fix / lesson learned
- Related system
- Tags
- Date resolved

---

## Questions

Status: Implemented

### Requirement

Provide a lightweight inbox for unresolved work questions.

### Expected behaviour

Each question contains:
- Question
- Status
- Related system
- Notes / answer
- Date created

Saved questions should collapse by default and show the question plus answer preview.
Saved questions should show edit and delete icon actions only from the expanded row.

Supported statuses:
- Open
- Investigating
- Need to ask
- Answered

---

## Global Search

Status: Implemented

### Requirement

Search across personal work knowledge and progress records.

### Expected behaviour

Search covers:
- Tasks
- Knowledge notes
- Glossary terms
- Scratchpad items
- Weekly logs
- Systems
- Troubleshooting entries
- Questions
- Quick captures

Search matches titles, body/content, related system names and tags where that content type supports tags, and labels each result by content type.

---

## Settings

Status: Implemented

### Requirement

Allow users to manage application data and customise the UI/UX.

### Expected behaviour

Users can:
- Export application data as JSON.
- Select a JSON file for automatic local backup.
- Import JSON data from another device.
- Select the application theme and display density.
- Clear all saved local data to start over.

Exported data should be saved locally and import should preserve existing application data where appropriate.
Auto backup should write the full local DayBook data object to the selected file after data changes and every weekday at 12:00 while the app is open.

---

## Data Privacy

Status: Implemented

### Requirement

Keep the app fully usable locally.

### Expected behaviour

- Do not use external AI APIs.
- Do not use external cloud storage.
- Do not add telemetry.
- Do not automatically upload note content.
- Keep all current knowledge and work data local.
- Auto backup writes only to a user-selected local file; cloud sync happens only if the user places that file in a synced Drive folder.
