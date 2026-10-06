# Role workspaces

Each role directory owns its workspace shell and role-specific screens. Keep cross-role domain components and business logic under `features/`; keep reusable UI and clients under `shared/`. This avoids duplicating shared audit/form logic across roles while keeping role navigation isolated.
