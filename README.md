# MUDShow

I was frustrated with the native Linux GUI options for playing MUDs, MUSHes, and MUCKs, so I made a minimalistic browser based client. I haven't added any features that I wouldn't use, and I'm not going to (feel free to fork). There's no mapping, no complex scripting or triggers, no status bars for health or stats, but there are a few handy features for roleplayers.

*A mud show is a historical term for a small, traveling circus that moved from town to town by horse and wagon, often getting caked in mud on unpaved roads. Today, it is also used colloquially to describe any low-budget, unprofessional, or highly disorganized live performance.*

## Features
Shows you a MU*.
Built-in notes.
Two input bars.
Simple highlighting.
Tab completion.
Nothing else.

## Installation

1. Click Code > Download ZIP, then unzip it.
2. Have node.js installed.
3. Run `npm install`.
4. Run `node proxy.js`, then open mudshow.html.

## Usage

- If you're on Linux, you can try one of the included shell scripts. It does the same thing as step 4, but the proxy will stay open until you Ctrl+C, then get killed.
- There are two input bars, which can come in handy if someone's talking to you while you're editing a description, for example. Switch to them with F1 or F2.
- Press F3 to open and close the notes panel. Each character has their own notes. If you value them, back them up regularly.
- Press F4 to open and close the highlights panel. If you put in a word or phrase, you can make it show up with a different colour. No, there is no regex support.
- There are options for line width and for a new activity sound in the character editor. Padding seems to take up 2 characters worth of width, so expect to need to increase your MU's expected line width by two.
- Tab completion only gives you the most recent word, so it's mainly useful for names.
- If you clear your browser data, you'll lose your characters and their notes.
