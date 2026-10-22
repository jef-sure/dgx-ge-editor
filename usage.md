# The DGX-GE editor: user guide

The editor makes the data of a game for the DGX-GE engine, everything except
the code. It marks up sprite frames (base points, collision masks, attachment
points) and describes animations (scripts and the state machine), scenes and
levels, dialogs and their styles, and the game's constants, timers, sounds
and shows.

**A project is the game's data folder, `game_data/`.** You open it in the
editor with **Open folder…** (you can also pick the game folder itself; the
editor then takes its `game_data/`), and from then on the editor saves every
change into it by itself. The game's code and build files sit next to
`game_data/`; the editor neither sees nor touches them. Running
`idf.py build flash` or `make` in the game folder packs the data and builds
the game. There is no separate save, export or packing step (see section 3,
"The project folder" and "From the editor to the board").

What the editor writes into `game_data/`:

- pictures: PNG files in one folder per kind (`HERO/run-1.png`);
- animations: one text file `KIND.anim` per kind, in the engine's language,
  with your comments; you can read and edit it outside the editor too;
- dialogs: `dialogs/NAME.dlg`;
- **`NAME.json`**: everything else, and the index of it all: frame markup,
  scenes, tiles, styles, the game's numbers and timers. This is the editor's
  and the packer's working file; nobody opens or edits it by hand. You open
  the project as a folder, not as a JSON file. The engine's packer
  (`tools/dgx_ge_pack.py`, `add_sprites`) reads it together with the other
  files in the folder. Its format is described in
  [sprite-format.md](sprite-format.md), which is meant for people who write
  tools rather than games.

The guide starts with **getting started** and a **ten-minute example**, then
covers **how to work on your own game**, and ends with a **reference** for
every part of the workbench.

## 1. Getting started

### Running the editor

Open `index.html` in a browser (Chrome, Firefox). No server or build step is
needed, but you need an internet connection: Vue, Pinia and Bootstrap load
from a CDN.

### One workbench

The editor is laid out like a CAD program: a single window where everything
always has the same place.

```
┌ Top bar: project name, Open folder, ✓ folder, Open JSON, Example, New ·
│ Undo, Redo · tools of the current mode · zoom · Problems · Help · language
├────────────┬────────────────────────────────────────┬─────────────────────┤
│ Project    │ Middle: the frame canvas, script       │ Properties of the   │
│ tree       │ steps, a scene, a dialog screen, the   │ selection, and the  │
│            │ game's tables                          │ Help pane           │
│            ├────────────────────────────────────────┤                     │
│            │ Bottom strip: frame strip, player,     │                     │
│            │ scene palette, dialog text             │                     │
├────────────┴────────────────────────────────────────┴─────────────────────┤
│ Status bar: what the mouse does now, coordinates, active mask or layer    │
└───────────────────────────────────────────────────────────────────────────┘
```

- The **project tree** on the left lists everything the game is made of, in
  the same structure as the engine's pack. Clicking a node opens it in the
  middle; its properties appear on the right.
- The **middle** shows what is selected in the tree: a kind's frame on the
  canvas, a script's steps, a scene, a dialog screen, a game table.
- The **right column** holds the properties of the selection (a frame, a
  script as a state, a scene object, a style) and, at the bottom, the
  **Help** pane with explanations for the current mode. The Help checkbox is
  in the top bar; tooltips and the status bar keep working without it.
- The **bottom strip** depends on the mode: the frame strip with playback,
  the animation player with event buttons, the scene palette, the dialog
  text. Drag its top edge to change its height.
- The **status bar** at the very bottom tells you what the mouse and keys
  will do right now and shows the coordinates under the cursor.

The editor speaks English and Russian: the language list at the right end of
the top bar switches buttons, tooltips, Help and the status bar, and the
browser remembers your choice. The words of the `.anim` language, JSON keys
and the messages of the checks are in English in both languages, the same as
the engine's tools print them. Hover over any button or field to see what it
does.

### Terms

- **Kind**: a character, an item or a set of rules with its own animation:
  the prince, a guard, a potion, a torch, the rules of a level. A kind can
  have **frames** (pictures with markup), an **animation** (scripts and
  transitions) and a **game frames table**. A kind without pictures is just
  an animation. In the JSON, kinds are stored in the `sets` field; the
  engine makes the same split: a palette with pictures is a set, and
  something with an animation and a state is a kind.
- **Frame**: one PNG picture and its markup: the base point, masks and
  points.
- **Base point**: the pixel by which the sprite is placed in the game,
  usually at the feet. Its row is the **baseline** (the floor), its column is
  the **base column** (the mirror axis when the sprite turns around).
- **Canvas**: the rectangle shared by all frames of a kind. Every frame
  stands on it with its base point at the same spot. The grid in the middle
  of the window is the canvas.
- **Mask**: a 1-bit "shadow" of a frame used for collisions, with an index
  that names a zone: body, head, blade. The engine reports which indexes
  overlapped; what that means is up to the game.
- **Attachment point**: a named pixel of a frame ("hand", "tip") that
  another sprite attaches to, such as a sword in a hand.
- **Script**: what a character does: frames over time, moves, commands. A
  script is also a **state**. An **event** is something the game tells the
  character. A **transition** is what an event does in a given state.
- **Scene**: a level or a room: layers of objects, tile grids, exits, links.
  A **tile** is a cell of a grid, drawn from pieces according to rules.
- **Dialog**: text in the engine's dialog language; a **style** defines how
  it looks.

## 2. A ten-minute example

The editor has a built-in example, a wanderer with a sword: 19 frames, masks,
points and four scripts. There is nothing to download.

1. Choose **Example… → Wanderer** in the top bar (it asks for confirmation,
   because the current document will be replaced). The kind `wanderer`
   appears in the tree, its first frame on the canvas in the middle, and the
   frame strip at the bottom.
2. **Frames.** Step through the strip at the bottom by clicking, or with
   PageDown and PageUp. The light blue line is the floor, the vertical one
   is the axis. Turn on **All frames** at the top: all frames are drawn
   faintly over each other, and you can see that the feet stand on one line.
   The mouse wheel over the canvas zooms.
3. **Masks.** In the Masks section on the right you can see that the frame
   has the masks `body` and `head` drawn, and the strike frames also have
   `blade`. Pick the `body` mask with its radio button, choose the **Brush**
   tool at the top and paint a pixel with the left button; the right button
   erases. Ctrl+Z undoes.
4. **Points.** With the **Points** tool, click the `hand` circle: the point
   is selected and you can drag it. The Points section on the right shows
   its coordinates and its side (in front of the body or behind it).
5. **Frames in sequence.** Press **Play** at the bottom: the frames run like
   a cartoon, each on its own base point. Press Space to stop.
6. **Scripts.** In the tree under `wanderer`, click **Scripts**. The middle
   shows the kind's scripts as text; the bottom shows the player with event buttons
   `walk`, `stop`, `strike`, `jump`. Press ▶ and send `walk`: the wanderer
   starts walking; `stop` makes it stand still. On the right is the state
   `stand`: which events it answers and where they lead.
7. **Another script.** Under **Scripts** in the tree is the list of scripts,
   grouped. Choose `walk`; the text puts the cursor on it. Click a line of
   the script and the player jumps to that step. Edit a statement (`dx 3`)
   right in the text: the change is picked up a moment later.
8. **Transitions.** The **Transitions** button at the top shows the rule
   table, a view by event, groups, a graph and a matrix: the same rules from
   different angles. In the graph, drag from one state to another to create
   a new transition.
