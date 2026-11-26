# supabase

Postgres schema (`migrations/`) and dev seed data (`seed.sql`) for CrateDig. Requires Docker and the Supabase CLI.

```bash
supabase start      # from the repo root: starts the local stack and applies migrations and the seed
supabase db reset   # rebuilds the local DB from scratch
supabase migration new <slug>   # timestamped file in migrations/
```

- Tables follow PRD §3.2: `profiles`, `stores`, `master_records`, `sightings`, `crate_items`, `merchant_broadcasts`. Enum values are lowercase snake_case.
- RLS is on for every table. Policies come with T-10; until then only the service role can read or write.
- `on_auth_user_created` creates a `profiles` row (role `collector`, radius 10 mi) for each new auth user.
- `sightings.archive_date` defaults to `sighting_timestamp + 180 days`. The archive job is T-21.
