# Pin Folders to Dash

A GNOME Shell extension that lets you pin app folders to the dash, the same way you pin regular apps.

This is a fork of [fcusr/pin-app-folders-to-dash](https://github.com/fcusr/pin-app-folders-to-dash), updated to work on GNOME Shell 50. The original stopped working on GNOME Shell 46+ due to internal API changes.

## What's different from the original

- Fixed compatibility with GNOME Shell 50 (`updateDragFocus` removal, `IconGrid` changes)
- Fixed a crash when pinning/unpinning a folder directly from the dash
- Folder icons in the dash now get a background so they're visually distinct from regular app icons

## Installation

1. git clone https://github.com/TheOrsia/pin-app-folders-to-dash
2. cd pin-app-folders-to-dash
3. cp -r pin-folders-to-dash@TheOrsia ~/.local/share/gnome-shell/extensions/

* Do you want "Get it on GNOME Extensions"? Coming soon...

## License

GPLv3, same as the original project.
