# GNOME Shell Extension - Pin Folders to Dash

A GNOME Shell extension that lets you pin app folders to the dash, the same way you pin regular apps.

This is a fork of [fcusr/pin-app-folders-to-dash](https://github.com/fcusr/pin-app-folders-to-dash), updated to work on GNOME Shell 50. The original stopped working on GNOME Shell 46+ due to internal API changes.

## What's different from the original

- Fixed compatibility with GNOME Shell 50 (`updateDragFocus` removal, `IconGrid` changes)
- Fixed a crash when pinning/unpinning a folder directly from the dash
- Folder icons in the dash now get a background so they're visually distinct from regular app icons

## Installation

1. git clone https://github.com/TheOrsia/pin-folders-to-dash
2. cd pin-folders-to-dash
3. cp -r pin-folders-to-dash@TheOrsia ~/.local/share/gnome-shell/extensions/

* Do you want "Get it on GNOME Extensions"? Coming soon...

## Screenshot<img width="791" height="383" alt="Screenshot From 2026-09-22 13-00-04" src="https://github.com/user-attachments/assets/c834df3b-dc5a-4f7c-bf0d-f966e2549756" />

## License

GPLv3, same as the original project.
