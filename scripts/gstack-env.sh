#!/usr/bin/env bash
# Source this file from the same Bash process that will run GStack commands.
_poksin_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
export PATH="$_poksin_root/tooling/gstack/node_modules/.bin:$PATH"
export GSTACK_STATE_ROOT="$_poksin_root/.cache/gstack/state"
export GSTACK_HOME="$GSTACK_STATE_ROOT"
export PLAYWRIGHT_BROWSERS_PATH="$_poksin_root/.cache/gstack/browsers"
unset _poksin_root
