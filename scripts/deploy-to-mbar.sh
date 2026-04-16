#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$PROJECT_ROOT/dist}"
TARGET_HTDOCS="${MBAR_HTDOCS:-/Users/ivanvecchiato/work/node/mbar-server/htdocs}"

echo "[deploy] Dist dir: $DIST_DIR"
echo "[deploy] Target htdocs: $TARGET_HTDOCS"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "[deploy] ERRORE: cartella dist non trovata: $DIST_DIR" >&2
  exit 1
fi

if [[ ! -d "$TARGET_HTDOCS" ]]; then
  echo "[deploy] ERRORE: cartella target non trovata: $TARGET_HTDOCS" >&2
  exit 1
fi

if [[ ! -f "$DIST_DIR/index.html" || ! -d "$DIST_DIR/assets" ]]; then
  echo "[deploy] Dist incompleta, eseguo build..."
  (cd "$PROJECT_ROOT" && npm run build)
fi

if [[ ! -f "$DIST_DIR/index.html" || ! -d "$DIST_DIR/assets" ]]; then
  echo "[deploy] ERRORE: build non valida. Attesi index.html e assets in: $DIST_DIR" >&2
  exit 1
fi

# Aggiorna solo l'app root di pmsweb, preservando altre cartelle in htdocs (es. img, admin)
rm -rf "$TARGET_HTDOCS/assets"
mkdir -p "$TARGET_HTDOCS/assets"
cp -R "$DIST_DIR/assets/." "$TARGET_HTDOCS/assets/"

if [[ -f "$DIST_DIR/index.html" ]]; then
  cp "$DIST_DIR/index.html" "$TARGET_HTDOCS/index.html"
else
  echo "[deploy] ERRORE: index.html non trovato in dist" >&2
  exit 1
fi

if [[ -f "$DIST_DIR/favicon.ico" ]]; then
  cp "$DIST_DIR/favicon.ico" "$TARGET_HTDOCS/favicon.ico"
fi

# Copia eventuali altri file statici top-level prodotti dalla build (es. manifest)
while IFS= read -r -d '' file; do
  name="$(basename "$file")"
  case "$name" in
    index.html|favicon.ico)
      ;;
    *)
      cp "$file" "$TARGET_HTDOCS/$name"
      ;;
  esac
done < <(find "$DIST_DIR" -maxdepth 1 -type f -print0)

echo "[deploy] Deploy completato con successo."
