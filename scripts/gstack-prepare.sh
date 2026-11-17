#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
project=$(pwd -P)
source_dir="$project/.agents/skills/gstack"
tools="$project/tooling/gstack"
cache="$project/.cache/gstack"

for executable in git node npm; do
  if ! command -v "$executable" >/dev/null; then
    echo "Prérequis absent : $executable. Consultez docs/gstack.md." >&2
    exit 1
  fi
done

tag=$(node -p 'require("./tooling/gstack/source.json").tag')
commit=$(node -p 'require("./tooling/gstack/source.json").commit')
bun_version=$(node -p 'require("./tooling/gstack/package.json").dependencies.bun')
source scripts/gstack-env.sh

if [[ $# -eq 1 && $1 == --check ]]; then
  exec node scripts/gstack-status.cjs
fi
if [[ $# -ne 0 ]]; then
  echo 'Usage : bash scripts/gstack-prepare.sh [--check]' >&2
  exit 2
fi
if node scripts/gstack-status.cjs --quiet; then
  exec node scripts/gstack-status.cjs
fi

mkdir -p -- "$cache" "$(dirname -- "$source_dir")"
lock="$cache/preparing"
if ! mkdir -- "$lock" 2>/dev/null; then
  echo 'Une préparation GStack a déjà réservé ce clone. Consultez docs/gstack.md.' >&2
  exit 1
fi
trap 'rmdir -- "$lock"' EXIT

if [[ ! -d "$source_dir" ]]; then
  git -c advice.detachedHead=false clone --depth 1 --branch "$tag" \
    -- https://github.com/garrytan/gstack.git "$source_dir"
fi
if [[ ! -d "$source_dir/.git" ]] || [[ $(git -C "$source_dir" rev-parse HEAD) != "$commit" ]]; then
  echo "GStack doit correspondre à $tag ($commit) dans $source_dir." >&2
  echo 'Consultez la procédure de mise à jour dans docs/gstack.md.' >&2
  exit 1
fi

if [[ ! -f "$tools/node_modules/.bin/bun" ]] || [[ $(bun --version) != "$bun_version" ]]; then
  npm ci --prefix "$tools" --no-audit --no-fund
fi
if [[ $(bun --version) != "$bun_version" ]]; then
  echo "Bun $bun_version est requis par la version GStack épinglée." >&2
  exit 1
fi

# Codex reconnaît ce chemin de checkout et enregistre les skills dans le dépôt.
(cd -- "$source_dir" && ./setup --host codex --no-team --no-browser)
node scripts/gstack-status.cjs --record
node scripts/gstack-status.cjs
