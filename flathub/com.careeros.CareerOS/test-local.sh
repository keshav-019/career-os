#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MANIFEST="${SCRIPT_DIR}/com.careeros.CareerOS.yml"
GENERATED_SOURCES="${SCRIPT_DIR}/generated-sources.json"

missing=()
for command in flatpak flatpak-builder flatpak-node-generator; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    missing+=("${command}")
  fi
done

if ((${#missing[@]} > 0)); then
  printf 'Missing required command(s): %s\n' "${missing[*]}" >&2
  printf 'Install Flatpak tooling and flatpak-node-generator, then rerun this script.\n' >&2
  exit 1
fi

cd "${REPO_ROOT}"
flatpak-node-generator --no-requests-cache -o "${GENERATED_SOURCES}" npm package-lock.json

cd "${SCRIPT_DIR}"
flatpak-builder --force-clean --user --install build-dir "${MANIFEST}"

printf '\nBuild installed locally. Run it with:\n'
printf '  flatpak run com.careeros.CareerOS\n'
