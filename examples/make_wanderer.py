#!/usr/bin/env python3
"""Draws the example frames of examples/wanderer and their markup wanderer.json.

The wanderer is a figure drawn from a skeleton: joints are placed by angles, limbs are capsules with an outline.
Nothing is taken from other games. Every pixel knows the part it belongs to, so the masks of the markup are exact:
body (1), blade (2), head (3). Frames are cut to their pixels, the base point is the column of the hips on the
floor row, so frames of different sizes stand the same.

Only the standard library is used. Run: python3 examples/make_wanderer.py
"""
import json
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wanderer')

PALETTE = [
    (0, 0, 0),  # 0 transparent
    (26, 20, 32),  # 1 outline
    (224, 168, 120),  # 2 skin
    (176, 120, 80),  # 3 skin, far side
    (58, 36, 24),  # 4 hair
    (58, 106, 176),  # 5 tunic
    (40, 74, 128),  # 6 tunic, far side
    (192, 48, 48),  # 7 sash
    (90, 74, 58),  # 8 trousers
    (64, 52, 40),  # 9 trousers, far side
    (106, 58, 26),  # 10 boots
    (216, 220, 232),  # 11 blade
    (136, 144, 160),  # 12 blade edge
    (208, 160, 32),  # 13 hilt
    (232, 224, 200),  # 14 headband
    (74, 40, 18),  # 15 boots, far side
]
OUTLINE, SKIN, SKIN_FAR, HAIR, TUNIC, TUNIC_FAR, SASH, TROUSERS, TROUSERS_FAR, BOOTS, BLADE, BLADE_EDGE, HILT, \
    HEADBAND, BOOTS_FAR = range(1, 16)

MASKS = [
    {'index': 1, 'name': 'body', 'color': '#e04040'},
    {'index': 2, 'name': 'blade', 'color': '#3070e0'},
    {'index': 3, 'name': 'head', 'color': '#e09020'},
]
# parts of the figure and the masks they are in; outlines and the hilt are in no mask
PART_MASK = {'body': 1, 'blade': 2, 'head': 3}

THIGH, SHIN, TORSO, UPPER_ARM, FOREARM, HEAD_R, BLADE_LEN = 9.0, 8.5, 12.0, 6.5, 6.0, 3.6, 13.0
SIZE = 96  # the buffer a frame is drawn in, the hips stand in its middle


class Frame:
    def __init__(self):
        self.color = [[0] * SIZE for _ in range(SIZE)]
        self.part = [[None] * SIZE for _ in range(SIZE)]
        self.points = {}

    def capsule(self, a, b, r, color, part):
        """Pixels whose centers are not farther than r from the segment a-b."""
        x0 = int(math.floor(min(a[0], b[0]) - r - 1))
        x1 = int(math.ceil(max(a[0], b[0]) + r + 1))
        y0 = int(math.floor(min(a[1], b[1]) - r - 1))
        y1 = int(math.ceil(max(a[1], b[1]) + r + 1))
        dx, dy = b[0] - a[0], b[1] - a[1]
        length2 = dx * dx + dy * dy
        for y in range(max(y0, 0), min(y1, SIZE)):
            for x in range(max(x0, 0), min(x1, SIZE)):
                px, py = x + 0.5, y + 0.5
                t = 0 if not length2 else max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / length2))
                cx, cy = a[0] + t * dx, a[1] + t * dy
                if (px - cx) ** 2 + (py - cy) ** 2 <= r * r:
                    self.color[y][x] = color
                    self.part[y][x] = part

    def limb(self, segments, part):
        """segments: [(a, b, r, color)]; the outline of the whole limb goes first, so its joints have none."""
        for a, b, r, color in segments:
            self.capsule(a, b, r + 1, OUTLINE, None)
        for a, b, r, color in segments:
            self.capsule(a, b, r, color, part)


def along(p, angle, length):
    """A point at length from p; angle 0 is straight down, positive angles turn forward (to the right)."""
    return (p[0] + length * math.sin(angle), p[1] + length * math.cos(angle))


