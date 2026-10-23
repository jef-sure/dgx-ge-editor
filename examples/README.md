# Examples

Everything here is drawn and written for this repository; nothing is taken from other games. In the editor all of
them are in the choice **Example…** at the top. Русский: [README-ru.md](README-ru.md).

| Folder | What it is |
| --- | --- |
| [`snake/`](snake) | Snake: a whole game, data and code, for the CYD and the computer |
| [`tetris/`](tetris) | Tetris: a whole game, data and code, for the CYD and the computer |
| [`pacman/`](pacman) | Pac-Man: a whole game, data and code, for the CYD (standing up) and the computer |
| [`wanderer/`](wanderer) | A figure with a sword: 19 frames with masks, points and animations (sprites only) |
| `walk.json`, `walk.anim`, `walk-*.png` | The tiny example of the format description ([sprite-format-ru.md](../sprite-format-ru.md)) |

## The games

Each game is a folder as [workflow.md](../workflow.md) describes: its data in `game_data/` (the editor opens it),
its code and builds beside it.

```sh
cd examples/snake
make && make run           # in a window (SDL2)
idf.py build flash         # on the CYD
```

The builds make the pack from `game_data/` themselves. The engine: `DGX_GE`, else a checkout of
`esp32-component-dgx-ge` beside the editor's folder; see [workflow.md](../workflow.md#what-is-needed).

| Game | Keys (computer) | Touch (CYD) |
| --- | --- | --- |
| Snake | arrows; Enter: start, pause | swipe: turn; tap beside the head: turn that way; long press: pause; tap: start |
| Tetris | ← →: move, ↑ or Shift: turn, Z or X: drop, ↓: faster; Enter: start, pause | drag sideways: move; tap: turn; swipe down: drop; long press: pause; tap: start |
| Pac-Man | arrows (a turn may be asked ahead); Enter: start, pause | swipe: turn; tap beside him: turn that way; long press: pause; tap: start |

Shift is A, Z and X are B and X of the engine's host board; the mouse is a finger.

### What is data, what is code

| | Data (`game_data/`, the editor) | Code (`main/main.c`) |
| --- | --- | --- |
| Snake | the field as it starts (walls, the snake, the apple; a scene with its music), the snake as tiles chosen by the cell's modifier (the sides it goes on to), the apple shining, sparks; the clock of its steps (CLOCK: a frame of `game_var.speed` ms); PLAY: the phases, score, best, length, how fast it goes, the star and its time, GAME OVER; the sounds (`sounds/*.wav`), the music on FM (`music/*.mml`) | a cell a step, turning, what the head finds; the best score in NVS |
| Tetris | the well and its boxes (a scene with its music), blocks as tiles by piece, the shapes as numbers; the fall (FALL: a frame of `game_var.fall` ms, shorter while down is held); PLAY: the phases, score, lines, level and how fast it falls (a table), the time before a piece locks, full lines flashing; the sounds (`sounds/*.wav`), the music on the NES (`music/*.mml`) | a row down, moving, turning against walls, full lines |
| Pac-Man | the maze (a picture, its walls and door as cells), dots and energizers as tiles; the ghosts whole: bobbing in the house and out through the door (`path`), where each aims (the arcade's targets: tables and questions to the game, `game.*`), the modes, Cruise Elroy, frightened anywhere (the dice, `rnd`), eaten, the eyes home and in again; who meets whom (masks, `hit`: caught, eaten, the fruit); the fruit; the house letting one out when no dot is eaten for a while (a timer); Pac-Man's pictures facing right, turned his way (`rotate`); PLAY: the phases and how long each lasts, score, lives, the extra life, READY and GAME OVER, the music of a fright; the sounds (`sounds/*.wav`), the siren and the fright on the chip (`music/*.mml`, the siren the maze's) | walking the maze from cell to cell toward the cell a ghost aims at, the answers to its questions, the clocks (the maze stands while PLAY's phase says), passing on what the actors say and whom they meet; the best score in NVS |

All three have a title show and a pause dialog with PLAY's numbers, made in the editor: Continue, New game, and two
sliders (left, right), the volumes of the music and of the effects — variables of the game (`game_var.music_volume`,
`effects_volume`) the game gives the mixer's buses and keeps in NVS as the engine saves them (a chunk VARS). The music
goes lower while the dialog is open.

The packer takes what lies beside a game's document as well: the sounds' samples, `game_data/sounds/<name>.wav`, and
the music's notes, `game_data/music/<name>.mml`. The constants of the document (the signals, the phases the scripts and
the code share) reach the C in the pack's header.

### Remaking the data

`game_data/` of the three games is made by a script; the code is not touched by it:

```sh
python3 examples/make_games.py [pacman tetris snake]   # the data, written as the editor writes it
python3 -B examples/check_games.py                     # the chain: the editor reads it with no problems and saves it
                                                       # as it is, the engine's packer packs it, the .anim the editor
                                                       # writes make the same pack byte for byte
python3 examples/make_example_data.py                  # the examples into ExampleData.js, for the choice Example…
python3 -B examples/pack.py examples/snake/game_data   # a pack alone, without a build
```

`editor_check.js` is the editor's own code without a browser (node): `make_games.py` and `check_games.py` read and
check through it.

## The wanderer

`wanderer/`: 19 frames drawn by `make_wanderer.py` from a skeleton of joints and angles, and their markup
`wanderer.json` (masks body, blade, head; the point hand; the animations stand, walk, strike, jump, also as
`wanderer.anim`). Run the script again to draw them anew; the animations are kept.
