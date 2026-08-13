#!/usr/bin/env bash
set -euo pipefail

MODEL="${OPENROUTER_MODEL:-openrouter/free}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

load_env_file() {
  local file_path="$1"
  [[ -f "${file_path}" ]] || return 0

  while IFS='=' read -r key value; do
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ -n "${key}" && "${key}" != \#* && "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ -z "${!key:-}" ]] || continue
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    value="${value%\"}"
    value="${value#\"}"
    export "${key}=${value}"
  done < "${file_path}"
}

load_env_file "${REPO_ROOT}/.env.local"
load_env_file "${REPO_ROOT}/.env"
MODEL="${OPENROUTER_MODEL:-${MODEL}}"

echo "CareerOS AI inference uses OpenRouter."
echo "OPENROUTER_MODEL=${MODEL}"

if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "OPENROUTER_API_KEY is not set. Add it to your local or production environment before using AI features."
  exit 0
fi

echo "OPENROUTER_API_KEY is configured."
