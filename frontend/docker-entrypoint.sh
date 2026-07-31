#!/bin/sh
set -eu

case "${BACKEND_URL:-}" in
  http://*|https://*) ;;
  *)
    echo "BACKEND_URL must be an absolute http:// or https:// URL." >&2
    exit 1
    ;;
esac

BACKEND_URL=${BACKEND_URL%/}
export BACKEND_URL

envsubst '${BACKEND_URL}' \
  < /etc/nginx/templates/default.conf.template \
  > /tmp/frontend-default.conf

exec nginx -g 'daemon off;'
