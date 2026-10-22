# ERP foundation setup

The ERP prototype is separate from the public-facing school pages. It is built to work with the current static-site setup, using Supabase Auth and PostgreSQL rather than pretending that browser-only forms are a secure database.

## Configure a development project

1. Create a Supabase project controlled by the school. Choose a region suitable for the school and review the project's backup and access settings.
2. In the Supabase SQL Editor, run `supabase/001_auth_profiles.sql` from the repository root.
3. In Supabase Auth, enable email/password sign-in and turn off public sign-ups for the production project.
4. Create the first staff account in the Supabase dashboard. Copy its Auth user UUID, then use the SQL Editor to promote only that account to administrator:

   ```sql
   update public.profiles
   set role = 'admin', is_active = true
   where id = 'REPLACE-WITH-THE-AUTH-USER-UUID';
   ```

   Verify the UUID before running this query. Do not make an administrator account using a public sign-up form.
5. Edit `erp/config.js` with the project's **Project URL** and **publishable/anon key** from Supabase project settings. Those frontend values are not secret, but the database must remain protected by RLS.
6. Deploy a preview from this feature branch and test with non-production accounts before linking the portal from the public homepage.

## Important key distinction

Only the public/publishable anon key belongs in `erp/config.js`. Never copy the Supabase `service_role` key or any secret API key into this repository or frontend code. RLS must protect data even if the public key is visible.

## Accounts and roles

New profile rows receive the `pending` role. An administrator must explicitly provision the role after verifying a staff/family account. Phase 1 uses the Supabase dashboard for initial account provisioning; the in-product user-management workflow belongs in a later phase.

Roles:
- `admin`: school-approved configuration and user administration.
- `teacher`: future assigned-class workflows.
- `parent`: future records for linked child/children only.
- `student`: future own-record access only.
- `pending`: no ERP access.

## What works in Phase 1

Once configured, users can sign in, their role is resolved from the database, inactive or pending accounts are rejected, and the portal shows the appropriate foundation dashboard. No attendance, marks, datesheet, fee, upload, or notification action is represented as operational yet.

## Before real student data is added

- Add and verify table-specific RLS policies for each module.
- Create separate test accounts for every role and try unauthorized cross-user reads/writes.
- Add audit events and backups for any operational record.
- Review school approval, child-data minimization, privacy notice, access/offboarding, breach handling, and retention requirements.
- Never test using real student records until those checks have passed.