#!/usr/bin/env bash
set -e

DIR="${CERT_DIR:-.certs}"
CN="${CN:-localhost.localdomain}"
DAYS="${DAYS:-825}"
CONF="ops/openssl/dev.cnf"

KEY="$DIR/key.pem"
CRT="$DIR/cert.pem"
CA="$DIR/rootCA.pem"

[ -f "$KEY" ] && [ -f "$CRT" ] && {
  echo "[ok] Certs already exist in $DIR (use FORCE=true to overwrite)";
  [ "${FORCE:-false}" != "true" ] && exit 0;
}

mkdir -p "$DIR"

OPENSSL_CONF="$CONF" CN="$CN" \
openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days "$DAYS" \
  -keyout "$KEY" -out "$CRT"

cp "$CRT" "$CA"

echo "[ok] Created:"
printf "  %s\n" "$CRT" "$KEY" "$CA"
