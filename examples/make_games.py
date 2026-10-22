#!/usr/bin/env python3
"""Makes the data of the example games examples/pacman, examples/tetris, examples/snake: in each, game_data/, the
folder the editor opens (Open folder) and the packer of the engine reads (dgx_ge_pack.py add_sprites): the document
<name>.json, the pictures of each kind in a folder of its name, <KIND>.anim of each kind with animations,
dialogs/*.dlg, sounds/<name>.wav of the sounds it names (the editor keeps their names only). The game's code beside it (main/, the builds) is not touched.

Everything is drawn here, simply: no pictures of anybody else's. What the games do is data as far as the engine
takes it: the scripts of the actors, the score and the speed of the game in the game's own actor PLAY, the tiles
drawing themselves by the state of their cells, the timers, the rules as numbers of the game, a title show and a
pause dialog. The code of a game is left with its own: what the buttons do and where things may go.

The document is written as the editor writes it: it is read by the editor's own code (editor_check.js, node) and
the animations are the editor's reading of the .anim texts. Run: python3 examples/make_games.py
(then python3 examples/make_example_data.py for the button Example)."""
import glob
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))


# --- pictures ---

class Pic:
    """A picture of values of its set's colors, 0 transparent."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [0] * (w * h)

    def get(self, x, y):
        return self.px[y * self.w + x] if 0 <= x < self.w and 0 <= y < self.h else 0

    def put(self, x, y, v):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y * self.w + x] = v

    def rect(self, x, y, w, h, v):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.put(xx, yy, v)

    def frame(self, x, y, w, h, v):
        self.rect(x, y, w, 1, v)
        self.rect(x, y + h - 1, w, 1, v)
        self.rect(x, y, 1, h, v)
        self.rect(x + w - 1, y, 1, h, v)

    def disc(self, cx, cy, r, v, keep=lambda dx, dy: True):
        for y in range(self.h):
            for x in range(self.w):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                if dx * dx + dy * dy <= r * r and keep(dx, dy):
                    self.put(x, y, v)

    def text(self, x, y, s, v, scale=1):
        for ch in s:
            glyph = FONT[ch]
            for gy, row in enumerate(glyph):
                for gx, c in enumerate(row):
                    if c == '#':
                        self.rect(x + gx * scale, y + gy * scale, scale, scale, v)
            x += 6 * scale

    def outline(self, v):
        """A line of value v around what is drawn, outside it."""
        old = list(self.px)
        for y in range(self.h):
            for x in range(self.w):
                if old[y * self.w + x]:
                    continue
                if any(0 <= x + dx < self.w and 0 <= y + dy < self.h and old[(y + dy) * self.w + x + dx]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    self.px[y * self.w + x] = v


def text_size(s, scale=1):
    return (6 * len(s) - 1) * scale, 7 * scale


def text_pic(s, v, scale=1, border=0, edge=0):
    w, h = text_size(s, scale)
    p = Pic(w + 2 * border, h + 2 * border)
    p.text(border, border, s, v, scale)
    if edge:
        p.outline(edge)
    return p


# a font of 5 x 7 points, the letters the games say
FONT = {
    'A': ".###.|#...#|#...#|#####|#...#|#...#|#...#", 'B': "####.|#...#|#...#|####.|#...#|#...#|####.",
    'C': ".###.|#...#|#....|#....|#....|#...#|.###.", 'D': "####.|#...#|#...#|#...#|#...#|#...#|####.",
    'E': "#####|#....|#....|####.|#....|#....|#####", 'F': "#####|#....|#....|####.|#....|#....|#....",
    'G': ".###.|#...#|#....|#.###|#...#|#...#|.####", 'H': "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    'I': ".###.|..#..|..#..|..#..|..#..|..#..|.###.", 'J': "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
    'K': "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", 'L': "#....|#....|#....|#....|#....|#....|#####",
    'M': "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", 'N': "#...#|#...#|##..#|#.#.#|#..##|#...#|#...#",
    'O': ".###.|#...#|#...#|#...#|#...#|#...#|.###.", 'P': "####.|#...#|#...#|####.|#....|#....|#....",
    'Q': ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", 'R': "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    'S': ".####|#....|#....|.###.|....#|....#|####.", 'T': "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    'U': "#...#|#...#|#...#|#...#|#...#|#...#|.###.", 'V': "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    'W': "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.", 'X': "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    'Y': "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", 'Z': "#####|....#|...#.|..#..|.#...|#....|#####",
    '0': ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.", '1': "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
    '2': ".###.|#...#|....#|...#.|..#..|.#...|#####", '3': "####.|....#|....#|.###.|....#|....#|####.",
    '4': "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", '5': "#####|#....|####.|....#|....#|#...#|.###.",
    '6': ".###.|#....|#....|####.|#...#|#...#|.###.", '7': "#####|....#|...#.|..#..|.#...|.#...|.#...",
    '8': ".###.|#...#|#...#|.###.|#...#|#...#|.###.", '9': ".###.|#...#|#...#|.####|....#|....#|.###.",
    '!': "..#..|..#..|..#..|..#..|..#..|.....|..#..", '-': ".....|.....|.....|.###.|.....|.....|.....",
    ':': ".....|..#..|.....|.....|.....|..#..|.....", ' ': ".....|.....|.....|.....|.....|.....|.....",
}
FONT = {k: v.split('|') for k, v in FONT.items()}


def write_png(path, pic, colors):
    """An indexed PNG: value 0 transparent, value n the color colors[n - 1]; 4 bits up to 15 colors, else 8."""
    palette = [(0, 0, 0)] + [tuple(c) for c in colors]
    depth = 4 if len(palette) <= 16 else 8
    raw = bytearray()
    for y in range(pic.h):
        raw.append(0)
        row = pic.px[y * pic.w:(y + 1) * pic.w]
        if depth == 8:
            raw.extend(row)
        else:
            for i in range(0, pic.w, 2):
                raw.append(row[i] << 4 | (row[i + 1] if i + 1 < pic.w else 0))

    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)

    with open(path, 'wb') as out:
        out.write(b'\x89PNG\r\n\x1a\n')
        out.write(chunk(b'IHDR', struct.pack('>IIBBBBB', pic.w, pic.h, depth, 3, 0, 0, 0)))
        out.write(chunk(b'PLTE', bytes(v for c in palette for v in c)))
        out.write(chunk(b'tRNS', b'\x00'))
        out.write(chunk(b'IDAT', zlib.compress(bytes(raw), 9)))
        out.write(chunk(b'IEND', b''))


def square_mask(index, half):
    """A frame's mask: a square of 2 x half points around its base point (the body that meets others)."""
    w = 2 * half
    digits = (w + 3) // 4
    row = format(((1 << w) - 1) << (digits * 4 - w), f'0{digits}x')
    return {str(index): {'x': -half, 'y': -half, 'width': w, 'height': w, 'rows': [row] * w}}


# --- sounds ---

SOUND_RATE = 11025


def synth(notes, rate=SOUND_RATE):
    """Samples of notes one after another, each (from Hz, to Hz, ms, volume, shape): the pitch glides from one to the
    other; 0 Hz is a rest; shape square or triangle. Each note ends softly (no click)."""
    out, phase = [], 0.0
    for f0, f1, ms, vol, shape in notes:
        n = int(rate * ms / 1000)
        for i in range(n):
            f = f0 + (f1 - f0) * i / max(1, n - 1)
            phase = (phase + f / rate) % 1.0
            v = 0 if f0 == 0 else (1 if phase < 0.5 else -1) if shape == 'square' else 4 * abs(phase - 0.5) - 1
            fade = min(1.0, (n - i) / (rate * 0.004))
            out.append(int(v * vol * fade * 32767))
    return out


def write_wav(path, samples, rate=SOUND_RATE):
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack(f'<{len(samples)}h', *samples))


# --- a project ---

class Project:
    def __init__(self, name, title, screen):
        self.name, self.title = name, title
        self.doc = {'format': 'dgx-ge-sprites', 'formatVersion': 1, 'name': name, 'masks': [], 'sets': [],
                    'screen': {'width': screen[0], 'height': screen[1]}, 'tilesets': [], 'scenes': [], 'styles': [],
                    'palettes': [], 'dialogs': [], 'game': [], 'constants': {}, 'timers': [], 'sounds': [], 'shows': []}
        self.pictures = {}  # kind -> [(file, pic)]
        self.colors = {}  # kind -> its colors
        self.anims = {}  # kind -> .anim text
        self.dialog_files = {}
        self.sound_samples = {}  # name -> its samples: sounds/<name>.wav beside the document (the game's pack script adds them)

    def kind(self, name, colors, default_mask=None):
        self.doc['sets'].append({'name': name, 'defaultMask': default_mask, 'frames': []})
        self.pictures[name] = []
        self.colors[name] = colors
        return name

    def frame(self, kind, file, pic, origin, pack_name=None, masks=None):
        st = next(s for s in self.doc['sets'] if s['name'] == kind)
        if max(pic.px, default=0) > len(self.colors[kind]):
            raise SystemExit(f'{kind}/{file}: value {max(pic.px)}, the kind has {len(self.colors[kind])} colors')
        fr = {'image': file, 'width': pic.w, 'height': pic.h, 'origin': {'x': origin[0], 'y': origin[1]}, 'masks': masks or {}, 'points': {}}
        if pack_name:
            fr['packName'] = pack_name
        st['frames'].append(fr)
        self.pictures[kind].append((file, pic))
        return pic_name(kind, file, pack_name)

    def anim(self, kind, text):
        if not any(s['name'] == kind for s in self.doc['sets']):
            self.kind(kind, [])
        self.anims[kind] = text

    def dialog(self, name, text):
        self.doc['dialogs'].append({'name': name, 'text': text})

    def sound(self, name, samples):
        """A sound by its name (the editor keeps names only) and its samples, written as sounds/<name>.wav."""
        self.doc['sounds'].append(name)
        self.sound_samples[name] = samples

    def write(self, root):
        # the data of the game made anew, in its own folder; the game's code beside it is left as it is
        out = os.path.join(root, self.name, 'game_data')
        if os.path.exists(out):
            shutil.rmtree(out)
        os.makedirs(out)
        for st in self.doc['sets']:
            st['canvas'] = canvas_of(st['frames'])
        # the document as the editor reads it, with the animations as it reads the texts
        r = editor(self.doc, self.anims)
        doc = r['doc']
        for kind, pics in self.pictures.items():
            if not pics:
                continue
            os.makedirs(os.path.join(out, kind))
            for file, pic in pics:
                write_png(os.path.join(out, kind, file), pic, self.colors[kind])
        # the animations as the editor writes them (their comments kept): opened and saved, they stay as they are
        for kind, text in r['exported'].items():
            with open(os.path.join(out, kind + '.anim'), 'w', encoding='utf-8') as f:
                f.write(text)
        if doc.get('dialogs'):
            os.makedirs(os.path.join(out, 'dialogs'))
            for d in doc['dialogs']:
                with open(os.path.join(out, 'dialogs', d['name'] + '.dlg'), 'w', encoding='utf-8') as f:
                    f.write(d['text'])
        if self.sound_samples:
            os.makedirs(os.path.join(out, 'sounds'))
            for name, samples in self.sound_samples.items():
                write_wav(os.path.join(out, 'sounds', name + '.wav'), samples)
        with open(os.path.join(out, self.name + '.json'), 'w', encoding='utf-8') as f:
            f.write(json.dumps(doc, indent=4, ensure_ascii=False))
        errors = [p for p in r['problems'] if p['error']]
        for p in r['problems']:
            print(f"  {'error' if p['error'] else 'warning'}: {p['source']}: {p['text']}")
        print(f"{self.name}: {sum(len(p) for p in self.pictures.values())} pictures, {len(self.anims)} animations, "
              f"{len(errors)} errors, {len(r['problems']) - len(errors)} warnings")
        return r


