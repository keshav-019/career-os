#!/usr/bin/env bash
# CareerOS Desktop - Linux compatibility / health check.
#
# Run this BEFORE installing to confirm a distro can run the Electron build, and again AFTER installing
# (pass the installed binary's path, or let it auto-detect) to confirm the install itself is sound - a
# missing shared library or a misconfigured chrome-sandbox binary are the two most common ways an
# Electron app silently fails to launch on Linux, and neither produces an obviously diagnosable error
# from the desktop menu.
#
# Usage:
#   ./linux-compat-check.sh                  # pre-install system check + recommend a package format
#   ./linux-compat-check.sh --binary <path>  # also verify a specific installed CareerOS binary
#   ./linux-compat-check.sh --appimage <path># also verify a downloaded .AppImage file specifically
#
# Exit codes: 0 = all checks passed (warnings are still printed but don't fail the run), 1 = one or more
# hard failures. Intended to be run by hand and read, not just checked for exit code - each check prints
# why it matters, not just pass/fail.

set -u

PASS=0
WARN=0
FAIL=0
BINARY_PATH=""
APPIMAGE_PATH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --binary) BINARY_PATH="${2:-}"; shift 2 ;;
    --appimage) APPIMAGE_PATH="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m[ OK ]\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
warn() { printf '  \033[33m[WARN]\033[0m %s\n' "$1"; WARN=$((WARN+1)); }
fail() { printf '  \033[31m[FAIL]\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
info() { printf '  \033[36m[INFO]\033[0m %s\n' "$1"; }

echo
bold "CareerOS Desktop - Linux compatibility check"
echo "Run at: $(date)"
echo

# ---------------------------------------------------------------------------
bold "1. Distro identification"
DISTRO_ID="unknown"
DISTRO_LIKE=""
DISTRO_NAME="unknown"
if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO_ID="${ID:-unknown}"
  DISTRO_LIKE="${ID_LIKE:-}"
  DISTRO_NAME="${PRETTY_NAME:-$DISTRO_ID}"
  ok "Detected: $DISTRO_NAME (id=$DISTRO_ID${DISTRO_LIKE:+, like=$DISTRO_LIKE})"
else
  fail "/etc/os-release not found - cannot identify distro. This script targets Garuda, AlmaLinux, Fedora, Ubuntu, and Debian."
fi

PKG_FORMAT=""
PKG_MANAGER=""
case "$DISTRO_ID $DISTRO_LIKE" in
  *arch*|*garuda*|*manjaro*|*endeavouros*)
    PKG_FORMAT="pacman"; PKG_MANAGER="pacman" ;;
  *fedora*|*rhel*|*centos*|*almalinux*|*rocky*)
    PKG_FORMAT="rpm"; PKG_MANAGER="dnf" ;;
  *debian*|*ubuntu*|*mint*)
    PKG_FORMAT="deb"; PKG_MANAGER="apt" ;;
  *opensuse*|*suse*)
    PKG_FORMAT="rpm"; PKG_MANAGER="zypper" ;;
  *)
    warn "Unrecognized distro family - falling back to the universal AppImage recommendation."
    PKG_FORMAT="AppImage" ;;
esac
info "Recommended native package for this system: CareerOS-1.0.0-x64.$PKG_FORMAT"

echo
# ---------------------------------------------------------------------------
bold "2. Architecture"
ARCH="$(uname -m)"
if [ "$ARCH" = "x86_64" ]; then
  ok "Architecture: $ARCH (matches the x64 build)"
else
  fail "Architecture: $ARCH - CareerOS Desktop 1.0.0 only ships x64 builds. This machine cannot run it."
fi

echo
# ---------------------------------------------------------------------------
bold "3. glibc version"
if command -v ldd >/dev/null 2>&1; then
  GLIBC_VER="$(ldd --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+$' || echo "")"
  if [ -n "$GLIBC_VER" ]; then
    GLIBC_MAJOR="${GLIBC_VER%%.*}"
    GLIBC_MINOR="${GLIBC_VER##*.}"
    if [ "$GLIBC_MAJOR" -gt 2 ] || { [ "$GLIBC_MAJOR" -eq 2 ] && [ "$GLIBC_MINOR" -ge 28 ]; }; then
      ok "glibc $GLIBC_VER (Electron/Chromium on this build expects glibc 2.28+)"
    else
      warn "glibc $GLIBC_VER is older than the commonly-required 2.28 - the app may fail to start. AlmaLinux 8 and older Debian releases are the most likely to hit this; AlmaLinux 9+/Fedora/Ubuntu 20.04+/current Garuda are fine."
    fi
  else
    warn "Could not parse glibc version from 'ldd --version' output."
  fi
