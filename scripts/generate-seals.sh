#!/usr/bin/env bash
# Regenerate seals.json from the contents of seal-image/.
# Run from the repo root, or via the npm-style alias below:
#   bash scripts/generate-seals.sh
#
# Output: ./seals.json (a JSON array of filenames, sorted)

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d seal-image ]; then
  echo "error: seal-image/ not found" >&2
  exit 1
fi

# List *.jpg / *.jpeg / *.png (case-insensitive), sorted, one per line.
# Then turn each line into a JSON string and wrap in an array.
{
  printf '['
  first=1
  while IFS= read -r -d '' f; do
    name="$(basename "$f")"
    # JSON-escape: backslash, double-quote, control chars
    esc=$(printf '%s' "$name" | python3 -c 'import json,sys; sys.stdout.write(json.dumps(sys.stdin.read(), ensure_ascii=False))')
    if [ $first -eq 1 ]; then
      printf '\n  %s' "$esc"
      first=0
    else
      printf ',\n  %s' "$esc"
    fi
  done < <(find seal-image -maxdepth 1 -type f \
            \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) \
            -print0 | LC_ALL=C sort -z)
  printf '\n]\n'
} > seals.json

count=$(grep -c '^  "' seals.json || true)
echo "wrote seals.json ($count entries)"
