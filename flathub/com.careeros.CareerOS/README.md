# com.careeros.CareerOS Flathub Manifest

This folder is shaped like the app folder that goes into the Flathub submission repository:

- `com.careeros.CareerOS.yml` - Flatpak build manifest.
- `com.careeros.CareerOS.desktop` - desktop launcher metadata.
- `com.careeros.CareerOS.metainfo.xml` - AppStream metadata.
- `careeros-flatpak` - runtime launcher wrapper used by the Flatpak.
- `flathub.json` - Flathub build metadata.
- `latex/` - Flatpak-specific LaTeX integration.

Before submitting, generate the offline npm source list from the repo root:

```bash
flatpak-node-generator --no-requests-cache -o flathub/com.careeros.CareerOS/generated-sources.json npm package-lock.json
```

Or run the local Linux build helper from the repo root:

```bash
bash flathub/com.careeros.CareerOS/test-local.sh
```

For the actual Flathub pull request, replace the local `type: dir` source in `com.careeros.CareerOS.yml` with a tagged
GitHub source archive and commit the generated `generated-sources.json` beside this README.

The manifest also preloads `electron-v31.7.7-linux-x64.zip` into Electron Builder's cache. If the Electron version in
`package-lock.json` changes, update that URL and SHA256.
