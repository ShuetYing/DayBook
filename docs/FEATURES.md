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

## Dashboard

Status: Implemented

### Requirement

Focus the user on the current week and support quick work capture.

### Expected behaviour

- Show the current date and current week range.
- Provide an entry point to the current week's Weekly Log.
- Show current-week counts for today tasks, knowledge notes, solved troubleshooting entries, open questions and expired tasks.
- Provide Quick Capture for short work notes, questions, errors or decisions.
- Allow quick captures to prefill a knowledge note, question, troubleshooting entry or weekly log item.
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
- Use tags for project organisation.
- Link tasks to projects as subtasks.
- Display project timeline text as simple staged rows.

---

## Knowledge Repository

Status: Implemented

### Requirement

Store reusable, long-term personal work knowledge.

### Expected behaviour

Notes should:
- Use one standardised template covering title, summary, context, details, example/command, related systems, tags and open questions.
- Not use categories.
- Use tags as the main organisation method.
- Allow custom tags.
- Be searchable by title, body and tags.

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
- Problems solved
- Impact / contribution
- Open questions
- Next week priorities

Each section can contain multiple entries as plain text.
Weekly logs are editable after creation.
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
- Users
- Inputs
- Outputs
- Workflow / data flow
- Repositories
- Databases
- Infrastructure
- Dependencies
- Common failures
- Debugging notes
- Related knowledge notes
- Related troubleshooting entries
- Tags

The workflow field is plain structured text.

---

## Troubleshooting

Status: Implemented

### Requirement

Document work problems and their solutions as a searchable personal knowledge base.

### Expected behaviour

Each troubleshooting entry contains:
- Title / problem
- Symptoms
- Error message or observed behaviour
- Initial hypothesis
- Investigation steps
- Root cause
- Solution
- Prevention / future improvement
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
- Knowledge notes
- Weekly logs
- Systems
- Troubleshooting entries
- Questions
- Quick captures

Search matches titles, body/content, tags and related system names, and labels each result by content type.

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
- Select the application theme.
- Clear all saved local data to start over.

Exported data should be saved locally and import should preserve existing application data where appropriate.
Auto backup should write the full local DayBook data object to the selected file after data changes while the app is open.

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
