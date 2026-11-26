# supabase

Postgres schema (`migrations/`) and dev seed data (`seed.sql`) for CrateDig. Requires Docker and the Supabase CLI.

```bash
supabase start      # from the repo root: starts the local stack and applies migrations and the seed
supabase db reset   # rebuilds the local DB from scratch
supabase migration new <slug>   # timestamped file in migrations/
```

- Tables follow PRD §3.2: `profiles`, `stores`, `master_records`, `sightings`, `crate_items`, `merchant_broadcasts`. Enum values are lowercase snake_case.
- RLS is on for every table; policies are in `20261127000000_rls_policies.sql` and tested by `supabase test db` (`tests/`).
- `on_auth_user_created` creates a `profiles` row (role `collector`, radius 10 mi) for each new auth user.
- `sightings.archive_date` defaults to `sighting_timestamp + 180 days`. The archive job is T-21.
- `zip_centroids` maps 5-digit ZIPs to lat/lng for the GPS-off fallback (2020 Census ZCTA internal points). Regenerate with `python3 supabase/scripts/build_zip_centroids.py > supabase/migrations/<ts>_zip_centroids.sql`. PO-box-only ZIPs have no centroid.
- `seed.sql` (local only) loads 12 fictional Portland, OR stores (2 pending), 15 master records, 26 sightings in USD and 6 broadcasts. No accounts are seeded.
