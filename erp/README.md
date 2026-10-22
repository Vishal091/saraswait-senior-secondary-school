# ERP foundation setup

The ERP is a separate area from the public school website. The current feature branch includes a browser-only fictional demo to test the intended workflows before connecting a real database.

## Try the interactive demo

Open `/erp/` on the Vercel preview or run the site locally. When no Supabase project is configured, the portal opens in demo mode and lists these test accounts:

| Role | Demo email |
|---|---|
| Principal (full demo access) | `principal@demo.saraswati.test` |
| Finance department | `finance@demo.saraswati.test` |
| Teacher | `teacher@demo.saraswati.test` |
| Parent / guardian (linked to two demo children) | `parent@demo.saraswati.test` |
| Student — Aarav Sharma | `aarav@demo.saraswati.test` |
| Student — Ananya Verma | `ananya@demo.saraswati.test` |
| Student — Vivaan Singh | `vivaan@demo.saraswati.test` |
| Student — Meera Gupta | `meera@demo.saraswati.test` |

Shared demo password: `Demo@12345`.

Demo functions include viewing sample students, attendance, published marks, a sample datesheet, fee invoices and notices; the principal/teacher can try attendance and marks workflows, finance/principal can create fictional fee invoices and mark them paid, the principal can publish notices, and the teacher/principal can upload small demo files (maximum 400 KB). The principal can reset the browser's demo dataset.

**Demo limitations:** the accounts and role changes are simulated in browser code, not authenticated accounts. All records and uploaded demo attachments are stored only in the current browser's local storage. The demo is not secure enough for real information; don't enter real student data, use real credentials, or attempt real payments. Uploaded files are not sent to any server.

## Configure a live development project

1. Create a Supabase project controlled by the school. Review data-region, access, backup and retention settings.
2. In the Supabase SQL Editor, run `supabase/001_auth_profiles.sql` from the repository root.
3. Enable email/password sign-in and disable public sign-ups for production.
4. Create the first staff account in the Supabase dashboard. Copy its Auth user UUID, then promote only that verified account in the SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin', is_active = true
   where id = 'REPLACE-WITH-THE-AUTH-USER-UUID';
   ```

5. Edit `erp/config.js` with the project's **Project URL** and **publishable/anon key**. These frontend values are visible by design; the database must enforce row-level security.
6. Open `/erp/` for live authentication. Append `?demo=1` only when you explicitly want the fictional demo sandbox.

Never put a Supabase `service_role` key or any secret API key in frontend files, Vercel public variables, or Git.

## Live feature status

Live sign-in can read the approved profile role, but attendance, marks, datesheets, notices, student records and finance workflows are **not yet connected to live tables**. The demo experience proves the intended user flows only. Before real student information is imported, implement and test table-specific RLS for each module with separate administrator, finance, teacher, parent and student accounts, plus audit trails, backups and restore testing. Do not use production student data until those checks pass.
