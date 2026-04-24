# CareerOS Flathub Submission

This repo contains a local Flatpak manifest draft in `flathub/com.careeros.CareerOS/`.

Flathub submissions for Electron apps should use `flatpak-builder`, the Electron BaseApp, a generated npm dependency
source manifest, and a tagged source archive. Electron Builder's single-file Flatpak output is not the right artifact
for Flathub.

## 1. Install Tools On Linux Or WSL

```bash
sudo apt update
sudo apt install -y flatpak flatpak-builder git jq python3-pip pipx

flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install -y flathub org.flatpak.Builder
flatpak install -y flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08
flatpak install -y flathub org.electronjs.Electron2.BaseApp//25.08
flatpak install -y flathub org.freedesktop.Sdk.Extension.node20//25.08
flatpak install -y flathub org.freedesktop.Sdk.Extension.texlive//25.08
```

Install the npm source generator:

```bash
git clone https://github.com/flatpak/flatpak-builder-tools.git /tmp/flatpak-builder-tools
pipx install /tmp/flatpak-builder-tools/node/flatpak_node_generator
```

## 2. Generate Offline NPM Sources

From the repo root:

```bash
flatpak-node-generator --no-requests-cache -o flathub/com.careeros.CareerOS/generated-sources.json npm package-lock.json
```

The generated `flathub/com.careeros.CareerOS/generated-sources.json` file must be committed to the Flathub submission
repo.

## 3. Build And Run Locally

From the repo root:

```bash
cd flathub/com.careeros.CareerOS
flatpak run --command=flathub-build org.flatpak.Builder --install com.careeros.CareerOS.yml
flatpak run com.careeros.CareerOS
```

The manifest uses the TeX Live Flatpak extension. The wrapper adds `/app/texlive/bin/*-linux` to `PATH`, and the app
sets `CAREEROS_DISABLE_PORTABLE_LATEX=1`, so CareerOS uses `pdflatex` from the Flatpak extension instead of asking the
user for a host LaTeX install.

## 4. Run The Linter

```bash
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest com.careeros.CareerOS.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder repo repo
```

Fix any linter findings before opening the PR.

## 5. Convert The Local Manifest For Submission

The checked-in manifest uses a local `type: dir` source so you can build from this workspace. For the Flathub PR,
replace that source with a tagged GitHub archive:

```yaml
sources:
  - type: archive
    url: https://github.com/keshav-019/career-os/archive/refs/tags/v1.0.0.tar.gz
    sha256: REPLACE_WITH_SHA256
    dest: main
  - generated-sources.json
```

Create and push the release tag first, then compute the archive hash:

```bash
git tag v1.0.0
git push origin v1.0.0
curl -L -o /tmp/careeros-v1.0.0.tar.gz https://github.com/keshav-019/career-os/archive/refs/tags/v1.0.0.tar.gz
sha256sum /tmp/careeros-v1.0.0.tar.gz
```

The `.gitattributes` file excludes Windows compiler binaries and local build output from source archives.

## 6. Open The Flathub PR

```bash
gh repo fork --clone flathub/flathub
cd flathub
git checkout --track origin/new-pr
git checkout -b add-com-careeros-careeros
mkdir -p com.careeros.CareerOS
cp -a /path/to/career-os/flathub/com.careeros.CareerOS/. com.careeros.CareerOS/
git add com.careeros.CareerOS
git commit -m "Add com.careeros.CareerOS"
git push -u origin add-com-careeros-careeros
```

Open the pull request against Flathub's `new-pr` branch, not `master`. After review comments are resolved, comment
`bot, build` to request a test build.

## Notes To Resolve Before Final Submission

- Confirm whether `com.careeros.CareerOS` is the right app ID. If you cannot verify/control `careeros.com`, use the
  GitHub-based ID `io.github.keshav_019.career-os` and rename every Flatpak metadata file accordingly.
- Replace `LicenseRef-proprietary` if CareerOS gets a real open-source license.
- Add screenshots to the metainfo before final review if the Flathub linter requests them.
- Flathub's current policy says submission PRs themselves should not be generated or opened by AI tools. Treat these
  files as a maintainer-reviewed draft and make the final PR yourself.
