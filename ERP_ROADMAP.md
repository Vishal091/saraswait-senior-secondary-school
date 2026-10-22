# Saraswati School ERP — phased delivery plan

The public website remains a static HTML/CSS/vanilla JavaScript site. The ERP has a separate `/erp/` area. The current branch contains a fictional browser-only demo for UX testing and a Supabase profile/auth foundation for a later live rollout.

## Phase 1 — Foundation and demonstration (current branch)

- Responsive ERP portal with separate workspaces for principal/admin, finance, teacher, parent and student roles.
- Eight public demo identities (one principal, one finance officer, one teacher, one parent/guardian and four students) with fictional seed records.
- Demo attendance, marks, datesheet, notices and fee invoice workflows.
- Demo edits and small uploads persist only in the current browser and can be reset.
- Supabase Auth + PostgreSQL profile/RLS foundation for live authentication.
- Setup guide and explicit production/security checklist.

**Important:** demo role simulation is not real authentication; it is intentionally unsafe for real records. Live authentication is only a foundation. No real ERP data modules are connected yet.

## Phase 2 — School setup and records

- Academic sessions, classes, sections and subjects.
- Student admission records, roll numbers, guardian-to-student links.
- Teacher accounts, class-teacher assignments and subject assignments.
- CSV import with preview, validation, duplicate detection and rollback.
- Admin change history for sensitive record updates.

## Phase 3 — Attendance

- Mobile-friendly daily/class attendance with Present, Absent, Late and Excused.
- Teacher access limited to assigned classes/sections.
- Prevent duplicate attendance for the same student/session; record who marked and when.
- Draft, submit and correction workflows with an audit trail and reason for edits.
- Parent/student views limited to linked students and published records.
- Optional absent alerts after the school approves a notification provider and consent process.

## Phase 4 — Exams, marks and datesheets

- Exam and subject setup, assessment dates/times and datesheet publishing.
- Marks entry by assigned subject teachers, draft/review/publish status and validation against maximum marks.
- Student/parent report cards, downloadable PDF and correction history.
- Do not expose unpublished marks to students or parents.

## Phase 5 — Learning and communication

- Timetable, homework/assignments, approved resources and submission status.
- Notices/circulars targeted by audience/class, attachments and expiry dates.
- Parent-teacher meeting calendar and leave/communication requests.
- Email/SMS/WhatsApp alerts only through an approved provider, with delivery logs and consent handling.

## Phase 6 — Operations

- Fee plans, fee invoices, receipts, concessions and outstanding balances.
- Online payments only after gateway onboarding and reconciliation design.
- Transport routes and bus roster; library/lending; admission applications.
- Staff leave and payroll are optional and should follow a separate permissions review.

## Phase 7 — Reporting and mobile experience

- Attendance trends, class performance, fee collection and operational reports.
- Export permissions, audit events, database backups and restore drills.
- Installable Progressive Web App (PWA), accessibility review and staff training.

## Baseline security rules

1. Keep the public site separate from private records and private file storage.
2. Use RLS for every table that contains personal or school data. Frontend checks alone are not authorization.
3. Never place a Supabase service-role/secret key in frontend files, Vercel public variables, or Git.
4. Disable public account registration in production; accounts and roles are provisioned by authorized school staff.
5. Use least-privilege roles, strong staff passwords and MFA for administrators where available.
6. Test with separate admin, finance, teacher, parent and student accounts before real data is imported.
7. Store only necessary child data, restrict exports and define a retention/deletion policy.
8. Back up the database and test restores before operational rollout.
