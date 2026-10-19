#!/bin/sh
#
# API container entrypoint.
#
# Set RUN_MIGRATIONS=true to apply committed Prisma migrations before the
# server starts. This is convenient for a single self-hosted instance; for
# multiple replicas run `npm run db:deploy --workspace=@crochet-peakz/api`
# as a separate release job instead so replicas do not race.

set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] Applying database migrations"
  /app/node_modules/.bin/prisma migrate deploy \
    --schema /app/apps/api/prisma/schema.prisma
fi

exec "$@"