9. **Problems.** The **Problems** node in the tree and the counter at the top
   collect all errors and warnings of the project; clicking a line takes you
   to the place.
10. **Save.** In Chrome or Edge, **Save to folder…** at the top writes the
    example into a folder you choose, and from then on it saves itself. In
    other browsers, **JSON ⭳** downloads `wanderer.json`. The document is also
    kept in the browser, but a file is safer. Your own game is a folder that
    saves itself (section 3).

Complete games are in the same **Example…** list: **Pac-Man**, **Tetris** and
**Snake**. Their folders are `examples/pacman`, `examples/tetris` and
`examples/snake` in the editor's repository. Snake also comes with its game
code, so you can build it and flash it right away (section 3, "From the
editor to the board").

## 3. Your own game: how to work

### The project folder

[workflow.md](workflow.md) covers the whole path from the editor to a board in one place: the folder, saving, the
builds, data versus code, starting a game of your own, what you need installed, and what to do when something goes
wrong. The examples that follow this path are described in [examples/README.md](examples/README.md). In short:

A game is one folder. The editor's data lives in its `game_data/` subfolder
(the engine's packer reads it); the game's code and build files sit next to
it, and the editor does not see them:

```
mygame/
  game_data/             the game's data: this is what the editor opens
    mygame.json          markup: kinds, masks, scenes, dialogs, styles, game
    HERO/                PNG frames of the kind HERO (subfolder = kind)
      stand.png
      run-1.png
    GUARD/
    HERO.anim            the kind's animation text
    GUARD.anim
    dialogs/
      intro.dlg          dialog texts
    po/
      ru.po              translations

  main/main.c            the game's code: whatever the data does not say
  main/CMakeLists.txt    board build (idf.py): makes the pack from game_data/
  main/idf_component.yml the engine, DGX-DI and what the board needs
  CMakeLists.txt         the ESP-IDF project, choice of board
  Makefile               desktop build (make): also makes the pack itself
  tools/pack.py          the engine's packer over game_data/ (the builds call it)
```

There are no fonts in the folder: the editor needs a DGX font only to
preview dialogs. You load it once in the **Fonts** node, and the browser
remembers it.

**Open folder…** opens `game_data/` (or the game folder, and then its
`game_data/`): it reads the markup, the PNG files in the kind folders, the
`.anim` files, `dialogs/` and `po/`. After that the folder **saves itself**:
a moment after each change the editor writes the markup, the PNG files (new
ones and those changed in the editor), `KIND.anim` for every kind that has an
animation (if a kind no longer has one, its old `.anim` is deleted), and
`dialogs/NAME.dlg` (deleted dialogs are deleted from the folder too). Only
what changed is written, so the build repacks only when it has to; just
looking around writes nothing. The game's code and build files are never
touched. The button with the folder's name shows the state: ✓ saved,
… writing, ⚠ not written (the tooltip says what went wrong); clicking it
writes immediately. A new project or an example is saved into a folder with
**Save to folder…**, and from that moment it saves itself as well. After you
reload the page, the editor offers the same folder again: **↻ mygame** (the
browser asks for permission).

Only Chrome and Edge can write to folders (even from a page opened as a
local file). In other browsers **Open folder…** only reads; instead of
saving, use **JSON ⭳**, and download the `.anim` and `.dlg` files from the
kinds and dialogs.

Comments in `.anim` are kept: a comment above a line or at the end of it
stays with that line through saving and through edits elsewhere. The editor
does decide the order of the text (declarations, scripts, groups, rules), so
it may rearrange the text when it writes it.

### From the editor to the board

```
editor:   Open folder… → edits (saved into mygame/game_data/ by themselves)
mygame/:  idf.py build flash        flash the board (CYD; another board: -D GAME_BOARD=…)
          make && make run          the same in a window on the computer (SDL2)
```

The build makes the pack (`main/assets/mygame.pack` and the header
`mygame_pack.h` with the numbers of kinds, scripts, events, params, tiles and
scenes) by itself whenever the saved data is newer, so you never run the
packer separately. It needs `python3` with Pillow (the system one: ESP-IDF's
Python has no Pillow, and the build finds the system Python on its own).

The model to follow is `examples/snake`: Snake on the CYD. The data holds the
pictures, the tiles (the snake is drawn with tiles chosen by the cell
modifier), a scene, a title show, a pause dialog and the PLAY actor with the
game's rules (score, length, speed, the star). `main/main.c` contains only
what the data does not say: moving cell by cell, turning, what the head ran
into. The engine does not enable the CYD's touch screen, so Snake reads it
itself (`main/cyd_touch.c`, the XPT2046 through DGX-DI): a swipe turns, a tap
to the side of the head turns that way, a long press pauses.

Pictures are indexed PNG files, one per frame, with index 0 transparent. The
editor does not change pixels except in two cases: moving an area with the
Move tool and drawing with the pencil. It writes changed pictures out as new
PNG files.

### Steps

1. **Kinds and frames.** In the tree, **Kinds +** makes a new kind; on the
   right, set its name and use **Load PNG frames…** to load all of the
   character's PNG files at once. Or use **Open folder…** for the whole
   folder. Each file becomes a frame with its base point at the bottom-left
   pixel; the canvas grows by itself.
2. **Base points.** Use the **Base point** tool and click, or use the arrow
   keys. **Show previous / next** or **All frames** at the top show the
   neighbouring frames: the feet should stand on one line.
3. **Masks.** In the **Masks** node, create masks (`body`, `blade`…); **Fill
   all** fills a mask from the opaque pixels in every frame. Then fix up
   individual frames with the brush, eraser and rectangle. **Meets** in the
   same node sets which masks meet.
4. **Attachment points.** On a frame, use **Add point**, then place it with
   the **Points** tool. The same point has the same name in every frame.
5. **Scripts.** Under the kind, open **Scripts**: **+** (or **+ script** at the
   top), then write the scripts in the text, or in the steps (**Steps**: **+
   step** and statements in the steps). Events and rules are in
   **Transitions** under the kind. Check your work with the player at the
   bottom: the event buttons show where the character will go.
6. **Tiles and scenes.** **Tilesets +**, tiles and their pieces; **Scenes +**,
   a grid, the Tile tool, characters, zones, entries, exits, links.
7. **Dialogs.** **Fonts: Load font .c…** (no text is visible without a
   font), **Styles +** or a template, **Dialogs +**, the text, and playback.
8. **The game.** The **Game** node: constants, timers, sounds, shows, chase.
9. **Checking.** **Problems**: whatever is an error here will also make the
   build fail.
10. **Building.** The game folder saves itself; run `idf.py build flash` or
    `make` in it. The same things can be done one by one: **Export .anim** on
    a kind, ⭳ on a dialog, **Download changed PNG** (and **JSON ⭳** in a
    browser that cannot write folders).

## 4. The workbench

### Top bar

| Item | What it does |
| --- | --- |
| Project name | The field on the left: the document's name, which is also the JSON file name |
| Open folder… | Opens the game folder: the JSON, the PNG files in kind folders, `.anim`, `dialogs/*.dlg`, `po/*.po`, `.c` fonts (code and build files are not read). A kind that is missing from the markup is created from its folder |
| ↻ folder | Opens the folder from last time again (the browser asks for permission) |
| ✓ folder / Save to folder… | The game folder: it saves itself after every change; ✓ … ⚠ show its state, and a click writes immediately. With no folder open, **Save to folder…** lets you choose where to save (section 3) |
| JSON ⭳ | Only in a browser that cannot write folders: downloads the markup |
| Open JSON… | Opens a markup file in place of the current one; load its pictures with Load PNG frames on a kind, or with Open folder |
| Example… | Ready-made examples: the wanderer, and complete games: Pac-Man, Tetris, Snake |
| New | A new, empty document (asks for confirmation) |
| Undo, Redo | Undo and redo any change to the document: markup, animations, scenes, styles, game tables, and drawing steps on pictures. Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z |
| Mode tools | Frames: tools and view options; animations: Scripts / Transitions / Game frames, Text / Steps, + script, + step, Import and Export .anim; scenes: scene tools, Snap, checkboxes, Scene / Map; dialogs: Styles / Dialogs, Zoom, Line / Answers, language |
| N ✖ N ⚠ | The project's errors and warnings; a click opens Problems |
| Help | Shows or hides the Help pane on the right |
| English / Русский | The editor's language; the browser remembers it |

### Project tree

| Node | What it contains | What it opens |
| --- | --- | --- |
| Kinds | The kinds. **+** makes a new one, **+ control…** makes a control from a template. Each kind shows two numbers, pictures · scripts, and a ⚠ or ✖ if it has problems | Clicking a name opens the frames (or the scripts, if there are no pictures); the current kind is expanded |
| · Frames | The kind's frames | The frame canvas, the kind and frame properties, the frame strip |
| · Scripts | The kind's scripts: everything it does (frames, movement, hits, touches, senses); below it, the list of scripts grouped by the state machine's groups; **+** makes a new one | The scripts as text (or as steps), the selected state's transitions on the right, the player at the bottom |
| · Transitions | Transitions between scripts on events | Rules, By event, Groups, Graph, Matrix |
| · Game frames | A table of frames by number (for frames given as numbers, as in PoP) | The table "number → picture, dx, dy" |
| Palettes | The file's palettes (colour sets without pictures) and the palette of the current frame's picture | The canvas, with the palettes on the right |
| Masks | All masks of the project and which of them meet (Meets) | The canvas, with the mask table on the right |
| Tilesets | Tilesets | The tileset properties (scene mode) |
| Scenes | Scenes; **Map** shows a map of all scenes. Under the selected scene: its layers with objects, grids, exits, links | The scene, its properties, the palette at the bottom |
| Dialogs, Styles | Dialog texts (+, Import…, ⭳ to download) and styles (+, + template…) | The game screen, the style properties, the text or a sample at the bottom |
| Fonts, Translations | DGX fonts for previews (Load font .c…) and translations (Load .po…); they are not part of the file and are kept in the browser | |
| Maps | The scene graph: maps (levels, shows) with their scenes, exits and rules, and where the game starts | The map's tables, the numbers of names |
| Game | Numbers, Constants, Timers, Sounds, Shows, Chase, Crops | The table of that part |
| Problems | All errors and warnings | The list; clicking a line takes you to the place |

The **filter** field at the top keeps only the names containing its text in
the tree: kinds, scripts, scenes, styles (Ctrl+F puts the cursor there). ▸ and
▾ expand and collapse nodes.

### Keys

Keys work when the text cursor is not in a field.

| Key | Where | Action |
| --- | --- | --- |
| Ctrl+Z, Ctrl+Y (Ctrl+Shift+Z) | everywhere | Undo, redo |
| Ctrl+F | everywhere | Go to the tree filter |
| Mouse wheel | frames, scenes | Zoom |
| Middle button, H | scenes | Pan the view |
| F | scenes | Fit the whole scene in the window |
| 0 | frames | Fit the whole canvas in the window |
| + −, = | frames, scenes | Zoom in, zoom out |
| O, B, E, R, P, D, F, I, M | frames | Tools: Base point, Brush, Eraser, Rectangle, Points, Pencil, Fill, Picker, Move |
| V, H, P, T, A, Z, E, L, C | scenes | Tools: Select, Pan, Picture, Tile, Actor, Zone, Entry, Link, Camera |
| Arrows | frames | Move the base point; with Points, the selected point; with Move, the selection |
| Arrows, Shift+arrows | scenes | Move the selected object by 1 or 8 |
| PageUp / PageDown, `,` / `.` | frames | Previous and next frame |
| Space | frames, animations | Play and pause (frames in sequence, the player) |
| ← → (`,` `.`), Home | animations | One frame back or forward, back to the start of the script |
| Delete, Ctrl+D | scenes | Delete the selection, duplicate an object |
| Esc | frames, scenes | Clear the selection, cancel a link in progress |

## 5. A kind's frames

Frame mode: **Frames** under a kind in the tree, or click the kind's name.
The middle shows the current frame's canvas, the right shows the kind and
frame properties, and the bottom shows the frame strip with the "frames in
sequence" window.

### What the canvas shows

- Each grid cell is one pixel of the frame. The grid appears at zoom 4 and
  above.
- A light blue band runs along the base point's row and column; a blue line
  runs along the bottom edge of the base row (the floor) and through the
  middle of the base column (the mirror axis); a blue square marks the base
  point pixel itself.
- Masks are drawn as a semi-transparent fill in their colour with an
  outline. The current mask (the one being drawn) is brighter, with a thick
  outline.
- Attachment points are circles with a cross and a label; the selected one
  is pink; a point "behind the body" has a dashed circle.
- Neighbouring frames (Show previous / next: previous ones reddish, next ones
  bluish) or all frames of the kind (All frames) are drawn faintly under the
  current one.
- The wheel zooms; the 0 key fits the whole canvas in the window.

### Tools and view

| Tool | Key | Left button | Right button | Arrows |
| --- | --- | --- | --- | --- |
| Base point | O | The pixel under the cursor becomes the base point | Same | Move the base point |
| Brush | B | Paints the current mask | Erases it | Move the base point |
| Eraser | E | Erases the current mask | Paints it | Move the base point |
| Rectangle | R | Drag a rectangle; on release it is filled in the current mask | Erases the rectangle | Move the base point |
| Points | P | On a point: select it and drag it; elsewhere: move the selected point there; with no point selected: create a new one | Same | Move the selected point, or the base point if none is selected |
| Pencil | D | Draws pixels of the picture itself in a palette colour | Draws transparent pixels | Move the base point |
| Fill | F | Fills an area of one colour in the picture | Fills with transparent | Move the base point |
| Picker | I | The pixel's colour becomes the pencil colour | Same | |
| Move | M | Drag a selection rectangle; inside a selection, drag the selection | Same | Move the selection |

| View option | What it does |
| --- | --- |
| − N× + Fit | Zoom: how many screen pixels per frame pixel; Fit puts the whole canvas in the window |
| Show previous, next, frames | Draws the frames before the current one (reddish) and/or after it (bluish) faintly under it, aligned by the base point; the number says how many on each side. Off by default |
| All frames | Draws all frames of the kind under the current one: if the base points are right, the feet of all frames match |
| Picture, Masks, Points | Show the picture, the masks, the attachment points. Each mask also has its own visibility checkbox in its row |

### Kind properties (Kind)

| Field | Meaning |
| --- | --- |
| name | The kind's name. Together with the file name it makes the picture's name in the pack: `KID_401`. × deletes the kind with all its frames and animations |
| Load PNG frames… | Loads frames; you can pick many files at once. Files with known names supply pictures for frames already marked up; new names become new frames. If a picture's size does not match the markup, you get a warning |
| default mask | What counts as the mask of a frame with no masks drawn: all its opaque pixels. "none" means such a frame collides with nothing (scenery) |
| preview in | Shows the kind's pictures in one of the file's palettes (a guard in the colours of a level). Preview only |
| faces left | The pictures face left (as in PoP): "forward" is to the left; the player shows them that way |
| canvas | The canvas: left and top (the top-left corner relative to the base point), width, height. It grows by itself when a frame does not fit; Fit makes it exactly as big as the frames need. It never gets smaller than the frames need |
| new frame | An empty transparent frame of the given size, in the current frame's palette, for drawing a picture with the pencil |

### Frame properties (Frame)

| Field | Meaning |
| --- | --- |
| < N / M: file > | Neighbouring frames; × removes the frame from the markup (the PNG file is not touched) |
| base point x, y | The base point in picture pixels, from its top-left corner |
| pack name | A custom name for the picture in the pack instead of KIND_FILE (for example, `DAGGER`) |
| picture changed · Download PNG | The picture was changed (Move, pencil) and is not saved anywhere yet: download it |
| selection | The area selected with the Move tool: size, position, offset; Drop releases it (Esc) |

### Base point

- With the Base point tool, clicking a cell makes it the base point.
- The arrow keys move the base point across the picture one pixel at a time.
  The grid is tied to the base point, so on screen **the picture moves the
  opposite way**: ↑ moves the base point up the picture, so the picture moves
  down and the feet sink below the baseline; ↓ raises the picture. If the
  feet float above the floor, press ↑; if they sink into it, press ↓.
- The masks and attachment points stay where they are on the picture.
- The base point may also lie outside the picture.

### Masks in a frame

The **Masks** section of the frame properties lists all masks of the project
and their state in this frame:

| Item | What it does |
| --- | --- |
| Radio button | The brush, eraser and rectangle draw this mask |
| Checkbox | Whether to show the mask |
| State | `N px`: drawn, with this many pixels (`0 px` means empty); `none`: not drawn; `default`: the default mask applies |
| Fill | Makes the frame's mask equal to the opaque pixels of the picture. Disabled when there is no picture |
| Clear | The mask exists in the frame but is empty: in this frame the zone collides with nothing |
| None | The frame has no such mask at all. If no masks are left in the frame, the default mask applies again |

The default mask applies only while the frame has no masks at all. If you
take the brush to such a frame right away, you get a mask made only of the
pixels you painted, and the default mask is gone. So use Fill first (or Fill
all in the Masks node), then the brush. A mask can be painted anywhere within
the canvas, outside the picture too; outside the canvas the brush paints
nothing.

### Attachment points

- **Add point**: type a name (names already used in the kind are suggested)
  and press the button or Enter. The point appears at the base point, gets
  selected, and the Points tool turns on: click where it should go.
- In the points table: the radio button selects, the name renames, x and y
  are relative to the base point, the **front / behind** list says whether
  what is attached (a sword) is drawn in front of the character or behind
  it, separately in each frame; × deletes.
- The selected point is remembered by name: on the next frame, the point with
  the same name is selected. A new point takes its side from the point of the
  same name in a neighbouring frame.

### Drawing pictures

- **Pencil** (D) draws pixels of the picture itself in a palette colour (left
  button) or transparent (right button); **Fill** (F) fills an area of one
  colour; **Picker** (I) makes a pixel's colour the pencil colour. Ctrl+Z
  undoes a step.
- **Palette** in the frame properties shows the picture's colours: click one
  to draw with it; the selected colour can be edited (the "in all frames"
  checkbox applies the edit to all pictures of the kind); **+ color** adds a
  colour (the PNG bit depth grows by itself: 1, 2, 4, 8 bits).
- **New frame** creates an empty transparent frame of a given size.
- With a folder open, changed pictures are written into it by themselves,
  like everything else. Without a folder they are kept in the browser until
  you download them with **Download changed PNG** on the kind or **Download
  PNG** on the frame; put the files in place of the old ones. A frame with a
  changed picture is marked ✎ in the strip. If you load a file of the same
  name with different pixels, the changed picture is not replaced, and you
  get a warning.

### Moving an area (Move)

When part of a picture is in the wrong place (say, a frame's feet are one
pixel off):

1. Take the Move tool (M) and drag a rectangle over that part of the frame.
2. Drag the selection with the mouse by grabbing inside the frame, or move it
   with the arrow keys. The pixels of all the frame's masks inside the
   rectangle move along with the picture's pixels. Attachment points do not
   move.
3. Transparent pixels of the selection do not overwrite what they land on.
4. Esc or Drop releases the selection. Until then, the cut-out part is kept
   whole; the picture size does not change, and whatever ends up outside its
   edge is cropped.

### The frame strip and frames in sequence

The bottom strip shows the kind's frames in a row: the file name, the
picture with its base point pixel in blue, and the marks `m2` (number of
masks), `p1` (number of points) and ✎ (picture changed). A pink border marks
the current frame; a red dashed border means the frame has no picture
loaded. Click to select a frame.

To the right is the **frames in sequence** window: the kind's frames one
after another, each standing on its own base point. It is a quick check that
the frames line up.

| Item | What it does |
| --- | --- |
| Play / Stop, Space | Start or stop. Starts from the current frame if it is in the range |
| Frames | The numbers of the first and last frame. ⇤ and ⇥ take the current frame's number, all takes every frame |
| FPS, Zoom | Frames per second, the window's zoom |
| Mirror | Mirrored around the base column, as a character facing the other way |
| Masks | Shows the drawn masks |

The frames play in the strip's order, which is the order of the file names.
Real animations, with frame timing, moves and transitions, are made in
scripts (**Scripts** under the kind).

## 6. Masks and meets (the Masks node)

A table of all masks in the project; the definitions are shared by all kinds.

| Item | What it does |
| --- | --- |
| + | A new mask with the lowest free index (which may be 0). There can be at most 16 masks |
| Radio button, checkbox | Draw this mask; show it |
| Index | The zone number the game sees. Changing it changes it in every frame of every kind |
| Name, colour | The name becomes the constant `MASK_NAME` in the pack (letters and digits, everything else turns into "_", in capitals); the Meets text refers to masks by name. The colour is for the screen only |
| in frame | The mask's state in the current frame, as in the frame properties |
| Fill all | Fills the mask from the opaque pixels in every frame of the kind that does not have this mask yet. Frames where it is already drawn are left alone |
| × | Deletes the mask from every frame of every kind (asks for confirmation) |

**Meets** says which masks meet, that is, are tested against each other for
overlap. Every body has an owner and a side: **own** covers pairs of masks
of bodies on the same side (a sword in a hand and the one holding it, a
thrown stone and the thrower), **foreign** covers bodies on different sides
(enemies). Parts of one whole (a hand and the sword in it) never meet. A
checkbox where row `a` crosses column `b` means masks `a` and `b` are
tested; the grid is symmetric.

Below the grids is the same choice as text, the way the packer reads it: a
line `own|foreign mask mask`, where a mask is a name or an index, and `#`
starts a comment. While there is no text, the engine's defaults apply (own:
nothing, foreign: every pair), and the checkboxes are pale; the first click
writes the defaults as text and changes one pair. **Defaults** removes the
text. An empty text means nothing meets. Renaming a mask, changing its index
or deleting it updates the text automatically.

## 7. Palettes (the Palettes node)

- **Palette**: the colours of the current frame's picture, as in the frame
  properties.
- **Palettes**: the file's palettes, colour sets without pictures (the
  game's EGA colours, the guard's seven palettes, one per level). **+** makes
  a new two-colour palette, **+ from picture** makes one from the current
  picture's colours. Click a colour to edit it; the name is edited in its
  field (tile piece colours that name the palette follow the rename); + and −
  add a colour and remove the last one; × deletes the palette. In scenes, a
  tile piece's colour picks a palette next to the colour number; a kind can be
  previewed in a palette (**preview in** on the kind).