def draw_leg(f, hip, thigh, knee, far):
    k = along(hip, thigh, THIGH)
    shin = thigh - knee
    ankle = along(k, shin, SHIN)
    boot_top = along(k, shin, SHIN - 3.5)
    toe = (ankle[0] + 3.0, ankle[1] + 0.3)
    trousers, boots = (TROUSERS_FAR, BOOTS_FAR) if far else (TROUSERS, BOOTS)
    f.limb([(hip, k, 2.0, trousers), (k, boot_top, 1.7, trousers), (boot_top, ankle, 1.8, boots),
            (ankle, toe, 1.2, boots)], 'body')


def draw_arm(f, shoulder, upper, elbow, far):
    e = along(shoulder, upper, UPPER_ARM)
    hand = along(e, upper + elbow, FOREARM)
    tunic, skin = (TUNIC_FAR, SKIN_FAR) if far else (TUNIC, SKIN)
    f.limb([(shoulder, e, 1.6, tunic), (e, hand, 1.3, skin), (hand, hand, 1.5, skin)], 'body')
    return hand


def draw_sword(f, hand, angle):
    """angle in degrees from the forward direction, negative is up. Returns the tip."""
    a = math.radians(angle)
    d = (math.cos(a), math.sin(a))
    n = (-d[1], d[0])
    guard = (hand[0] + d[0] * 2.0, hand[1] + d[1] * 2.0)
    tip = (hand[0] + d[0] * (2.0 + BLADE_LEN), hand[1] + d[1] * (2.0 + BLADE_LEN))
    pommel = (hand[0] - d[0] * 2.5, hand[1] - d[1] * 2.5)
    f.capsule(guard, tip, 1.5, OUTLINE, None)
    f.capsule(pommel, guard, 1.4, OUTLINE, None)
    g0 = (guard[0] + n[0] * 2.5, guard[1] + n[1] * 2.5)
    g1 = (guard[0] - n[0] * 2.5, guard[1] - n[1] * 2.5)
    f.capsule(g0, g1, 1.4, OUTLINE, None)
    f.capsule(guard, tip, 0.75, BLADE, 'blade')
    f.capsule(pommel, guard, 0.6, HILT, None)
    f.capsule(g0, g1, 0.6, HILT, None)
    return tip


def draw_head(f, neck, lean):
    c = along(neck, math.pi - lean, 4.2)
    c = (c[0] + 0.6, c[1])
    f.capsule(c, c, HEAD_R + 1, OUTLINE, None)
    f.capsule(c, c, HEAD_R, SKIN, 'head')
    for y in range(SIZE):
        for x in range(SIZE):
            if f.part[y][x] != 'head':
                continue
            px, py = x + 0.5, y + 0.5
            if py < c[1] - 1.6 or (px < c[0] - 0.8 and py < c[1] + 2.2):
                f.color[y][x] = HAIR
            if abs(py - (c[1] - 1.1)) < 0.5:
                f.color[y][x] = HEADBAND
    # the eye looks forward
    ex, ey = int(c[0] + 1.9), int(c[1] + 0.3)
    f.color[ey][ex] = OUTLINE


def draw_figure(pose):
    """pose: dict of angles in radians (sword angle in degrees); returns a Frame drawn around the hips."""
    f = Frame()
    hip = (SIZE / 2 + 0.5, SIZE / 2 - 8 + pose.get('lift', 0.0))
    lean = pose.get('lean', 0.08)
    # the torso goes up from the hips, a positive lean bends it forward
    neck = along(hip, math.pi - lean, TORSO)
    shoulder = along(neck, -lean, 1.8)
    draw_arm(f, shoulder, *pose['far_arm'], far=True)
    draw_leg(f, hip, *pose['far_leg'], far=True)
    # the torso: a tunic a little longer than the hips, a sash over them
    skirt = along(hip, -lean, 2.5)
    f.limb([(skirt, neck, 3.1, TUNIC)], 'body')
    f.capsule(along(hip, -lean, -0.2), along(hip, -lean, -1.6), 3.1, SASH, 'body')
    draw_leg(f, hip, *pose['near_leg'], far=False)
    draw_head(f, neck, lean)
    sword = pose.get('sword')
    upper, elbow = pose['near_arm']
    hand = along(along(shoulder, upper, UPPER_ARM), upper + elbow, FOREARM)
    if sword is not None:
        f.points['tip'] = draw_sword(f, hand, sword)
    draw_arm(f, shoulder, upper, elbow, far=False)
    f.points['hand'] = hand
    f.hip = hip
    return f


