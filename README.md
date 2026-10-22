# dgx-ge-editor

An editor for the game data of the DGX-GE engine. It starts from indexed PNG frames and adds what the pictures
themselves don't carry:

- the base point of every frame: the pixel the sprite is placed by and mirrored around;
- 1-bit collision masks with indexes (body, head, blade…);
- named attachment points (a hand, a blade tip) that child sprites attach to.

The editor is a single CAD-style workbench. The project tree on the left lists everything: kinds with their frames,
animations and game frames; palettes, masks, tilesets, scenes, dialogs, styles, fonts, translations, the game as a
whole, and all problems. The middle shows the selected item, the right column shows its properties with
explanations, the strip below holds the kind's frames, the animation player, the scene palette or the dialog text,
and the status bar at the bottom says what to do next. Everything can be undone and redone.

What it edits:

- **Animations**: frame scripts and the state machine of transitions between them (events, groups, rules), viewed
  as a state, a table, a graph or a matrix. The editor plays them along the floor and reads and writes the `.anim`
  text of the engine's assembler, comments included.
- **Scenes**, the levels of a game: parallax layers, pictures, tile grids drawn from pieces, actors, zones, entries,
  exits between scenes, and links.
- **Dialogs** and their styles, with a preview that lays the text out exactly as the engine does.
- **The game as a whole**: constants, timers, sounds, shows (title screens and the like) and kinds chasing the hero.

Pictures are changed in only two ways: moving a selected area together with its masks, and drawing pixels with the
pencil.

Open `index.html` in a browser. No server or build step is needed; Vue, Pinia and Bootstrap load from a CDN. The
interface is in English or Russian (the switch is at the top right).

Documentation:

- [workflow.md](workflow.md) ([Russian](workflow-ru.md)): from the editor to a board: a game is a folder, its data in
  `game_data/` kept by the editor, its code beside it, one build command;
- [usage.md](usage.md) ([Russian](usage-ru.md)): the user guide: getting started, a ten-minute example, how to work
  on a game, then every part of the workbench;
- [sprite-format.md](sprite-format.md) ([Russian](sprite-format-ru.md)): the format of the saved JSON file, for
  the engine's packer and other tools;
- [examples/README.md](examples/README.md) ([Russian](examples/README-ru.md)): the examples.

## From the editor to a board

A game is one folder: its data in `game_data/`, which the editor opens and keeps up to date by itself (the document,
the pictures by kind, `<KIND>.anim`, `dialogs/`), and next to it the game's code and builds, which the editor never
reads.

```
editor:   Open folder… → edit (every change is written into mygame/game_data/ by itself)
mygame/:  idf.py build flash         the board (the CYD; another: -D GAME_BOARD=…)
          make && make run           the same in a window on the computer (SDL2)
```

The builds make the pack from `game_data/` themselves. The whole way, what is needed and what to do when something
goes wrong: [workflow.md](workflow.md).

## Examples

All drawn and written for this repository, and all in the editor's choice **Example…**:

- `examples/snake/`, `examples/tetris/`, `examples/pacman/`: whole games, data and code, that build for the CYD and
  the computer and run there;
- `examples/wanderer/`: 19 frames of a figure with a sword, with masks, points and animations;
- `examples/walk.json`: the tiny example of the format description.

See [examples/README.md](examples/README.md).
