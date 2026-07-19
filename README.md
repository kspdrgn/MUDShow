# MUDShow

I was frustrated with the native Linux GUI options for playing MUDs, MUSHes, and MUCKs, so I made a minimalistic browser based client. I haven't added any features that I wouldn't use, and I'm not going to (feel free to fork). There's no mapping, no complex scripting or triggers, no status bars for health or stats, but there are a few handy features for roleplayers.

*A mud show is a historical term for a small, traveling circus that moved from town to town by horse and wagon, often getting caked in mud on unpaved roads. Today, it is also used colloquially to describe any low-budget, unprofessional, or highly disorganized live performance.*

## Features
Shows you a MU*.
Built-in notes.
Modular input bars.
Simple highlighting.
Tab completion.
Nothing else.

## Developing / Building

1. Click Code > Download ZIP, then unzip it.
2. Have `node` version 26 or higher installed globally.
3. To build and debug the app, run `npm start`.

## Development Options

VS Code: See file `vscode.launch.json.example` for working launch options. You can copy this file into `/.vscode` to use and modify as needed.

* Use `npm start` or `npm run tauri:dev` to launch the full app in development mode.
    * On Windows, `npm start` enables a WebView2 remote debugging port for the frontend. In VS Code, use `Attach to Tauri WebView` from `.vscode/launch.json` to debug the UI while Tauri is running.
* Use `npm run build` to produce a full release bundle (Windows exe or Linux AppImage) and installers.
* Use `npm run dev:frontend` to compile and launch the frontend UI code only, without any connection ability.

## Usage

- The app starts with one input bar, and you can add or remove more from the bar controls in the bottom right. Switch between the first two with F1 or F2 when a world tab is active. If there is only one input bar, F2 will open a second one.
- Press F3 to open and close the notes panel. Each character has their own notes. If you value them, back them up regularly.
- Press F4 to open and close the highlights panel. If you put in a word or phrase, you can make it show up with a different colour.
- Press F5 to open and close the rules panel. Rules use raw regexp patterns for more advanced matching.
- There are options for an optional max line width, a new activity sound, and output history lines in the character editor.
- Output history can be enabled by setting max number of lines to save. Output history will show when reconnecting. Set to 0 to disable.
- Tab completion only gives you the most recent word, so it's mainly useful for names.
- If you clear your browser data, you'll lose your characters and their notes.
