#!/bin/sh
set -e

# Create or update the superuser on every start.
# Safe to run repeatedly — upsert won't fail if the user already exists.
/pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"

exec /pb/pocketbase serve \
  --http=0.0.0.0:${PORT:-8090} \
  --dir=/pb/pb_data \
  --migrationsDir=/pb/pb_migrations