## 8. Controls

A control in a dialog or a settings page (a button, a toggle, a cycle, a
slider) is an ordinary kind: frames for its states and an animation in which
the scripts are the states and the rules answer the interface events
`focus`, `blur`, `activate`, `more`, `less`. What a control changes is its
param `value` (the game is told about every change) or a signal.

**+ control…** on Kinds creates a kind from a template, with simple pictures
for the states (redraw them: Download changed PNG, edit them in your own
picture editor, then Load PNG frames back) and an animation:

| Template | What it does | Scripts |
| --- | --- | --- |
| button | `activate` presses it and sends `signal 1` to the game | normal, focused, pressed |
| toggle | `value` 0/1: `activate`, `more` and `less` flip it; range `least 0, most 1, step 1` | normal, focused, flip, flip_focused |
| cycle | `value` is one of `COUNT`, going round: `activate`/`more` take the next one, `less` the previous one; no range | normal, focused, forward(_focused), backward(_focused) |
| slider | `value` from 0 to `MAX`: `more` adds 1, `less` subtracts 1; range `least 0, most MAX, step 1` | normal, focused, up(_focused), down(_focused) |

**A control's range**: if the params `least`, `most` and
`step` are declared right after `value`, in exactly this order, as params 1,
2 and 3 (they are not called `min` and `max` because those are words of the
expression language), with `most > least` and `step > 0`, then the dialog
puts a slider over the control's picture (or a switch, when
`most − least ≤ step`). A touch sets the value, and the control is driven to
it by its own `more`/`less` events (a switch clicks with its `activate`). A
kind without these params works by events only. If the params are out of
place or the range is empty, the checks warn. The editor's player has no
touch slider; it uses the less/more buttons as before.

