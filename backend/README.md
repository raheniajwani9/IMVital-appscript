# Backend

This project uses Supabase as its backend; it does not need a separate Node/Express server. The React app connects with the Supabase publishable key. Configure Supabase Auth and Row Level Security before treating client-side roles as authorization.

- `supabase/migrations/`: versioned SQL schema and policy changes.
- `supabase/functions/`: Supabase Edge Functions for trusted server-side work and secrets.
- Never place a service-role key in `frontend/.env` or browser code.

Run Supabase CLI commands from this folder after installing the Supabase CLI and linking the project.
