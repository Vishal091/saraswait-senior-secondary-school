# Saraswati School ERP — phased delivery plan

This project currently uses static HTML, CSS and vanilla JavaScript. The existing public website should remain lightweight; the ERP will live in a separate `/erp/` area and use a real authentication/database service. Do not store student records in HTML, JavaScript fixtures, GitHub, or browser local storage.

## Phase 1 — Identity and security foundation (this branch)

- Separate ERP entry point with email/password sign-in.
- Server-managed roles: administrator, teacher, parent, student; new accounts start as `pending`.
- Role is read from the database after sign-in. Users cannot choose their own role or self-register into a privileged role.
- Supabase Auth + PostgreSQL Row Level Security (RLS) foundation.
- Setup guide, initial profile schema and a role-aware foundation dashboard.
- No real student data or school credentials are included in this repository.

**Exit criteria:** a Supabase project is configured; four test accounts can sign in; disabled/pending users are rejected; role changes are restricted; access tests confirm users cannot read other profiles; and no service-role key is shipped to the browser.

## Phase 2 — School setup and records

- Academic sessions, classes, sections and subjects.
- Student admission records, roll numbers, guardian-to-student links.
- Teacher accounts, class-teacher assignments and subject assignments.
- CSV import with preview, validation, duplicate detection and a rollback path.
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

- Timetable, homework/assignments, approved learning resources and submission status.
- Notices/circulars targeted by audience or class, with attachments and expiry dates.
- Parent-teacher meeting calendar and leave/communication requests.
- Email/SMS/WhatsApp alerts only through an approved provider, with delivery logs and opt-out/consent handling.

## Phase 6 — Operations

- Fee plans, fee invoices, receipts, concessions and outstanding balances.
- Online payments only after gateway onboarding and reconciliation design.
- Transport routes and bus roster; library/lending; admission applications.
- Staff leave and payroll are optional and should follow a separate permissions review.

## Phase 7 — Reporting and mobile experience

- Attendance trends, class performance, fee collection and operational reports.
- Export permissions, audit events, database backups and restore drills.
- Installable Progressive Web App (PWA), performance/accessibility review and staff training.

## Baseline security rules

1. Keep the public site separate from private records and private file storage.
2. Use RLS for every table that contains personal or school data. Frontend checks alone are not authorization.
3. Never place a Supabase service-role/secret key in frontend files, Vercel public variables, or Git.
4. Disable public account registration in production; accounts and roles are provisioned by authorized school staff.
5. Use least-privilege roles, strong staff passwords and MFA for administrators where available.
6. Test with separate administrator, teacher, parent and student accounts before any real student information is imported.
7. Store only necessary child data, obtain school approval for contact/notification workflows, restrict exports and define a retention/deletion policy.
8. Back up the database and test restores before operational rollout.

## Phase 1 status

The portal and initial profile schema in this branch are a **foundation preview**. The portal remains intentionally disconnected until a school-owned Supabase project is configured and the setup/security checks are completed. Attendance, marks and datesheets are not implemented yet.