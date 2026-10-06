# IM Vitals

## Project layout

`frontend/` contains the React + Vite application. Its source is organized by feature under `frontend/src/features/`, with shared UI/configuration under `frontend/src/shared/` and app composition under `frontend/src/app/`.

`backend/` contains Supabase infrastructure: SQL migrations and Edge Functions. Supabase provides the database and API, so this project does not add a second custom web server.

## Run locally

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env`. Never expose a Supabase service-role key to the frontend.

## Frontend source conventions

- Put application startup, role workspaces, and composition in `frontend/src/app/`.
- Put feature-specific UI and logic in `frontend/src/features/<feature>/`, grouped into `components/`, `views/`, `utils/`, and `api/` as the feature grows.
- Put reusable UI, layout, configuration, and shared clients in `frontend/src/shared/`.
- Keep database schema changes in timestamped SQL migrations under `backend/supabase/migrations/`; use Edge Functions for trusted server-side operations.

## Supabase setup status

The frontend client is connected using the publishable key. The current name-and-email screen still identifies users through the `users` table; it is not yet Supabase Auth. The live project also does not currently expose the `audit_drafts` table, so remote draft saving needs a migration and an access policy before it can work across devices.