Script 0 (`normal`) shows the picture for the value
(`frame (TOGGLE_N0 + value) 1000ms`) and changes nothing. Each time, the
dialog starts the control in script 0 with its value, sends it the event and
reads the value right away. That is why an event leads from `normal` to a
script that changes the value before any frame and then goes back with
`goto`. Test it with the player (the event buttons) or in a dialog (answers
with controls).

## 9. A kind's animation

Script mode: **Scripts** under a kind in the tree. The kind's scripts are
listed under it, grouped by the state machine's groups. The middle shows the
scripts (as text or as steps), the transitions, or the game frames table
(buttons at the top); the right shows the kind's header and the selected
state with its transitions; the bottom shows the player.

### Concepts

- A **script** is a sequence of statements: show a frame for some time
  (`frame`), move the character forward or down (`dx`, `dy`), turn around
  (`flip`), set params (`set`, `add`), speed and acceleration, signals to the
  game, sounds, active masks, jumps (`goto`), stopping on the last frame
  (`hold`). A script is a **state** of the character: "standing", "walking",
  "jumping".
- A **step** is the statements up to and including a frame: when the previous
  frame's time is up, the statements run and the frame is shown.
- A **param** is a number every character keeps for itself: lives, "what it
  is doing" (`action`). A **define** is a named constant for expressions.
