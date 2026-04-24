## CareerOS Desktop 1.0.0

The first stable release of the CareerOS desktop app — the full CareerOS career workspace (applications tracker, AI resume/job matching, Interview War Room, Learning Center, and more), plus two capabilities that only run locally:

- **Local LaTeX resume compilation.** Compile LaTeX resumes to PDF on your own machine (via a bundled [Tectonic](https://tectonic-typesetting.github.io/) engine, with a system pdfLaTeX fallback) — no upload required.
- **Coding Arena.** Run and submit solutions against real test cases in C, C++, Java, JavaScript, Python, or Rust, entirely on your machine.

macOS is not built in this release. Windows and Linux are both covered, with native packages for every major Linux distribution family.

### Downloads

| Platform | File | Notes |
|---|---|---|
| Windows | `CareerOS-1.0.0-x64.exe` | Installer (NSIS). Run and follow the prompts. |
| Windows (portable) | `CareerOS-1.0.0-x64.zip` | No installer — unzip and run. |
| Debian / Ubuntu / Mint | `CareerOS-1.0.0-x64.deb` | `sudo dpkg -i CareerOS-1.0.0-x64.deb` |
| Fedora / RHEL / openSUSE | `CareerOS-1.0.0-x64.rpm` | `sudo rpm -i CareerOS-1.0.0-x64.rpm` |
| Arch / Manjaro | `CareerOS-1.0.0-x64.pacman` | `sudo pacman -U CareerOS-1.0.0-x64.pacman` |
| Any Linux distro | `CareerOS-1.0.0-x64.AppImage` | `chmod +x CareerOS-1.0.0-x64.AppImage && ./CareerOS-1.0.0-x64.AppImage` — no install needed, works everywhere. |

`checksums.txt` contains SHA-256 hashes for every file above — verify with `sha256sum -c checksums.txt` (Linux) or `Get-FileHash` (Windows).

### What's inside

- Applications pipeline, AI Match, Resume Studio (Visual + LaTeX modes), Interview War Room (Coding, Aptitude, Computer Science, AI role-based tracks, System Design), Learning Center, Analytics, and Calendar — the same CareerOS product as the web app, running locally.
- Coding-arena problems and the LaTeX/judge harness now load from a locked-down catalog — only a verified admin account can publish changes to what runs on your machine.

### Requirements

- Windows 10/11 (x64) or a 64-bit Linux distribution.
- An internet connection for sign-in and AI features; LaTeX compilation and code execution work offline once the app has started.
