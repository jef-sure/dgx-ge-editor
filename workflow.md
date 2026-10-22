# From the editor to a board

How a game made with this editor gets onto a board of DGX-GE: what lies where, what you do, what the builds do. The
examples [`examples/snake`](examples/snake), [`examples/tetris`](examples/tetris) and
[`examples/pacman`](examples/pacman) go this whole way and run on the CYD; see [examples/README.md](examples/README.md).

## A game is a folder

```
mygame/
  game_data/               the game's data: the editor opens and keeps this folder, and nothing else
    mygame.json            the document: kinds and frames, masks, scenes, tiles, styles, numbers and timers of the game
    HERO/  GUARD/          the pictures of each kind (PNG, a folder a kind)
    HERO.anim  GUARD.anim  the animations of each kind, the engine's language, with your comments
    dialogs/intro.dlg      the dialogs
    po/ru.po               translations
  main/main.c              the game's code: what the data cannot say
  main/CMakeLists.txt      the build for a board (idf.py); it makes the pack from game_data/
  main/idf_component.yml   the engine, DGX-DI and what the boards need
  CMakeLists.txt           the ESP-IDF project, the choice of a board
  Makefile                 the build for the computer (make, SDL2); it makes the pack too
  tools/pack.py            the engine's packer over game_data/ (the builds call it)
```

- **You open `game_data/`**, never the JSON by itself. The `.json` is the editor's and the packer's file: the summary
  of the project, written by the editor. Open folder takes a game's folder too: it goes into its `game_data/`.
- **The `.anim` files are readable text**, the same text the editor shows in Scripts → Text. You may edit them
  outside the editor; opening the folder again takes them over the JSON.
- **The game's code is beside the data**, not in it: the editor never reads `main/`, `tools/` or the builds.

## In the editor

1. **Open folder…** and choose the game's folder (or its `game_data/`). The button by it shows **✓ mygame/game_data**.
2. Work. Every change is written into the folder a moment after it, and only what changed: the JSON, a picture you
   painted, the `.anim` of a kind whose animation changed, a dialog. Nothing is written when you only look around.
   The button shows ✓ saved, … saving, ⚠ not written (its hint says why); a click writes at once.
3. After a reload of the page the editor offers the same folder: **↻ mygame/game_data** (the browser asks whether the
   editor may read and write it).

A new game, or an example you want to make your own: **Save to folder…** once, choose the game's folder; from then on
it keeps itself. Writing folders needs Chrome or Edge (the page may be opened as a file); in another browser Open
folder only reads, and **JSON ⭳**, **Export .anim** and the dialogs' **⭳** download the files to put there yourself.

**Problems** (✖ ⚠ at the top) is what the packer would refuse and what is likely a mistake. What is an error there,
the build refuses too.

## Building

In the game's folder, one command:

```sh
idf.py build flash         # the board: the CYD by default; another: idf.py -D GAME_BOARD=jc8012p4a1c build flash
make && make run           # the same game in a window on the computer
```

Each build makes the pack itself, whenever `game_data/` is newer than it: `tools/pack.py` runs the engine's packer
(`Pack.add_sprites`) and writes `main/assets/<name>.pack` and its header `<name>_pack.h`. The header names
everything of the data as numbers for the C code: `MYGAME_HERO_SCRIPT_RUN`, `MYGAME_EVENT_JUMP`,
`MYGAME_PLAY_PARAM_SCORE`, `MYGAME_SCENE_LEVEL1_ZONE_EXIT`, `MYGAME_GAME_LIVES`… A name changed in the editor is a
compile error in the code, not a silent mistake on the board.

## Data and code

The engine runs the data; the game's code is what only it knows. The examples share one way of splitting them:

- **What the actors do** (pictures, steps, timing, what follows from what) is their animations.
- **The rules of the game** (the score, lives, levels, speeds, how long a piece lies before it locks) are an actor
  of their own, **PLAY**: an animation with params (`score`, `lives`, …) and scripts. The code tells it what happened
  (`dot`, `ate`, `taken` with how many lines), PLAY counts and answers with **signals** (`SIG_NUMBERS`, `SIG_OVER`,
  …: constants of the document, so the scripts read as words). The pause dialog shows PLAY's params.
- **Numbers of the game** (speeds, the shapes of Tetris's pieces, the ghosts' corners) are the Game node's numbers,
  read in C by name.
- **The scene** of the editor is the level: its layers, pictures, grids of tiles, actors, zones (where the score is
  written, where the tunnel is) and entries.
- **The code** is what the data cannot say: input, walking the grid, where a ghost aims, what the head of the snake
  found, what a full line is.

## Starting a game of your own

Copy an example's folder (Snake is the smallest) and rename it:

1. `game_data/snake.json` → `game_data/mygame.json`; in the editor, open the folder and give the project its name
   (the field at the top left): the names of the header become `MYGAME_…`.
2. In `Makefile`, `CMakeLists.txt` and `main/CMakeLists.txt`: `snake` → `mygame` (the pack's file names).
3. In `main/main.c`: `SNAKE_` → `MYGAME_`, `snake_pack` → `mygame_pack`, then make the code yours.

## What is needed

- A browser with access to folders: Chrome or Edge. No server: open `index.html`.
- The engine **DGX-GE** with its tools (`tools/dgx_ge_pack.py`): a checkout of
  [esp32-component-dgx-ge](https://github.com/jef-sure/esp32-component-dgx-ge). The builds take it from the variable
  `DGX_GE` (`export DGX_GE=~/git/esp32-component-dgx-ge`), else from beside the editor's folder: clone both side by
  side and nothing needs to be said.
- **python3 with Pillow** for the packer: the system's. ESP-IDF's own Python has no Pillow; the board's build finds
  the system's `python3` itself.
- For a board: **ESP-IDF** 5.3 or later (the examples are built with 6.0.1). **DGX** 0.8 and **DGX-DI** 0.1.2 come
  from the registry by themselves.
- For the computer: **SDL2** (`libsdl2-dev`), GNU make 4.3+, a C compiler; DGX and DGX-DI as an `idf.py` build of the
  game downloaded them (into its `managed_components/`), or checkouts of
  [esp32-component-dgx](https://github.com/jef-sure/esp32-component-dgx) and
  [esp32-component-dgx-di](https://github.com/jef-sure/esp32-component-dgx-di) beside the editor's folder, or
  `make DGX=… DGX_DI=…`.

## The CYD's touch

The engine's board of the CYD leaves its resistive panel out. The examples take it themselves (`main/cyd_touch.c`,
the XPT2046 through DGX-DI, built with `GAME_CYD`) and read gestures by DGX-DI's touch: a swipe is short (2 mm: the
panel gives few points of a quick move), a long press pauses. On the computer the mouse is the finger.

## When something goes wrong

| What | Why, what to do |
| --- | --- |
| The button by the folder shows ⚠ | Its hint says why: the browser did not allow writing (click it), or the folder has another `.json` at the top (the packer wants one) |
| The build stops at «the pack of game_data/ could not be made» | The packer's message above it says what: an error the editor shows in Problems, or no Pillow for `python3` |
| A compile error with a name `MYGAME_…` | The name was changed in the editor: the header follows it, change the code too |
| «No engine at …» | Set `DGX_GE` to the folder of DGX-GE, or put its checkout beside the editor's folder |
| Text of a dialog not seen in the editor's preview | The editor shows dialogs with a font of DGX loaded once in the Fonts node (Load font .c…); the game is not affected |