else
  warn "'ldd' not found - cannot check glibc version directly."
fi

echo
# ---------------------------------------------------------------------------
bold "4. Required shared libraries (Electron/Chromium runtime dependencies)"
# This list matches what upstream Electron documents as needed to run a packaged Linux app:
# https://www.electronjs.org/docs/latest/tutorial/installation (Linux dependencies)
REQUIRED_LIBS="libgtk-3.so.0 libnss3.so libasound.so.2 libatk-1.0.so.0 libatk-bridge-2.0.so.0 libcups.so.2 libdrm.so.2 libgbm.so.1 libxcomposite.so.1 libxdamage.so.1 libxfixes.so.3 libxrandr.so.2 libxkbcommon.so.0 libx11-xcb.so.1"
if command -v ldconfig >/dev/null 2>&1; then
  LDCONFIG_CACHE="$(ldconfig -p 2>/dev/null)"
  MISSING_LIBS=""
  for lib in $REQUIRED_LIBS; do
    if ! echo "$LDCONFIG_CACHE" | grep -q "$lib"; then
      MISSING_LIBS="$MISSING_LIBS $lib"
    fi
  done
  if [ -z "$MISSING_LIBS" ]; then
    ok "All checked runtime libraries present ($(echo $REQUIRED_LIBS | wc -w) checked)."
  else
    fail "Missing libraries:$MISSING_LIBS"
    case "$PKG_MANAGER" in
      apt)  info "Try: sudo apt install libgtk-3-0 libnss3 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 libx11-xcb1" ;;
      dnf)  info "Try: sudo dnf install gtk3 nss alsa-lib atk at-spi2-atk cups-libs libdrm mesa-libgbm libXcomposite libXdamage libXfixes libXrandr libxkbcommon libX11-xcb" ;;
      pacman) info "Try: sudo pacman -S gtk3 nss alsa-lib atk at-spi2-atk cups libdrm mesa libxcomposite libxdamage libxfixes libxrandr libxkbcommon libxcb" ;;
    esac
  fi
else
  warn "'ldconfig' not found - cannot check for missing shared libraries."
fi

echo
# ---------------------------------------------------------------------------
bold "5. AppImage support (FUSE)"
if [ -e /dev/fuse ] && (command -v fusermount >/dev/null 2>&1 || command -v fusermount3 >/dev/null 2>&1); then
  ok "FUSE is available - the .AppImage can mount and run directly."
else
  warn "FUSE (or /dev/fuse) not found. The .AppImage will still run via 'APPIMAGE_EXTRACT_AND_RUN=1 ./CareerOS-1.0.0-x64.AppImage' or './CareerOS-1.0.0-x64.AppImage --appimage-extract-and-run', but won't mount natively. This is common on minimal server installs and some AlmaLinux setups. Native package (.$PKG_FORMAT) avoids this entirely if available."
fi

echo
# ---------------------------------------------------------------------------
bold "6. Display server"
SESSION_TYPE="${XDG_SESSION_TYPE:-}"
if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
  ok "Display server detected (session type: ${SESSION_TYPE:-unknown}, DISPLAY=${DISPLAY:-unset}, WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-unset})"
  if [ "$SESSION_TYPE" = "wayland" ]; then
    info "On Wayland, Electron runs under XWayland by default - this is normal and works fine. Pass --ozone-platform=wayland at launch for native Wayland rendering if you want to try it (optional, not required)."
  fi
else
  fail "No DISPLAY or WAYLAND_DISPLAY set - there's no graphical session to launch into (e.g. this is a bare SSH session or a headless box). Launch this check from the machine's actual desktop session."
fi

echo
# ---------------------------------------------------------------------------
bold "7. Chromium sandbox prerequisites"
USERNS_SETTING="$(sysctl -n kernel.unprivileged_userns_clone 2>/dev/null || echo "")"
if [ "$USERNS_SETTING" = "1" ] || [ -z "$USERNS_SETTING" ]; then
  ok "Unprivileged user namespaces available (or not gated on this kernel) - Chromium's sandbox can use them."
