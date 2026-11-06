# From the editor to a board

How a game made with this editor gets onto a board: what lies where, what you do, what the builds do. The
examples [`examples/snake`](examples/snake), [`examples/tetris`](examples/tetris) and
[`examples/pacman`](examples/pacman) go this whole way and run on the boards of
[jef-sure/boards](https://github.com/jef-sure/esp32-component-boards) (the CYD, Guition's 10", 7" and 4.3") and on the
computer; see [examples/README.md](examples/README.md). The engine's `examples/hello` is laid out the same way.

## A game is a folder

```
mygame/
  game_data/               the game's data: the editor opens and keeps this folder, and nothing else
    mygame.json            the document: kinds and frames, masks, scenes, tiles, styles, numbers and timers of the game
    HERO/  GUARD/          the pictures of each kind (PNG, a folder a kind)
    HERO.anim  GUARD.anim  the animations of each kind, the engine's language, with your comments
    dialogs/intro.dlg      the dialogs
    sounds/  music/        the sounds' samples (WAV) and the music's notes (MML)
    po/ru.po               translations
  main/main.c              the game's code: what the data cannot say
  main/CMakeLists.txt      the build (idf.py), for a board and for the computer; it makes the pack from game_data/
  main/idf_component.yml   the engine, the boards (jef-sure/boards), DGX-DI
  CMakeLists.txt           the ESP-IDF project: the board a preset chose, where the engine is
  sdkconfig.defaults.<board>, CMakePresets.json
                           the boards, as board_select.py of jef-sure/boards wrote them
  sdkconfig.defaults       the game's own settings of ESP-IDF, after the board's
  tools/pack.py            the engine's packer over game_data/ (the build calls it)
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

In the game's folder, in a shell with ESP-IDF, one command:

```sh
idf.py build flash monitor                       # the current board, the CYD
idf.py --preset jc8012p4a1c build flash monitor  # another: the 10"; jc1060p470c the 7", jc4827w543c the 4.3"
idf.py --preset host build                       # the computer: a window of the CYD's display
./build/host/mygame.elf
```

Each board builds in `build/<board>` with its own sdkconfig: no `set-target`, no menuconfig. The boards are those
`board_select.py` of jef-sure/boards wrote into the folder (`sdkconfig.defaults.<board>`, `CMakePresets.json`): another
is `python3 managed_components/jef-sure__boards/tools/board_select.py <board> .` after a first build downloaded it,
the current one `board_select.py --current <board> .`. ESP-IDF 5 does not read the presets:
`idf.py -B build/<board> -D SDKCONFIG=build/<board>/sdkconfig -D BOARD=<board> build`.

The computer is the board `host` of jef-sure/boards: ESP-IDF's linux target, the display a window of DGX as large as
the board it shows, the mouse a finger, the keys buttons (the arrows or WASD, Space A, Backspace B, Enter START; the
CYD's BOOT is the key B), NVS kept in `build/host/flash.bin`. With nobody at it (a check), DGX's variables:
`DGX_HOST_SCRIPT` (a file of keys and mouse presses and their times), `DGX_HOST_QUIT_MS`, `DGX_HOST_SHOT` (the display
written as a PPM), with `SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy` (the engine's `docs/host-en.md`, section 7).

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

The engine makes one from an example, renamed and tied to nothing around it (DGX-GE 0.5.0, `tools/dgx_ge_new.py`):

```sh
python3 ~/git/esp32-component-dgx-ge/tools/dgx_ge_new.py ~/games/mygame --from snake   # or tetris, pacman, hello
```

It finds the editor's examples beside the engine's folder (or by `$DGX_GE_EDITOR`), renames the project, the pack,
the prefix in C (`SNAKE_` → `MYGAME_`) and the document, keeps the example's boards, and writes the project's
`CMakeLists.txt`, a README and the settings of clangd. Then open `~/games/mygame` in the editor.

By hand: copy an example's folder (Snake is the smallest) and rename it:

1. `game_data/snake.json` → `game_data/mygame.json`; in the editor, open the folder and give the project its name
   (the field at the top left): the names of the header become `MYGAME_…`.
2. In `CMakeLists.txt` and `main/CMakeLists.txt`: `snake` → `mygame` (the project, the pack's file names).
3. In `main/main.c`: `SNAKE_` → `MYGAME_`, `snake_pack` → `mygame_pack`, the NVS namespace `"snake"`, then make the
   code yours.

A copy outside the editor's folder finds no engine beside it, and takes the registry's (`main/idf_component.yml`);
`DGX_GE=<a checkout>` gives it a checkout.

## What is needed

- A browser with access to folders: Chrome or Edge. No server: open `index.html`.
- The engine **DGX-GE** with its tools (`tools/dgx_ge_pack.py`): a checkout of
  [esp32-component-dgx-ge](https://github.com/jef-sure/esp32-component-dgx-ge), which the build takes from the
  variable `DGX_GE` (`export DGX_GE=~/git/esp32-component-dgx-ge`), else from beside the editor's folder (clone both
  side by side and nothing needs to be said); without a checkout, the ESP Component Registry's (`^0.5.0`), which the
  build downloads into `managed_components/`.
- **python3 with Pillow** for the packer: the system's. ESP-IDF's own Python has no Pillow; the build finds the
  system's `python3` itself.
- **ESP-IDF** 5.5 or later (6 reads the presets; the examples are built with 6.0.1), for the boards and the computer
  alike. **jef-sure/boards**, **DGX** and **DGX-DI** come from the registry by themselves, and with them what the board
  needs (its touch panel's driver, its codec).
- For the computer: **SDL2** (`libsdl2-dev`) and the computer's C compiler.

### Versions

The least each part must be for the examples to build and play, and what they were checked with:

| Part | At least | Why | Checked with |
| --- | --- | --- | --- |
| DGX-GE | 0.5.0 | the boards of jef-sure/boards and what a game does over them, the engine's: the touch as its pointer and the pad on the display (`dgx_ge_di_*`, `dgx_ge_pad_*`), the sound (`dgx_ge_sound_open`), the loop's pace (`dgx_ge_pace`), a board's buttons by their names (`dgx_ge_key_named`); before it (0.4.0) music by notes, the game's variables, a frame's time by an expression, Pac-Man turned by quarters | 0.5.0 |
| jef-sure/boards | 0.0.5 | the boards and the computer's board `host`, the level of a board's speaker, buttons by their names | 0.0.5 |
| DGX | 0.10.10 | DGX-GE asks for `^0.10.10` (the window of the computer) | 0.10.11 |
| DGX-DI | 0.1.5 | the games' `idf_component.yml`: the first that builds for the computer | 0.1.5 |
| ESP-IDF | 5.5 | jef-sure/boards' least | 6.0.1: the CYD, the 10", the 7", the 4.3" and the computer |
| python3, Pillow | — | the packer | Python 3.14, Pillow 12.1 |
| SDL2 | — | the computer's board | 2.32 |
| node | — | `examples/editor_check.js`, `make_games.py`, `check_games.py` only | 24 |

A dash: nothing older is known not to work, but nothing older was tried. The games' `main/idf_component.yml` ask
for this DGX-GE too (`^0.5.0`); their `main/CMakeLists.txt` carry the synthesizer of their music
(`dgx_ge_synths(chip)` Pac-Man, `nes` Tetris, `fm` Snake).

## The touch, the buttons, the display

The games ask for the board's parts by kind (`boards.h`), never by its name. The touch is the board's (the CYD's
resistive XPT2046 too, the computer's mouse); its gestures are DGX-DI's touch in the game: a swipe is short (2 mm: a
resistive panel gives few points of a quick move), a long press pauses. The pad of DGX-DI is drawn over the game where
the touch follows several fingers and the board has no arrows of its own (the 10", the 7", the 4.3"); on the CYD the
finger plays, on the computer the keys. A board's button without a gamepad's name (the CYD's BOOT) is START: it starts
a game, pauses, takes an answer. Pac-Man stands a display up where lying down it does not show the maze whole (the
CYD, the 4.3"); on the computer its window holds the CYD standing (`CONFIG_BOARD_HOST_TURN=0` in its
`sdkconfig.defaults`). The 10"'s touch panel needs its firmware, which may not be given away: the game embeds
`main/jc8012p4a1c_touch.fw` when it is there (made by DGX-DI's `tools/gsl_firmware.py`; jef-sure/boards,
`docs/en/touch-firmware.md`), else its touch is off.

## When something goes wrong

| What | Why, what to do |
| --- | --- |
| The button by the folder shows ⚠ | Its hint says why: the browser did not allow writing (click it), or the folder has another `.json` at the top (the packer wants one) |
| The build stops at «the pack of game_data/ could not be made» | The packer's message above it says what: an error the editor shows in Problems, or no Pillow for `python3` |
| A compile error with a name `MYGAME_…` | The name was changed in the editor: the header follows it, change the code too |
| «a DGX-GE older than 0.5.0» | The checkout of the engine (`$DGX_GE`, else the one beside the editor's folder) is older than the game: update it (`git pull`), or remove it to take the registry's |
| «no sdkconfig.defaults.<board> here» | The board is not one of the game's: `board_select.py <board> .` of jef-sure/boards adds it |
| ESP-IDF 5 builds no board | It does not read `CMakePresets.json`: `idf.py -B build/<board> -D SDKCONFIG=build/<board>/sdkconfig -D BOARD=<board> build` |
| The board's sdkconfig keeps an old setting | ESP-IDF reads the defaults only into a new sdkconfig: remove `build/<board>` |
| Text of a dialog not seen in the editor's preview | The editor shows dialogs with a font of DGX loaded once in the Fonts node (Load font .c…); the game is not affected |
