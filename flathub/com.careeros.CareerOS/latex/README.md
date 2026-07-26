# LaTeX Runtime For The Flatpak

CareerOS normally prepares a portable Tectonic runtime for desktop builds. The Flathub build should not ship the
Windows `apps/desktop/vendor/latex/win32-x64/tectonic.exe` binary or ask users to install LaTeX on the host system.

This folder contains the Flatpak-specific LaTeX integration:

- `careeros-latex-env` disables the app's portable compiler downloader with `CAREEROS_DISABLE_PORTABLE_LATEX=1`.
- The same script adds the TeX Live extension binaries under `/app/texlive/bin/*-linux` to `PATH`.
- `com.careeros.CareerOS.yml` declares `org.freedesktop.Sdk.Extension.texlive` as an app extension.

At runtime, CareerOS sees `pdflatex` from the TeX Live extension and uses it for resume compilation inside the
Flatpak sandbox.
