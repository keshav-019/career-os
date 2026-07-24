#!/usr/bin/env bash
# CareerOS Desktop - Flathub submission prep.
#
# Run this AFTER you've tested the app on all your target distros with linux-compat-check.sh and you're
# satisfied it's ready. This automates everything Flathub submission needs EXCEPT opening the pull request
# itself - Flathub's contribution policy says submission PRs must be opened by a maintainer, not a tool, so
# this script stops right before that step and prints exactly what to run/click next.
#
# Must run on a real Linux machine (not WSL-without-a-display, ideally) with flatpak-builder and the
# Flathub build/runtime dependencies installed - see docs/flathub-submission.md section 1 if you haven't
# set those up yet. Run from the repo root.
#
# Usage: ./apps/desktop/scripts/submit-flathub-pr.sh [tag]   (defaults to v1.0.0)

set -euo pipefail

TAG="${1:-v1.0.0}"
REPO_OWNER="keshav-019"
REPO_NAME="career-os"
APP_ID="com.careeros.CareerOS"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MANIFEST_DIR="$REPO_ROOT/flathub/$APP_ID"
WORKDIR="$(mktemp -d)"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[36m==>\033[0m \033[1m%s\033[0m\n' "$1"; }
die()  { printf '\033[31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) is required - install it and run 'gh auth login' first."
command -v flatpak >/dev/null 2>&1 || die "flatpak is required. See docs/flathub-submission.md section 1."
[ -d "$MANIFEST_DIR" ] || die "Manifest draft not found at $MANIFEST_DIR"

step "1/6 - Verifying the '$TAG' release archive exists"
ARCHIVE_URL="https://github.com/$REPO_OWNER/$REPO_NAME/archive/refs/tags/$TAG.tar.gz"
if ! curl -sfIL "$ARCHIVE_URL" >/dev/null; then
  die "Release archive not found at $ARCHIVE_URL - push the '$TAG' tag first (git tag $TAG && git push origin $TAG)."
fi
bold "Found: $ARCHIVE_URL"

step "2/6 - Downloading the release archive and computing its SHA-256"
curl -sL -o "$WORKDIR/source.tar.gz" "$ARCHIVE_URL"
ARCHIVE_SHA256="$(sha256sum "$WORKDIR/source.tar.gz" | awk '{print $1}')"
bold "SHA-256: $ARCHIVE_SHA256"

step "3/6 - Generating offline npm sources (flatpak-node-generator)"
if ! command -v flatpak-node-generator >/dev/null 2>&1; then
  echo "flatpak-node-generator not found - installing via pipx from flatpak-builder-tools..."
  command -v pipx >/dev/null 2>&1 || die "pipx is required to install flatpak-node-generator. See docs/flathub-submission.md."
  git clone --depth 1 https://github.com/flatpak/flatpak-builder-tools.git "$WORKDIR/flatpak-builder-tools"
  pipx install "$WORKDIR/flatpak-builder-tools/node/flatpak_node_generator"
fi
flatpak-node-generator --no-requests-cache -o "$MANIFEST_DIR/generated-sources.json" npm "$REPO_ROOT/package-lock.json"
bold "Wrote $MANIFEST_DIR/generated-sources.json"

step "4/6 - Rewriting the manifest source to point at the tagged archive (was a local 'type: dir' source)"
MANIFEST_YML="$MANIFEST_DIR/$APP_ID.yml"
cp "$MANIFEST_YML" "$WORKDIR/manifest-original-backup.yml"
python3 - "$MANIFEST_YML" "$ARCHIVE_URL" "$ARCHIVE_SHA256" <<'PYEOF'
import sys, re
manifest_path, url, sha256 = sys.argv[1], sys.argv[2], sys.argv[3]
with open(manifest_path, encoding="utf-8") as f:
    content = f.read()
# Replace a local "type: dir" main source with a tagged archive source. Left as a manual step if the
# manifest's source block doesn't match this exact shape - check the diff before proceeding.
replacement = f"  - type: archive\n    url: {url}\n    sha256: {sha256}\n    dest: main\n  - generated-sources.json\n"
new_content = re.sub(r"( *- type: dir\n(?: {4}.*\n)*)", replacement, content, count=1)
with open(manifest_path, "w", encoding="utf-8") as f:
    f.write(new_content)
print("Manifest source block replaced - REVIEW THE DIFF before continuing.")
PYEOF

step "5/6 - Build, lint, and smoke-test the manifest locally"
echo "Review the manifest diff now:"
diff -u "$WORKDIR/manifest-original-backup.yml" "$MANIFEST_YML" || true
read -r -p "Manifest looks correct? Continue with build+lint? [y/N] " CONFIRM
[ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ] || die "Stopped - fix the manifest manually and re-run."

(
  cd "$MANIFEST_DIR"
  flatpak run --command=flathub-build org.flatpak.Builder --install "$APP_ID.yml"
  flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest "$APP_ID.yml"
)
echo "Build and lint passed. Launch it yourself to smoke-test: flatpak run $APP_ID"
read -r -p "App launched and looks right? Continue to PR prep? [y/N] " CONFIRM2
[ "$CONFIRM2" = "y" ] || [ "$CONFIRM2" = "Y" ] || die "Stopped - re-run once you're satisfied."

step "6/6 - Forking flathub/flathub and preparing the submission branch"
FORK_DIR="$WORKDIR/flathub-fork"
gh repo fork flathub/flathub --clone="$FORK_DIR" --remote
(
  cd "$FORK_DIR"
  git checkout --track origin/new-pr 2>/dev/null || git checkout new-pr
  BRANCH="add-$(echo "$APP_ID" | tr '.' '-' | tr '[:upper:]' '[:lower:]')"
  git checkout -b "$BRANCH"
  mkdir -p "$APP_ID"
  cp -a "$MANIFEST_DIR/." "$APP_ID/"
  # The local build/test scaffolding isn't part of the submission.
  rm -f "$APP_ID/test-local.sh" "$APP_ID/README.md"
  git add "$APP_ID"
  git commit -m "Add $APP_ID"
  git push -u origin "$BRANCH"
  echo "$BRANCH" > "$WORKDIR/branch-name.txt"
)

BRANCH_NAME="$(cat "$WORKDIR/branch-name.txt")"
GH_USER="$(gh api user -q .login)"

echo
bold "=========================================================================="
bold " Everything is prepared. Flathub's policy requires a human to open the PR."
bold "=========================================================================="
echo
echo "1. Open this URL and review the diff one more time:"
echo "   https://github.com/$GH_USER/flathub/compare/flathub:new-pr...$GH_USER:$BRANCH_NAME?expand=1"
echo
echo "2. Fill in the PR template honestly (it asks whether you tested the manifest - you did, with"
echo "   linux-compat-check.sh and this script's local build)."
echo "3. Target branch must be 'new-pr', not 'master'."
echo "4. After a reviewer comments, reply 'bot, build' to request a Flathub test build."
echo
echo "Working files (archive, manifest backup, fork clone) are in: $WORKDIR"
echo "(not auto-deleted - remove it yourself once the PR is merged or you're done referencing it)"