def pic_name(kind, file, pack_name=None):
    import re
    return re.sub(r'[^A-Za-z0-9]', '_', pack_name or f'{kind}_{os.path.splitext(file)[0]}').upper()


def canvas_of(frames):
    """The canvas of a kind: every picture of it by its base point, and the base point."""
    if not frames:
        return {'left': 0, 'top': 0, 'width': 1, 'height': 1}
    left = min(min(0, -f['origin']['x']) for f in frames)
    top = min(min(0, -f['origin']['y']) for f in frames)
    right = max(max(0, f['width'] - 1 - f['origin']['x']) for f in frames)
    bottom = max(max(0, f['height'] - 1 - f['origin']['y']) for f in frames)
    return {'left': left, 'top': top, 'width': right - left + 1, 'height': bottom - top + 1}


def editor(doc, anims):
    p = subprocess.run(['node', os.path.join(HERE, 'editor_check.js')], input=json.dumps({'doc': doc, 'anims': anims}),
                       capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(p.stderr)
    r = json.loads(p.stdout)
    if r.get('error'):
        raise SystemExit(f"the editor does not take {doc['name']}: {r['error']}")
    return r


def piece(kind, file, layer, **more):
    return dict({'set': kind, 'image': file, 'dx': 0, 'dy': 0, 'layer': layer, 'key': 0}, **more)


def ref(kind, file):
    return {'set': kind, 'image': file}


def layer(name, objects=(), order='added'):
    return {'name': name, 'factor': 256, 'order': order, 'visible': True, 'locked': False, 'objects': list(objects)}


def picture(kind, file, x, y, name=''):
    return {'type': 'picture', 'name': name, 'set': kind, 'image': file, 'x': x, 'y': y, 'key': 0, 'flip': False, 'clip': None}


def actor(name, kind, script, x, y, flip=False, params=None):
    return {'type': 'actor', 'name': name, 'set': kind, 'script': script, 'x': x, 'y': y, 'flip': flip, 'params': params or {}}


def zone(name, kind, x, y, w, h):
    return {'type': 'zone', 'name': name, 'kind': kind, 'x': x, 'y': y, 'width': w, 'height': h}


def entry(name, x, y, flip=False):
    return {'type': 'entry', 'name': name, 'x': x, 'y': y, 'flip': flip}


def menu_style(screen, w, h, fill, border, text, bar):
    return {'name': 'menu', 'frame': 'fill', 'place': [(screen[0] - w) // 2, (screen[1] - h) // 2, w, h], 'padding': [8, 6, 8, 6],
            'font': 'TerminusTTFMedium12', 'scale': [1, 1], 'important': False, 'scrollMs': 1200, 'waitMs': 0, 'borderWidth': 2,
            'showName': False, 'align': 'middle', 'colors': {'fill': fill, 'border': border, 'text': text, 'bar': bar, 'name': text}}


# the game stands while it is open; its numbers are the params of the game's actor PLAY (the role play)
PAUSE_DIALOG = """dialog pause
roles play PLAY
game PLAY
style menu
pause
    say game "{title}  {numbers}"
choose play
    "Continue" -> resume
    "New game" -> restart
label resume
    end
label restart
    tell play restart
    end
"""


def words(p, kind, items, colors):
    """The kind of words: a picture of each, standing on the middle of its bottom row; blink shows one on and off."""
    p.kind(kind, colors)
    for file, s, v, scale, edge in items:
        pic = text_pic(s, v, scale, 1 if edge else 0, edge)
        p.frame(kind, file, pic, (pic.w // 2, pic.h - 1))


# --- Pac-Man ---
# The maze of the arcade, cell by cell: # wall, . a dot, o an energizer, - the door of the ghosts' house, a space a way
# with no dot (or nothing, outside the maze). Row 14 goes out at both sides: the tunnel. As DGX-GE's Pac-Man has it.
MAZE = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "     #.##### ## #####.#     ",
    "     #.##          ##.#     ",
    "     #.## ###--### ##.#     ",
    "######.## #      # ##.######",
    "      .   #      #   .      ",
    "######.## #      # ##.######",
    "     #.## ######## ##.#     ",
    "     #.##          ##.#     ",
    "     #.## ######## ##.#     ",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#.####.#####.##.#####.####.#",
    "#o..##.......  .......##..o#",
    "###.##.##.########.##.##.###",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################",
]
COLS, ROWS, CELL, TOP = 28, 31, 8, 24  # the maze from 24 points down: the score above it, the lives below
BLUE, PINK, PEACH, YELLOW, WHITE, RED = (33, 33, 222), (255, 184, 222), (255, 184, 151), (255, 255, 0), (222, 222, 255), (255, 0, 0)
GHOSTS = [("blinky", (255, 0, 0), (14 * 8, 11 * 8 + 4), 'left'), ("pinky", (255, 184, 255), (14 * 8, 14 * 8 + 4), 'down'),
          ("inky", (0, 255, 255), (12 * 8, 14 * 8 + 4), 'up'), ("clyde", (255, 184, 82), (16 * 8, 14 * 8 + 4), 'up')]
WAYS = {'right': 0, 'up': 90, 'left': 180, 'down': 270}
LOOKS = {'right': (1, 0), 'up': (0, -1), 'left': (-1, 0), 'down': (0, 1)}
FRIGHT_BLUE = (33, 33, 255)


def wall(c, r):
    return r < 0 or r >= ROWS or c < 0 or c >= COLS or MAZE[r][c] == '#'


def maze_picture():
    """The walls a line along every wall, a little inside it, round at the corners; the door a pink bar."""
    p = Pic(COLS * CELL, ROWS * CELL)
    for y in range(p.h):
        for x in range(p.w):
            c, r = x // CELL, y // CELL
            if MAZE[r][c] == '-':
                if 3 <= y % CELL <= 4:
                    p.put(x, y, 2)
                continue
            if not wall(c, r):
                continue
            d = 99.0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if wall(c + dc, r + dr):
                        continue
                    left, top = (c + dc) * CELL, (r + dr) * CELL
                    dx = max(left - x - 0.5, 0, x + 0.5 - left - CELL)
                    dy = max(top - y - 0.5, 0, y + 0.5 - top - CELL)
                    d = min(d, math.hypot(dx, dy))
            if 3.0 <= d < 4.2:
                p.put(x, y, 1)
    return p


def pacman(angle, opening):
    p = Pic(13, 13)

    def keep(dx, dy):
        if opening <= 0:
            return True
        a = math.degrees(math.atan2(-dy, dx))
        return abs((a - angle + 180) % 360 - 180) > opening / 2
    p.disc(6.5, 6.5, 6.6, 1, keep)
    return p


def ghost_body(f, v=1):
    p = Pic(14, 14)
    for y in range(14):
        for x in range(14):
            cx, cy = x + 0.5 - 7, y + 0.5 - 7
            if y < 7:
                on = cx * cx + cy * cy <= 49
            elif y < 12:
                on = True
            else:
                k = (x + (2 if f else 0)) % 4
                on = k < 2 if y == 13 else k != 3 or y == 12
            if on:
                p.put(x, y, v)
    return p


def ghost_eyes(p, look):
    for ex in (3, 9):
        for y in range(3, 8):
            for x in range(ex - 1, ex + 3):
                if not (y in (3, 7) and x in (ex - 1, ex + 2)):
                    p.put(x, y, 2)
        lx, ly = look
        px = ex - 1 if lx < 0 else ex + 1 if lx > 0 else ex
        py = 3 if ly < 0 else 6 if ly > 0 else 5
        p.rect(px, py, 2, 2, 3)
    return p


def fright_face(p, v):
    for x, y in ((4, 5), (5, 5), (4, 6), (5, 6), (8, 5), (9, 5), (8, 6), (9, 6)):
        p.put(x, y, v)
    for x in range(2, 12):
        p.put(x, 9 if x % 2 else 10, v)
    return p


def cherry():
    p = Pic(12, 12)
    for cx, cy in ((3.0, 8.5), (8.5, 9.0)):
        p.disc(cx, cy, 3.1, 1)
        p.put(int(cx - 1), int(cy - 1), 3)
    for k in range(6):
        p.put(min(11, 3 + k), 5 - k, 2)
        p.put(min(11, 8 + k // 3), 6 - k, 2)
    return p


def pacman_game():
    p = Project('pacman', 'Pac-Man', (224, 288))
    d = p.doc
    # who meets whom is the masks': Pac-Man's body, a ghost's, the fruit's, a small square around each base point (as
    # the arcade's cell); what a meeting does is the scripts' (hit): a ghost catches him or, frightened, is eaten, the
    # fruit is eaten
    d['masks'] = [{'index': 1, 'name': 'pac', 'color': '#e0c020'}, {'index': 2, 'name': 'ghost', 'color': '#e04040'},
                  {'index': 3, 'name': 'fruit', 'color': '#40c040'}]
    d['meets'] = "foreign PAC GHOST    # caught, or eaten when frightened: the ghost's hit says\nforeign PAC FRUIT    # eaten: the fruit's hit\n"
    pac_mask, ghost_mask, fruit_mask = square_mask(1, 2), square_mask(2, 2), square_mask(3, 3)

    p.kind('MAZE', [BLUE, PINK])
    p.frame('MAZE', 'maze.png', maze_picture(), (0, ROWS * CELL - 1))
    d['palettes'].append({'name': 'MAZE_WHITE', 'colors': [list(WHITE), [0, 0, 0]]})  # the maze flashing, a level cleared

    p.kind('DOTS', [PEACH])
    dot = Pic(8, 8)
    dot.rect(3, 3, 2, 2, 1)
    energizer = Pic(8, 8)
    energizer.disc(4, 4, 4.1, 1)
    p.frame('DOTS', 'dot.png', dot, (0, 7))
    p.frame('DOTS', 'energizer.png', energizer, (0, 7))
    p.frame('DOTS', 'blank.png', Pic(8, 8), (0, 7))

    p.kind('PAC', [YELLOW], default_mask=1)
    p.frame('PAC', 'full.png', pacman(0, 0), (6, 6), masks=pac_mask)
    for w, a in WAYS.items():
        p.frame('PAC', f'{w}_1.png', pacman(a, 50), (6, 6), masks=pac_mask)
        p.frame('PAC', f'{w}_2.png', pacman(a, 100), (6, 6), masks=pac_mask)
    for k in range(11):
        p.frame('PAC', f'die_{k}.png', pacman(90, 40 + k * 32), (6, 6), masks=pac_mask)

    # a ghost: Blinky's colors are the kind's, the others are palettes of the same values (the game draws each with its
    # own): 1 the body, 2 white, 3 the pupils; frightened 4 and 5, flashing 6 and 7
    ghost_colors = [GHOSTS[0][1], WHITE, BLUE, FRIGHT_BLUE, PEACH, WHITE, RED]
    p.kind('GHOST', ghost_colors, default_mask=2)
    for w, look in LOOKS.items():
        for f in (0, 1):
            p.frame('GHOST', f'{w}_{f}.png', ghost_eyes(ghost_body(f), look), (7, 7), masks=ghost_mask)
        p.frame('GHOST', f'eyes_{w}.png', ghost_eyes(Pic(14, 14), look), (7, 7), masks=ghost_mask)
    for f in (0, 1):
        p.frame('GHOST', f'fright_{f}.png', fright_face(ghost_body(f, 4), 5), (7, 7), masks=ghost_mask)
        p.frame('GHOST', f'flash_{f}.png', fright_face(ghost_body(f, 6), 7), (7, 7), masks=ghost_mask)
    for name, color, _, _ in GHOSTS[1:]:
        d['palettes'].append({'name': name.upper(), 'colors': [list(color)] + [list(c) for c in ghost_colors[1:]]})

    p.kind('FRUIT', [RED, (222, 151, 81), (255, 255, 255)], default_mask=3)
    p.frame('FRUIT', 'cherry.png', cherry(), (6, 6), masks=fruit_mask)

    words(p, 'WORDS', [('ready.png', 'READY!', 1, 1, 0), ('game_over.png', 'GAME  OVER', 2, 1, 0),
                       ('logo.png', 'PAC-MAN', 1, 3, 3), ('press_start.png', 'PRESS START', 4, 1, 0),
                       ('score.png', '1UP   HIGH SCORE', 4, 1, 0)], [YELLOW, RED, BLUE, WHITE])

    # the dots are a grid: the game clears a cell where Pac-Man eats; an energizer blinks by itself
    d['tilesets'].append({'name': 'MAZE', 'cellWidth': CELL, 'cellHeight': CELL, 'fields': {}, 'tiles': [
        {'name': 'dot', 'kind': 1, 'solid': {}, 'pieces': [piece('DOTS', 'dot.png', 'dots')]},
        {'name': 'energizer', 'kind': 2, 'solid': {}, 'pieces': [
            {'cycle': [dict(ref('DOTS', 'energizer.png'), ms=166), dict(ref('DOTS', 'blank.png'), ms=166)], 'dx': 0, 'dy': 0,
             'layer': 'dots', 'key': 0}]},
        # the walls and the door of the ghosts' house: where one may not go (the game's open()); the picture MAZE draws them
        {'name': 'wall', 'kind': 3, 'solid': {'top': True, 'left': True, 'right': True, 'bottom': True}, 'pieces': []},
        {'name': 'door', 'kind': 4, 'solid': {'top': True, 'bottom': True}, 'pieces': []},
    ]})
    # the maze as cells: a dot, an energizer, a wall, the door; 0 a way with nothing in it (or outside the maze)
    cells = [[{'.': 1, 'o': 2, '#': 3, '-': 4}.get(ch, 0) for ch in row] for row in MAZE]
    # the ghosts as they start: Blinky above the door, out at once; the others in the house, each waiting for so many
    # dots eaten (wait) after the one before it is out
    waits = (0, 0, 30, 60)
    ghosts = [actor(name, 'GHOST', 'out' if i == 0 else 'home', x, y + TOP, params={'who': i, 'way': f'WAY_{way.upper()}', 'wait': waits[i]})
              for i, (name, _, (x, y), way) in enumerate(GHOSTS)]
    d['scenes'].append({
        'name': 'maze', 'width': 224, 'height': 288, 'background': '#000000',
        'layers': [
            layer('maze', [picture('MAZE', 'maze.png', 0, TOP + ROWS * CELL - 1, 'walls')]),
            layer('dots'),
            layer('actors', [actor('pac', 'PAC', 'whole', 14 * 8, 23 * 8 + 4 + TOP)] + ghosts + [
                actor('fruit', 'FRUIT', 'hidden', 14 * 8, 17 * 8 + 4 + TOP),
                zone('house', 'house', 10 * 8, TOP + 12 * 8, 8 * 8, 5 * 8),
                zone('tunnel_left', 'tunnel', 0, TOP + 14 * 8, 6 * 8, 8),
                zone('tunnel_right', 'tunnel', 22 * 8, TOP + 14 * 8, 6 * 8, 8),
                entry('house_door', 14 * 8, 11 * 8 + 4 + TOP),
            ]),
            layer('text', [picture('WORDS', 'score.png', 112, 8, 'score_words'),
                           zone('message', 'message', 56, TOP + 17 * 8, 112, 8),  # what PLAY shows: READY!, GAME OVER
                           zone('score', 'label', 8, 8, 56, 16), zone('high', 'label', 84, 8, 56, 16),
                           zone('lives', 'lives', 16, 274, 80, 13)]),
        ],
        'grids': [{'name': 'maze', 'tileset': 'MAZE', 'x': 0, 'y': TOP, 'cols': COLS, 'rows': ROWS, 'cells': cells, 'mods': {}, 'variants': {}}],
        'exits': [], 'links': []})

    # the rules of the arcade, level 1. Speeds in points a second x 256, times ms. What only the game's code reads is a
    # number of the game (GAME blob: PACMAN_GAME_*); what the scripts read is a constant (the game's code reads them
    # too, by the header its pack script writes of them: PACMAN_<NAME>)
    top = 75.75757625

    def speed(v):
        return round(v * top * 256)
    d['game'] = [{'name': n, 'value': v} for n, v in (
        ('pac_speed', speed(.80)), ('pac_fright_speed', speed(.90)), ('corner_points', 4), ('dot_pause_ms', 17),
        ('energizer_pause_ms', 50), ('points_ms', 1500), ('kinds', 8), ('timers', 2), ('voices', 4))] + [
        # the four cells a ghost hunting does not turn up from: the arcade's
        {'name': f'no_up_{i + 1}_{axis}', 'value': v} for i, cell in enumerate(((12, 11), (15, 11), (12, 23), (15, 23)))
        for axis, v in zip(('col', 'row'), cell)]
    d['constants'] = {
        # the ways, as DGX-GE's sides (dgx_ge_graph.h); where a ghost is (its param state); the phases of the game
        # (PLAY's param phase)
        'WAY_LEFT': 0, 'WAY_RIGHT': 1, 'WAY_UP': 2, 'WAY_DOWN': 3,
        'ST_HOUSE': 0, 'ST_LEAVING': 1, 'ST_HUNTING': 2, 'ST_BLUE': 3, 'ST_EYES': 4, 'ST_ENTERING': 5,
        'PH_TITLE': 0, 'PH_READY': 1, 'PH_PLAYING': 2, 'PH_ATE': 3, 'PH_CAUGHT': 4, 'PH_DYING': 5, 'PH_CLEARED': 6, 'PH_OVER': 7,
        # the signals of the actors to the game: PLAY's, then the ghosts', Pac-Man's, the fruit's; MODES' are the modes
        'SIG_NUMBERS': 1, 'SIG_LAY': 2, 'SIG_PLACE': 3, 'SIG_DIE': 4, 'SIG_HIDE': 5, 'SIG_WHITE': 6, 'SIG_BLUE': 7,
        'SIG_FRUIT': 8, 'SIG_RELEASE': 9, 'SIG_OVER': 10, 'SIG_TITLE': 11,
        'SIG_OUT': 12, 'SIG_EATEN': 13, 'SIG_CAUGHT': 14, 'SIG_GONE': 15, 'SIG_TAKEN': 16,
        'SCATTER': 1, 'CHASE': 2,
        'COLS': COLS, 'ROWS': ROWS, 'FRIGHT_LOOPS': 14, 'FRIGHT_FLASHES': 5,
        'GHOST_SPEED': speed(.75), 'GHOST_FRIGHT_SPEED': speed(.50), 'GHOST_TUNNEL_SPEED': speed(.40), 'EYES_SPEED': speed(1.60),
        'HOUSE_SPEED': speed(.50), 'ELROY1_SPEED': speed(.80), 'ELROY2_SPEED': speed(.85), 'ELROY1_DOTS': 20, 'ELROY2_DOTS': 10,
        'DOT_SCORE': 10, 'ENERGIZER_SCORE': 50, 'GHOST_SCORE': 200, 'FRUIT_SCORE': 100, 'LIVES': 3, 'EXTRA_LIFE': 10000,
        'DOTS': 244, 'FRUIT_DOTS1': 70, 'FRUIT_DOTS2': 170, 'READY_MS': 2000, 'EAT_GHOST_MS': 1000, 'FRUIT_MS': 9500}
    # the sounds, made here as the pictures are: a melody of a start, a chomp, a siren, a blip
    sq, tri = 'square', 'triangle'
    for name, notes in (
            ('start', [(f, f, 110, .3, tri) for f in (523, 659, 784, 1047, 784, 659, 523, 0, 587, 740, 880, 1175, 880, 740, 587, 0,
                                                      523, 659, 784, 1047)] + [(1047, 1047, 330, .3, tri)]),
            ('chomp', [(480, 240, 55, .18, sq), (240, 480, 55, .18, sq)]),
            ('fright', [(f0, f1, 70, .2, tri) for _ in range(4) for f0, f1 in ((300, 650), (650, 300))]),
            ('eat_ghost', [(180, 1400, 280, .25, sq)]),
            ('death', [(f, f - 260, 140, .25, tri) for f in range(950, 250, -100)] + [(0, 0, 80, 0, sq), (200, 120, 90, .3, sq),
                                                                                       (0, 0, 60, 0, sq), (200, 120, 90, .3, sq)]),
            ('fruit', [(700, 1100, 70, .25, sq), (0, 0, 30, 0, sq), (1100, 1500, 90, .25, sq)]),
            ('extra_life', [n for _ in range(6) for n in ((1320, 1320, 70, .22, sq), (0, 0, 50, 0, sq))])):
        p.sound(name, synth(notes))
    d['constants'].update({f'SND_{s.upper()}': i for i, s in enumerate(d['sounds'])})
    d['timers'] = [
        # the house lets the next ghost out when no dot is eaten for so long: each dot starts it anew
        {'name': 'idle', 'once': '4000ms', 'reset': 'scene', 'event': 'idle', 'start': ''},
    ]

    ways = list(WAYS)
    chomp = ''.join(f"""
script {w}
    masks PAC
label {w}_chomp
    frame PAC_{w.upper()}_1 40ms
    frame PAC_{w.upper()}_2 40ms
    frame PAC_{w.upper()}_1 40ms
    frame PAC_FULL 40ms
    goto {w}_chomp
""" for w in ways)
    still = ''.join(f"""
script still_{w}            # against a wall: his mouth stays as it was
    frame PAC_{w.upper()}_1 1000ms
    hold
""" for w in ways)
    p.anim('PAC', f"""# Pac-Man: chomping his way, still against a wall, caught, dying, running on the title.
# The game moves him from the middle of a cell to the next (dgx_ge_walk.h) and tells him his way. His body is the
# mask PAC: a ghost that meets it says what follows (its hit: caught).
event left, right, up, down, stop, caught, die

script whole
    masks PAC
    frame PAC_FULL 1000ms
    hold
{chomp}{still}
script caught               # a ghost has him: he stands whole; the game is told (PLAY stands it all a while)
    masks
    signal SIG_CAUGHT
    frame PAC_FULL 1000ms
    hold

script dying
    masks
    sound SND_DEATH
""" + ''.join(f"    frame PAC_DIE_{k} 133ms\n" for k in range(11)) + f"""    frame none 500ms
    signal SIG_GONE           # tell the game: he is gone
label gone
    frame none 1000ms
    goto gone

script parade               # entry: the title show starts it; he runs across, the ghost after him
    masks
    velocity 60 0
label parade_chomp
    frame PAC_RIGHT_1 40ms
    frame PAC_RIGHT_2 40ms
    frame PAC_RIGHT_1 40ms
    frame PAC_FULL 40ms
    goto parade_chomp

group any: whole, {', '.join(ways)}, {', '.join('still_' + w for w in ways)}
""" + ''.join(f"on {w}: any -> {w} now\n" for w in ways) + ''.join(f"on stop: {w} -> still_{w} now\n" for w in ways)
           + "on caught: any -> caught now\non die: caught -> dying now\n")

    # what a ghost hunting aims at, before each of its frames: the arcade's, by who. Blinky hurrying (so few dots
    # left: "Cruise Elroy") is faster and hunts scattering too.
    elroy1, elroy2 = 'who == 0 and game.dots_left <= ELROY1_DOTS', 'who == 0 and game.dots_left <= ELROY2_DOTS'
    hunt = f"""    set speed game.tunnel ? GHOST_TUNNEL_SPEED : (({elroy2}) ? ELROY2_SPEED : (({elroy1}) ? ELROY1_SPEED : GHOST_SPEED))
    set tcol game.pac_col + (way_dx[game.pac_way] - (game.pac_way == WAY_UP)) * ahead[who]
    set trow game.pac_row + way_dy[game.pac_way] * ahead[who]
    set tcol who == 2 ? 2 * tcol - game.blinky_col : tcol
    set trow who == 2 ? 2 * trow - game.blinky_row : trow
    set aim (game.mode == SCATTER and not ({elroy1})) or (who == 3 and (game.col - game.pac_col) * (game.col - game.pac_col) + (game.row - game.pac_row) * (game.row - game.pac_row) <= 64)
    set tcol aim ? corner_col[who] : tcol
    set trow aim ? corner_row[who] : trow
"""
    # frightened: slow, anywhere (a cell of the dice, anew each frame)
    scared = """    set speed game.tunnel ? GHOST_TUNNEL_SPEED : GHOST_FRIGHT_SPEED
    set tcol rnd(COLS - 1)
    set trow rnd(ROWS - 1)
"""
    walk = ''.join(f"""
script {w}
    set way WAY_{w.upper()}
    set state ST_HUNTING
    masks GHOST
    hit GHOST on PAC event caught
label {w}_go
{hunt}    frame GHOST_{w.upper()}_0 133ms
{hunt}    frame GHOST_{w.upper()}_1 133ms
    goto {w}_go
""" for w in ways)
    eyes = ''.join(f"""
script eyes_{w}
    set way WAY_{w.upper()}
    frame GHOST_EYES_{w.upper()} 1000ms
    hold
""" for w in ways)
    leave = 'goto leaving if game.next_home == who and game.eaten >= wait'
    p.anim('GHOST', f"""# A ghost, all it does: bobbing in the house till its turn, out through the door, hunting in the maze,
# frightened, eaten, its eyes home and in through the door, out again. In the maze the game walks it from the middle
# of a cell to the next (dgx_ge_walk.h) toward the cell it aims at (tcol, trow) at its speed (speed), and tells it
# its way; in the house its own path moves it. Where it aims is the arcade's, by who: Blinky at Pac-Man's cell, Pinky
# four cells ahead of him, Inky past two ahead as far again as Blinky is from there, Clyde at Pac-Man when far and
# at his corner when near; scattering, each at its corner; frightened, anywhere. Its body (the mask GHOST) catches
# Pac-Man, or is eaten by him frightened (its hit). The four are one kind: the game draws each with its colors
# (param who: the palettes PINKY, INKY, CLYDE). What it asks the game (game.*): where Pac-Man is (his cell, his way),
# where Blinky is, its own cell, the mode, the dots left, whether it is in a tunnel, which ghost is the next in the
# house, the dots eaten, the door and the middle of the house.
event left, right, up, down, fright, eaten, enter, leave, hide
game pac_col pac_row pac_way blinky_col blinky_row col row mode dots_left tunnel next_home eaten door_col door_row door_x door_y inside_y
table way_dx -1 1 0 0         # by WAY_*
table way_dy 0 0 -1 1
table ahead 0 4 2 0           # cells ahead of Pac-Man, by who
table corner_col 25 2 27 0    # where each scatters: cells outside the maze, above and below it
table corner_row -3 -3 31 31
param who 0                 # 0 Blinky, 1 Pinky, 2 Inky, 3 Clyde
param way WAY_LEFT          # the way it goes now: frightened, the game keeps telling it, for after
param wait 0                # dots eaten before it may leave the house
param state ST_HOUSE        # where it is (ST_*): the game walks it in the maze (hunting, blue, eyes)
param speed GHOST_SPEED     # in the maze, points a second x 256
param tcol 0                # the cell it aims at
param trow 0
param aim 0                 # 1: its corner
param n 0
param dist 0

script home                 # in the house, bobbing, till it is the next and its dots are eaten (or the game lets it out)
    set state ST_HOUSE
    masks
    path x: 0, y: (who % 2 ? 4 : -4) * sin(t * HOUSE_SPEED / 1024)
label home_up
    {leave}
    goto home_down if vy > 0
    frame GHOST_UP_0 133ms
    {leave}
    goto home_down if vy > 0
    frame GHOST_UP_1 133ms
    goto home_up
label home_down
    {leave}
    goto home_up if vy < 0
    frame GHOST_DOWN_0 133ms
    {leave}
    goto home_up if vy < 0
    frame GHOST_DOWN_1 133ms
    goto home_down

script leaving              # out of the house: to the middle of the door, then up through it
    set state ST_LEAVING
    masks
    set dist game.door_x - x
    path x: max(min(t * HOUSE_SPEED / 256, dist), -t * HOUSE_SPEED / 256), y: 0
    goto leave_up if abs(dist) < 0.5
    goto leave_left if dist < 0
label leave_right
    frame GHOST_RIGHT_0 133ms
    goto leave_up if x >= game.door_x - 0.5
    frame GHOST_RIGHT_1 133ms
    goto leave_up if x >= game.door_x - 0.5
    goto leave_right
label leave_left
    frame GHOST_LEFT_0 133ms
    goto leave_up if x <= game.door_x + 0.5
    frame GHOST_LEFT_1 133ms
    goto leave_up if x <= game.door_x + 0.5
    goto leave_left
label leave_up
    set dist y - game.door_y
    path x: 0, y: -min(t * HOUSE_SPEED / 256, dist)
label leave_up_go
    frame GHOST_UP_0 133ms
    goto out if y <= game.door_y + 0.5
    frame GHOST_UP_1 133ms
    goto out if y <= game.door_y + 0.5
    goto leave_up_go

script out                  # above the door: the game walks it from here, left
    velocity 0 0
    signal SIG_OUT
    goto left

script walk                 # hunting on its way, whichever it was
    goto right if way == WAY_RIGHT
    goto up if way == WAY_UP
    goto down if way == WAY_DOWN
    goto left
{walk}
script fright               # blue for a while, then flashing; slow, anywhere; Pac-Man eats it
    set state ST_BLUE
    masks GHOST
    hit GHOST on PAC recoil eaten
    sound SND_FRIGHT
    set n 0
label fright_blue
{scared}    frame GHOST_FRIGHT_0 133ms
{scared}    frame GHOST_FRIGHT_1 133ms
    add n 1
    goto fright_blue if n < FRIGHT_LOOPS
    set n 0
label fright_flash
{scared}    frame GHOST_FLASH_0 233ms
{scared}    frame GHOST_FRIGHT_0 233ms
    add n 1
    goto fright_flash if n < FRIGHT_FLASHES
    goto walk

script eyes                 # eaten: only its eyes go home, fast, to the door; they meet nothing
    set state ST_EYES
    masks
    sound SND_EAT_GHOST
    signal SIG_EATEN          # tell the game: PLAY counts it
    set speed EYES_SPEED
    set tcol game.door_col
    set trow game.door_row
    goto eyes_right if way == WAY_RIGHT
    goto eyes_up if way == WAY_UP
    goto eyes_down if way == WAY_DOWN
    goto eyes_left
{eyes}
script entering             # at the door (the game says): its eyes in, down to the middle of the house; alive, out again
    set state ST_ENTERING
    set dist game.door_x - x
    path x: max(min(t * EYES_SPEED / 256, dist), -t * EYES_SPEED / 256), y: 0
label entering_side
    frame GHOST_EYES_DOWN 33ms
    goto entering_down if abs(x - game.door_x) < 0.5
    goto entering_side
label entering_down
    set dist game.inside_y - y
    path x: 0, y: min(t * EYES_SPEED / 256, dist)
label entering_down_go
    frame GHOST_EYES_DOWN 33ms
    goto leaving if y >= game.inside_y - 0.5
    goto entering_down_go

script hidden               # gone a while (Pac-Man dying, the level eaten): the game starts it anew
    masks
    velocity 0 0
label hidden_still
    frame none 1000ms
    goto hidden_still

script parade               # entry: the title show starts it; after Pac-Man
    masks
    velocity 60 0
label parade_go
    frame GHOST_RIGHT_0 133ms
    frame GHOST_RIGHT_1 133ms
    goto parade_go

group hunting: walk, {', '.join(ways)}
group looking: eyes, {', '.join('eyes_' + w for w in ways)}
group seen: home, leaving, out, walk, {', '.join(ways)}, fright, eyes, {', '.join('eyes_' + w for w in ways)}, entering
""" + ''.join(f"on {w}: hunting -> {w} now\non {w}: looking -> eyes_{w} now\n" for w in ways) + """on fright: hunting -> fright now
on fright: fright -> fright now
on eaten: fright -> eyes now
on enter: looking -> entering now
on leave: home -> leaving now
on hide: seen -> hidden now
""")

    p.anim('FRUIT', """# The fruit under the house: shown a while when PLAY says (SIG_FRUIT); Pac-Man meeting it eats it (its hit).
event show, eaten, hide

script hidden
    masks
    frame none 1000ms
    hold

script shown
    masks FRUIT
    hit FRUIT on PAC recoil eaten
    frame FRUIT_CHERRY FRUIT_MS
    goto hidden

script taken
    masks
    sound SND_FRUIT
    signal SIG_TAKEN          # tell the game: PLAY counts it
    goto hidden

on show: hidden -> shown now
on eaten: shown -> taken now
on hide: shown -> hidden now
""")

    p.anim('MODES', """# The schedule of the ghosts' modes, level 1: a signal to the game as each begins. The game starts it
# with a life (an actor of its own, not drawn); its clock stands while the ghosts are frightened.
script schedule
    signal SCATTER
    frame none 7000ms
    signal CHASE
    frame none 20000ms
    signal SCATTER
    frame none 7000ms
    signal CHASE
    frame none 20000ms
    signal SCATTER
    frame none 5000ms
    signal CHASE
    frame none 20000ms
    signal SCATTER
    frame none 5000ms
    signal CHASE
label chasing                 # the last chase lasts
    frame none 60000ms
    goto chasing
""")

    play = ['title', 'new_game', 'level', 'ready', 'playing', 'ate_dot', 'ate_energizer', 'counted', 'fruit_comes', 'scored',
            'bonus_life', 'ate_ghost', 'ate_fruit', 'release', 'caught', 'life_lost', 'cleared', 'game_over', 'over']
    p.anim('PLAY', """# The game itself as an actor: its numbers, its phases and how long each lasts, and the word it shows (READY!,
# GAME OVER: the game draws it in the zone message). The game tells it what happened and reads its phase (what moves
# now: PH_*) and its numbers (PACMAN_PLAY_PARAM_*); the pause dialog shows them. Its signals: SIG_NUMBERS the
# numbers changed, SIG_LAY the dots anew (a game, a level), SIG_PLACE everyone where they start, SIG_DIE Pac-Man dies
# (the ghosts go), SIG_HIDE the ghosts and the fruit go (the level eaten), SIG_WHITE and SIG_BLUE the maze flashing,
# SIG_FRUIT the fruit comes, SIG_RELEASE the next ghost out of the house (no dot eaten for a while: the timer idle),
# SIG_OVER the game is over, SIG_TITLE the title again.
event start, restart, dot, energizer, ghost, fruit, caught, lost, idle
param phase PH_TITLE
param score 0
param lives LIVES
param eaten 0                 # dots and energizers eaten on this level
param bonus GHOST_SCORE       # what the next ghost of this fright is worth
param extra 0                 # 1: the extra life of this game is given

script title                  # the title show plays (the game's)
    set phase PH_TITLE
    frame none 1000ms
    hold

script new_game
    set score 0
    set lives LIVES
    set extra 0
    sound SND_START
    goto level

script level                  # the dots anew
    set eaten 0
    signal SIG_LAY
    goto ready

script ready                  # everyone where they start, READY! a while, then the game goes
    set phase PH_READY
    timer stop idle
    signal SIG_PLACE
    signal SIG_NUMBERS
    frame WORDS_READY READY_MS
    set phase PH_PLAYING
    timer start idle
    goto playing

script playing
    frame none 1000ms
    hold

script ate_dot
    add score DOT_SCORE
    goto counted

script ate_energizer
    add score ENERGIZER_SCORE
    set bonus GHOST_SCORE
    goto counted

script counted
    add eaten 1
    sound SND_CHOMP
    timer start idle            # anew: no dot for so long, the house lets one out
    goto cleared if eaten >= DOTS
    goto fruit_comes if eaten == FRUIT_DOTS1 or eaten == FRUIT_DOTS2
    goto scored

script fruit_comes            # under the house, for a while (the fruit's own time)
    signal SIG_FRUIT
    goto scored

script scored                 # the numbers shown anew; an extra life once a game
    signal SIG_NUMBERS
    goto bonus_life if extra == 0 and score >= EXTRA_LIFE
    goto playing

script bonus_life
    set extra 1
    add lives 1
    sound SND_EXTRA_LIFE
    signal SIG_NUMBERS
    goto playing

script ate_ghost              # 200, 400, 800, 1600 in one fright: all stands a while, its points shown
    add score bonus
    set bonus bonus * 2
    set phase PH_ATE
    timer hold idle
    signal SIG_NUMBERS
    frame none EAT_GHOST_MS
    set phase PH_PLAYING
    timer go idle
    goto scored

script ate_fruit
    add score FRUIT_SCORE
    goto scored

script release                # no dot eaten for so long: the next ghost out, and the time anew
    signal SIG_RELEASE
    timer start idle
    goto playing

script caught                 # a ghost has him: all stands a second, then he dies (the ghosts go)
    set phase PH_CAUGHT
    timer stop idle
    frame none 1000ms
    set phase PH_DYING
    signal SIG_DIE
    frame none 1000ms
    hold

script life_lost              # he is gone (the game says): again, or the game is over
    add lives -1
    signal SIG_NUMBERS
    goto ready if lives > 0
    goto game_over

script cleared                # the level eaten: all stands, the maze flashes, the next level
    set phase PH_CLEARED
    timer stop idle
    signal SIG_NUMBERS
    frame none 1000ms
    signal SIG_HIDE
""" + """    signal SIG_WHITE
    frame none 233ms
    signal SIG_BLUE
    frame none 233ms
""" * 4 + """    frame none 300ms
    goto level

script game_over
    set phase PH_OVER
    signal SIG_OVER
    frame WORDS_GAME_OVER 1000ms  # a start in this second is not taken
    goto over

script over
    frame WORDS_GAME_OVER 7000ms
    signal SIG_TITLE
    goto title

group any: """ + ', '.join(play) + """
on start: title -> new_game now
on start: over -> new_game now
on restart: any -> new_game now
on dot: playing -> ate_dot now
on energizer: playing -> ate_energizer now
on ghost: playing -> ate_ghost now
on fruit: playing -> ate_fruit now
on idle: playing -> release now
on caught: playing -> caught now
on lost: caught -> life_lost now
""")
    p.anim('WORDS', """# Words on the screen: the prompt of the title blinks.
script blink
    frame WORDS_PRESS_START 500ms
    frame none 300ms
    goto blink
""")

    d['shows'] = [{'name': 'TITLE', 'pictures': [{'picture': 'WORDS_LOGO', 'x': 112, 'y': 90, 'layer': 0, 'flip': False, 'color': 0}],
                   'actors': [{'name': 'prompt', 'kind': 'WORDS', 'script': 'blink', 'x': 112, 'y': 230, 'layer': 1, 'flip': False, 'color': 0},
                              {'name': 'pac', 'kind': 'PAC', 'script': 'parade', 'x': -20, 'y': 160, 'layer': 1, 'flip': False, 'color': 0},
                              {'name': 'ghost', 'kind': 'GHOST', 'script': 'parade', 'x': -60, 'y': 160, 'layer': 1, 'flip': False, 'color': 0}],
                   'cues': [{'at': '5s', 'role': 'end', 'event': ''}]}]
    d['styles'] = [menu_style((224, 288), 160, 64, [0, 0, 0], list(BLUE), list(WHITE), [33, 33, 120])]
    p.dialog('pause', PAUSE_DIALOG.format(title='PAUSE', numbers='Score {score}  Lives {lives}'))
    return p


# --- Tetris ---
PIECES = {  # the seven, each in its four turns: rows of 4 x 4 (the game's numbers TETRIS_GAME_<P>_<TURN>)
    'I': ["....|####|....|....", "..#.|..#.|..#.|..#.", "....|....|####|....", ".#..|.#..|.#..|.#.."],
    'O': [".##.|.##.|....|...."] * 4,
    'T': [".#..|###.|....|....", ".#..|.##.|.#..|....", "....|###.|.#..|....", ".#..|##..|.#..|...."],
    'S': [".##.|##..|....|....", ".#..|.##.|..#.|....", "....|.##.|##..|....", "#...|##..|.#..|...."],
    'Z': ["##..|.##.|....|....", "..#.|.##.|.#..|....", "....|##..|.##.|....", ".#..|##..|#...|...."],
    'J': ["#...|###.|....|....", ".##.|.#..|.#..|....", "....|###.|..#.|....", ".#..|.#..|##..|...."],
    'L': ["..#.|###.|....|....", ".#..|.#..|.##.|....", "....|###.|#...|....", "##..|.#..|.#..|...."],
}
PIECE_COLORS = {'I': (0, 220, 230), 'O': (240, 220, 0), 'T': (170, 60, 220), 'S': (60, 210, 60), 'Z': (230, 50, 50),
                'J': (50, 90, 240), 'L': (250, 150, 20)}
TC = 10  # a cell, points
WELL_X, WELL_Y = 110, 20


def shape_bits(shape):
    bits = 0
    for r, row in enumerate(shape.split('|')):
        for c, ch in enumerate(row):
            if ch == '#':
                bits |= 1 << (15 - (r * 4 + c))
    return bits


def lighter(c, k=0.55):
    return tuple(round(v + (255 - v) * k) for v in c)


def tetris_game():
    p = Project('tetris', 'Tetris', (320, 240))
    d = p.doc
    # the blocks: value 2k-1 the color of piece k, 2k its light edge; 15 white, of a line going
    colors = []
    for k in 'IOTSZJL':
        colors += [PIECE_COLORS[k], lighter(PIECE_COLORS[k])]
    colors.append((255, 255, 255))
    p.kind('BLOCKS', colors)
    for i, k in enumerate('IOTSZJL'):
        base, light = 2 * i + 1, 2 * i + 2
        b = Pic(TC, TC)
        b.rect(0, 0, TC, TC, base)
        b.rect(0, 0, TC, 1, light)
        b.rect(0, 0, 1, TC, light)
        b.rect(3, 3, 3, 3, light)
        p.frame('BLOCKS', f'{k.lower()}.png', b, (0, TC - 1))
        g = Pic(TC, TC)
        g.frame(0, 0, TC, TC, light)
        p.frame('BLOCKS', f'shadow_{k.lower()}.png', g, (0, TC - 1))
    flash = Pic(TC, TC)
    flash.rect(0, 0, TC, TC, 15)
    p.frame('BLOCKS', 'flash.png', flash, (0, TC - 1))
    dim = Pic(TC, TC)
    dim.rect(1, 1, TC - 2, TC - 2, 15)
    for y in range(TC):
        for x in range(TC):
            if (x + y) % 2:
                dim.put(x, y, 0)
    p.frame('BLOCKS', 'flash_dim.png', dim, (0, TC - 1))

    # the well and the boxes beside it
    GREY, DARK, LIGHT, INK = (120, 120, 140), (50, 50, 70), (190, 190, 210), (20, 20, 40)
    p.kind('WELL', [GREY, DARK, LIGHT, INK])
    w = Pic(10 * TC + 8, 20 * TC + 4)
    w.rect(0, 0, 4, w.h, 1)
    w.rect(w.w - 4, 0, 4, w.h, 1)
    w.rect(0, w.h - 4, w.w, 4, 1)
    w.rect(0, 0, 1, w.h, 3)
    w.rect(w.w - 1, 0, 1, w.h, 2)
    w.rect(0, w.h - 1, w.w, 1, 2)
    w.rect(4, 0, 10 * TC, 20 * TC, 4)
    p.frame('WELL', 'well.png', w, (4, 0))  # its base point the left upper corner of the well's inside
    box = Pic(84, 40)
    box.rect(0, 0, 84, 40, 4)
    box.frame(0, 0, 84, 40, 1)
    box.frame(1, 1, 82, 38, 2)
    p.frame('WELL', 'box.png', box, (0, 0))
    words(p, 'WORDS', [('next.png', 'NEXT', 1, 1, 0), ('score.png', 'SCORE', 1, 1, 0), ('lines.png', 'LINES', 1, 1, 0),
                       ('level.png', 'LEVEL', 1, 1, 0), ('game_over.png', 'GAME OVER', 2, 2, 3), ('press_start.png', 'PRESS START', 1, 1, 0),
                       ('paused.png', 'PAUSED', 1, 2, 3)], [(240, 240, 250), (230, 50, 50), (20, 20, 40)])

    # the title: the six letters fall in, each of a color of a piece
    letters = ['T', 'E', 'T', 'R', 'I', 'S']
    tones = ['Z', 'L', 'O', 'S', 'I', 'T']
    p.kind('LOGO', [PIECE_COLORS[t] for t in tones] + [(20, 20, 40)])
    for i, ch in enumerate(letters):
        pic = text_pic(ch, i + 1, 5, 1, 7)
        p.frame('LOGO', f'letter_{i + 1}.png', pic, (pic.w // 2, pic.h - 1))

    d['tilesets'].append({'name': 'TETRIS', 'cellWidth': TC, 'cellHeight': TC, 'fields': {}, 'tiles': [
        # a block of the well, its piece by the modifier of its cell: 0 I, 1 O, 2 T, 3 S, 4 Z, 5 J, 6 L
        {'name': 'block', 'kind': 1, 'solid': {'top': True, 'left': True, 'right': True, 'bottom': True},
         'pieces': [{'by_mod': [ref('BLOCKS', f'{k.lower()}.png') for k in 'IOTSZJL'], 'dx': 0, 'dy': 0, 'layer': 'blocks', 'key': 0}]},
        # where the piece falling would land
        {'name': 'shadow', 'kind': 2, 'solid': {},
         'pieces': [{'by_mod': [ref('BLOCKS', f'shadow_{k.lower()}.png') for k in 'IOTSZJL'], 'dx': 0, 'dy': 0, 'layer': 'blocks', 'key': 0}]},
        # a line going: it flashes by itself until the game takes it away (the timer clear)
        {'name': 'going', 'kind': 3, 'solid': {},
         'pieces': [{'cycle': [dict(ref('BLOCKS', 'flash.png'), ms=60), dict(ref('BLOCKS', 'flash_dim.png'), ms=60)], 'dx': 0, 'dy': 0,
                     'layer': 'blocks', 'key': 0}]},
    ]})
    # a moment of a game: blocks below, a T falling with its shadow, an S next
    rows = [[0] * 10 for _ in range(20)]
    mods = {}

    def lay(c, r, tile, mod):
        rows[r][c] = tile
        if mod:
            mods[f'{c},{r}'] = mod
    garbage = ["......LL..", "Z.....LIJJ", "ZZ.OOTTIJ.", ".ZSOOSTIJJ", "SSSSSSSIOO"]
    for r, line in enumerate(garbage):
        for c, ch in enumerate(line):
            if ch != '.':
                lay(c, 15 + r, 1, 'IOTSZJL'.index(ch))
    for r, row in enumerate(PIECES['T'][0].split('|')):
        for c, ch in enumerate(row):
            if ch == '#':
                lay(3 + c, 1 + r, 1, 2)
                lay(3 + c, 13 + r, 2, 2)
    nrows, nmods = [[0] * 4 for _ in range(2)], {}
    for r, row in enumerate(PIECES['S'][0].split('|')[:2]):
        for c, ch in enumerate(row):
            if ch == '#':
                nrows[r][c] = 1
                nmods[f'{c},{r}'] = 3
    box_x = WELL_X + 10 * TC + 16
    d['scenes'].append({
        'name': 'well', 'width': 320, 'height': 240, 'background': '#14142a',
        'layers': [
            layer('back', [picture('WELL', 'well.png', WELL_X, WELL_Y, 'well'),
                           picture('WELL', 'box.png', box_x, 20, 'next_box'), picture('WELL', 'box.png', box_x, 70, 'score_box'),
                           picture('WELL', 'box.png', box_x, 120, 'lines_box'), picture('WELL', 'box.png', box_x, 170, 'level_box'),
                           picture('WORDS', 'next.png', box_x + 42, 30, 'next_words'),
                           picture('WORDS', 'score.png', box_x + 42, 80, 'score_words'),
                           picture('WORDS', 'lines.png', box_x + 42, 130, 'lines_words'),
                           picture('WORDS', 'level.png', box_x + 42, 180, 'level_words')]),
            layer('blocks'),
            layer('text', [zone('score', 'label', box_x + 6, 86, 72, 16), zone('lines', 'label', box_x + 6, 136, 72, 16),
                           zone('level', 'label', box_x + 6, 186, 72, 16), zone('message', 'message', WELL_X, WELL_Y + 80, 10 * TC, 30),
                           entry('spawn', WELL_X + 3 * TC, WELL_Y)]),
        ],
        'grids': [{'name': 'well', 'tileset': 'TETRIS', 'x': WELL_X, 'y': WELL_Y, 'cols': 10, 'rows': 20, 'cells': rows, 'mods': mods, 'variants': {}},
                  {'name': 'next', 'tileset': 'TETRIS', 'x': box_x + 22, 'y': 36, 'cols': 4, 'rows': 2, 'cells': nrows, 'mods': nmods, 'variants': {}}],
        'exits': [], 'links': []})

    d['game'] = [{'name': f'{k}_{t}', 'value': shape_bits(s)} for k, turns in PIECES.items() for t, s in enumerate(turns)] + [
        {'name': f'fall_{i + 1}', 'value': v} for i, v in enumerate((800, 717, 633, 550, 467, 383, 300, 217, 133, 100, 83, 83, 83, 67, 67))] + [
        {'name': n, 'value': v} for n, v in (('cols', 10), ('rows', 20), ('spawn_col', 3), ('lock_ms', 500), ('repeat_after_ms', 170),
                                             ('repeat_ms', 50), ('soft_drop_ms', 40))]
    d['constants'] = {'LINES_PER_LEVEL': 10, 'TOP_LEVEL': 15, 'SIG_NUMBERS': 1, 'SIG_LEVEL': 2, 'SIG_OVER': 3, 'SIG_LOCK': 4, 'SIG_CLEAR': 5,
                      'SIG_NEW': 6}
    d['sounds'] = ['move', 'turn', 'lock', 'line', 'four', 'level_up', 'game_over']
    d['constants'].update({f'SND_{s.upper()}': i for i, s in enumerate(d['sounds'])})
    d['timers'] = [
        {'name': 'lock', 'once': '500ms', 'reset': 'scene', 'event': 'lock', 'start': ''},
        {'name': 'clear', 'once': '360ms', 'reset': 'scene', 'event': 'cleared', 'start': ''},
    ]
    p.anim('PLAY', """# The game itself as an actor: the score, the lines, the level and how fast the pieces fall, worked out
# here, and the waits of the game. The game tells it: landed (a piece lies on something: it locks after a
# while), lifted (it moved off), full (lines are full: they flash a while), taken with given set (the lines
# it took away at once), dropped with given set (cells a piece was dropped by hand), topped (no room).
# Its signals: SIG_NUMBERS the numbers changed, SIG_LEVEL a new level (a row falls as the game's fall_<level> says),
# SIG_OVER the game is over, SIG_LOCK the piece is locked, SIG_CLEAR the full lines go, SIG_NEW a new game
# (the game empties the well).
event start, landed, lifted, lock, full, cleared, taken, dropped, topped, restart
param score 0
param lines 0
param level 1
param given 0                 # what the game gives with its event: the lines taken, the cells dropped
table line_points 0 40 100 300 1200

script idle
    frame none 1000ms
    hold

script new_game
    set score 0
    set lines 0
    set level 1
    signal SIG_NEW
    signal SIG_NUMBERS
    signal SIG_LEVEL
    goto idle

script landing
    timer start lock
    goto idle

script lifting
    timer stop lock
    goto idle

script locking
    signal SIG_LOCK
    goto idle

script flashing
    timer start clear
    goto idle

script clearing
    signal SIG_CLEAR
    goto idle

script count_lines
    add score line_points[given] * level
    add lines given
    sound SND_LINE
    goto four if given == 4
    goto counted

script four
    sound SND_FOUR
    goto counted

script counted
    signal SIG_NUMBERS
    goto idle if lines < level * LINES_PER_LEVEL or level >= TOP_LEVEL
    add level 1
    sound SND_LEVEL_UP
    signal SIG_LEVEL
    goto idle

script count_drop
    add score given
    signal SIG_NUMBERS
    goto idle

script over
    sound SND_GAME_OVER
    signal SIG_OVER
    goto idle

on start: idle -> new_game now
on restart: idle -> new_game now
on taken: idle -> count_lines now
on dropped: idle -> count_drop now
on topped: idle -> over now
on landed: idle -> landing now
on lifted: idle -> lifting now
on lock: idle -> locking now
on full: idle -> flashing now
on cleared: idle -> clearing now
""")
    p.anim('WORDS', """# Words in the well: the prompt of the title blinks, GAME OVER drops into the middle, PAUSED blinks.
event over, paused, resume, restart

script quiet
    frame none 1000ms
    hold

script blink
    frame WORDS_PRESS_START 500ms
    frame none 300ms
    goto blink

script game_over
""" + ''.join(f"    frame WORDS_GAME_OVER 30ms\n    dy {s}\n" for s in (-8, -6, -4, -2, 0, 2, 4, 6, 8)) + """    frame WORDS_GAME_OVER 1000ms
    hold

script paused
    frame WORDS_PAUSED 600ms
    frame none 300ms
    goto paused

on over: quiet -> game_over now
on paused: quiet -> paused now
on resume: paused -> quiet now
on restart: game_over -> quiet now
""")
    drops = []
    for i in range(6):
        steps, v, y = [], 0.0, -120.0
        while y < 0:
            v += 2.2
            y = min(0.0, y + v)
            steps.append(y)
        steps += [-6, -9, -10, -9, -6, 0]  # a bounce
        lines = [f"\nscript letter_{i + 1}{'          # entry: the title show starts it' if i else ''}\n    frame none {150 * i + 1}ms\n    dy -120\n"]
        last = -120
        for s in steps:
            lines.append(f"    frame LOGO_LETTER_{i + 1} 25ms\n    dy {round(s) - last}\n")
            last = round(s)
        lines.append(f"label landed_{i + 1}\n    frame LOGO_LETTER_{i + 1} 1000ms\n    goto landed_{i + 1}\n")
        drops.append(''.join(lines))
    p.anim('LOGO', "# The title: each letter falls in after the one before and bounces.\n" + ''.join(drops))
    d['shows'] = [{'name': 'TITLE', 'pictures': [],
                   'actors': [{'name': f'letter_{i + 1}', 'kind': 'LOGO', 'script': f'letter_{i + 1}', 'x': 85 + 30 * i, 'y': 110,
                               'layer': 0, 'flip': False, 'color': 0} for i in range(6)] +
                   [{'name': 'prompt', 'kind': 'WORDS', 'script': 'blink', 'x': 160, 'y': 180, 'layer': 1, 'flip': False, 'color': 0}],
                   'cues': [{'at': '6s', 'role': 'end', 'event': ''}]}]
    d['styles'] = [menu_style((320, 240), 180, 64, [20, 20, 40], [190, 190, 210], [240, 240, 250], [50, 90, 240])]
    p.dialog('pause', PAUSE_DIALOG.format(title='PAUSED', numbers='Score {score}  Lines {lines}'))
    return p


# --- Snake ---
SC = 10
FIELD_COLS, FIELD_ROWS, FIELD_Y = 32, 22, 20
UP, RIGHT, DOWN, LEFT = 1, 2, 4, 8  # a cell of the snake: the sides it goes on to, its modifier


def snake_piece(sides, head=None, tail=None, dead=False):
    """A cell of the snake, 10 x 10: a band from the middle to each side it goes on to (1 the edge, 2 the green,
    3 the light back); the head round with eyes looking away from its body, the tail thinning."""
    p = Pic(SC, SC)
    lo, hi = 2, 7

    def band(side, width_lo, width_hi):
        if side == UP:
            p.rect(width_lo, 0, width_hi - width_lo + 1, 5, 2)
        if side == DOWN:
            p.rect(width_lo, 5, width_hi - width_lo + 1, 5, 2)
        if side == LEFT:
            p.rect(0, width_lo, 5, width_hi - width_lo + 1, 2)
        if side == RIGHT:
            p.rect(5, width_lo, 5, width_hi - width_lo + 1, 2)
    if head is not None:
        p.disc(5, 5, 4.6, 2)
        band(head, lo, hi)
    elif tail is not None:
        band(tail, 3, 6)
        p.disc(5, 5, 2.2, 2)
    else:
        p.disc(5, 5, 2.9, 2)
        for s in (UP, RIGHT, DOWN, LEFT):
            if sides & s:
                band(s, lo, hi)
        # a light stripe along its back
        for s in (UP, RIGHT, DOWN, LEFT):
            if sides & s:
                if s in (UP, DOWN):
                    p.rect(4, 0 if s == UP else 5, 2, 5, 3)
                else:
                    p.rect(0 if s == LEFT else 5, 4, 5, 2, 3)
    p.outline(1)
    if head is not None:
        # eyes on the side away from the body
        face = {UP: DOWN, DOWN: UP, LEFT: RIGHT, RIGHT: LEFT}[head]
        if face in (LEFT, RIGHT):
            ex = 6 if face == RIGHT else 3
            eyes = [(ex, 3), (ex, 6)]
        else:
            ey = 6 if face == DOWN else 3
            eyes = [(3, ey), (6, ey)]
        for x, y in eyes:
            if dead:
                p.put(x, y, 5)
                p.put(x + 1, y + 1, 5)
                p.put(x + 1, y, 5)
                p.put(x, y + 1, 5)
            else:
                p.rect(x, y, 2, 2, 4)
                p.put(x + (1 if face == RIGHT else 0), y + (1 if face == DOWN else 0), 5)
        if not dead:  # the tongue
            tx, ty = {RIGHT: (9, 4), LEFT: (0, 4), DOWN: (4, 9), UP: (4, 0)}[face]
            p.rect(tx, ty, 1 if face in (LEFT, RIGHT) else 2, 2 if face in (LEFT, RIGHT) else 1, 6)
    return p


def snake_game():
    p = Project('snake', 'Snake', (320, 240))
    d = p.doc
    p.kind('SNAKE', [(20, 70, 20), (70, 170, 50), (150, 220, 90), (255, 255, 255), (10, 10, 10), (220, 40, 60)])
    # body: by its sides, 16 values of the modifier, those two sides apart are drawn
    body = []
    for m in range(16):
        if bin(m).count('1') == 2:
            name = f'body_{m}.png'
            p.frame('SNAKE', name, snake_piece(m), (0, SC - 1))
            body.append(ref('SNAKE', name))
        else:
            body.append(None)
    sides = [('up', UP), ('right', RIGHT), ('down', DOWN), ('left', LEFT)]
    for n, s in sides:
        p.frame('SNAKE', f'head_{n}.png', snake_piece(0, head=s), (0, SC - 1))
        p.frame('SNAKE', f'dead_{n}.png', snake_piece(0, head=s, dead=True), (0, SC - 1))
        p.frame('SNAKE', f'tail_{n}.png', snake_piece(0, tail=s), (0, SC - 1))
    # head and tail by the side their body is on: 0 up, 1 right, 2 down, 3 left; the head dead 4..7
    heads = [ref('SNAKE', f'head_{n}.png') for n, _ in sides] + [ref('SNAKE', f'dead_{n}.png') for n, _ in sides]
    tails = [ref('SNAKE', f'tail_{n}.png') for n, _ in sides]

    p.kind('FIELD', [(150, 90, 50), (100, 60, 30), (190, 130, 80), (200, 30, 40), (255, 120, 120), (60, 140, 40), (255, 255, 255),
                     (240, 200, 40)])
    brick = Pic(SC, SC)
    brick.rect(0, 0, SC, SC, 1)
    for y in (0, 5):
        brick.rect(0, y + 4, SC, 1, 2)
    brick.rect(4, 0, 1, 4, 2)
    brick.rect(8, 5, 1, 4, 2)
    brick.rect(0, 0, SC, 1, 3)
    p.frame('FIELD', 'wall.png', brick, (0, SC - 1))
    for k in (0, 1):
        a = Pic(SC, SC)
        a.disc(5, 6, 3.8, 4)
        a.rect(5, 0, 1, 3, 2)
        a.rect(6, 1, 2, 1, 6)
        a.put(3, 4, 5 if k == 0 else 7)
        if k:
            a.put(4, 4, 7)
            a.put(3, 5, 7)
        p.frame('FIELD', f'apple_{k}.png', a, (0, SC - 1))
    star = Pic(SC, SC)
    for i in range(SC):
        star.put(i, 5, 8)
        star.put(5, i, 8)
    star.disc(5.5, 5.5, 2, 8)
    p.frame('FIELD', 'star.png', star, (0, SC - 1))

    p.kind('SPARKLE', [(255, 240, 120), (255, 255, 255)])
    for k in range(4):
        s = Pic(15, 15)
        r = 2 + k * 2
        for a in range(8):
            x = 7 + round(r * math.cos(a * math.pi / 4))
            y = 7 + round(r * math.sin(a * math.pi / 4))
            s.put(x, y, 1 if k < 3 else 2)
            if k < 2:
                s.put(x + 1, y, 1)
        p.frame('SPARKLE', f'sparkle_{k + 1}.png', s, (7, 7))

    words(p, 'WORDS', [('logo.png', 'SNAKE', 1, 5, 3), ('score.png', 'SCORE', 2, 1, 0), ('best.png', 'BEST', 2, 1, 0),
                       ('game_over.png', 'GAME OVER', 4, 2, 3), ('press_start.png', 'PRESS START', 2, 1, 0)],
                      [(70, 170, 50), (240, 240, 240), (20, 70, 20), (220, 40, 60)])
    d['palettes'].append({'name': 'GRASS', 'colors': [[96, 150, 60], [86, 140, 52]]})  # the paper of the game and its checks

    d['tilesets'].append({'name': 'SNAKE', 'cellWidth': SC, 'cellHeight': SC, 'fields': {}, 'tiles': [
        {'name': 'wall', 'kind': 1, 'solid': {'top': True, 'left': True, 'right': True, 'bottom': True}, 'pieces': [piece('FIELD', 'wall.png', 'cells')]},
        {'name': 'apple', 'kind': 2, 'solid': {}, 'pieces': [
            {'cycle': [dict(ref('FIELD', 'apple_0.png'), ms=900), dict(ref('FIELD', 'apple_1.png'), ms=150)], 'dx': 0, 'dy': 0, 'layer': 'cells', 'key': 0}]},
        # the body by its modifier: the sides it goes on to (up 1, right 2, down 4, left 8)
        {'name': 'body', 'kind': 3, 'solid': {}, 'pieces': [{'by_mod': body, 'dx': 0, 'dy': 0, 'layer': 'cells', 'key': 0}]},
        # the head and the tail by the side their body is on (0 up, 1 right, 2 down, 3 left), the head dead + 4
        {'name': 'head', 'kind': 4, 'solid': {}, 'pieces': [{'by_mod': heads, 'dx': 0, 'dy': 0, 'layer': 'cells', 'key': 0}]},
        {'name': 'tail', 'kind': 5, 'solid': {}, 'pieces': [{'by_mod': tails, 'dx': 0, 'dy': 0, 'layer': 'cells', 'key': 0}]},
        {'name': 'star', 'kind': 6, 'solid': {}, 'pieces': [piece('FIELD', 'star.png', 'cells')]},
    ]})
    cells = [[0] * FIELD_COLS for _ in range(FIELD_ROWS)]
    mods = {}
    for c in range(FIELD_COLS):
        cells[0][c] = cells[FIELD_ROWS - 1][c] = 1
    for r in range(FIELD_ROWS):
        cells[r][0] = cells[r][FIELD_COLS - 1] = 1
    for c in range(8, 13):
        cells[6][c] = 1
        cells[15][FIELD_COLS - 1 - c] = 1
    # the snake at the start: its tail at the left, its head at the right, going right
    r0 = 11
    cells[r0][6], mods[f'6,{r0}'] = 5, 1  # the tail, its body to the right
    for c in range(7, 10):
        cells[r0][c], mods[f'{c},{r0}'] = 3, LEFT | RIGHT
    cells[r0][10], mods[f'10,{r0}'] = 4, 3  # the head, its body to the left
    cells[r0][20] = 2
    cells[4][26] = 6
    d['scenes'].append({
        'name': 'field', 'width': 320, 'height': 240, 'background': '#60963c',
        'layers': [
            layer('cells'),
            layer('actors', [entry('start', 10 * SC, FIELD_Y + r0 * SC + SC - 1)]),
            layer('text', [picture('WORDS', 'score.png', 30, 13, 'score_words'), picture('WORDS', 'best.png', 220, 13, 'best_words'),
                           zone('score', 'label', 64, 2, 60, 16), zone('best', 'label', 246, 2, 60, 16)]),
        ],
        'grids': [{'name': 'field', 'tileset': 'SNAKE', 'x': 0, 'y': FIELD_Y, 'cols': FIELD_COLS, 'rows': FIELD_ROWS, 'cells': cells,
                   'mods': mods, 'variants': {}}],
        'exits': [], 'links': []})
    d['game'] = [{'name': n, 'value': v} for n, v in (('start_col', 10), ('start_row', r0))]
    d['constants'] = {'START_LENGTH': 5, 'STEP_MS': 150, 'FASTEST_MS': 60, 'FASTER_MS': 4, 'GROW': 3, 'APPLE_SCORE': 10, 'STAR_SCORE': 50,
                      'STAR_EVERY': 5, 'SIG_NUMBERS': 1, 'SIG_OVER': 2, 'SIG_STAR': 3, 'SIG_STAR_GONE': 4, 'SIG_NEW': 5}
    d['sounds'] = ['eat', 'star', 'turn', 'crash']
    d['constants'].update({f'SND_{s.upper()}': i for i, s in enumerate(d['sounds'])})
    d['timers'] = [{'name': 'star', 'once': '6000ms', 'reset': 'scene', 'event': 'star_gone', 'start': ''}]
    p.anim('PLAY', """# The game itself as an actor: the score, the length the snake is to grow to, how fast it goes, when a star
# comes. The game moves the snake a cell every speed ms and tells this actor what the head found.
# Its signals: SIG_NUMBERS the numbers changed, SIG_OVER the game is over, SIG_STAR a star comes (a cell
# of the game's choosing), SIG_STAR_GONE it is gone (the timer star), SIG_NEW a new game (the game lays the
# snake and an apple anew).
event start, ate, star, crash, star_gone, restart
param score 0
param best 0
param length START_LENGTH      # the snake grows a cell a step until it is so long
param speed STEP_MS            # ms a step

script idle
    frame none 1000ms
    hold

script new_game
    set score 0
    set length START_LENGTH
    set speed STEP_MS
    timer stop star
    signal SIG_NEW
    signal SIG_NUMBERS
    goto idle

script apple                    # each apple: longer and faster
    add score APPLE_SCORE
    add length GROW
    set speed max(FASTEST_MS, speed - FASTER_MS)
    sound SND_EAT
    goto star_comes if (length - START_LENGTH) / GROW % STAR_EVERY == 0   # every STAR_EVERY apples
    goto counted

script star_comes
    timer start star
    signal SIG_STAR
    goto counted

script star_goes
    signal SIG_STAR_GONE
    goto idle

script bonus                    # a star: only points
    add score STAR_SCORE
    sound SND_STAR
    timer stop star
    goto counted

script counted
    set best max(best, score)
    signal SIG_NUMBERS
    goto idle

script crashed
    sound SND_CRASH
    signal SIG_OVER
    goto idle

on start: idle -> new_game now
on restart: idle -> new_game now
on ate: idle -> apple now
on star: idle -> bonus now
on crash: idle -> crashed now
on star_gone: idle -> star_goes now
""")
    p.anim('SPARKLE', """# Where the snake ate: sparks fly out and are gone.
script pop
    frame SPARKLE_SPARKLE_1 50ms
    frame SPARKLE_SPARKLE_2 50ms
    frame SPARKLE_SPARKLE_3 60ms
    frame SPARKLE_SPARKLE_4 80ms
    vanish
label gone
    frame none 1000ms
    goto gone
""")
    p.anim('WORDS', """# Words: the prompt of the title blinks, the logo sways.
script blink
    frame WORDS_PRESS_START 500ms
    frame none 300ms
    goto blink

script sway                     # entry: the title show starts it
    path x: 0, y: 4 * sin(t * 3)
    frame WORDS_LOGO 2000ms
    goto sway
""")
    d['shows'] = [{'name': 'TITLE', 'pictures': [],
                   'actors': [{'name': 'logo', 'kind': 'WORDS', 'script': 'sway', 'x': 160, 'y': 110, 'layer': 0, 'flip': False, 'color': 0},
                              {'name': 'prompt', 'kind': 'WORDS', 'script': 'blink', 'x': 160, 'y': 170, 'layer': 1, 'flip': False, 'color': 0}],
                   'cues': [{'at': '6s', 'role': 'end', 'event': ''}]}]
    d['styles'] = [menu_style((320, 240), 180, 64, [20, 70, 20], [150, 220, 90], [240, 240, 240], [70, 170, 50])]
    p.dialog('pause', PAUSE_DIALOG.format(title='PAUSE', numbers='Score {score}  Best {best}'))
    return p


def main():
    only = sys.argv[1:]
    for make in (pacman_game, tetris_game, snake_game):
        p = make()
        if only and p.name not in only:
            continue
        p.write(HERE)


if __name__ == '__main__':
    main()