def cut(f, airborne=0):
    """The frame cut to its pixels. The lowest pixel stands on the floor row, or airborne pixels above it."""
    rows = [y for y in range(SIZE) if any(f.color[y])]
    cols = [x for x in range(SIZE) if any(f.color[y][x] for y in range(SIZE))]
    top, bottom, left, right = rows[0], rows[-1], cols[0], cols[-1]
    floor = bottom + airborne
    base_x = int(math.floor(f.hip[0]))
    pixels = [row[left:right + 1] for row in f.color[top:bottom + 1]]
    masks = {}
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            m = PART_MASK.get(f.part[y][x])
            if m:
                masks.setdefault(m, set()).add((x - base_x, y - floor))
    # the hand goes first in every frame, the tip of the blade after it
    points = {n: {'x': int(math.floor(f.points[n][0])) - base_x, 'y': int(math.floor(f.points[n][1])) - floor}
              for n in sorted(f.points, key=lambda n: n != 'hand')}
    return {
        'pixels': pixels,
        'origin': {'x': base_x - left, 'y': floor - top},
        'masks': masks,
        'points': points,
    }


def encode_mask(pixels):
    """As the editor keeps a mask: cut to its pixels, rows of hex digits, the high bit is the left one."""
    xs = [p[0] for p in pixels]
    ys = [p[1] for p in pixels]
    x0, y0 = min(xs), min(ys)
    width, height = max(xs) - x0 + 1, max(ys) - y0 + 1
    rows = []
    for r in range(height):
        row = ''
        for c in range(0, width, 4):
            digit = 0
            for b in range(4):
                if c + b < width and (x0 + c + b, y0 + r) in pixels:
                    digit |= 8 >> b
            row += format(digit, 'x')
        rows.append(row)
    return {'x': x0, 'y': y0, 'width': width, 'height': height, 'rows': rows}


def write_png(path, pixels):
    """An indexed PNG of 4 bits, index 0 transparent."""
    height, width = len(pixels), len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for i in range(0, width, 2):
            raw.append(row[i] << 4 | (row[i + 1] if i + 1 < width else 0))

    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)

    with open(path, 'wb') as out:
        out.write(b'\x89PNG\r\n\x1a\n')
        out.write(chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 4, 3, 0, 0, 0)))
        out.write(chunk(b'PLTE', bytes(v for c in PALETTE for v in c)))
        out.write(chunk(b'tRNS', b'\x00'))
        out.write(chunk(b'IDAT', zlib.compress(bytes(raw), 9)))
        out.write(chunk(b'IEND', b''))


def walk(i, n=8):
    p = 2 * math.pi * i / n
    return {
        'near_leg': (0.45 * math.sin(p), 0.1 + 0.8 * max(0.0, math.cos(p))),
        'far_leg': (-0.45 * math.sin(p), 0.1 + 0.8 * max(0.0, -math.cos(p))),
        'near_arm': (-0.45 * math.sin(p), 0.35),
        'far_arm': (0.45 * math.sin(p), 0.35),
        'lean': 0.1,
    }


