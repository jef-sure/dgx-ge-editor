# Sprite markup file format

The editor saves its markup in a single JSON file: `<NAME>.json` in the game's
data folder `game_data/` (automatically, after every change) or via the
**JSON ⭳** button. The file holds what the pictures themselves don't: the base
point of every frame, the shadow collision masks and the named attachment
points. The pictures are not part of the file: a frame refers to its PNG by
file name.

This document describes what every field means. The engine's packer
(`components/dgx-ge/tools/dgx_ge_pack.py`) reads the file according to it.
How to use the editor is covered separately, in [usage.md](usage.md). The
examples come from `examples/walk.json`.

## In short

- The file is JSON: a list of mask descriptions and a list of frame sets.
- Every frame has a base point (`origin`), given in picture pixels from the
  picture's top-left corner. Everything else (masks, points, canvas) is
  relative to the base point.
- A mask is a 1-bit rectangle; its rows of bits are written as hex digits,
  most significant bit on the left.
- A frame without masks gets the default mask: its own opaque pixels, under
  the set's `defaultMask` index.
- Mirroring is done around the base column: x becomes −x.
- A set can have animations (`animation`): frame scripts and transition
  rules, the same thing the engine's `.anim` text describes.
- The file can have scenes (`scenes`): levels made of layers with pictures,
  actors, zones, tile grids, exits and links.
- The file can have fields for the game as a whole: game numbers (`game`),
  pack constants (`constants`), timers (`timers`), sounds (`sounds`), shows
  (`shows`), chases (`chases`) and crops (`crops`) — what the packer takes
  with `add_game`, `add_constants`, `add_timer`, `add_sound`, `add_show`,
  `add_chase` and `add_crop`.

## Terms

- **Picture** — the PNG of one frame: a `width` × `height` pixel rectangle
  with a palette.
- **Frame** — a picture together with its markup: base point, masks and
  attachment points.
- **Set** — the frames of one character or object, for example all frames
  of the prince. The frames of a set are marked up together and compared
  with one another.
- **Base point** — the pixel by which a sprite is placed in the game. It is
  usually a pixel at the feet, but it may lie outside the picture.
- **Canvas** — a rectangle shared by all frames of a set. Frames are placed
  on it so that their base points land on the same spot, so the canvas
  covers all frames of the set at once. Its size is the largest sprite size
  of the set.
- **Mask** — a 1-bit "shadow" of a frame used for collisions. It lies on the
  canvas separately from the picture: it may be smaller or larger than the
  picture and may extend past the picture's edges, but not past the canvas.
- **Attachment point** — a named pixel of a frame that another sprite is
  attached to.

The picture and the canvas are different rectangles. Each frame has its own
picture of its own size; there is one canvas per set, and it is no smaller
than any picture in the set:

```
   set canvas: left, top — its top-left pixel relative to the base point
   ┌──────────────────────────────────────────────┐
   │                                              │
   │          ┌────────────┐                      │
   │          │            │                      │
   │          │   frame    │▒▒▒▒▒▒▒ ← blade mask: │
   │          │  picture   │▒▒▒▒▒▒▒   outside the │
   │          │   (PNG)    │  picture, inside the │
   │          │            │  canvas              │
   │          └─────■──────┘                      │
   └────────────────┼─────────────────────────────┘
                    base point (0, 0)
```

Another frame of the same set has a picture of a different size placed
differently, but its base point lands on the same spot of the canvas.

## Coordinates

- The X axis points right, the Y axis points down. The unit is one frame
  pixel.
- A frame's **base point** (`origin`) is given in picture pixels from the
  picture's top-left corner. These are the only coordinates in the file
  measured from the picture corner.
- **Everything else** — masks, attachment points, the canvas — is measured
  from the base point: the base point pixel is (0, 0). Picture pixel
  (px, py) has coordinates (px − origin.x, py − origin.y). So coordinates to
  the left of and above the base point are negative.
- The row of the base point is the **baseline**: the feet stand on it, that
  is, the bottom edge of row y = 0 is the floor. The column of the base
  point is the **base column**: the sprite is mirrored around it (see
  "Mirroring").
- Until a frame is marked up, the editor puts the base point at the
  bottom-left pixel of the picture: `origin = (0, height − 1)`.

Example: frame `walk-1.png`, 8 × 14, with `origin` (3, 13). Its top-left
pixel is at (−3, −13), its bottom-right pixel at (4, 0), and the base point
is picture pixel (3, 13), that is, (0, 0).

## Overview

```json
{
    "format": "dgx-ge-sprites",
    "formatVersion": 1,
    "name": "example",
    "masks": [
        { "index": 1, "name": "body", "color": "#e04040" },
        { "index": 2, "name": "blade", "color": "#3070e0" }
    ],
    "sets": [
        {
            "name": "walk",
            "defaultMask": 1,
            "canvas": { "left": -6, "top": -15, "width": 19, "height": 16 },
            "frames": [
                {
                    "image": "walk-1.png",
                    "width": 8,
                    "height": 14,
                    "origin": { "x": 3, "y": 13 },
                    "masks": {
                        "1": { "x": -3, "y": -13, "width": 7, "height": 14,
                               "rows": ["38", "7c", "7c", "38", "7c", "fe", "fe", "fe", "38", "38", "28", "28", "28", "6c"] }
                    },
                    "points": { "hand": { "x": 3, "y": -6 } }
                },
                ...
            ]
        }
    ]
}
```

## File fields

| Field | Meaning |
| --- | --- |
| `format` | The file type, always `dgx-ge-sprites`. This is how the packer recognizes a file of this editor |
| `formatVersion` | The format version, an integer. It goes up when a file in the new format can no longer be read as the old one; new optional fields don't change it. Currently 1, the format described here |
| `name` | The name of the markup, also used as the file name when saving |
| `masks` | Mask descriptions: which indexes exist, what they are called and what color they are shown in. Sorted by index |
| `meets` | Optional. Which masks meet, as text (see "Which masks meet"). Without it, the engine defaults apply |
| `sets` | Frame sets — the kinds (Kinds in the editor). A set can have frames, an animation, or just one of the two |
| `palettes`, `screen`, `tilesets`, `scenes`, `styles`, `dialogs` | Optional: palettes, the screen and scenes, dialog styles and texts — see their sections below |
| `game`, `constants`, `timers`, `sounds`, `shows`, `chases`, `crops` | Optional: the game as a whole — see "The game as a whole" |
| `graph`, `maps` | Optional: the scene graph — see "Scene graph" |

The editor refuses to load a file with a different `format` or with a
`formatVersion` higher than it knows. A converter should do the same. When
loading, the editor drops fields it doesn't know (except for the fields of
dialog styles, which it keeps as they are); a converter may simply ignore
them.

## Mask description

```json
{ "index": 1, "name": "body", "color": "#e04040" }
```

| Field | Meaning |
| --- | --- |
| `index` | The mask index — a zone: body, head, blade. An integer, different for each mask. What an index means is up to the game logic; the engine only reports which mask indexes overlapped |
| `name` | A human-readable name. The engine doesn't need it, but the packer can emit it as the name of a constant for the index |
| `color` | The mask color in the editor, `#rrggbb`. The engine doesn't need it |

The descriptions are shared by all sets: index 1 means the same thing
throughout the file. The format puts no limit on the number of indexes. The
editor offers indexes 0 to 15 (`MaskLimit` in `Store.js`, 16 masks); that is
an editor setting, not part of the format. 0 is an ordinary index; it does
not mean "no mask".