- A **label** (`label`) is a place inside a script that `goto` can jump to.
- **Forward** is the direction the unflipped picture faces. `dx`, and speed
  and acceleration along x, point forward.
- A script that reaches its last line **continues into the next one** in the
  list. Usually that is a mistake: a script should end with `goto` or
  `hold`. The editor flags it (⚠) and offers the buttons "+ hold" and
  "+ goto". The checkboxes **entry** (the game starts this script itself) and
  **through** (it continues into the next one on purpose) silence the
  warnings.
- An **event** is something the game sends a character: "run", "stop",
  "strike". Events are shared by the whole pack: the game's timers and shows
  name them too.
- A **transition** is what an event does in a state: where to go and when:
  `now` means immediately; `branch` means at the script's next `branch`
  point; `end` means where the script itself would move on or stop.
- A **group** is a label for a set of states ("in the air", "on the
  ground"), an explicit list of scripts. A rule for a group gives the
  transition to all of its scripts.
- **Rules** only fill in the table "state × event". They have no order and no
  priorities, and there is no "all scripts". Two rules that give different
  answers for the same cell are a **conflict**: the editor shows both sides
  and refuses to export until it is resolved.

### At the top

| Item | What it does |
| --- | --- |
| Scripts | The kind's scripts in the middle |
| Text / Steps | The scripts as `.anim` text, or as step cards |
| Transitions | Transitions: Rules, By event, Groups, Graph, Matrix |
| Game frames | The table of frames by number |
| name, + script | A new script with this name after the selected one (empty means `script`) |
| + step | A new step with a frame after the selected step |
| Import .anim… | An `.anim` text replaces the kind's animation (asks for confirmation). Pictures are found by their pack name `KIND_FILE`; other names stay as pack names, numbers stay numbers. Comments are kept |
| Export .anim ⭳ | Downloads `KIND.anim`. The engine's assembler produces the same bytecode from it as from the imported text. It is not downloaded while there are errors |

### On the right: the kind's header and the state

- **Defines**: named constants (`gravity = 3 * 12 * 12`,
  `tick = 1000 / 12`); their names can be used in place of numbers. Renaming
  one updates the expressions that use it, an empty name deletes it, and ‹ ›
  change the order.
- **Tables**: tables of constants, rows of whole numbers (16 bits) read by
  index in expressions: `chance[skill]`; outside the table the value is 0. A
  table must be declared before it is read.
- **Game**: questions to the game, by name. In expressions, `game.name` is the
  game's answer at the moment of the step (the game's function
  `dgx_ge_expr_ask`; without it, 0). They are numbered in order; in the pack
  header they become `PREFIX_KIND_GAME_NAME`.
- **Params**: the character's params, a name and a starting value. Renaming
  one updates the `set`/`add` statements, an empty name deletes it, and ‹ ›
  change the order (which gives the numbers the game uses). The engine keeps
  4 params per character; with more, the editor warns.
- **Pockets, Stack**: how many places for things the character has, and how
  many things of this kind fit in one place of someone else's pocket.
- **State**: the selected script as a state, with **all events** listed. If
  the state answers an event, the row says where and when, and who set it:
  "itself" (a rule of the script itself) or "group …" (click to go to the
  group); you can change where and when right here, and × removes the
  transition. If it does not answer, a yellow row says "does nothing", and
  "+ to…" adds a transition. A conflict is a red row with both sides and
  buttons to remove one of the rules. Above are the state's groups: × takes
  the state out of a group; "+ group" first shows what joining would give and
  whether it causes conflicts, and only Join actually joins. Below is where
  the state goes by itself (`goto`, continuing into the next script, `hold`)
  and what leads into it.

### Scripts: the text

The kind's scripts can be shown in two ways, switched with **Text | Steps**
at the top. The main one is **Text**: the kind's whole animation as `.anim`
text, the way the engine reads it and the way it lies in the game folder
(`KIND.anim`).