STANCE = {'near_leg': (0.4, 0.3), 'far_leg': (-0.35, 0.15), 'far_arm': (-0.5, 0.6)}
STRIKE = [
    dict(STANCE, near_arm=(0.5, 1.0), sword=-60, lean=0.05),  # guard
    dict(STANCE, near_arm=(-0.6, 2.2), sword=-150, lean=-0.05),  # the sword goes back
    dict(STANCE, near_arm=(1.2, 0.9), sword=-55, lean=0.15),  # the swing
    dict(STANCE, near_leg=(0.75, 0.7), far_leg=(-0.5, 0.05), near_arm=(1.55, 0.05), sword=0, lean=0.35),  # lunge
    dict(STANCE, near_leg=(0.7, 0.65), near_arm=(1.3, 0.1), sword=15, lean=0.3),  # follow through
    dict(STANCE, near_arm=(0.5, 1.0), sword=-60, lean=0.05),  # guard again
]
JUMP = [
    ({'near_leg': (0.7, 1.4), 'far_leg': (0.55, 1.3), 'near_arm': (-0.8, 0.3), 'far_arm': (-0.9, 0.3), 'lean': 0.45,
      'lift': 4.0}, 0),  # crouch
    ({'near_leg': (-0.15, 0.05), 'far_leg': (-0.3, 0.1), 'near_arm': (2.5, 0.2), 'far_arm': (2.3, 0.2), 'lean': 0.1},
     0),  # take off
    ({'near_leg': (1.0, 1.8), 'far_leg': (0.6, 1.6), 'near_arm': (1.9, 0.3), 'far_arm': (1.7, 0.3), 'lean': 0.2},
     7),  # in the air
    ({'near_leg': (0.35, 0.5), 'far_leg': (0.1, 0.4), 'near_arm': (1.2, 0.4), 'far_arm': (1.0, 0.4), 'lean': 0.15},
     3),  # coming down
    ({'near_leg': (0.7, 1.4), 'far_leg': (0.55, 1.3), 'near_arm': (0.6, 0.5), 'far_arm': (0.4, 0.5), 'lean': 0.4,
      'lift': 4.0}, 0),  # landing
]


def main():
    os.makedirs(OUT, exist_ok=True)
    frames = []
    for i in range(8):
        frames.append(('walk-%d.png' % (i + 1), cut(draw_figure(walk(i)))))
    for i, pose in enumerate(STRIKE):
        frames.append(('strike-%d.png' % (i + 1), cut(draw_figure(pose))))
    for i, (pose, airborne) in enumerate(JUMP):
        frames.append(('jump-%d.png' % (i + 1), cut(draw_figure(pose), airborne)))
    # the order the editor keeps: by name, numbers compared as numbers
    frames.sort(key=lambda f: (f[0].rsplit('-', 1)[0], int(f[0].rsplit('-', 1)[1].split('.')[0])))

    left, top, right, bottom = 0, 0, 1, 1
    out_frames = []
    for name, f in frames:
        write_png(os.path.join(OUT, name), f['pixels'])
        height, width = len(f['pixels']), len(f['pixels'][0])
        ox, oy = f['origin']['x'], f['origin']['y']
        masks = {str(k): encode_mask(v) for k, v in sorted(f['masks'].items())}
        # the canvas takes the base point, the picture, the masks and the points of every frame
        for x, y, w, h in [(-ox, -oy, width, height)] + [(m['x'], m['y'], m['width'], m['height']) for m in
                                                          masks.values()] + [(p['x'], p['y'], 1, 1) for p in
                                                                             f['points'].values()]:
            left, top, right, bottom = min(left, x), min(top, y), max(right, x + w), max(bottom, y + h)
        out_frames.append({'image': name, 'width': width, 'height': height, 'origin': f['origin'], 'masks': masks,
                           'points': f['points']})
    doc = {
        'format': 'dgx-ge-sprites',
        'formatVersion': 1,
        'name': 'wanderer',
        'masks': MASKS,
        'sets': [{
            'name': 'wanderer',
            'defaultMask': 1,
            'canvas': {'left': left, 'top': top, 'width': right - left, 'height': bottom - top},
            'frames': out_frames,
        }],
    }
    # the animations are made in the editor (and kept in wanderer.anim): a new drawing keeps them
    path = os.path.join(OUT, 'wanderer.json')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as old:
            animation = json.load(old)['sets'][0].get('animation')
        if animation:
            doc['sets'][0]['animation'] = animation
    with open(path, 'w', encoding='utf-8') as out:
        json.dump(doc, out, indent=4)
        out.write('\n')
    print('%d frames, canvas %s' % (len(out_frames), doc['sets'][0]['canvas']))


if __name__ == '__main__':
    main()