else
  warn "kernel.unprivileged_userns_clone=0 - Chromium's sandbox may fall back to the setuid chrome-sandbox helper. This is normal on some hardened Debian/Ubuntu kernels and is handled automatically as long as chrome-sandbox has correct permissions after install (checked below if --binary is given)."
fi

echo
# ---------------------------------------------------------------------------
bold "8. Disk space"
AVAIL_MB="$(df -Pm "$HOME" 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "$AVAIL_MB" ]; then
  if [ "$AVAIL_MB" -ge 500 ]; then
    ok "Available space in \$HOME: ${AVAIL_MB} MB"
  else
    warn "Only ${AVAIL_MB} MB free in \$HOME - CareerOS Desktop plus its LaTeX/coding runtimes can use several hundred MB over time."
  fi
else
  warn "Could not determine available disk space."
fi

# ---------------------------------------------------------------------------
if [ -n "$APPIMAGE_PATH" ]; then
  echo
  bold "9. AppImage file check: $APPIMAGE_PATH"
  if [ -f "$APPIMAGE_PATH" ]; then
    if [ -x "$APPIMAGE_PATH" ]; then
      ok "File exists and is executable."
    else
      warn "File exists but is not executable - run: chmod +x \"$APPIMAGE_PATH\""
    fi
    FILE_TYPE="$(file -b "$APPIMAGE_PATH" 2>/dev/null || echo "")"
    case "$FILE_TYPE" in
      *ELF*) ok "Looks like a valid ELF binary (file: $FILE_TYPE)" ;;
      *) warn "Unexpected file type: $FILE_TYPE - the download may be corrupt or truncated. Re-download and verify against checksums.txt." ;;
    esac
  else
    fail "File not found at $APPIMAGE_PATH"
  fi
fi

if [ -n "$BINARY_PATH" ]; then
  echo
  bold "9. Installed binary check: $BINARY_PATH"
  if [ -x "$BINARY_PATH" ]; then
    ok "Binary exists and is executable."
    SANDBOX_PATH="$(dirname "$BINARY_PATH")/chrome-sandbox"
    if [ -f "$SANDBOX_PATH" ]; then
      SANDBOX_PERMS="$(stat -c '%a %U' "$SANDBOX_PATH" 2>/dev/null || echo "")"
      SANDBOX_MODE="$(echo "$SANDBOX_PERMS" | awk '{print $1}')"
      SANDBOX_OWNER="$(echo "$SANDBOX_PERMS" | awk '{print $2}')"
      if [ "$SANDBOX_MODE" = "4755" ] && [ "$SANDBOX_OWNER" = "root" ]; then
        ok "chrome-sandbox is setuid-root (4755) - the Chromium sandbox will work correctly."
      else
        fail "chrome-sandbox permissions are '$SANDBOX_PERMS', expected '4755 root'. Fix with: sudo chown root:root \"$SANDBOX_PATH\" && sudo chmod 4755 \"$SANDBOX_PATH\" - otherwise the app may refuse to start or fall back to --no-sandbox (less secure)."
      fi
    else
      info "No chrome-sandbox helper found next to the binary (expected for some packaging layouts) - not necessarily an issue."
    fi
  else
    fail "Binary not found or not executable at $BINARY_PATH"
  fi
fi

# ---------------------------------------------------------------------------
echo
bold "Summary"
echo "  Passed:   $PASS"
echo "  Warnings: $WARN"
echo "  Failed:   $FAIL"
echo

if [ "$FAIL" -gt 0 ]; then
  printf '\033[31mResult: NOT READY - fix the FAIL items above before installing/running CareerOS Desktop.\033[0m\n'
  exit 1
elif [ "$WARN" -gt 0 ]; then
  printf '\033[33mResult: LIKELY OK - review the WARN items above; none are guaranteed blockers but worth checking if the app misbehaves.\033[0m\n'
  exit 0
else
  printf '\033[32mResult: READY - this system should run CareerOS Desktop (%s recommended) without issues.\033[0m\n' "$PKG_FORMAT"
  exit 0
fi