Which masks are active in which animation frame ("the blade is dangerous
only during the strike frames") is up to the animation script: the `masks`
command in the set's animations (see "Animations of a set"). The frame masks
here only say how the masks are drawn.

## Which masks meet

In the engine, a collision body has an **owner** (parts of one whole — a hand
and the sword in it — never meet) and a **side** (a thrown stone stays on
the thrower's side). A pair of masks of two bodies on the same side is
checked only if it is listed as `own`; bodies on different sides — only if
it is listed as `foreign`.

The `meets` field is text, one pair per line, `#` starts a comment that
runs to the end of the line:

```
foreign BLADE BODY    # a strike lands
foreign BLADE PARRY
own STONE BODY        # a thrown stone can fall on the thrower
```

- A line is `own|foreign <mask> <mask>`. A mask is either a name (the mask's
  `name` from `masks`, following the pack naming rule: letters and digits
  stay, everything else becomes `_`, upper case; `"the blade"` is
  `THE_BLADE`; a mask without a name is `MASK_<index>`) or an index 0…15. A
  word made only of digits is always an index. If two masks share a name,
  the name means the last of them.
- Pairs are symmetric: `a b` is the same as `b a`. Pairs that aren't listed
  don't meet. The same pair twice in one matrix is an error.
- Without the field, the engine defaults apply: own — nothing, foreign —
  every pair. Empty text means nothing meets.
- Packer errors (`add_sprites`): an unknown mask, a malformed line, a pair
  given twice.

In the pack (DGPK v4) this is a 64-byte table: 16 own rows of 16 bits, then
16 foreign rows; bit `b` of row `a` means masks `a` and `b` meet.

The editor keeps the text as is, with its comments (the own/foreign grid
under the mask table adds and removes lines). When a mask is renamed, given a
new index or deleted, the editor updates its words in the text and removes
the lines of a deleted mask.

## Set

| Field | Meaning |
| --- | --- |
| `name` | The set name, unique among sets. The pictures of a set are files from one folder; the editor finds a picture by set name and file name |
| `defaultMask` | The index of the default mask: a frame without any masks gets it, see "Drawn, empty, absent". `null` or no field — no default mask. A new set in the editor gets 1 |
| `canvas` | The set's canvas: `left`, `top` — its top-left pixel relative to the base point; `width`, `height` — its size in pixels |
| `frames` | The frames, sorted by file name (numbers in names compare as numbers: `walk-2` comes before `walk-10`) |
| `animation` | Optional. The set's animations: frame scripts, events, groups, transition rules; see "Animations of a set". No field — no animations |
| `facesLeft` | Optional, `true`: the set's pictures face left ("forward" is to the left); only affects display in the editor |
| `palette` | Optional (DGX-GE 0.4.0): a ready palette of the set in the pack — `nes`, `gameboy`, `pico8` (the engine's, `tools/palettes/`) or the `name` of one of the file's `palettes`. The packer brings every color of the set's pictures to the palette's nearest (CIE76, the distance in CIELAB) and gives the set only the colors taken, in the palette's order; so the frames need not share their color numbers. It warns once a set how many colors were not the palette's and the farthest one. A name of no palette is refused, naming those there are |
| `frameTable` | Optional: a table of frames by number for `frame N` — `[{set, image, dx, dy} | null, …]`, the array index is the number; the picture may come from any set, `dx` is forward and `dy` is down from the actor; `null` is a number with no picture. Used only by the editor's player: a game that draws numbered frames itself (PoP) keeps its own table |

The canvas covers everything in the set's frames: the base point pixel,
pictures, masks and attachment points. For `walk`, the canvas starts 6
pixels left of and 15 pixels above the base point, so it spans x from −6 to
12 and y from −15 to 0.

The packer needs the canvas as the largest sprite size of the set and as a
boundary nothing in the frames goes beyond. It can trim masks to their
content itself. The order of `frames` is just the order of file names, not
the order of an animation.

## Frame

| Field | Meaning |
| --- | --- |
| `image` | The PNG file name, without a folder |
| `width`, `height` | The picture size in pixels as it was when marked up. The packer can use it to check that the markup belongs to this picture |
| `origin` | The base point, in picture pixels from the picture's top-left corner. May lie outside the picture |
| `masks` | The frame's masks. The key is the mask index as a string (`"1"`), the value is the mask. Not every mask from the file's `masks` has to be drawn |
| `packName` | Optional: the picture's own name in the pack (`DAGGER`), following the naming rule (letters and digits, everything else `_`, upper case); without it — `<SET>_<FILE>`. Animations, tiles and styles refer to the picture by this name |
| `points` | Attachment points. The key is the point name, the value is `{x, y, z}`: its position relative to the base point and its side of the body; see "Attachment points" |

When the base point is moved in the editor, masks and points move with the
picture: they stay on the same picture pixels, and their coordinates in the
file change by the opposite of the shift.

## Frame mask

```json
"1": { "x": -3, "y": -13, "width": 7, "height": 14, "rows": ["38", "7c", ...] }
```

A mask is a 1-bit image in a rectangle.

| Field | Meaning |
| --- | --- |
| `x`, `y` | The top-left pixel of the mask rectangle, relative to the base point |
| `width`, `height` | The size of the rectangle |
| `rows` | `height` rows from top to bottom. A row is `ceil(width / 4)` hex digits, each digit is 4 pixels, the most significant bit is the leftmost pixel. Unused bits of the last digit are zero |

Pixel (c, r) of the rectangle, where c is the column and r the row, both
counted from 0, is given by the bit
`(int(rows[r][c // 4], 16) >> (3 - c % 4)) & 1`. Its coordinates relative
to the base point are (x + c, y + r).

The full mask of frame `walk-1` (body, index 1): `x` is −3 and `width` is 7,
so the rectangle's columns are x from −3 to 3. The eighth bit of every row
only pads the row to a whole digit and is always 0.

```
  y   rows  bits      x: -3 -2 -1  0  1  2  3
-13   "38"  0011 1000      ·  · ██ ██ ██  ·  ·
-12   "7c"  0111 1100      · ██ ██ ██ ██ ██  ·
-11   "7c"  0111 1100      · ██ ██ ██ ██ ██  ·
-10   "38"  0011 1000      ·  · ██ ██ ██  ·  ·
 -9   "7c"  0111 1100      · ██ ██ ██ ██ ██  ·
 -8   "fe"  1111 1110     ██ ██ ██ ██ ██ ██ ██
 -7   "fe"  1111 1110     ██ ██ ██ ██ ██ ██ ██
 -6   "fe"  1111 1110     ██ ██ ██ ██ ██ ██ ██
 -5   "38"  0011 1000      ·  · ██ ██ ██  ·  ·
 -4   "38"  0011 1000      ·  · ██ ██ ██  ·  ·
 -3   "28"  0010 1000      ·  · ██  · ██  ·  ·
 -2   "28"  0010 1000      ·  · ██  · ██  ·  ·
 -1   "28"  0010 1000      ·  · ██  · ██  ·  ·
  0   "6c"  0110 1100      · ██ ██  · ██ ██  ·   ← baseline
```

The head (rows −13…−9) is centered on the base column x = 0, and the feet
stand on the baseline y = 0.

A mask may extend past the picture — for example, a blade mask wider than
the drawn blade — but not past the canvas. The editor stores masks trimmed
to their pixels, but a converter should not rely on that: the rectangle may
be larger than its pixels.

### Drawn, empty, absent

- **The mask exists and has pixels**: the zone of this index in the frame is
  exactly as drawn.
- **The mask exists but is empty**: `{"x": 0, "y": 0, "width": 0,
  "height": 0, "rows": []}` ("Clear" in the editor). The mask is drawn and
  there is nothing in it: in this frame, the zone of this index overlaps
  nothing.
- **The mask is absent** ("None" in the editor). This index is not drawn in
  the frame.
- **The frame has no masks at all** (`masks` is empty): the default mask
  applies — the opaque pixels of the picture, that is, all pixels with a
  non-zero palette index. Its index is the set's `defaultMask`: what an
  index means is known to the game, and the "body" zone may have different
  indexes in different sets. If `defaultMask` is `null` or missing, there is
  no default mask and a frame without masks collides with nothing — handy
  for decorations.

The default mask applies only while the frame has **no** masks at all. As
soon as any mask is drawn in the frame — even a single pixel of another
index — the frame no longer has the default mask. That's why in the editor
you first press "Fill": the mask is written out explicitly, equal to the
picture's opaque pixels, and then refined with the brush.

## Attachment points

```json
"points": { "hand": { "x": 7, "y": -7, "z": 1 } }
```

A named point of a frame: `x`, `y` are relative to the base point; `z` says
whether whatever is attached is drawn in front of the owner's body
(`z` > 0) or behind it (`z` < 0). The numbers work like the `z` of a child
item in the engine: children are ordered by `z` among themselves, 0 is not
allowed, sensible values are −8…7. Without `z`, it is 1, in front of the
body. `z` is set per frame (a hand raised for a swing may be behind the
torso). Mirroring the sprite does not change `z`. A child sprite attaches to
the point: a sword in a hand, a picked-up stone. The name is any string; the
same point is named the same in different frames (the editor suggests names
already used in the set). A point may exist in some frames and not in
others. A point is a pixel, just like the base point.

## Animations of a set

The set's `animation` field holds the engine's animations: frame scripts and
the state machine of transitions between them. It says the same thing as a
text in the `.anim` language of the engine's assembler
(`components/dgx-ge/tools/dgx_ge_anim.py`; the language is described at the
top of that file), only as JSON. The editor writes it out as that text into
the file `<SET>.anim` next to the JSON (automatically into the game folder,
or with the kind's **Export .anim ⭳** button) and reads it back from there;
the assembler produces the same bytecode from the written text as from the
original. The packer (`add_sprites`) takes animations from the
`<SET>.anim` files, not from this field.

The field is optional, and an older reader of the file simply ignores it,
so `formatVersion` stays 1.

Example from `examples/walk.json` (the same thing as text is in
`examples/walk.anim`):

```json
"animation": {
    "events": ["walk", "stop", "turn"],
    "params": [{ "name": "action", "value": 0 }],
    "groups": [{ "name": "still", "scripts": ["stand", "turn"] }],
    "scripts": [
        { "name": "stand", "lines": [
            { "op": "set", "param": "action", "value": 0 },
            { "op": "frame", "image": "walk-1.png", "ms": 200 },
            { "op": "hold" }
        ] },
        ...
    ],
    "rules": [
        { "event": "walk", "source": "still", "to": "walk", "when": "end" },
        { "event": "stop", "source": "walk", "to": "stand", "when": "branch" },
        ...
    ]
}
```

| Field | Meaning | In `.anim` text |
| --- | --- | --- |
| `events` | The events the set responds to with rules. Their numbers in the pack are shared (see below) | `event walk, stop, turn` |
| `defines` | Named constants: a name and a value — a number or an expression of numbers and earlier `define`s. Order matters: a constant sees only those above it | `define gravity 3 * 12 * 12` |
| `questions` | Optional. Questions to the game: a list of names; in text — `game name name …` (may span several lines, up to 255), in expressions — `game.name`: the game's answer at the moment of the step (`dgx_ge_expr_ask`; without that function — 0). The number is the position in the list; in the header — `<PREFIX>_<KIND>_GAME_<NAME>`. The name must not match a define, a parameter, a table or a word of the language; `game` is a word of the language | |
| `tables` | Optional. Constant tables: a list of `{name, values}`, `values` are 16-bit integers. In text — `table name v1 v2 …`, in expressions — `name[index]` (0 outside the table). Animations only: not in tile pieces and not in dialogs. The name must not match a define, a parameter, a function or a word of the language (`t`, `now`, `vx`, `vy`, `x`, `y`, `its`, `and`, `or`, `not`) | |
| `params` | Actor parameters: a name and an initial value −32768…32767 (a number or an expression of numbers and `define`s). Their order gives their numbers, by which the game reads them. At run time a parameter holds 32 bits | `param action 0` |
| `pockets` | Optional. How many slots for items the actor has, 0…255 (a number or a `define`); none — no pockets | `pockets 6` |
| `stack` | Optional. How many items of this kind fit in one pocket slot, 1…255; none — 1 | `stack 10` |
| `groups` | Groups: a name and an explicit list of scripts. A script may be in several groups, but only once in each | `group still: stand, turn` |
| `scripts` | Scripts in order: the order gives their numbers in the bytecode, and a script that runs to its end continues into the next one in this order | `script stand` and the lines under it |
| `rules` | Transition rules | `on walk: still -> walk end` |

Names of scripts, labels, events, groups and parameters consist of letters,
digits and `_`; script and label names don't repeat, and neither do
parameter names.

**Events are shared across the pack.** The packer keeps one list of event
names: a name gets one number in all blobs of the pack, new names are
appended, and there are at most 255 of them. A blob's matrix is as wide as
the pack's events known when the blob is built. An event sent by
`hit … event`, `recoil` or `contact on` need not be declared by this set: it
becomes a pack event (a hand's `hit 5 on 6 event taken` tells a pot
`taken`; the pot declares `event taken` and has the rule). A rule `on e:`
requires `event e` in its own set. The editor warns about such an event if
no set declares it (for `event`) or the set itself doesn't (for `recoil`
and `contact`: those go to the actor itself). Such a `.anim` can't be built
on its own, outside a pack — `assemble(text)` numbers events itself and
requires them to be declared. The pack header gets both
`<PREFIX>_EVENT_<NAME>` (shared) and `<PREFIX>_<ANIMATION>_EVENT_<NAME>`.

A **parameter** is a number each actor keeps for itself: lives, "what it is
doing". The engine only stores it and lets scripts change it (`set`,
`add`); its meaning is known to the game. When an actor starts, its
parameters get their initial values, and they persist across scripts. The
assembler accepts up to 255 parameters. The engine's runtime keeps
`DGX_GE_ANIM_PARAMS` per actor and won't open a blob with more; a game's
build sets it from the pack's header (`dgx_ge_params_of_pack`): as many as
the greediest animation of the pack has, 8 bytes a param in every actor.

### Script lines

A script is a list of `lines`, one element per line of the language, in the
same order:

| `op` | Fields | In `.anim` text |
| --- | --- | --- |
| `frame` | a picture (see below), `ms` 1…65535, `at` `{x, y}` −128…127 — optional; or `expr` — the picture as an expression, plus `ms`; or `none: true` — show nothing for this time (the packer writes picture 0xFFFF, the actor's picture is −1: hidden; a script without a frame keeps the previous picture). `ms` may be an expression of the actor (a string: `"speed"`, `"(speed * 2)"`): it is worked out as the frame begins (below 1 — 1 ms, above 65535 — 65535; step `FRAME_MS` 44, DGX-GE 0.4.0); one of constants is a number as before and gives the same bytes. The unit `ms` may be left out; it is read off only as a unit (`fall_ms` is a name) | `frame WALK_WALK_1 200ms at 2, -1`, `frame (DAGGERS_1 + min(amount, 10) - 1) 1000ms`, `frame none 100ms`, `frame STEP (speed)ms`, `frame none speed` |
| `keep` | nothing: the world keeps the actor while it is in this script | `keep` |
| `timer` | `action`: `start`, `stop`, `hold` (pause), `go` (resume); `name` — a game timer (the same names as in `timer(NAME)`); the game is told what was done | `timer start clock` |
| `draw` | `point` — a point, as in `carry`; `kind` — the item's kind, as in `shoot`: from the pockets into the hand | `draw hand SWORD` |
| `stow` | `point`: whatever the point holds goes into the pockets | `stow hand` |
| `dx`, `dy` | `value` −128…127 | `dx 2` |
| `set` | `param` — the parameter name, `value`: assign. A constant −32768…32767 is stored in the step; beyond that, up to ±2²⁴ (exact as a float), as an expression; an expression is rounded, a non-number gives 0 | `set action 1` |
| `add` | `param`, `value` (as in `set`): add; the value is clamped to 32 bits | `add hp -1` |
| `set`, `add` (variable) | `variable` — a variable of the game (the file's `variables`, see "The game as a whole") instead of `param`; `value` — always written as an expression (a constant within ±2²⁴); the result is kept within 32 bits, the game is told when it changes (`DGX_GE_ANIM_VAR`; steps `SET_VAR` 47, `ADD_VAR` 48) | `set game_var.volume 3`, `add game_var.score 10` |
| `rotate` | `value` — degrees clockwise (anticlockwise below zero), a number or an expression of the actor worked out at the step; `to: true` — into that turn, not by it. To the nearest multiple of 90 (a half away from zero: 45 is 90, −45 is −90), round the circle (−90 is 270). The picture is drawn turned (after the mirror: the eight orientations of DGX), and everything said in the actor's axes turns with it: `dx`, `dy`, `velocity`, `accel`, `path`, the frame's `at`, points and what is held, masks, `front`/`back` of `contact`, `release`, `shoot`, `steer`, `sense`. The scene does not turn. A constant is kept in quarter turns (step `ROTATE` 49, 2 bytes), an expression as `ROTATE_X` 50 (DGAN 11) | `rotate 90`, `rotate to 180`, `rotate to (dir * 90)`, `rotate to game_var.facing` |
| `music` | `name` — a music of the pack (the file's `music`; a name the file has not is a name only: the packer numbers it, it plays nothing, and the editor warns) or `stop`; or `volume` 0…100 — the music's level by design, percent of the player's volume; `ms` — the fade (the one playing fades out, then this one comes in as long) or the time the level is reached over, 0…65535 (written `500ms` or `2s`; none — 0, at once). The same music already playing goes on. Steps `MUSIC` 45 and `MUSIC_LEVEL` 46, 4 bytes | `music theme`, `music theme 500ms`, `music stop 1s`, `music volume 30% 500ms` |
| `signal`, `sound` | `value` 0…255 | `signal 3` |
| `velocity`, `accel` | `x`, `y` −32768…32767 | `velocity 40 0`, `velocity 40, -power + 10` |
| `path` | `x`, `y` — expressions of `t`: position by formula, see below | `path x: 40*t, y: 3*sin(t*6)` |
| `contact` (mask) | `mask` 0…15 (a number, a `define` or a pack mask name); `side` — `inside`, `below`, `above`, `left`, `right`, `beside` (left or right), `front`, `back` (relative to facing), `any`, or `none` — stop watching; `within` 0…255 (1 by default; 0 — `inside` only); `event` — an event to itself the moment this side touches something solid; `off` — an event when it stops touching; at least one of the two; `first` 1…255 (only with `off`; `first within 8` at the end) — if, when watching starts (or at the first look at the terrain), there is nothing within that many points on this side, `off` arrives at once: a frame that needs a floor started over empty space (CONTACT_FIRST 43: the CONTACT_MASK bytes plus one more). Two masks can be watched at once | `contact 1 below on landed off fell`, `contact 1 below within 2 on landed`, `contact 10 below within 1 off fall first within 8`, `contact 1 off` |
| `contact` | `on`: `true` or `false` — look for contacts with the terrain (floors and walls are described by the game) or stop; `event` — only with `on`, optional: the event the actor itself gets at the moment of contact (may be declared further down) | `contact on`, `contact on landed`, `contact off` |
| `carry` | `point` — the name of an attachment point of the frames; a picture as in `frame`: `image`, `number` or `name`; none of them — `none`, nothing | `carry hand SWORD_3`, `carry hand none` |
| `shoot` | `point` — a point, as in `carry`; `kind` — the projectile kind: a number 0…65535 or a pack blob name — the animation of any set of this file (`DAGGER`; the packer builds the file's animations together, `add_anims`, so set order doesn't matter) or a blob added to the pack before the file; `x`, `y` — the velocity, as in `release`; without them — `0 0` | `shoot hand DAGGER 220 0` |
| `tell` | `target` — to whom: `holder` (whoever holds this actor) with `event` — a pack event, no declaration needed; or `cell` — a map cell: `cell` (a number or an expression, as `dgx_ge_cells` counts: in PoP, (room − 1)·30 + tile), `event`, `value` (a number or an expression, 0 — none) into its own parameter; the game carries it out (the map rules) | `tell holder drank_wine`, `tell cell 451, loosened, 3` |
| `press` | `cell` — a number or an expression: the button in a map cell is pressed as if stepped on (its links fire); the game carries it out | `press 720` |
| `clear` | `cell` — a number or an expression: whatever lies in the map cell disappears; the game carries it out | `clear 421` |
| `appear` | `kind` — a kind (a pack blob name or a number), `event` — a pack event for the newcomer, `x`, `y` — where (numbers or expressions), `left` — facing left; `with` — an optional list of `{param, value}`: the newcomer's parameters (by its own numbering), as expressions; an actor of that kind appears at `x`, `y` and hears `event`; where it lives is up to the game | `appear KID, mouse_go, 200, 55, left`, `appear WOLF, born, x, y with age = 0` |
| `sense` | `target` — a kind (name or number), `any` (any actor) or `cell` (a non-empty cell); `radius` — a number 0…65535 or an actor expression evaluated at the step (`30 - full / 4`: a hungry one senses farther; step flag 4, the expression bytes after `where`); `seen` — optional, a word after the radius: only someone the gaze reaches within the radius through tile veils (`veil`; step flag 2); `where` — an optional condition on what was found, using `its.<parameter of the kind>`, `its.vx`, `its.vy`, `its.image`, `its.script`, `its.flip` for bodies and `its.tile`, `its.mod`, `its.cell` for cells; `into` — 1…3 parameter names (or `_`): distance (−1 — nobody), dx forward, dy; `copies` — `{param, value}`: what else to copy from what was found | `sense WOLF within 80 where its.age > 3 into enemy, edx, edy, mate = its.cell`, `sense SHEEP within 120 seen into prey` |
| `steer` | `way` — `seek`, `flee`, `arrive`, `pursue`, `evade`, `wander`; `args` — expressions in order: speed, force[, radius or spread], then the target's dx, dy[, vx, vy]; for `wander`, instead of a target, `angle` — the angle parameter (degrees, 0 forward, 90 down) | `steer seek 40, 10 to edx, edy`, `steer wander 20, 5, 30 angle heading` |
| `vanish` | no fields: the game removes this actor | `vanish` |
| `release` | `point` — the name of an attachment point, as in `carry`; `x`, `y` — the velocity, as in `velocity` (numbers or expressions with parameters and `define`s, without `t`; x is forward); without them — `0 0` | `release grip 52, -110`, `release hand` |
| `hit` | `mask` — the striking mask, `on` — a list of the other actor's masks it strikes (all 0…15: numbers, `define`s or pack mask names); `damage` — a constant −32768…32767, none — 0; `event` — an event for the one struck, `recoil` — an event to itself (event names, may be declared further down) | `hit 2 on 1 3 damage 1 event hurt recoil parried` |
| `masks` | `indexes`: masks 0…15 — numbers, `define`s or pack mask names (see below) | `masks 1 2`, `masks BODY TIP` |
| `flip`, `branch`, `hold` | — | `flip` |
| `goto` | `target`: a script or a label; `cond` — an optional expression: jump only where it is non-zero, otherwise continue down the script | `goto walkcycle`, `goto noknife if count(DAGGER) == 0` |
| `label` | `name` | `label walkcycle` |

**Numbers and expressions.** Every number in a line (`ms`, `at`, `value`,
`x`, `y`, elements of `indexes`), a parameter's initial value and a
`define`'s value is either a JSON integer or a string with an expression of
the language, exactly as written in the `.anim` text: numbers (fractional
too), `+ - * /`, parentheses, unary minus, `min(a, b)`, `max(a, b)`, `abs`,
`sin`, `cos`, `sqrt`, `exp`, `smoothstep(x)` (0 below 0, 1 above 1, smooth
in between: `smoothstep((t - t0) / d)`), `its.<name>` — what a `sense` step
found (only in its `where` and copies; `its.rotation` too: its turn);
`game_var.<name>` — a variable of the game as the game's store has it at the
moment of the step (the file's `variables`; scripts and dialog conditions, not
tiles and not `path`; the editor's player keeps its own store from the
starting values); `rotation` — the actor's turn now, 0, 90, 180 or 270 (not in
constants, not in `path`, not in tiles); `music` — the number of the music
playing, −1 none (`goto wait if music >= 0`: wait for one to end; the
player says what the scripts asked and keeps that number); `rotation` and
`music` are words only where no `define` or parameter has that name; `game.<name>` — the game's answer to
a question declared with a `game name …` line (at the moment of the step;
without the game's function — 0; not in `path` and not in tiles); integer
bit operations (32 bits, negatives in two's complement): `xor(a, b)`,
`bits(x)` (the number of set bits), `bit(n)` (2ⁿ, 0 outside 0…30),
`field(x, first, count)` ((x >> first) & (2^count − 1)); the animation's
constant tables `name[index]` (the integer part of the index; outside the
table — 0); names of `define`s and parameters, `t`; comparisons
`< <= > >= == !=` and the words `and`, `or`, `not`, which give 1 or 0 and so
work in arithmetic too: `velocity (hp > 0) * 40, 0`. Expressions can also
use `x` and `y` — where the actor is right now, in scene points (`x` is not
"forward", unlike `vx`); not in constants and not in `path`; the names `x`,
`y` are reserved, like `vx`, `vy`, `now`, `t`. Precedence from weakest to
strongest: `or`, `and`, `not`, comparison, `+ -`, `* /`. Comparisons don't
chain: `0 < x < 5` is an error; write `0 < x and x < 5`. What is allowed
where:

- `at`, `dx`, `dy`, `signal`, `sound`, `masks` and initial parameter
  values take only numbers and `define`s: the assembler evaluates them right
  away and rounds to an integer (halves away from zero, as the engine does:
  −2.5 → −3); so does a frame's `ms` of constants — one that reads the
  actor (`frame A (speed)ms`) is worked out as the frame begins;
- **pack constants** (the file's `constants` field, see "The game as a
  whole") can stand anywhere a number can, like a `define` given before the
  first line (`frame A TICK_MS ms`, `signal CLOCK_OUT`,
  `define tick 1000 / TICK_MS`). You can't reuse such a name for your own
  `define`, `param`, `table` or `game`: "TICK_MS is a constant of the pack
  (83): not to be defined again";
- **pack mask names** are allowed only where a mask is expected (`masks`,
  `hit … on …`, `contact <mask>`): the same name as in `meets` and in the
  header (the mask's `name`: letters and digits, everything else `_`, upper
  case; a mask without a name is `MASK_<index>`). `masks BODY TIP`,
  `hit TIP on BODY damage 1`, `contact FEET below on landed`. A name gives
  the same bytes as the number. Elsewhere a mask name is not a number:
  `frame A BODY ms` is an error. The editor stores the name as written and
  updates it in scripts when the mask is renamed or its index changes (for a
  mask without a name);
- numbers are decimal or hexadecimal (`0x80`); `%` is the remainder (same
  precedence as `*` and `/`), `&` and `|` are bitwise AND and OR on integers
  (below `+` and `-`, above comparisons: `mod & 0x7F == 2` means
  `(mod & 0x7F) == 2`); `%`, `&`, `|` take integer parts (like the engine's
  `int32_t`), the remainder has the sign of the dividend, as in C
  (`-7 % 3` is `-1`); `rnd(n)` is the game's die, an integer 0…n: it isn't
  evaluated at build time, so it isn't allowed in constants (`define`,
  `dx`…); the editor's player rolls it the way the engine does, from seed 1;
- `c ? a : b` is `a` if `c` is non-zero, otherwise `b`; it binds weaker than
  every other operator, right to left (`a ? b : c ? d : e` is
  `a ? b : (c ? d : e)`); with constant operands it is evaluated at build
  time;
- `timer(NAME)` — milliseconds since the game timer of that name started, at
  the moment of the step, or −1 if it isn't running (timers are described by
  the game: the `TIMERS` blob); like `count`, it's actor-only: not in `path`,
  not in constants; the editor's player doesn't run timers, so it gets −1;
- `axis(NAME)` — a player gamepad axis at the moment of the step (the
  engine's pad branch): `lx`, `ly`, `rx`, `ry` — sticks, −1…1; `lt`, `rt` —
  triggers, 0…1 (the axis number is its position in this list; in the blob,
  step 52 and a byte with the number). Only in animation scripts: not in
  `path`, not in tiles, not in dialog conditions, not in `param` initial
  values; never folded at build time. A parameter or `define` named `axis`
  hides the function. The editor's player has no gamepad, so it gets 0;
- `velocity`, `accel`, `set`, `add`, `release` can also use the actor's
  parameters, `vx` and `vy` — its current velocity in scene points per
  second, x forward (in its axes: the mirror and the turn taken into
  account) — and `now`, the moment of
  the step in seconds of the game clock (fractional): such expressions are
  evaluated on the board at the moment of the step (`set drunk now + 10`);
- `path` can use parameters and `t`, but not `vx`, `vy`: the path formula
  sets the velocity itself, and otherwise the position would depend on the
  frame rate.

The names `t`, `vx`, `vy`, `and`, `or`, `not`, `its`, `game`, `game_var` and
function names can't be used for `define`s and parameters. A `game <name>`
question can't be named as a variable of the game. An evaluated expression must fit the
range of its field. A line keeps its text as is, so `"accel 0 gravity"`
stays `{"op": "accel", "x": 0, "y": "gravity"}`, not `432`.

**`carry`** — what the actor holds: from this step on, at point `point` of
its frames it holds this picture (a sword frame matching the body pose)
until the next `carry` of the same point replaces it; changing scripts and
`masks` don't clear it. Up to two points at a time. It is placed by the
engine's rule: the picture's point with the same name (for a sword, `hand` —
where it is gripped) goes onto the carrier's point; without one, the
picture's base point does; it is mirrored together with the carrier; it is
drawn in front of or behind the body according to the `z` of the carrier's
point. The point name is as in the frames' `points` (or in upper case, as in
the pack); the editor doesn't know a point that no frame has and warns about
it: it must exist in the pack.

**`contact`** — look for contacts with the terrain. With an event
(`contact on landed`), at the moment of contact the engine refines that
moment, places the actor at the contact position and sends the event to the
actor itself; its matrix decides what happens next (a pot: `flying` →
`shatter`, a stone: `flying` → `lying`). `contact off` takes no event. In
the blob (DGAN 7) the command takes 3 bytes: event `0xFF` means no event.
The player has no terrain: while a `contact on` with an event is in effect,
a `touch → <event>` button appears next to the `contact` mark and simulates
a contact.

**`carry` in DGAN 7** means "what to show the thing at the point with in
this frame" (a sword frame matching the hand pose); `carry <point> none`
means "with its own frame". The game itself can also hold things
(`dgx_ge_actor_hold`), and the held thing can be a separate actor with its
own scripts (a sword, a pot); `release` lets go of it. The bytes haven't
changed; the editor's player, which has no such actors, draws the `carry`
picture at the point as before.

**`shoot <point> <kind> [vx vy]`** — a shot: a projectile of that kind flies
out of the point with velocity `vx`, `vy` (x forward, the flip sign taken at
the moment of the step). The kind is an ordinary pack animation, and its
**first** script defines the projectile: picture (`frame`), falling
(`accel`), mask (`masks`), strikes (`hit`). The game is told
`DGX_GE_ANIM_SHOOT` (the value is the point number); the game makes the
projectile fly and hit. The kind name is the blob name: the packer builds
the file's set animations together (`add_anims`), so set order doesn't
matter; when a set is renamed, the editor updates the kind name in `shoot`.
In the blob (DGAN 9) the velocity is always written as expressions. The
player only logs the shot in the log and the status line.

**Script marks** (for the editor's checks only; in JSON — `entry` and
`through` on the script, in `.anim` — a comment on the `script` line, which
the assembler doesn't see): `entry` — the game starts this script itself,
which silences the "nothing leads to it" warning; `through` — the script
intentionally continues into the next one
(`script run  # entry: the game starts it; through: goes on into the next on purpose`).

**Comments** of the `.anim` text are kept by the editor with whatever they
belong to: on a define, a parameter, a table, a script, a script line, a
group and a rule — `above` (a list of comment lines above it, without `#`)
and `note` (the comment at the end of its line); for the `event`, `game`,
`pockets`, `stack` lines — the same, in the animation's `heads`
(`{"event": {"above": [...], "note": "..."}}`); comments after the last line
go into `tail`. All these fields are optional; the packer doesn't need them,
it reads the `.anim` text.

**Pockets (DGAN 10).** `pockets N` and `stack N` are animation lines that
come before its scripts (in JSON — the animation's `pockets` and `stack`
fields): how many item slots the actor has and how many items of this kind
fit in one slot. `draw <point> <kind>` takes one item of that kind out of
the pockets into the hand, `stow <point>` puts whatever is at the point into
the pockets; `shoot` by an actor with pockets shoots from them (none — no
shot). The kind is as in `shoot`: a number or the name of a set animation of
this file (in any order) or of a blob added before the file. In expressions
`count(KIND)` is how many items of that kind are in the pockets, and
`amount` is how many items the actor itself is (a stack on the floor); both
are actor-only (not in tiles, not in `path`, not in `define`). `keep` — the
world keeps the actor while it is in this script (a pot lying on the floor
is remembered, its shards are not). `goto <where> if <expression>` jumps
only if the expression is non-zero; otherwise the script goes on.

**A frame as an expression**, `frame (<expression>) <ms>`: the picture is
computed at the moment of the step; pack picture names in it stand for their
numbers (in JSON — the frame's `expr` field instead of
`image`/`number`/`name`; such a frame has no `at`). An expression of only
pictures and numbers is folded by the assembler into an ordinary frame. The
editor's player numbers pictures the way the packer does for this file (set
by set, frame by frame); `amount` is 1 and `count` is 0 for it: it doesn't
track pockets, `draw` only writes to the log, and `stow` removes the held
thing from the point.

**`tell holder <event>`** — this actor (a pot someone drinks from) asks the
game to send an event to whoever holds it (`DGX_GE_ANIM_TELL`). The event is
shared by the pack (see above); the holder declares it and responds to it
with a rule. In the blob (DGAN 8) it is 3 bytes. The player only writes the
command to the log: there is no holder in it.

When `set` or `add` changes a parameter's value, the game is told the
parameter number (`DGX_GE_ANIM_PARAM`); the player logs
`<parameter> = <value>`.

**`release`** — let go of what the actor holds at point `point`, with
velocity `x`, `y` (pixels per second, x forward, the flip sign taken at the
moment of the step). The point is freed; if something was there, the game
learns about it (`DGX_GE_ANIM_RELEASE`, the value is the point number) and
decides itself what happens to the object (a thrown stone flies). If the
point is empty, nothing happens. The game itself may put a picture at the
point without `carry`; `release` lets go of that too. In the blob, the
`release` velocity is always written as expressions, even a constant one
(DGAN 6). The editor's player frees the point and shows in the status line
what was released and how fast.

**`hit`** — a strike. Consecutive `hit` lines (comments and blank lines
between them don't break the run) form one set of strikes; any other line,
a label or a `script` starts a new one. Strikes stay in effect until the
next set, until a `masks` command or until another script is entered. The
parts after the masks may come in any order, each with its value; masks and
damage are single words (a number or a `define` name), with no spaces
inside.

**`path`** — position by formula: `t` is the number of seconds since the
`path` started, and the position is the point where it started plus the
formula; `x` is forward, by the facing at the start. It stays in effect until
the next `velocity`, `accel` or `path`; frame and script changes don't
interrupt it; `dx`, `dy` shift its starting point; after it is replaced, the
actor continues with the velocity of the formula (its derivative).

A frame's picture is given by one of three fields:

- `image` — the file name of a frame of **this set**. In `.anim` text it is
  the picture name in the engine's pack: `<SET>_<FILE NAME WITHOUT
  EXTENSION>`, with everything except ASCII letters and digits replaced by
  `_`, then upper-cased. Set `walk`, file `walk-1.png` → `WALK_WALK_1`. The
  packer names pictures the same way; two files with the same such name are
  an error.
- `number` — the number by which the game itself draws the frame (as in
  PoP), 0…65535.
- `name` — the name of a pack picture that is not among the set's frames;
  written into the text as is.

The `action N` command no longer exists in the language: it is an ordinary
parameter, `param action 0` and `set action N`. When reading old text or an
old JSON with `action`, the editor declares the `action` parameter itself
and writes `set action N`.

An animation step is the commands up to and including a frame: the commands
run when the previous frame's time is up, then the frame is shown for `ms`
milliseconds.

### Rules

A rule is `{event, source, to, when}`: on event `event`, script `source` (or
every script of group `source`) switches to script `to`; `when`:

- `now` — immediately;
- `branch` — at the script's next `branch` point (or at its end);
- `end` — where the script would itself move on to another one (`goto`) or
  stop (`hold`).

Rules only fill in the "script × event" matrix — the state machine. Rule
order means nothing, there are no priorities and no "all scripts" (`*`). Two
rules that give one cell different answers are a conflict, an error; two
rules with the same answer are fine. If a group name matches a script name,
the rule refers to the group.

## Scenes

Scenes are the game's levels, as the engine's `dgx_ge_scene.h` draws them:
layers from back to front, pictures and actors on the layers, plus tile
grids, zones, entries, exits and links. They sit at the top level of the
file, next to `sets`, and refer to set frames by set name and file name. All
fields are optional: a file without them is a file without scenes
(`formatVersion` stays 1).

```json
"screen": { "width": 320, "height": 240 },
"tilesets": [ {
    "name": "tiles", "cellWidth": 24, "cellHeight": 46,
    "tiles": [ {
        "name": "floor", "kind": 1,
        "solid": { "top": true, "left": false, "right": false, "bottom": false },
        "pieces": [ { "set": "walls", "image": "floor.png", "dx": 0, "dy": 0, "layer": "back", "key": 0 } ]
    } ]
} ],
"scenes": [ {
    "name": "room1", "width": 320, "height": 240, "background": "#000000",
    "layers": [ {
        "name": "back", "factor": 256, "order": "added", "visible": true, "locked": false,
        "objects": [
            { "type": "picture", "name": "", "set": "walls", "image": "torch.png", "x": 60, "y": 150, "key": 0, "flip": false, "clip": null },
            { "type": "actor", "name": "guard", "set": "guard", "script": "stand", "x": 160, "y": 182, "flip": true, "params": { "hp": 4 } },
            { "type": "zone", "name": "door", "kind": "exit", "x": 280, "y": 120, "width": 39, "height": 63 },
            { "type": "entry", "name": "from_left", "x": 20, "y": 182, "flip": false }
        ]
    } ],
    "grids": [ { "name": "grid", "tileset": "tiles", "x": 0, "y": 0, "cols": 13, "rows": 5,
                 "cells": [[0, 1, ...], ...], "mods": { "3,4": 2 } } ],
    "exits": [ { "edge": "right", "zone": "", "scene": "room2", "entry": "from_left" } ],
    "links": [ { "from": { "grid": "grid", "col": 3, "row": 4 }, "to": { "object": "door" } } ]
} ]
```

| Field | Meaning |
| --- | --- |
| `screen` | The device screen size in pixels; shared by all scenes |
| `tilesets[].fields` | Names for bits of a cell's modifier and variant, see "Tileset fields" |
| `tilesets` | Tilesets, shared by all scenes |
| `scenes` | The scenes |

**Scene.** `width`, `height` — the size in pixels (up to 32767); a scene the
size of the screen is a room, a larger one scrolls. `background` — the
background color in the editor (and the paper of the frame in the game).
`music` — optional (DGX-GE 0.4.0): the music the game plays as it enters the
scene, a name of the file's `music` (another name is a name only and plays
nothing; the editor warns) or `stop` for silence; none — what plays goes on.
`musicFade` — optional, how many ms the change fades over, 0…65535 (500 when
not given). Scene coordinates are pixels from the scene's top-left corner.

**Layer.** Layers are drawn in list order, the first being the farthest;
there are at most 8 of them (`DGX_GE_SCENE_MAX_LAYERS`). `factor` — how the
layer moves with the scene view: 256 — together with it, 128 — at half the
speed (background), 0 — stays put (sky, a panel); int16. `order`: `added` —
the layer's pictures are drawn in the order given, `key` — by key, smaller
first. `visible` and `locked` are editor-only.

In the engine, a layer can be "in screen pixels"
(`dgx_ge_scene_layer_pixels`): its objects are not scene points but display
pixels, drawn at the display's resolution on top of the scaled frame
(dialogs, text); `factor` has no effect, there are no children. The engine
draws the pictures of such a layer at the frame's scale: every
picture pixel is a square with a side equal to the scale
(`dgx_ge_item_t.scale`). The editor's JSON doesn't have this field yet; when
it is needed it will be `"pixels": true` next to `factor` and `order`. How
the packer puts scenes into the pack is covered in "Scenes in the pack"
below.

**Layer objects** (`type`):

| `type` | Fields | Meaning |
| --- | --- | --- |
| `picture` | `set`, `image`, `x`, `y`, `key`, `flip`, `rotation`, `clip` | A picture: a frame of a set, with its base point at `x`, `y`. `flip` mirrors it around the base column. `rotation` — optional (DGX-GE 0.4.0): degrees clockwise about the base point, after the mirror, 0, 90, 180 or 270 (any multiple of 90; −90 is 270; another is refused). `key` is for a layer ordered by `key`. `clip` is a scene rectangle `{x, y, width, height}` outside which the picture isn't drawn, or `null` |
| `actor` | `set`, `script`, `x`, `y`, `flip`, `rotation`, `params` | An actor: where it appears (by its base point), the set with the animations, the script it starts with, and `params` — its initial parameters, overriding those given in the set's animations. `rotation` as for a picture: the actor begins turned so, its axes with it (as after `rotate to`) |
| `zone` | `kind`, `x`, `y`, `width`, `height` | A rectangle for the game logic; `kind` is a word the game understands (`exit`, `trap`…) |
| `entry` | `x`, `y`, `flip` | An entry point: where an actor ends up when it comes into the scene, and which way it faces |

Every object has a `name`. That's how the game refers to the object from its
code: the packer emits names as constants (everything except ASCII letters
and digits becomes `_`, then upper case), so two names in one scene that
give the same constant are an error. A picture doesn't need a name.

**Grid** (`grids`) — cells with tiles from tileset `tileset`, its top-left
corner at scene `x`, `y`, `cols` × `rows` cells of the tileset's cell size.
`cells` — rows from top to bottom; a cell holds 0 (empty) or a tile number
starting from 1 (up to 65535). `mods` — cell modifiers for the game (gate
state, potion type…), 8 bits: `"column,row": number`, only for cells that
have one; missing means 0. Tile pieces also use it to pick a picture
(`by_mod`) and an offset. `variants` — likewise, cell decoration variants,
32 bits (for the pieces' `variant` and for expressions); missing means 0.

**Tileset fields** (`fields`) — names for bits of a cell's modifier and
variant: `{"middle_x": ["variant", 1, 3]}` — bits 1…3 of the variant,
`["mod", 7, 1]` — the top bit of the modifier. Piece expressions (`dx`,
`dy`, `pick`, `color`, `when`) can use `mod`, `variant` and these names; a
field is the unsigned number made of its bits. A piece has no actor: `now`,
`vx`, `vy` in them are an error ("now is of an actor, there is none here"),
and so is `t`. A field can't be called `t`, `vx`, `vy`, `now`, `mod`,
`variant`, a function name, or `and`, `or`, `not`.

A **tile** (the tileset's `tiles`) is drawn in **pieces** (`pieces`). This
way one cell can be drawn in parts on different layers (a wall behind the
actor, the front edge of the floor in front of it) and can reach into
neighbouring cells. `kind` is a number for the game. `solid` — which sides of
the tile are solid: the actor can't pass through them. `closes` — optional,
`{top, left, right, bottom}`: which sides end the open space in which the
actor is visible (beyond them it is hidden); without the field, the same as
`solid`. It is needed when visibility doesn't match collision: you can walk
through a doorway, but on its right side it hides the actor. In PoP, floors
and walls close at the bottom (a ceiling for whoever stands below), walls
close on the left, the top of a door on the right. Tile names within a
tileset are unique: pieces use them to look at their neighbours.

`seen_as` — optional: the name of another tile of the tileset. Wherever a
neighbour condition (`around`) names that tile, this one matches too (a
lowered plate counts as floor: `"seen_as": "floor"`). It is resolved at
packing time; the blob doesn't have it.

`life` — optional (DGTS 8): the name of a pack animation (of a set with an
animation, by its pack name: `GATE`) that a cell with this tile plays by
itself — gates rise and fall, a floor crumbles, spikes shoot out. Its
parameters: 0 — the cell's modifier, 1 — its tile, the rest are its own.
Set animations go into the pack before tilesets; the packer won't accept an
animation that isn't already in the pack.

`bodies` — optional (DGTS 7): what is solid in the cell, a list of
rectangles:

```json
"bodies": [{"dx": 0, "dy": -2, "w": 32, "h": 11, "when": "q < 39", "for": [1, 3]}]
```

A body is a rectangle anchored at the cell's bottom-left pixel shifted by
`dx`, `dy` (up is negative): `w` pixels to the right and `h` up, counting
that pixel itself (in y — from `dy − h + 1` to `dy` relative to the cell's
bottom row). `dx`, `dy`, `w`, `h` are numbers or expressions, as in a
piece's `dx` (`mod`, `variant`, tileset fields); `when` is an optional
expression: the body exists only where it is non-zero (a constant 0 is an
error). A body with `w` or `h` of 0 or less stops nothing. A tile has at
most 255 bodies. If bodies are given, they are what stops the actor, and the
`solid` sides only matter for the pieces' `around` conditions and for
visibility (through `closes`); without bodies, the `solid` sides and the
strip at the edge apply, as before. `for` — optional (DGTS
8): the masks the body holds, a list of numbers 0..15 (the `index` of
the file's masks); missing or empty — all masks. When the engine queries the
grid with a mask (contact, sides, push-out), it sees only bodies that hold
that mask, so a tile can have bodies following the game's rules for people
(in PoP the floor is shifted by half a cell) side by side with bodies as
drawn for objects (a jug, shards) — otherwise objects would fall through
the gaps between the people's bodies. In the blob, it is the last u16 of the
body, the mask bits (0 — all), same size. The editor shows bodies as red
frames on the scene (the Bodies checkbox; next to it, the "for …" choice
shows only bodies that hold that mask, as the engine sees them; a body not
meant for every mask is dashed) and in the tile thumbnail (for `mod` 0 and
`variant` 0), and edits them in the tile properties; the check covers
numbers 0..15, repeats, and masks that don't exist in the file.

`veil` — optional (engine, life branch): a veil, 0…7 — how much a gaze
through the tile costs for `sense … seen`: 0 — transparent (no field — 0),
1…6 — one point through it costs 2…7 points of radius, 7 — you can't see
through it. In the blob — the top 3 bits of the `closes` byte, same version.
The seeker's own cell doesn't count.

`opening` — optional (DGTS 9, engine, door-stairs branch): the tile's
opening, `{"dx", "dy", "w", "h", "when"}` — a rectangle like a body, with
the same expressions, but without `for` (the packer and the editor's check
reject it). An opening isn't solid: through it you can see an actor that
has gone inside the tile (up the stairs of an exit door). In the blob — a
record right after the bodies, not counted among them; bit 16 of the tile's
`closes` byte. In the game, an item with the `DGX_GE_ITEM_INSIDE` flag is
clipped, besides the usual open space, by the opening of the cell under its
feet or of a neighbour in the same row whose opening reaches it. The editor
shows the opening as a blue frame (the Bodies checkbox; in the thumbnail —
for `mod` 0, `variant` 0) and edits it in the tile properties (Opening).

```json
"opening": {"dx": 32, "dy": 0, "w": 48, "h": "16 + 4 * min(q, 12) + lo"}
```

A piece stands with its base point at the cell's bottom-left pixel shifted
by `dx`, `dy`, on scene layer `layer` (a layer name); `key` is for a layer
ordered by `key`. Required: `layer` and one of: `set` + `image`, `by_mod`,
`pick` + `pictures`, `cycle`, `"draw": "fill"`. Everything else is
optional:

| Field | Meaning |
| --- | --- |
| `set`, `image` | A single picture: a frame of a set |
| `by_mod` | `[{set, image} \| null, ...]` — the picture by the cell's modifier (the grid's `mods`): `mod` 0 — the first, 1 — the second…, beyond the last — the last (gate closed / open, potion type); `null` — no piece for that modifier. No need to pad the list with repeats |
| `pick`, `pictures` | Like `by_mod`, but the picture number is the expression `pick`: the picture is `pictures[round(pick)]`, the number clamped to 0…length − 1; `null` in the list — no piece |
| `cycle` | `[{set, image, ms}, ...]` — pictures loop on the scene's shared clock, all cells in step; the game doesn't touch them (water, lava) |
| `dx`, `dy` | A number or an expression in the `.anim` expression language of `mod`, `variant` and the tileset fields (`"-mod / 4"` — the gate rises); the packer folds an expression of numbers only |
| `around` | `{side: condition}` — the piece is drawn only if the cell's neighbours match, all conditions together. Sides: `up`, `down`, `left`, `right`, `up_left`, `up_right`, `down_left`, `down_right`. A condition: `"empty"`; the name of a tile of this tileset; a list of names `["floor", "loose"]` (any of them); `"solid_top"`, `"solid_left"`, `"solid_right"`, `"solid_bottom"`, `"solid_any"` — the neighbour has that solid side (any); `"not "` before any of these except a list. Past the grid's edge, the neighbour is whatever the game says (in PoP, the adjacent rooms); the editor treats it as empty |
| `variant` | The piece is drawn only in cells whose decoration variant (the grid's `variants`, 32 bits) equals this number |
| `when` | An expression of `mod`, `variant` and the tileset fields (with comparisons and `and`, `or`, `not`): the piece is drawn only where it is non-zero. `"mod > 0 and variant == 0"`. A non-zero constant means no check; a constant 0 is an error (the piece would never be drawn) |
| `with` | `"self"` (the same as no field) or a side, as in `around`: the piece is laid when the grid lays the cell on that side, among that cell's pieces. Its position (`dx`, `dy` from its own cell) and its `around` rules are those of its own cell. The right edge of a floor: `"with": "right"`, `dx` — the cell width |
| `step` | 0…255 — the piece's turn among the pieces laid with a cell, 0 first; no field — 0. Within one turn, the cell's own pieces come first, then those coming from above, below, left, right, top-left, top-right, bottom-left, bottom-right, each in its own order |
| `draw` | `"normal"` (the same as no field), `"card"` — on a rectangle of its color the size of the picture, covering what's behind it, `"silhouette"` — the picture's shape in a single color, `"fill"` — no picture, a rectangle of its color of size `size` |
| `size` | For `fill`: `[width, height]`, the bottom-left corner at the cell's bottom-left pixel shifted by `dx`, `dy` |
| `color` | For `card`, `silhouette`, `fill`: `n` — the color of pixel value `n` of the piece's own set, `[set, n]` — of another set; 0 — the frame's paper. `n` can be an expression, as in `dx`: `["walls", "f0 + 6"]` |

Example: a gate — the picture chosen by modifier, rising by a quarter of the
modifier, only if there is no wall above and a wall or floor below, and only
in cells of variant 2:

```json
{ "layer": "back", "by_mod": [ { "set": "walls", "image": "door0.png" }, { "set": "walls", "image": "door1.png" } ],
  "dy": "-mod / 4", "around": { "up": "not wall", "down": ["wall", "floor"] }, "variant": 2 }
```

A list in `around` can't be negated (`"not"` goes only before a single name,
`empty` or `solid_*`): give a list of the other tiles instead.

There is room left for offsets of the `solid` boundaries and for procedural
tiles (a drawing that depends on the cell position).

**Exit** (`exits`) — where the scene leads: through an edge (`edge`:
`left`, `right`, `up`, `down`) — a side exit of the graph, with no name or
entry; or by name (`name`, empty `edge`; `zone` — the name of a zone of this
scene, only a hint of where the exit is) into scene `scene`, to its entry
`entry` (required), with transition `transition`: `cut`, `fade`, `wipe`,
`seamless` (instant, and the actor keeps going as it was: whoever arrives is
not restarted). Scenes with exits form a graph, as in Metal Gear; rooms
connected by edges are a special case. Details are in "Scene graph".

**Link** (`links`) — what acts on what: `from` — a cell `{grid, col, row}`
or an object `{object: name}` (an actor or a zone; pictures and entries
don't trigger anything), `to` — a cell (an object can't be a target yet: the
engine sends link events to the lives of cells, and an actor of a scene that
isn't being shown doesn't exist); `event` — a pack event for the target
cell's life (an empty string — the one the source sends), `value` — a
number −32767…32767 written to its parameter 0 before the event, or `null`.
Only scenes of a map in the graph have links. For the engine
(`dgx_ge_links.h`, the map's DGLK blob) links are grouped by source: a
source names its first link, and its last one is marked. The order: the
map's scenes in document order; within a scene, sources in the order they
first appear in the list of links, each source's links together (in the
editor's list they may be interleaved — the packer gathers them).

**Map cell numbers** run through the whole map: the map's scenes in
document order, a scene's grids in order, each grid row by row; number =
the grid's `first` + `row` × `cols` + `col`. A 3×3 grid of the first scene
gives cells 0…8, a 2×2 grid of the second gives 9…12. A scene outside any
map is numbered on its own. A map has at most 65535 cells. The editor shows
the numbers and the sources' first links in the **Maps** node (the Names
table).

An entry (`entry`) also has `arrive` — a pack event for whoever arrives (an
empty string — none), and `fires` — whose links to fire on arrival:
`{scene, object}` or `{scene, grid, col, row}` — a link source in a scene of
the same map that has links, or `null`. It refers to the source's first link
in the map's link blob; an entry can fire one of the first 255.

A scene has: `map` — the map name (an empty string — the scene is outside
the graph), `index` — its number in the map, 0…255, `kind` — `room` or
`show`, `onEnter` — an event for the map rules on entering (an empty string
— none), `leave` — `{left, right, up, down}`: an event for the map rules on
leaving the scene by that side (an empty string — none; a side with an event
and no scene next to it is an exit from the map).

The editor checks: names, coordinates and `factor` fitting in 16 bits, 1 to
8 layers, tile numbers within the tileset, and that exits, entries, zones,
links, sets, scripts and actor parameters exist. A tile piece on a layer
that the scene doesn't have is a warning.

### Scenes in the pack

The packer (`add_sprites`) reads `screen` and
`scenes` from the file: each scene becomes a blob `SCENE_<NAME>` in the
DGSC format, version 5 (DGX-GE 0.4.0, the engine's `include/dgx_ge_layout.h`;
the engine refuses older versions: repack): a head of 36 bytes with the paper
(`background`, which `dgx_ge_layout_scene` makes colour 0 of the frame) and
the scene's music (`music`, `musicFade`: `dgx_ge_layout_music` asks it of the
output as the game enters the scene), layers (`factor`, `order`), pictures
(`set`/`image`, x, y, `key`, `flip` and `rotation` in one byte of flags,
`clip`), zones (`kind` — the game's word), entries (x, y, `flip`), actors (a
set with an animation; `script` — an empty string means the first script; x,
y, `flip`, `rotation`; `params` by the animation's parameter names), grids (`tileset`, x, y, `cols`, `rows`,
`cells`, `mods`, `variants`; the tileset's slots map to the scene's layers
by the pieces' layer names; a grid also gets the number of its first cell in
the map), and the scene's table of link sources (a cell, an actor or a zone,
and the number of its first link). The engine opens such a scene and lays
it out (`dgx_ge_layout.h`: layers and pictures into the game scene, a zone,
an entry, an actor with its start, a grid with its setup; a cell by number —
`dgx_ge_layout_cell_at`, a source's first link — `dgx_ge_layout_links_of`).

A map's links are one blob `<GRAPH>_<MAP>_LINKS` (DGLK, in the header
`<PREFIX>_BLOB_<GRAPH>_<MAP>_LINKS`), if the map's scenes have links.

Header constants: `<PREFIX>_SCREEN_WIDTH`, `_SCREEN_HEIGHT`;
`<PREFIX>_SCENE_<SCENE>_LAYER_`, `_PICTURE_`, `_ACTOR_`, `_ZONE_`,
`_ENTRY_`, `_GRID_<NAME>` — the index in the scene's list of that type (a
picture without a name gets no constant); zone kind words —
`<PREFIX>_ZONE_<WORD>`, in order of first appearance.

The packer refuses, and the editor reports as an error: an actor of a set
without an animation (or of a map-rules set — that one doesn't become a
kind), or with a script or parameter that doesn't exist; cells that aren't
`rows × cols`; a tile number outside the tileset; two layers, two objects of
the same type or two grids with the same name in the header; not 1…8
layers; a number that doesn't fit in 16 bits (a position, `key`, `clip`, a
zone size, an actor parameter), a modifier outside 0…255; a `rotation`
that is not a multiple of 90; a `music` that is no name (nor `stop`), a
`musicFade` outside 0…65535; a scene's layers, pictures, zones, entries and
actors taking more than 64 KB (36 bytes of head, 4 a layer, 18 a picture, 10
a zone, 6 an entry, 6 a source of links, 12 an actor and 4 a parameter of it); two pack blobs
with the same name (`SCENE_<NAME>`, a graph, a dialog, a set animation, a
tileset, map links); a link from a picture or an entry, a link to an object,
a link to a cell outside the grid, links in a scene that isn't in a graph
map; an entry's `fires` pointing to a source with no links or in a scene of
another map, a `fires` first link of 255 or more; more than 65535 cells in a
map. The packer also won't accept an object of unknown `type`, and the
editor won't open such a file. The editor is stricter in one respect: an
object name is unique across the whole scene, whatever the object's type.

## Dialog styles

The `styles` field is an optional list of styles: how a conversation looks.
A dialog names its style (`style talk`); a style that isn't in the list is
the engine's default style. The packer (`add_sprites`) puts the styles into
the `STYLES` blob (48 bytes per style, `include/dgx_ge_talk_view.h`); the
name becomes the constant `<PREFIX>_STYLE_<NAME>`.

```json
"styles": [{
    "name": "talk",
    "frame": "fill",
    "place": [4, -4, -8, 44],
    "padding": [6, 4, 6, 4],
    "font": "TerminusTTFMedium12",
    "scale": [1, 1],
    "important": false,
    "scrollMs": 1200,
    "waitMs": 0,
    "borderWidth": 1,
    "colors": {"fill": [16, 16, 48], "border": [200, 200, 220], "text": [240, 240, 240],
               "bar": [64, 64, 140], "name": [255, 220, 120]}
}]
```

| Field | Meaning; without the field — the engine's value |
| --- | --- |
| `name` | The style name, which a dialog refers to |
| `frame` | `fill` — filled with `colors.fill`, with a `colors.border` border `borderWidth` wide; `picture` — a nine-slice picture (`picture` — `{set, image}`, `insets` — `[l, t, r, b]` of the fixed corners, each at least 1, the middle at least one point; the packer cuts it into pictures `<STYLE>_FRAME_0…8` row by row — their names must not clash with set pictures; under the frame there is a `colors.fill` fill, the corners stay as they are, the edges and the middle tile from the top-left corner of their area; a slice of a two-color picture is drawn in `colors.border`; no border is drawn; 10 scene actors against 2 for the fill); `none` — no frame. Default — `fill` |
| `place` | `[x, y, w, h]` of the frame on screen: `x`, `y` below 0 count from the right and bottom edges (`x = screen + x − w`); `w`, `h` of 0 or less mean the screen size minus that much. Default — `[4, -4, -8, 44]` |
| `padding` | `[l, t, r, b]`: the text area inside the frame. Default — `[6, 4, 6, 4]` |
| `font` | A DGX font by its function name (`TerminusTTFMedium12`, the handwritten `font0ss`); the packer numbers fonts in order of first appearance (`<PREFIX>_FONT_<NAME>`, the total — `<PREFIX>_FONT_COUNT`), and the game provides a table in the same order. Default — the game's first font. For the handwritten font, `scale` is the line height in points |
| `scale` | `[largest, smallest]` integer font scales: the largest scale at which the text fits is used, but no smaller than the smallest; answers use the smallest. Default — `[1, 1]` |
| `important` | Lines are important unless the dialog says otherwise: one that doesn't fit is shown in full by scrolling, while an unimportant one is cut off with "..." |
| `scrollMs` | Scrolling of an important line: one line up every that many ms (0 — only by button). Default — 1200 |
| `waitMs` | A line without its own time moves on after that many ms; 0 — wait for the button |
| `borderWidth` | Border thickness in points. Default — 1 |
| `appear` | `now` — the line appears at once; `letters` — letter by letter, one letter every `letterMs` ms (0…255, default 40). Letters are the characters of the laid-out lines, including spaces within a line; a space at a line break and `\n` are not. While a line is appearing, scrolling waits; the button shows it in full; the line's wait time starts once it has appeared. Default — `now` |
| `portrait` | `none`, `left`, `right`: the portrait of the speaker (or of whoever is choosing) — the `face` of their role in the dialog (`roles guard GUARD "Guard" face GUARD_FACE`) — in the top corner of that side, inside the padding, clipped to `portraitWidth` (0…255) and the height of the area; the text area is narrower by `portraitWidth + padding.l` and, on the left, shifted; control pictures on the right end before the portrait. It uses its own set's colors; a two-color picture is drawn in the `text` color. Default — `none` |
| `pen` | `hard`, `soft`: the pen of the handwritten font (DGX_FONT_HW) — the soft one writes in 15 shades between `fill` and `text`; it changes nothing for bitmap fonts. Default — `hard` |
| `showName` | The name of the speaker (or of whoever is choosing) as a line above the text, in `colors.name`, at the smallest scale; the text area moves down by `yAdvance × smallest scale`. The name is the role's name in the dialog (`roles guard GUARD "Guard"`) |
| `align` | `left`, `middle`, `right`: each line of text (the name and the answers too) within its area — on the left, centered (half the leftover width, the extra point going to the right), on the right. The leftover is computed from the area width rounded up to 8 points and the width of the whole line (including "..." when cut); a line that is appearing stands where it will be when complete. The packer puts it in bits 1–2 of the style's last byte (bit 0 is `showName`). Default — `left` |
| `colors` | RGB: `fill`, `border`, `text`, `bar` (the strip under the chosen answer), `name` (the speaker's name); the game adds them to the frame's colors |

Answers are listed one per line, at the smallest scale, and are never cut
off; the list scrolls to follow the chosen one, and the `bar` strip sits
inside the frame under its line. Fields the editor doesn't know yet are kept
as they are.

The editor shows a style on the **Dialogs** tab exactly as the engine does
(`Text.js` lays text out like `src/dgx_ge_text.c`; the frame and the strip
are drawn like `src/dgx_ge_talk_view.c`). Fonts for the preview are loaded
from C sources (`Text.readFont`, like `font2c/dgx_fonts.py json` from DGX)
and are not part of the file.

## Palettes

The `palettes` field is an optional list of `{name, colors}`: color sets
without pictures of their own (the game's EGA colors, guard colors per
level). Color `n` of a palette is `colors[n − 1]`, like the colors of a pack
set for values 1…n. A tile piece color `[NAME, n]` names either a palette or
a picture set; a palette and a set can't share a name, even after conversion
to header names (`Ega` and `EGA` are the same). A palette has 1 to 255
colors. The packer (`add_sprites`) turns each palette into a
pack color set (`add_set`) after the picture sets and before the tiles and
styles; the header calls it `<PREFIX>_SET_<NAME>`.

The editor can also show a picture set in a palette's colors (Frames,
"Preview in"): the pictures' color numbers stay the same and the files
themselves don't change; it is a viewing setting and is not saved to the
markup file. A set with a ready `palette` can be shown as the packer will
take it ("the pack: …"): every color of its pictures as its nearest of that
palette by CIE76, the packer's own reckoning.

## Dialogs

The `dialogs` field is an optional list of `{name, text}`: dialog texts in
the engine's dialog language (`tools/dgx_ge_dialog.py`: `dialog`, `roles`,
`game`, `style`, `pause`, `label`, `say`/`say!`, `choose` with answers (an
answer with a control `control KIND parameter` or with a game field
`field NAME`), `tell`, `give`, `goto`, `end`; a line can show up to four
numbers `{parameter}` of the speaker, and the plural form follows the first
of them; a translation (`.po`) shows the same `{names}` in any order of its
own (the packer stores them as `{i}` — the number's position in the line),
and a name that isn't in the line is an error; `.po` files and dialog texts
are read in NFC, a BOM is skipped; answer conditions may name pack constants
— the `constants` field: `"Gamepad" if board & BOARD_PAD …`). The game's
variables (the `variables` field, DGX-GE 0.4.0, DGDL version 7): a condition
reads one (`"Quieter" if game_var.volume > 0 -> menu`), a control edits one
(`"Volume" control SLIDER game_var.volume` — instead of a parameter of the
one choosing), a line shows them (`say game "Score: {game_var.score}"`; a
line shows either the speaker's parameters or variables, not both, and a
translation shows the same `{game_var.<name>}`); a name that is no variable
of the file is an error. The editor's playback keeps its own copies of the
variables from their starting values: a control changes them, conditions and
lines read them. `pause` is a
header line, on its own with nothing after it: while the dialog is open the
game stands still (the world, time, timers, actors), but time runs for the
conversation itself; its `tell`, `give` and conditions happen at the instant
when the world is paused (the `DGX_GE_DIALOG_PAUSE` bit in the blob's flags
byte). A game field (`"Name" field name -> back`) is declared by the game
with the packer call `Pack.add_field(name, size, keyboard=, letters=)`
(header: `<PREFIX>_FIELD_<NAME>`, `_SIZE`, `<PREFIX>_FIELD_COUNT`); the
editor's file has no fields, so the editor doesn't check field names — the
packer will reject an unknown one. In the blob such an answer is a control
of kind `0xFFFE` (`DGX_GE_DIALOG_FIELD`) with the field number; `activate`
edits the field, and when editing ends the answer leads to its label. The
editor stores the text as is; the packer reads dialogs from the files
`dialogs/<name>.dlg` next to the JSON — the editor writes them into the game
folder itself (without a folder — with the ⭳ button of the dialog), just
like the sets' `.anim` files. Translations are `po/<language>.po` (gettext,
`msgctxt` is the dialog name); the editor loads them only for playback, and
they are not part of the file.

## The game as a whole

Optional fields for what the game gives the pack besides kinds, scenes and
dialogs. The editor edits them in the **Game** node and checks them the same
way the packer does (`Game.js`). The packer (`add_sprites`) reads
them from the file with the same `add_*` calls as in the table below. Times
are always text, `500ms` or `2s`; names are `[A-Za-z_][A-Za-z0-9_]*`;
events are event names of any set in the file (events are shared by the
pack).

```json
"game": [{"name": "kinds", "value": 29}, {"name": "lives", "value": 30}],
"timers": [
    {"name": "clock", "every": "1s", "reset": "never", "event": "second", "start": "game"},
    {"name": "feather", "once": "18750ms", "reset": "map", "event": "", "start": ""},
    {"name": "button", "every": "500ms", "until": "10s", "reset": "scene", "event": "release", "start": ""}
],
"sounds": ["step", "sword"],
"variables": [{"name": "score", "value": 0}, {"name": "volume", "value": 80}],
"synth": "nes",
"music": ["theme", "boss"],
"shows": [{
    "name": "TITLE",
    "pictures": [{"picture": "TITLE_BACK", "x": 0, "y": 199, "layer": 0, "flip": false, "color": 0}],
    "actors": [{"name": "words", "kind": "TITLE_WORDS", "script": "", "x": 160, "y": 100, "layer": 1, "flip": false, "color": 15}],
    "cues": [{"at": "2170ms", "role": "words", "event": "next"}, {"at": "19100ms", "role": "end", "event": ""}]
}],
"chases": [{"kind": "GUARD", "sense": "always", "sides": ["left", "right", "up", "down"], "hearing": 0,
            "near": {"left": 32, "right": 33}, "steps": 0, "calm": ""}]
```

| Field | Meaning | Packer |
| --- | --- | --- |
| `game` | A list of `{name, value}`: the game's numbers, 32-bit, in this order; they are stored in the pack (the GAME blob), and the header calls them `<PREFIX>_GAME_<NAME>`. In the editor — **Numbers** | `add_game(**{name: value})` |
| `variables` | A list of `{name, value}` (DGX-GE 0.4.0): the game's variables — numbers that change as the game plays and belong to no actor (settings, a score, the state of the rules), numbered in this order; `value` — the whole 32-bit number it begins with (0 when not given; the blob `VARIABLES`). Scripts read `game_var.<name>` and write it (`set`, `add game_var.<name>`), dialogs read it in conditions, edit it by a control and show it in lines. The header: `<PREFIX>_GAME_VAR_<NAME>`, `<PREFIX>_GAME_VAR_COUNT`. Refused: a name twice (alike in upper case), named as a constant, a number of the game (`game`) or a question of a kind (`game <name>`), more than 256, a name of the header another thing has; a script or a dialog naming one the file has not. In the editor — **Variables**; renaming one renames it in the scripts | `add_variable(name, value)` in order |
| `synth` | `fm` (when not given), `chip` or `nes` (DGX-GE 0.4.0): the synthesizer the musics play on, unless a song says its own (`#synth`); another word is refused. The firmware carries those its build names (`dgx_ge_synths(...)`) | `set_music_synth(synth)` |
| `music` | A list of names (DGX-GE 0.4.0): musics by notes; the notes of each are the file `music/<name>.mml` beside the document (MML, `tools/dgx_ge_music.py`; sets of instruments the songs name — `music/sets/<name>.mml`); without the file — a name only, it plays nothing (the packer warns). A name as scripts write it (a letter or `_`, then letters, digits, `_`), not `stop` or `volume`, once; 255 at most, counting the names scripts and scenes give. The header: `<PREFIX>_MUSIC_<NAME>`, `<PREFIX>_MUSIC_COUNT` (the names scripts give are numbered first: the animations are made before the game's parts) | `add_music(name, text, path)` |
| `musicTexts` | An object `{name: text}`: the notes of the musics as the editor keeps them (the editor's own; the packer reads `music/<name>.mml`). The editor reads them from the project folder and writes them there; a music of `music` without them is told as a name only. In the editor — **Music**: the list, `synth` and the text of the chosen music's notes | — |
| `constants` | An object `{name: number}`: pack constants — names for numbers that script texts and dialog answer conditions use instead of the numbers themselves (`{"TICK_MS": 83, "TILE_FLOOR": 2}`); names are `[A-Za-z_][A-Za-z0-9_]*`, numbers are 32-bit. The packer replaces them with numbers at build time; they go into no blob (this is not `game`), but the header gives them to C as `#define PREFIX_NAME number` (DGX-GE 0.3.0), so a name must not be another name of the header. The packer applies them before building the animations (after `meets`). In the editor — **Constants**; renaming one also renames it in scripts | `add_constants(**constants)` |
| `timers` | A list of timers: `name`; exactly one of `once` (fire once after that long) and `every` (fire every that long); `until` only with `every` (no longer than that from the start, no shorter than the period); `reset` — `never`, `scene` or `map`; `event` — a pack event for the owner when it fires, or an empty string; `start` — `game` (runs from the start of the game, the owner is the game) or an empty string. At most 255 | `add_timer(name, once=, every=, until=, reset=, event=, start=)` |
| `sounds` | A list of names; a sound's number is its position in the list, from 0 | `add_sound(name)` in order |
| `shows` | A list of shows: `name` — the blob name (must not match a set name); `pictures` — `{picture, x, y, layer, flip, rotation, color}`: a pack picture name, the base point position, layer 0…7, mirroring, the turn (optional: 0, 90, 180, 270 degrees clockwise after the mirror; DGSH version 2), the color of a one-bit picture; `actors` — `{name, kind, script, x, y, layer, flip, rotation, color}`: a role (not `end`, unique), a set with an animation, a script (empty — the first one), a position; `cues` — `{at, role, event}`: the time from the start, a role or `end`, a pack event. At least one `end` cue | `add_show(name, pictures, actors, cues)`; `cues` as `(at, role, event)` |
| `crops` | A list of `{name, set, image, x, y, width, height, originX, originY}`: a part of the frame picture `set/image` (from its top-left corner) as a pack picture of its own, `name`, with the same color set, with its base point at `originX, originY` in crop pixels | `add_crop(name, picture, x, y, width, height, origin)` |
| `chases` | A list of `{kind, sense, sides, hearing, near, steps, calm}`: a set with an animation (once only); `sense` — `none`, `sight`, `hearing`, `always`; `sides` — a subset of `left`, `right`, `up`, `down`, `doors`; `hearing` — 16-bit; `near` — an object with keys from `left`, `right`, `up`, `down` (a missing key — anywhere); `steps` 0…255; `calm` — a time up to 65535 ms or an empty string (never) | `add_chase(kind, sense=, sides=, hearing=, near=, steps=, calm=)` |

The editor writes empty lists as `[]`; older files without these fields are
read as empty. `variables`, `synth`, `music` and `musicTexts` are written
only when the file has them or they are made in the editor, so a document of
an older engine is saved as it was.

## Scene graph

Optional fields of the scene graph (`tools/dgx_ge_graph.py`, the DGSG blob,
version 3): `graph` and `maps`; the rest are fields of scenes, exits and
entries (see "Scenes"). The editor edits them in the **Maps** node and in
the scene properties, and checks them in `Maps.js`. The packer
(`add_sprites`) builds a `Graph` from them and adds it with
`add_graph`; a map's rules are the text `<rules>.anim` next to the file, and
the set named in `rules` doesn't become a pack kind. It won't accept an exit
into a scene that isn't in a map. An entry's `fires` is the number of the
source's first link in the map's link blob (see "Scenes in the pack").

```json
"graph": {"name": "WORLD", "start": {"scene": "level1", "entry": "start"}},
"maps": [
    {"name": "level1", "data": "LEVEL_1", "rules": "WORLD_LEVEL1_RULES", "number": 1,
     "exits": [{"name": "next", "scene": "level2", "entry": "start", "transition": "fade"}]},
    {"name": "title", "data": "TITLE", "rules": "", "exits": []}
]
```

| Field | Meaning | Packer |
| --- | --- | --- |
| `graph.name` | The graph name — a pack blob and the prefix of the constants `<NAME>_EXIT_*`, `_ENTRY_*`, `_MAP_*` | `Graph(name)` |
| `graph.start` | The scene and its entry where the game starts | `g.start(scene, entry)` |
| `maps[].name` | The map name | `g.map(name, data, rules)` |
| `maps[].data` | The name of the map's data blob: a level (added by the game) or a show from `shows`; an empty string — none | `data=` |
| `maps[].rules` | The name of a set (kind) with an animation — the map rules; an empty string — none. Its `.anim` text is the rules; a `go NAME` in it is written as `signal N` with the number of the exit name | `rules=` the animation text |
| `maps[].number` | The number by which the game refers to the map (the level line), 0 — none | `number=` |
| `maps[].exits` | The map's exits: `{name, scene, entry, transition}` | `g.exit(map, name, scene, entry, transition)` |
| a scene with `map` | A graph node: `g.scene(map, index, kind, onEnter)`; its side exits — `g.side`, leave events — `g.leave(scene, side, event)`, named exits — `g.exit(scene, name, to, entry, transition)`; entries — `g.entry(scene, name, x, y, left=flip, arrive, fires)` | |

The packer numbers exit and entry names in order of first appearance, and
the editor shows them the same way (the Names table): maps in order; within
a map, its scenes in document order, for each scene first its entries
(objects in order), then its named exits in order; then the map's exits. An
entry's `fires` is the number of the source's first link in the map's link
blob, in the order described in "Scenes".

## Mirroring

A flipped sprite is mirrored around the base column; the baseline doesn't
change. Pixel (x, y) becomes (−x, y): column 0 stays in place, so a flipped
actor stands exactly where it stood.

A turned one (`rotation`, a script's `rotate`; DGX-GE 0.4.0) is turned
clockwise by quarters about its base pixel after the mirror: the eight
orientations of DGX (`dgx_ge_orient(flip, quarters)`). Pixel (x, y) after the
mirror becomes (−y, x) for 90°, (−x, −y) for 180°, (y, −x) for 270°; a
quarter turn swaps the width and the height of the picture's box. A vector of
the actor's axes (x forward, y down) — a velocity, `at`, a point, a mask —
goes into the scene the same way.

| What | How it is mirrored |
| --- | --- |
| A pixel, an attachment point | (x, y) → (−x, y) |
| A mask rectangle | `x` → −(x + width − 1), the bits of each row reversed; `y`, `width`, `height` unchanged |
| The canvas | `left` → −(left + width − 1) = 1 − left − width; `top`, `width`, `height` unchanged |
| The picture | Its top-left pixel (−origin.x, −origin.y) moves to (origin.x − width + 1, −origin.y), columns reversed |

For example, the mask of `walk-1` spans x from −3 to 3, and the mirrored one
spans −3 to 3 as well. The `walk` canvas (x from −6 to 12), mirrored, spans
x from −12 to 6.

## What the editor guarantees

In a file saved by the editor:

- all coordinates and sizes are integers, sizes are non-negative;
- every frame mask is trimmed to its pixels, and an empty mask looks like
  `{"x": 0, "y": 0, "width": 0, "height": 0, "rows": []}`;
- `rows` has exactly `height` rows, each with exactly `ceil(width / 4)`
  digits, in lower case;
- a set's canvas covers the base point, the picture, the masks and the
  points of every frame of the set;
- frame masks use only indexes described in the file's `masks`;
- a set's frames are sorted by file name.

A file edited by hand may not follow these rules. A converter should check
that a frame's masks are described in the file's `masks` and that the
frame's `width` and `height` match the PNG size, and report an error rather
than guess.

## Reading it: a Python example

```python
import json


def read_sprites(path):
    with open(path, encoding='utf-8') as f:
        doc = json.load(f)
    if doc.get('format') != 'dgx-ge-sprites':
        raise ValueError('not a dgx-ge-sprites file')
    if doc.get('formatVersion', 0) > 1:
        raise ValueError('format version %s is unknown' % doc.get('formatVersion'))
    return doc


def mask_pixels(mask):
    """Pixels (x, y) of a mask, from the base point."""
    for r, row in enumerate(mask['rows']):
        for c in range(mask['width']):
            if (int(row[c // 4], 16) >> (3 - c % 4)) & 1:
                yield mask['x'] + c, mask['y'] + r


def frame_masks(sprite_set, frame, picture):
    """{index: set of pixels (x, y)} of a frame; picture is rows of palette indexes."""
    if frame['masks']:
        return {int(k): set(mask_pixels(m)) for k, m in frame['masks'].items()}
    if sprite_set.get('defaultMask') is None:
        return {}
    ox, oy = frame['origin']['x'], frame['origin']['y']
    return {sprite_set['defaultMask']: {(px - ox, py - oy)
                                        for py, line in enumerate(picture)
                                        for px, v in enumerate(line) if v}}
```

For `examples/walk.json` this gives 58 body pixels for `walk-1`, and for
`walk-3` 71 body pixels and 5 blade pixels (index 2) with x from 7 to 10.

## Pictures

- The input is indexed PNGs (color type 3), bit depth 1, 2, 4 or 8, not
  interlaced. One file is one frame.
- Index 0 is always transparent, whatever the PNG itself says (`tRNS`). All
  other indexes are opaque.
- Picture pixels are changed only by moving a selected area (the Move tool),
  by drawing (Pencil, Fill) and by editing the palette; the editor also makes
  new blank frames itself (New frame). A changed picture is saved as a PNG of
  the same size, with its own palette (a new color may increase the bit
  depth: 1, 2, 4, 8 bits) and with the same other chunks of the original
  file (`tRNS`, `pHYs`...). The markup format doesn't change because of it.

## What the file does not contain

- Pictures: a frame refers to its PNG by name; the packer looks for it next
  to the JSON, in `<SET>/<file>` or right there (or in the folder it was
  given).
- Picture palettes and pixels: they are in the PNGs (the `palettes` field
  holds palettes without pictures).
- Animation bytecode: the engine's assembler produces it from the `.anim`
  text.
- Mask visibility, zoom and other editor view settings: these are kept only
  in the browser (`localStorage`).

## Where it is in the code

| File | What's there |
| --- | --- |
| `Store.js` | `SpriteFormat` (the format name and version), `MaskLimit`, `readSprites` — checking a file being loaded, `frameExtent` — what a frame occupies on the canvas |
| `Mask.js` | Encoding a mask into `rows` and back, the default mask (`fromPicture`) |
| `Meets.js` | The `meets` text: parsing it as the packer does, the grid checkboxes, updating words when masks are renamed or deleted |
| `PngIndexed.js` | Reading pixel indexes from a PNG and writing PNGs |
| `Scene.js` | Scenes: reading and checking the `screen`, `tilesets`, `scenes` fields, constant names |
| `Anim.js` | Animations: parsing and writing `.anim` text, the matrix built from rules with its conflicts, checks, reading the `animation` field, a player that mirrors the engine's runtime |
| `Game.js` | The game as a whole: reading and checking the `game`, `constants`, `timers`, `sounds`, `shows`, `chases`, `crops` fields, and their editor |
| `Maps.js` | The scene graph: reading and checking `graph`, `maps` and the graph fields of scenes, name numbers, the map editor |
| `Styles.js`, `Dialogs.js` | Dialog styles and dialog texts: reading, checking, layout and playback |
| `Problems.js` | All checks of the file in one list, for the Problems node |