- Language words, picture and constant names, numbers and comments each have
  their own colour. **Ctrl+Space** suggests names (events, params, scripts,
  labels, the kind's pictures, the pack's constants and masks); suggestions
  also pop up by themselves as you type a name. **Ctrl+/** comments out a
  line.
- The text is read a moment after each edit. Once it reads cleanly, it *is*
  the kind's animation: the player, the transitions and the problems see it
  at once, and it is written to the folder. If it does not read (a typo),
  the animation stays as it was, the top says what is wrong, and the faulty
  line is marked ✖.
- Checks (what the assembler would refuse, and likely slips) are marked at
  their lines: ✖ for an error, ⚠ for a warning; hover over the mark to read
  the message.
- **Comments** (`# …` above a line or at the end of it) stay with their line:
  neither saving nor edits in other views lose them.
- The cursor's line is where the player at the bottom stands: the script and
  the step. A script selected in the tree or in Problems is scrolled to the
  top of the text.
- The editor sets the order of the text: declarations, scripts, groups,
  rules. When you leave the text, it is tidied up the way it will be written
  to the file.

### Scripts: the steps (Steps)

- Above the strip: the script's name (renaming it updates `goto`, rules and
  groups), ↑ ↓ for its place in the list (which matters: it is the number in
  the bytecode and decides which script comes next), × to delete, + step, and
  the entry and through checkboxes.
- In a step card:
  - the statements before the frame, as fields holding `.anim` text
    (`dx 3`, `goto runcycle`). Hover to see what a statement does. Edits are
    checked the way the assembler checks them; an empty field deletes the
    statement; `+ statement` adds one. Expressions can stand in place of
    numbers: `dx tick / 10`, `velocity 40, -power + 10`, `set hp hp - 1`;
    `path x: 40*t, y: 3*sin(t*6)` moves the character along a formula of the
    time `t` in seconds; `hit 2 on 1 damage 1 event hurt` strikes with mask
    2 at mask 1 of whoever it meets;
  - the frame: a picture from the kind's frames, "number…" (a number the
    game draws by), "pack name…" (the name of a pack picture the kind does
    not have), or none (show nothing); **time** is the duration in ms;
    **shift x, y** is the picture's offset from the character (`at` in the
    `.anim` text), empty means 0;
  - ← → move the step, ⧉ duplicates it, × deletes it.
- The last card, "end", holds the statements after the last frame (`goto`,
  `hold`).
- Clicking a step puts the player on it.

### Transitions: every view of the transitions

- **Rules**: the list of events (add one; rename one, and the rules follow;
  delete one by emptying its name; reorder them, since the order of events is
  the order of the matrix columns in the bytecode) and all the rules as a
  list: "on event, from a state or group, to a state, when". It can be
  filtered by event and by source.
- **By event**: the selected event: from which states it leads where, grouped
  by target, and in which states it does nothing.
- **Groups**: the groups with their script lists and rules: rename, delete,
  add or remove a script ("+ state" also first shows what it would give),
  edit a group's rules and add new ones. Naming a script twice in a group is
  an error.
- **Graph**: the selected state in the centre; on the right, where it leads
  (by itself or through its groups); on the left, where it is entered from;
  "neighbours 2" adds the neighbours' neighbours; **Group** shows the states
  of a group. "groups as nodes" draws a group's rule as one arrow from the
  group's node; "gotos" draws the scripts' own jumps as dashed lines. A click
  puts a state in the centre, a double click opens it. **Drag** from one node
  to another to get the form for a new transition.
- **Matrix**: an overview of "state × event", filtered by group and by name.
  A cell shows the target (⑂ for `branch`, ⏹ for `end`), a dot means empty,
  red means a conflict. **Hide group** blanks the cells that come from that
  group alone (for example, `any` across all states of PoP), so that the
  special transitions stand out. Clicking a cell opens the state.

### Game frames: frames by number

A table "number → picture, dx, dy": this is how the player shows `frame N`
when frames are the game's numbers (in PoP, the frame table lives in the
game's code). **+ number** adds the next number, **By order** makes number N
frame N of the kind, **Import…** reads lines "N picture dx dy". An empty row
is a number deliberately left without a picture; a number beyond the table
gives a warning. Without a table, the player's **Numbers are frames**
checkbox shows number N as the kind's Nth frame.

### The player (at the bottom)

The character walks along the floor line with all its moves, turns and
transitions, so you can test the state machine without the game. Any edit to
the animation restarts the preview.

| Item | What it does |
| --- | --- |
| From | The script to start from |
| ⏮ ◀ ▶ ⏸ ▶\| | Back to the start, one frame back, play and pause, one frame forward (Home, ←, Space, →) |
| Speed | ×¼ … ×2 |
| Zoom, Onion | Zoom; faint frames under the character: 1…3 shows that many next frames (where the character goes by itself, without events), −1 the previous one, 0 none |
| Follow | The view follows the character; without it, the character walks out of view |
| Look left | The pictures face left: "forward" is to the left (a kind with faces left does this without the checkbox) |
| Numbers are frames | Shows frame number N as the kind's Nth frame when there is no Game frames table |
| pockets, amount | What the character has in its pockets ("DAGGER 3, SWORD 1") and how many things it holds itself: `count()` reads the pockets, `draw` takes a thing in hand, `stow` puts it back |
| game | Only for a kind that asks the game questions: the game's answers for the preview ("fuel 3"); unnamed ones are 0, as in the engine without the game's function |
| Masks | The frame's masks; after a `masks` statement, only the active ones |
| Events | Event buttons to the right of the scene: green ones are those the current state answers. A click sends the event |

Above the buttons is where the character is: state, step, frame,
coordinates, params, active masks, hits, what it is holding, a pending
transition, and a log (signals, sounds, `goto`). Drag the top edge of the
strip to change its height.

## 10. Scenes

Scene mode: **Scenes** in the tree (click a scene) or **Tilesets**. At the
top are the tools, zoom, snapping (**Snap**), what to show, **Camera 0,0**,
and the **Scene / Map** switch. Under the selected scene, the tree shows its
layers (the checkbox is visibility, the lock prevents editing, ↑↓ change the
order; the active layer, where new objects go, is in bold, and its objects
are listed under it), grids, exits and links. The middle shows the scene:
the wheel zooms around the cursor, the middle button (or Pan, or Shift and
dragging over empty space) pans, F fits the whole scene. The right shows the
properties of the selection: the scene, a layer, an object, a grid, a cell, a
tileset, a tile, an exit, a link. The bottom holds the palette: **Pictures**
(the kinds' frames), **Tiles** (the tiles of a tileset), **Actors** (kinds
with animations).

| Tool | Key | What it does |
| --- | --- | --- |
| Select | V | Click an object to select it, drag to move it; click a cell to select the cell; Delete deletes, arrows move (Shift: by 8), Ctrl+D duplicates |
| Pan | H | Pans the view |
| Picture | P | Places the picture selected in the palette, by its base point, where you click |
| Tile | T | Paints grid cells with the selected tile; the right button erases |
| Actor | A | Places a character of the kind selected in the palette |
| Zone | Z | Drag out a zone rectangle |
| Entry | E | Places an entry point |
| Link | L | A link: click the first end (a named object or a cell), then the second |
| Camera | C | Drag the screen frame: layers with a different factor shift, so you can see the parallax; "Camera 0,0" puts it back |

**How to work.** Scenes "+", then the scene properties (size; "= screen"
makes a room). Tilesets: Tilesets "+", the cell size, "+ tile" (if a
picture is selected in the palette, the tile gets it as its first piece);
a tile has pieces, solid sides and a `kind`. A piece has a picture: a single
one, **by mod** (chosen by the cell's modifier) or **cycle** (cycling over
time; the **Cycles** checkbox at the top animates them in the scene); an
offset `dx`, `dy`, a number or an expression of `mod`; a layer; a `variant`;
and a 3×3 grid of **neighbours**: the eight fields around the tile's name
say what each neighbour must be for the piece to be drawn (`empty`, a tile
name, several names separated by commas, `solid_top`…, `not …`; empty means
anything). A piece also has **with**, which places it together with the
neighbouring cell (the right edge of a floor: `right` and `dx` = the cell
width); **step**, its turn among the cell's pieces; and **draw**: normally,
as a card, or as a silhouette in the **color** from the tileset's palette or
a file palette. In by mod, a modifier can be set to "— none": no piece for
that modifier. The **pick** mode is the same, except the picture number is an
expression; **fill** draws no picture, just a rectangle of colour. **when**
is a condition expression: the piece is drawn only where it is not 0
(`mod > 0 and variant == 0`).

A tile's **Bodies** say what is solid in the cell. "+ body" adds a rectangle
covering the whole cell; then set `dx`, `dy` (the offset of the bottom-left
corner), `w` (to the right) and `h` (upwards), as numbers or expressions (a
gate: `h` = `63 - q`); **when**: the body exists only where the expression is
not 0; **for**: which masks the body stops, as numbers 0..15 or names of the
file's masks separated by spaces (empty means all). When the engine queries
the grid with a mask, it sees only the bodies that stop that mask, so one
tile can hold bodies following the game's rules for people next to bodies
matching the drawing for items. While a tile has no bodies, its solid sides
stop movement; once it has bodies, the solid sides only matter to neighbours
(`around`) and to visibility. Bodies are shown as red frames in the scene
(the **Bodies** checkbox at the top; the **for …** choice next to it keeps
only the bodies that stop that mask; a body that is not for every mask is
dashed) and in the tile's thumbnail. **Opening** is the tile's opening: a
rectangle like a body (dx, dy, w, h, when), but not solid: a character who
went inside (up the stairs of an exit) is visible through it; "+ opening",
shown as a blue frame. A tileset's **Fields** are names for bits of the
cell's variant (32 bits) and modifier (8 bits); they, `mod` and `variant` can
be used in the expressions of `dx`, `dy`, `pick` and `color`.

A cell's modifier and variant are in the cell properties (Select, click a
cell). A grid: Grids "+", then the Tile tool. Pictures, characters, zones and
entries are placed with their tools. Exits: Exits "+", then on the right an
edge or a zone, the target scene and the target entry. **Map** is a map of
all scenes with arrows for exits; scenes joined by edges sit next to each
other. **Parallax:** a layer with factor 256 moves with the screen, 128 moves
half as fast (the distance), 0 stays put (the sky).

Pictures and characters come from kinds, so load their PNG files first. The
format is in the "Scenes" section of [sprite-format.md](sprite-format.md).

### The scene graph: exits, entries, links

The engine knows where you can go from a scene through the scene graph
(`dgx_ge_graph.h`). Its fields are split between the scenes and the **Maps**
node:

- **An edge exit** is a scene exit with an `edge`: the neighbouring scene,
  entered the way you were going; it has no name and no entry.
- **A named exit** is an exit without an edge: a `name` (a door, a stairway;
  the constant `WORLD_EXIT_NAME`), a scene, its entry (required) and a
  **transition**: cut (immediately), fade (through black), wipe (with a
  curtain), seamless (immediately and keeping the motion: the arriving
  character is not restarted). The zone is only a hint of where the exit is:
  the game takes the exit by name.
- **An entry** is an Entry object: a place and a facing direction;
  **arrive** is the event sent to whoever arrives (falling, coming out of a
  door); **fires** says whose links to fire on arrival (you came back to a
  checkpoint, and the floor there has already collapsed): a link source from
  the map's scenes.
- **A link** (Link): a source (a pressure plate, a lever) fires its links.
  Each one tells the life of its target cell an **event** (empty means the
  one the source sends: opener sends open, closer sends shut) and puts the
  number **value** into its param.
- The scene properties have a **Graph** section: **map** is the scene's map,
  **index** its number in the map (a game constant), **kind** is room or
  show, **on enter** is the event sent to the map's rules on entering, and
  **leave** gives the events sent to the map's rules when leaving the scene
  by each side (falling off the bottom where there is no room; a side with an
  event and no scene next to it is an exit from the map).

## 10a. Maps (the Maps node)

A **map** is a cloud of scenes with shared data: a level (its data is a game
blob, for example `LEVEL_1`) or a show (its data is a show from Game → Shows,
and its scenes are of kind show). At the top of the page are the graph's name
(the prefix of its constants) and **start**: the scene and entry where the
game begins. A map has:

| Field | Meaning |
| --- | --- |
| data | The name of the map's data blob; empty means none |
| number | The number the game calls the map by (the "Level N" line); 0 means none |
| rules | The map's rules: a kind (an animation) whose actor lives while the game is on this map. Its events are the map's events (death, end); its script says which of the map's exits to take: `signal N`, where N is the number of the exit's name in the Names table |
| Scenes | The map's scenes: **+ scene…** adds a scene that is not on any map; index, kind, on enter; a summary of exits by side and by name; × removes the scene from the map (the scene itself stays) |
| Exits of the map | Exits of the whole map: end of level, death, time is up: name, scene, entry, transition. The map's rules take them |
| Names | The numbers of exit and entry names as the packer assigns them: in order of first appearance (maps in order; within a map, scenes in order: entries, then named exits; then the map's exits) |

The map's problems are shown below the tables and in Problems: a scene not on
any map is a warning; a named exit without an entry, a repeated number, or
an event that no kind has are errors.

## 11. Dialogs and styles

Dialog mode: **Dialogs** in the tree (click a dialog) or **Styles** (click a
style). At the top are the **Styles / Dialogs** switch, **Zoom**, the screen
size (as in scenes), **Line / Answers** for styles and **language** for
dialogs. The middle shows the game screen; the right shows the fields of the
style being previewed; the bottom shows a sample (for a style) or the text
and playback (for a dialog).

### Styles

A **style** is how a conversation looks: the frame (`fill`, `picture` (a
picture made of nine pieces), `none`), the place on the screen (`place`: an x
or y below zero counts from the right or bottom edge; a width or height of 0
or less means the screen minus that much), the text margin (`padding`), a DGX
font by name, the scales (the largest one at which the text fits, but not
below the smallest), the default importance, the scroll and wait times, how
the text appears (`now`, or `letters` one letter at a time, `letterMs`), the
portrait (`left`, `right`, `portraitWidth`), the pen of the handwritten font
(`hard`, `soft`), alignment, the speaker's name (`showName`), the border
width, and the colours (fill, border, text, bar, name).

- **Fonts: Load font .c…** loads DGX fonts from C sources (font2c writes
  them; DGX ships several: TerminusTTFMedium12, ArialRegular12…) and the
  handwritten font (`font0ss.c`: the style's scale is the line height in
  pixels, the pen is hard or soft). Without a font no text is visible; fonts
  are not part of the markup file and are kept in the browser.
- **Styles +** makes a style with the engine's default values; **+
  template…** makes one from a ready-made style (speech, notice, menu,
  subtitle, note: a note in a scroll frame).
- Drag the frame in the preview with the mouse; drag its right and bottom
  edges to resize it. Positions counted from the right or bottom edge stay
  that way. The yellow dashed line is the text area.
- At the bottom is a sample: **Line** is a line of speech (the `important`
  checkbox; **▶ play** and `t` show the line over time: appearing letter by
  letter, then scrolling; **all** shows all of it, like the player's button);
  **Answers** shows the answers, one per line, and the chosen one (`chosen`);
  a line `Sound | TOGGLE 1` is an answer with a TOGGLE control set to 1 (its
  picture at the right of the line), and the **less / activate / more**
  buttons send the event to the control and change its value, as a dialog
  does. The **name** and **face** fields give a sample name and portrait.
- The text is laid out exactly as the engine does it: word wrapping, the
  largest scale that fits; an important line that does not fit scrolls, an
  unimportant one is cut with "...". The status bar shows the result: the
  scale, the number of lines, whether it is cut or scrolling.

### Dialogs

- **Dialogs +** makes a blank dialog, **Import…** loads `.dlg` files, and ⭳
  on a dialog downloads `dialogs/NAME.dlg` for the packer. The text checks
  (as the assembler does them; a kind or picture that is not in this file is
  a warning) appear in Problems.
- **Translations: Load .po…** loads translations (`ru.po`); **language** at
  the top chooses the language to play in (msgid means as written). Plural
  forms follow the `Plural-Forms` rule.
- The bottom holds the dialog's text (edited live; the name comes from the
  `dialog NAME` line) and playback in its styles: **▶ start** starts from the
  beginning; **next** is the player's button (moves to the next line, or
  shows an appearing line in full; in a choice, picks the answer; on a
  control, sends `activate`; on a game field, asks for its text, where Cancel
  leaves it as it was, and then the answer goes to its label); **▲ ▼** choose
  an answer; **less / more** go to the control of the chosen answer; **time
  out** means no answer within the choice time. The roles' params and
  pockets (initial values come from their kinds' animations) change as the
  dialog goes on (`give`, controls); `tell` is written to the log. If the
  dialog's header has a `pause` line (as the settings menu does), **⏸ pauses
  the game** is shown above the params: in the game, the world stands still
  while the dialog is open.
- The right shows the style the dialog is in, and you can edit it while it
  plays.

## 12. The game as a whole (the Game node)

What the game adds to the pack besides kinds, scenes and dialogs. The packer
takes it through the calls `add_game`, `add_timer`, `add_sound`, `add_show`
and `add_chase`; the editor stores it in optional JSON fields and checks it
the way the packer does. Times are written as in the engine: `500ms`, `2s`.
Events may come from any kind in the project: they are the pack's events.

| Part | What it holds |
| --- | --- |
| Numbers | The game's numbers (the `game` field): how many kinds, lives, world records… They are in the pack; each name becomes `PREFIX_GAME_NAME` in the header, in this order (↑↓) |
| Constants | The pack's constants (the `constants` field): names for numbers that scripts and dialog answer conditions use instead of the numbers themselves: `frame A TICK_MS ms`, `signal CLOCK_OUT`, `if board & BOARD_PAD`. The packer turns them into numbers; they do not go into the pack. Renaming one renames it in the scripts too; a `define` with the same name is an error |
| Timers | Timers: **once** fires once after the given time; **every** fires every so often; **every, until** does so up to a limit. **reset** says when it stops by itself: never, scene (leaving the scene), map (leaving the map). **event** is what to send the owner. **game** means it runs from the start of the game (a clock). In scripts, `timer(NAME)` reads its milliseconds, and `timer start|stop|hold|go NAME` controls it |
| Sounds | Sound names; the number is the position in the list (`sound N` in scripts). There is no sound data yet |
| Shows | A show is a scene that plays by itself: a title screen, a story, credits. **Pictures** are the background pictures (pack name, position by the base point, layer, mirroring, colour for 1-bit pictures). **Actors** are the roles: a kind, the script it starts with, a position. **Cues** are timed cues: at a given moment, a role gets an event; the role **end** marks the end of the show (required) |
| Chase | A kind chasing the hero from scene to scene: **sense** is how it senses (sight, hearing, always, none), **sides** are the sides it can go through, **hearing** is how close it hears, **near** is how close to a side it must be to go through it (empty: anywhere; below zero: beyond it), **steps** is how many scenes from home it may go (0: no limit), **calm** is how long out of its senses before it calms down |
| Crops | Crops: part of a frame's picture made into a pack picture of its own with the same colour set, such as a portrait cut from a frame (the face of a dialog role): kind, frame, x, y, width, height from the top-left corner, and the crop's base point |

Each part's errors are shown below its table and in Problems.

## 13. Saving, checks, undo

- **The game folder saves itself** (section 3); **Save to folder…** picks the
  folder for a new project or an example. **Open JSON…** loads a markup file
  in place of the current one: if the frames' pictures are already loaded,
  they are picked up; otherwise the frames get red outlines and Problems says
  "N frames have no picture": load the PNG files, and the frames find them
  by name.
- **Autosave.** Half a second after each change, the markup and the view
  settings are saved in the browser (`localStorage`) and restored the next
  time you open the editor. Pictures are not stored there (except changed
  ones that are not saved yet), so after reloading the page, load the PNG
  files again (or use Open folder). This storage belongs to one browser on
  one machine; it does not replace a file.
- **Undo / Redo** cover any change to the document, up to 40 steps back;
  drawing steps on pictures are in the same queue. The buttons' tooltips show
  what will be undone.
- **Problems** gathers every check in the project: each kind's animation
  (what the assembler will not accept: `goto` to nowhere, missing scripts,
  groups or events, numbers out of range, conflicts, duplicate picture names;
  and likely slips: a script continuing into the next one, a script with no
  frames, a state that no rule or `goto` leads to, an event that does nothing
  anywhere), scenes and tiles, styles, dialogs, mask meets, the game tables,
  and frames without pictures. It also lists what the packer will reject: an
  empty last script; two names that come out the same in the pack header
  (`Walk` and `walk`, `stand-1` and `stand_1`, Cyrillic: everything except
  A–Z and 0–9 becomes `_`) or come out as the word `COUNT`; frames of a kind
  where the same colour number has different colours (a set's colours are
  shared), or a colour number past the end of the picture's palette; a
  translation of a line with numbers where a `{name}` is not from the line
  (the translation may use its own order of names). While there are errors,
  `.anim` is not exported. The buttons "mark unreached as entry" and "mark
  falling ones as through" mark at once all the scripts that the warnings say
  the same thing about.

## 14. Frequently asked questions

**I pressed an arrow key and the feet sank below the baseline.** The arrow
keys move the base point across the picture, so on screen the picture moves
the other way: ↑ raises the point, and the picture goes down. Press ↓ to
undo it.

**Can a mask go beyond the canvas?** No. Beyond the picture, yes; beyond the
canvas, no. If you need more room, enlarge the canvas with the kind's canvas
fields.

**I painted a dot with the brush and the body mask disappeared.** The frame
had no masks, so the default mask applied. The brush created a mask made of
the one dot you painted, and the default mask stopped applying. Press Fill
and paint on top of it, or press Ctrl+Z.

**What is the difference between Clear and None?** Clear: the mask exists
but is empty. None: there is no mask; if no masks are left in the frame at
all, the default mask applies.

**The Fill button is disabled.** The frame has no picture loaded. Load the
PNG.

**The frames have red dashed outlines.** The markup is there, but the
pictures are not: after reloading the page or loading a JSON file, load the
PNG files again, or open the whole folder (Open folder…).

**The canvas is huge.** It only grows by itself. Fit next to the canvas
fields shrinks it to the frames.

**How do I check that the frames line up?** Use All frames or Show previous /
next at the top, then Play at the bottom: in motion you see right away if the
character jitters.

**How do I see the character facing the other way?** The Mirror checkbox in
the frames-in-sequence window; it also works when stopped, for the current
frame.

**Where are the scripts?** In the tree under the kind: **Scripts**, with the
list of scripts under it, grouped. The filter at the top of the tree searches
by name.

**Where is Checks?** All checks are in the Problems node of the tree and the
counter in the top bar.

**There are 60 kinds but only 20 have pictures.** That is normal: potions,
torches and the rules of levels are kinds without pictures; they only have an
animation. In the tree such kinds show "—" for the number of pictures.

**I deleted something by mistake.** Ctrl+Z. If that does not help, Open JSON
on the last saved file.
