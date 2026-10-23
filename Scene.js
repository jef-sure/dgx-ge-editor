// Scenes: the levels of a game, in layers drawn from the back to the front, as dgx_ge_scene.h of the engine has
// them. A layer moves with the window of the scene by its factor (256 as the window, 128 half as far, 0 not at all)
// and draws its pictures in the order they were given or by key. A scene has layers of objects (pictures, actors,
// zones, entries), grids of tiles, exits to other scenes and links between its cells and objects. A scene is as
// large as it is: one screen (a room) or more (it scrolls). Coordinates are pixels of the scene from its left upper
// corner; a picture or an actor stands with its base point at x, y.
//
// A tile is drawn in pieces, each a picture of a set in a layer of the scene: a wall behind the actors, the front of
// the floor before them. A piece stands with its base point on the left lower pixel of its cell moved by dx, dy, so
// it may reach into the cells around. The engine knows which sides of a tile are solid.
//
// The document keeps {screen: {width, height}, tilesets: [tileset], scenes: [scene]}:
//   tileset: {name, cellWidth, cellHeight, fields: {name: ['mod' | 'variant', first bit, bits]}, tiles: [tile]}
//   tile: {name, kind, solid: {top, left, right, bottom}, closes?: {top, left, right, bottom}, bodies?: [body], pieces: [piece]}
//     solid: the sides an actor does not go through; closes: the sides that end the open space it is seen in
//     (a door frame is walked through but hides on its right); without closes they are the solid ones
//     seen_as: the name of another tile of the set: where a condition of neighbours names that one, this one goes too
//     (opener_down seen as floor)
//     life: the name of an animation of the pack (a set's, added before the tileset) a cell of the tile runs by itself:
//     a gate going up and down, a loose floor; its params: 0 the cell's modifier, 1 its tile, 2 and on its own
//     body: {dx, dy, w, h, when?, for?}: what of the cell is solid, a box from the bottom-left point of the cell moved
//     by dx, dy (up is less than 0), w to the right and h up of it; numbers or expressions as dx of a piece; when: it
//     is there only where that is not 0; for: the masks it holds, [numbers 0..15] (none or empty: every mask), so a
//     tile has the bodies of the rules for people beside the bodies as drawn for things (DGTS v8, the last u16 of a
//     body: a bit a mask, 0 every one). The engine asks the grid with the mask touching, and sees only the bodies that
//     hold it. With bodies the solid sides are only for around and for sight
//     veil: 0..7, how much a look through the tile costs for sense ... seen (0 clear, 1..6 a point through it costs
//     2..7 points, 7 nothing seen through); the top 3 bits of its closes byte in the pack
//     opening: {dx, dy, w, h, when?} as a body, without for (DGTS v9): not solid, what an actor gone into the tile (up
//     the stairs of a door) is seen through; the packer writes it after the bodies, not counted among them
//   piece: {layer, key, dx, dy, set, image | by_mod: [{set, image} | null] | pick, pictures: [{set, image} | null]
//           | cycle: [{set, image, ms}] | draw: 'fill', size: [w, h], around, variant, with, step, draw, color}
//     pick: an expression of mod, variant and the fields of the tileset choosing among pictures, as by_mod does;
//     when: an expression of them too, the piece is drawn only where it is not 0;
//     by_mod: the picture by the mod of the cell (the last one for any above, null: no piece then); cycle: pictures
//     in turn by the time of the scene; dx, dy: numbers or expressions of mod ("-mod / 4"); around: {side: what},
//     drawn only where the neighbours are so; variant: drawn only in cells of this variant; with: laid when the grid
//     lays the cell on that side, at its own place; step: its turn among the pieces laid with a cell, 0 first;
//     draw: 'normal' | 'card' (on a rectangle of its color) | 'silhouette' (its shape in one color); color: n of the
//     set of the piece, or [set, n] of another set, 0 the paper
//   scene: {name, width, height, background, music?, musicFade?, layers: [layer], grids: [grid], exits: [exit], links: [link]}
//     music: a music of the document (or a name only) the game plays as it enters the scene, or 'stop'; none: what
//     plays goes on; musicFade: ms the change fades over (500 when not said)
//   layer: {name, factor, order: 'added' | 'key', visible, locked, objects: [object]}
//   grid: {name, tileset, x, y, cols, rows, cells: [[0 empty | n the tile n - 1]], mods: {'col,row': n},
//          variants: {'col,row': n}}
//   object: {type: 'picture', name, set, image, x, y, key, flip, rotation?, clip: null | {x, y, width, height}}
//         | {type: 'actor', name, set, script, x, y, flip, rotation?, params: {name: value}}
//     rotation: degrees clockwise, 0, 90, 180 or 270 (a multiple of 90), after the mirror, about the base point
//         | {type: 'zone', name, kind, x, y, width, height}
//         | {type: 'entry', name, x, y, flip}
//   exit: {edge: 'left' | 'right' | 'up' | 'down' | '', zone: '' | name of a zone, scene, entry}
//   link: {from: ref, to: ref}, ref: {grid, col, row} | {object: name}
const Scene = {
    maxLayers: 8, // DGX_GE_SCENE_MAX_LAYERS
    edges: ['left', 'right', 'up', 'down'],
    sides: ['top', 'left', 'right', 'bottom'],
    // what a coordinate and a tile number of the engine hold
    maxCoord: 32767,
    maxTiles: 65535,
    // the neighbours of a cell a piece may look at: side -> [columns, rows] away
    around: {
        up: [0, -1],
        down: [0, 1],
        left: [-1, 0],
        right: [1, 0],
        up_left: [-1, -1],
        up_right: [1, -1],
        down_left: [-1, 1],
        down_right: [1, 1]
    },
    aroundWords: ['empty', 'solid_top', 'solid_left', 'solid_right', 'solid_bottom', 'solid_any'],
    // the order pieces laid from the cells around come in, after the cell's own ones
    withOrder: ['self', 'up', 'down', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right'],
    draws: ['normal', 'card', 'silhouette', 'fill'],

    newScene(name, screen) {
        return {
            name: name,
            width: screen.width,
            height: screen.height,
            background: '#000000',
            layers: [this.newLayer('back'), this.newLayer('actors'), this.newLayer('front')],
            grids: [],
            exits: [],
            links: [],
            // the graph of scenes (Maps.js): the map the scene is in, its number there, its kind, the event its map's
            // rules are told when one comes in
            map: '',
            index: 0,
            kind: 'room',
            onEnter: '',
            leave: Maps.newLeave()
        };
    },
    newLayer(name) {
        return {
            name: name,
            factor: 256,
            order: 'added',
            visible: true,
            locked: false,
            objects: []
        };
    },
    newTileset(name) {
        return {
            name: name,
            cellWidth: 16,
            cellHeight: 16,
            fields: {}, // names of bits of the mod and the variant of a cell: name -> ['mod' | 'variant', first, count]
            tiles: []
        };
    },
    newTile(name) {
        return {
            name: name,
            kind: 0,
            solid: {
                top: false,
                left: false,
                right: false,
                bottom: false
            },
            pieces: []
        };
    },
    newGrid(name, tileset, cols, rows) {
        return {
            name: name,
            tileset: tileset,
            x: 0,
            y: 0,
            cols: cols,
            rows: rows,
            cells: Array.from({
                length: rows
            }, () => new Array(cols).fill(0)),
            mods: {},
            variants: {}
        };
    },

    // a name not taken in a list of things with names
    freeName(list, base) {
        const used = new Set(list.map(x => x.name));
        if (!used.has(base)) return base;
        let n = 2;
        while (used.has(base + n)) ++n;
        return base + n;
    },

    // the name the game knows a thing by: a constant of a C header, as names of pictures are made
    constName(name) {
        return String(name).replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
    },

    objects(scene) {
        return scene.layers.flatMap(l => l.objects);
    },

    // the frame of a set by the name of its file
    findFrame(sprites, setName, image) {
        const set = sprites.sets.find(s => s.name === setName);
        return set ? set.frames.find(f => f.image === image) || null : null;
    },

    // the frame an actor shows: the first frame of its script, of the set's frames
    actorFrame(sprites, o) {
        const p = this.actorPicture(sprites, o);
        return p ? p.frame : null;
    },
    // the picture an actor shows: {setName, frame, dx, dy}; a frame by number goes by the set's table of frame numbers
    // (a picture of any set, so far forward and down), else the frame of that number in order; null none
    actorPicture(sprites, o) {
        const set = sprites.sets.find(s => s.name === o.set);
        if (!set) return null;
        const script = set.animation && set.animation.scripts.find(s => s.name === o.script);
        const first = script && script.lines.find(l => l.op === 'frame');
        const own = f => f ? {
            setName: set.name,
            frame: f,
            dx: 0,
            dy: 0
        } : null;
        if (first && first.image !== undefined) return own(set.frames.find(f => f.image === first.image));
        if (first && first.number !== undefined && set.frameTable) {
            const e = set.frameTable[first.number];
            const s = e && sprites.sets.find(s => s.name === e.set);
            const f = s && s.frames.find(f => f.image === e.image);
            return f ? {
                setName: s.name,
                frame: f,
                dx: e.dx,
                dy: e.dy
            } : null;
        }
        if (first && first.number !== undefined) return own(set.frames[first.number - 1]);
        if (first && first.name !== undefined)
            for (const s of sprites.sets) {
                const f = s.frames.find(f => Anim.imageName(s, f.image) === first.name);
                if (f) return {
                    setName: s.name,
                    frame: f,
                    dx: 0,
                    dy: 0
                };
            }
        return own(set.frames[0]);
    },

    // a rotation of the document (degrees clockwise, a multiple of 90; -90 is 270) in quarter turns 0..3; another 0
    turnsOf(rotation) {
        return Number.isInteger(rotation) && rotation % 90 === 0 ? (rotation / 90 % 4 + 4) % 4 : 0;
    },
    // a rotation the packer takes: a whole number of degrees, a multiple of 90 (_turns)
    isTurn(rotation) {
        return Number.isInteger(rotation) && rotation % 90 === 0;
    },
    // the orientation of a picture or an actor of a scene (dgx_ge_orient): mirrored (flip), then turned (rotation)
    orientOf(o) {
        return AnimRunner.orient(o.flip, this.turnsOf(o.rotation));
    },
    // where an actor's picture stands from it: the frame's shift (forward and down of its axes), turned as it lies
    shiftOf(o, ap) {
        return ap ? AnimRunner.apply(this.orientOf(o), ap.dx, ap.dy) : [0, 0];
    },
    // the rectangle a frame takes standing with its base point at x, y; mirrored around its base column, then turned
    // about its base point by quarters (dgx_ge_image_box: a quarter turn swaps its width and height)
    frameRect(f, x, y, flip, rotation) {
        if (!f || !f.width) return {
            x: x - 4,
            y: y - 15,
            width: 9,
            height: 16
        };
        const o = AnimRunner.orient(flip, this.turnsOf(rotation));
        const xb = 0x5A >> o & 1,
            yb = 0x3C >> o & 1;
        const along = xb ? -(f.width - 1 - f.origin.x) : -f.origin.x,
            down = yb ? -(f.height - 1 - f.origin.y) : -f.origin.y;
        return o & 2 ? {
            x: x + down,
            y: y + along,
            width: f.height,
            height: f.width
        } : {
            x: x + along,
            y: y + down,
            width: f.width,
            height: f.height
        };
    },

    // draws a picture (a canvas) whose base point is origin with its base pixel's left top at col, row of the view, z
    // view pixels a pixel, a step along its x and y going as s1, s2 there ([dx, dy], whole steps): as it is, mirrored,
    // turned (one of the eight of DGX)
    drawOriented(ctx, canvas, origin, col, row, z, s1, s2) {
        ctx.save();
        ctx.transform(z * s1[0], z * s1[1], z * s2[0], z * s2[1],
            col + z * (-s1[0] * origin.x - s2[0] * origin.y + (s1[0] < 0 || s2[0] < 0 ? 1 : 0)),
            row + z * (-s1[1] * origin.x - s2[1] * origin.y + (s1[1] < 0 || s2[1] < 0 ? 1 : 0)));
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
    },
    // draws a frame of a set standing with its base point at x, y of the view (pixels of the screen),
    // z screen pixels a pixel, mirrored around its base column when flipped, then turned clockwise by rotation
    // (degrees, a multiple of 90) about its base point. False when there is no picture
    drawFrame(ctx, setName, frame, x, y, flip, z, rotation) {
        const picture = frame && FrameImages.get(setName, frame.image);
        if (!picture) return false;
        const o = AnimRunner.orient(flip, this.turnsOf(rotation));
        this.drawOriented(ctx, picture.canvas, frame.origin, x, y, z, AnimRunner.apply(o, 1, 0), AnimRunner.apply(o, 0, 1));
        return true;
    },
    // a frame drawn as a piece of a tile asks: as it is, on a card of a color (a rectangle as large as it, hiding what
    // is behind), or as a silhouette (its shape in the color)
    drawFrameAs(ctx, setName, frame, x, y, flip, z, draw, rgb) {
        const picture = frame && FrameImages.get(setName, frame.image);
        if (!picture || !draw || draw === 'normal') return this.drawFrame(ctx, setName, frame, x, y, flip, z);
        const color = 'rgb(' + rgb.join(',') + ')';
        const o = frame.origin;
        const left = flip ? x - (picture.width - 1 - o.x) * z : x - o.x * z;
        if (draw === 'card') {
            ctx.fillStyle = color;
            ctx.fillRect(left, y - o.y * z, picture.width * z, picture.height * z);
            return this.drawFrame(ctx, setName, frame, x, y, flip, z);
        }
        // the silhouette: the shape of the picture filled with the color
        const c = document.createElement('canvas');
        c.width = picture.width;
        c.height = picture.height;
        const cc = c.getContext('2d');
        cc.drawImage(picture.canvas, 0, 0);
        cc.globalCompositeOperation = 'source-in';
        cc.fillStyle = color;
        cc.fillRect(0, 0, c.width, c.height);
        ctx.save();
        if (flip) {
            ctx.translate(x + (o.x + 1) * z, y - o.y * z);
            ctx.scale(-1, 1);
        } else ctx.translate(x - o.x * z, y - o.y * z);
        ctx.drawImage(c, 0, 0, picture.width * z, picture.height * z);
        ctx.restore();
        return true;
    },
    // is the pixel x, y of the scene an opaque pixel of a frame standing at ox, oy (mirrored, turned)
    framePixel(setName, frame, ox, oy, flip, x, y, rotation) {
        const picture = frame && FrameImages.get(setName, frame.image);
        if (!picture) return false;
        // the scene's point in the picture's axes: the orientation undone (whole pixels from the base pixel)
        const [u, v] = AnimRunner.apply(AnimRunner.inverse(AnimRunner.orient(flip, this.turnsOf(rotation))), x - ox, y - oy);
        let px = u + frame.origin.x;
        let py = v + frame.origin.y;
        if (px < 0 || py < 0 || px >= picture.width || py >= picture.height) return false;
        return picture.indexes[py * picture.width + px] !== 0;
    },

    // the rectangle an object takes in the scene {x, y, width, height}
    bounds(sprites, o) {
        if (o.type === 'zone') return {
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height
        };
        if (o.type === 'entry') return {
            x: o.x - 3,
            y: o.y - 12,
            width: 7,
            height: 13
        };
        if (o.type === 'actor') {
            // the picture it shows, of whatever set, so far forward and down
            const ap = this.actorPicture(sprites, o);
            const [dx, dy] = this.shiftOf(o, ap);
            return this.frameRect(ap && ap.frame, o.x + dx, o.y + dy, o.flip, o.rotation);
        }
        return this.frameRect(this.findFrame(sprites, o.set, o.image), o.x, o.y, o.flip, o.rotation);
    },

    inside(r, x, y) {
        return x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
    },

    // the left lower pixel of a cell, where its pieces stand
    cellBase(grid, tileset, col, row) {
        return {
            x: grid.x + col * tileset.cellWidth,
            y: grid.y + (row + 1) * tileset.cellHeight - 1
        };
    },

    // the cell of a grid at a point of the scene, null outside it
    cellAt(grid, tileset, x, y) {
        const c = Math.floor((x - grid.x) / tileset.cellWidth);
        const r = Math.floor((y - grid.y) / tileset.cellHeight);
        if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null;
        return {
            col: c,
            row: r
        };
    },

    // a grid made larger or smaller; tiles and mods that stay keep their cells
    resizeGrid(grid, cols, rows) {
        let cells = [];
        for (let r = 0; r < rows; ++r) {
            let row = [];
            for (let c = 0; c < cols; ++c) row.push(grid.cells[r] && grid.cells[r][c] || 0);
            cells.push(row);
        }
        const keep = map => {
            let kept = {};
            for (const k in map || {}) {
                const [c, r] = k.split(',').map(Number);
                if (c < cols && r < rows) kept[k] = map[k];
            }
            return kept;
        };
        grid.cols = cols;
        grid.rows = rows;
        grid.cells = cells;
        grid.mods = keep(grid.mods);
        grid.variants = keep(grid.variants);
    },

    // the fires of the entries of all scenes: links they start, by {scene, object} or {scene, grid, col, row}
    allFires(doc) {
        return doc.scenes.flatMap(s => this.objects(s)).filter(o => o.type === 'entry' && o.fires).map(o => o.fires);
    },
    // a scene renamed: exits of other scenes, exits of maps, the start of the graph and fires of entries follow it
    renameScene(doc, oldName, newName) {
        for (const s of doc.scenes) {
            if (s.name === oldName) s.name = newName;
            for (const e of s.exits)
                if (e.scene === oldName) e.scene = newName;
        }
        for (const m of doc.maps || [])
            for (const e of m.exits || [])
                if (e.scene === oldName) e.scene = newName;
        if (doc.graph && doc.graph.start && doc.graph.start.scene === oldName) doc.graph.start.scene = newName;
        for (const f of this.allFires(doc))
            if (f.scene === oldName) f.scene = newName;
    },
    // a grid renamed: links of its scene and fires of entries that name it follow it
    renameGrid(doc, scene, oldName, newName) {
        for (const g of scene.grids)
            if (g.name === oldName) g.name = newName;
        for (const l of scene.links)
            for (const end of [l.from, l.to])
                if (end.grid === oldName) end.grid = newName;
        for (const f of this.allFires(doc))
            if (f.scene === scene.name && f.grid === oldName) f.grid = newName;
    },
    renameTileset(doc, oldName, newName) {
        for (const t of doc.tilesets)
            if (t.name === oldName) t.name = newName;
        for (const s of doc.scenes) {
            for (const g of s.grids)
                if (g.tileset === oldName) g.tileset = newName;
        }
    },
    // a layer renamed: pieces of tiles that name it follow it, in every tileset
    renameLayer(doc, scene, oldName, newName) {
        for (const l of scene.layers)
            if (l.name === oldName) l.name = newName;
        for (const t of doc.tilesets) {
            for (const tile of t.tiles) {
                for (const p of tile.pieces)
                    if (p.layer === oldName) p.layer = newName;
            }
        }
    },
    // an object renamed: exits by its zone, entries and links that name it follow it
    renameObject(doc, scene, o, newName) {
        const oldName = o.name;
        o.name = newName;
        if (!oldName) return;
        for (const e of scene.exits)
            if (e.zone === oldName) e.zone = newName;
        for (const l of scene.links) {
            for (const end of [l.from, l.to])
                if (end.object === oldName) end.object = newName;
        }
        for (const f of this.allFires(doc))
            if (f.scene === scene.name && f.object === oldName) f.object = newName;
        if (o.type === 'entry') {
            for (const s of doc.scenes) {
                for (const e of s.exits)
                    if (e.scene === scene.name && e.entry === oldName) e.entry = newName;
            }
            for (const m of doc.maps || [])
                for (const e of m.exits || [])
                    if (e.scene === scene.name && e.entry === oldName) e.entry = newName;
            const start = doc.graph && doc.graph.start;
            if (start && start.scene === scene.name && start.entry === oldName) start.entry = newName;
        }
    },

    // the names expressions of pieces of a tileset may use: mod, variant and the fields of the tileset
    exprNames(tileset) {
        return ['mod', 'variant', ...Object.keys(tileset && tileset.fields || {})];
    },
    // the values those names have in a cell: a field is its bits of mod (8 bits) or variant (32 bits)
    cellEnv(grid, tileset, col, row) {
        const k = col + ',' + row;
        const mod = (grid.mods && grid.mods[k] || 0) & 0xff;
        const variant = (grid.variants && grid.variants[k] || 0) >>> 0;
        let env = {
            mod: mod,
            variant: variant
        };
        for (const [name, f] of Object.entries(tileset && tileset.fields || {})) {
            const value = f[0] === 'mod' ? mod : variant;
            env[name] = f[2] >= 32 ? value >>> f[1] : (value >>> f[1]) & ((1 << f[2]) - 1) >>> 0;
        }
        return env;
    },
    // an expression of a piece worked out in a cell; a number stays as it is, a bad one is 0
    pieceValue(v, env) {
        if (typeof v === 'number') return v;
        try {
            const tree = Anim.parseExpr(v, {
                defines: {},
                params: Object.keys(env),
                allowParams: true,
                allowT: false,
                actor: false
            });
            // rounded as the engine does: a half away from 0
            return Anim.halfAway(Anim.evalExpr(tree, env, 0));
        } catch (e) {
            return 0;
        }
    },
    // the pictures a piece may show: {set, image} each
    pieceRefs(p) {
        if (p.by_mod && p.by_mod.length) return p.by_mod.filter(r => r);
        if (p.pictures && p.pictures.length) return p.pictures.filter(r => r);
        if (p.cycle && p.cycle.length) return p.cycle;
        return p.set !== undefined ? [{
            set: p.set,
            image: p.image
        }] : [];
    },
    // the picture a piece shows in a cell (env: its mod, variant and fields) at this time of the scene, ms;
    // null: none there. A fill has no picture: it is {fill: true}
    pieceRef(p, env, time) {
        if (p.draw === 'fill') return {
            fill: true
        };
        const pick = (list, i) => list[Math.max(0, Math.min(i, list.length - 1))];
        if (p.by_mod && p.by_mod.length) return pick(p.by_mod, env.mod);
        if (p.pictures && p.pictures.length) return pick(p.pictures, this.pieceValue(p.pick, env));
        if (p.cycle && p.cycle.length) {
            const total = p.cycle.reduce((n, c) => n + Math.max(1, c.ms), 0);
            let t = (time || 0) % total;
            for (const c of p.cycle) {
                t -= Math.max(1, c.ms);
                if (t < 0) return c;
            }
            return p.cycle[0];
        }
        return {
            set: p.set,
            image: p.image
        };
    },
    // dx or dy of a piece in a cell: a number, or an expression of mod, variant and fields
    pieceOffset(v, env) {
        return this.pieceValue(v, env);
    },
    // does the neighbour of a cell (null: empty, or beyond the grid) answer a condition of around
    aroundHolds(what, neighbour) {
        let negate = false;
        if (typeof what === 'string' && what.startsWith('not ')) {
            negate = true;
            what = what.slice(4).trim();
        }
        let yes;
        if (what === 'empty') yes = !neighbour;
        else if (typeof what === 'string' && what.startsWith('solid_'))
            yes = !!neighbour && (what === 'solid_any' ? this.sides.some(k => neighbour.solid[k]) : !!neighbour.solid[what.slice(6)]);
        else {
            const names = Array.isArray(what) ? what : [what];
            // a tile seen as another goes where that one is named
            yes = !!neighbour && (names.includes(neighbour.name) || neighbour.seen_as !== undefined && names.includes(neighbour.seen_as));
        }
        return yes !== negate;
    },
    // the color of a card, a silhouette or a fill, [r, g, b]: 0 is the paper (the background), n the color of the
    // pixels of value n of the set of the piece or of the set named; n may be an expression of the cell
    pieceColor(doc, p, paper, env) {
        const c = p.color === undefined ? 0 : p.color;
        const n = this.pieceValue(Array.isArray(c) ? c[1] : c, env || {
            mod: 0,
            variant: 0
        });
        const setName = Array.isArray(c) ? c[0] : (this.pieceRefs(p)[0] || {}).set;
        if (!n) return paper;
        // a palette of the file by its name, its color n
        const palette = Array.isArray(c) && (doc.palettes || []).find(x => x.name === c[0]);
        if (palette) return palette.colors[n - 1] || [255, 0, 255];
        const set = doc.sets.find(s => s.name === setName);
        for (const f of set ? set.frames : []) {
            const picture = FrameImages.get(set.name, f.image);
            if (picture && picture.palette[n]) return picture.palette[n];
        }
        return [255, 0, 255];
    },
    // the pieces a grid lays with a cell, in their order: by steps, the cell's own first, then those laid with it
    // from the cells around; each {p, col, row} of the cell it belongs to
    laidWith(grid, tileset, col, row) {
        let laid = [];
        for (const side of this.withOrder) {
            // the piece of the cell on the other side, laid with this one
            const d = side === 'self' ? [0, 0] : this.around[side];
            const c = col - d[0],
                r = row - d[1];
            if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
            const tile = tileset.tiles[grid.cells[r][c] - 1];
            if (!tile) continue;
            tile.pieces.forEach((p, k) => {
                if ((p.with || 'self') === side) laid.push({
                    p: p,
                    col: c,
                    row: r,
                    order: laid.length
                });
            });
        }
        return laid.sort((a, b) => (a.p.step || 0) - (b.p.step || 0) || a.order - b.order);
    },
    // is a piece drawn in this cell: its variant, its condition when, its neighbours
    pieceShown(p, grid, tileset, col, row) {
        if (p.when !== undefined && !this.pieceValue(p.when, this.cellEnv(grid, tileset, col, row))) return false;
        if (p.variant !== undefined && p.variant !== null && (grid.variants && grid.variants[col + ',' + row] || 0) !== p.variant) return false;
        for (const side in p.around || {}) {
            const d = this.around[side];
            if (!d) continue;
            const c = col + d[0],
                r = row + d[1];
            const n = c >= 0 && r >= 0 && c < grid.cols && r < grid.rows ? tileset.tiles[grid.cells[r][c] - 1] || null : null;
            if (!this.aroundHolds(p.around[side], n)) return false;
        }
        return true;
    },
    // a condition of around as a text, and back: names of tiles by commas are a list
    aroundText(what) {
        return Array.isArray(what) ? what.join(', ') : what;
    },
    aroundRead(text) {
        text = text.trim();
        if (!text) return null;
        if (text.includes(',')) return text.split(',').map(x => x.trim()).filter(x => x);
        return text;
    },
    // what is wrong with a condition of around, '' when nothing
    aroundProblem(what, tileset) {
        const names = new Set(tileset.tiles.map(t => t.name));
        const check = w => {
            if (typeof w !== 'string') return 'not a name';
            const v = w.startsWith('not ') ? w.slice(4).trim() : w;
            if (this.aroundWords.includes(v) || names.has(v)) return '';
            return "'" + v + "' is no tile of " + tileset.name + ' and no word of around';
        };
        if (Array.isArray(what)) {
            if (!what.length) return 'an empty list';
            for (const w of what) {
                if (w.startsWith('not ')) return "'not' goes before a whole condition, not into a list";
                const e = check(w);
                if (e) return e;
            }
            return '';
        }
        return check(what);
    },
    // an expression (or a number) that is 0 whatever the cell
    constantZero(v, names) {
        if (typeof v === 'number') return !v;
        try {
            const tree = Anim.parseExpr(v, {
                defines: {},
                params: names,
                allowParams: true,
                allowT: false,
                actor: false
            });
            return tree[0] === 'num' && !tree[1];
        } catch (x) {
            return false;
        }
    },
    // what is wrong with an expression of a piece (dx, dy, pick, color), '' when nothing; names: what it may name
    offsetProblem(v, names) {
        if (typeof v === 'number') return Number.isInteger(v) ? '' : 'not a whole number';
        try {
            Anim.parseExpr(v, {
                defines: {},
                params: names || ['mod', 'variant'],
                allowParams: true,
                allowT: false,
                actor: false
            });
            return '';
        } catch (e) {
            return e.message;
        }
    },

    refText(ref) {
        return ref.object !== undefined ? ref.object : ref.grid + ' ' + ref.col + ',' + ref.row;
    },

    // what is wrong in the scenes: [{scene, text, error}]
    check(doc) {
        let problems = [];
        const say = (scene, text, error) => problems.push({
            scene: scene,
            text: text,
            error: !!error
        });
        const coord = v => Number.isInteger(v) && v >= -32768 && v <= this.maxCoord;
        // the sets the maps name for their rules: the graph's, not kinds of the pack (the packer makes no blob of them)
        const rulesSets = new Set((doc.maps || []).map(m => m.rules).filter(Boolean));
        const sceneNames = new Set();
        for (const s of doc.scenes) {
            const n = this.constName(s.name);
            if (sceneNames.has(n)) say(s.name, 'the name ' + n + ' is given to another scene too', true);
            sceneNames.add(n);
            if (!coord(s.width) || !coord(s.height)) say(s.name, 'the size is beyond ' + this.maxCoord, true);
            if (s.layers.length > this.maxLayers) say(s.name, s.layers.length + ' layers, the engine draws ' + this.maxLayers + ' at most', true);
            if (!s.layers.length) say(s.name, 'no layer: the packer lays a scene of 1 .. ' + this.maxLayers + ' layers', true);
            for (const l of s.layers) {
                if (!Number.isInteger(l.factor) || l.factor < -32768 || l.factor > 32767) say(s.name, 'layer ' + l.name + ': factor ' + l.factor + ' is beyond 16 bits', true);
            }
            // the header names layers and grids <PREFIX>_SCENE_<SCENE>_LAYER_<NAME>, _GRID_<NAME>: each once in the scene
            for (const [what, list] of [['layer', s.layers], ['grid', s.grids]]) {
                let seen = {};
                for (const x of list) {
                    const k = this.constName(x.name || '');
                    if (!k) continue;
                    if (seen[k]) say(s.name, what + "s '" + seen[k] + "' and '" + x.name + "' are both " + k, true);
                    seen[k] = x.name;
                }
            }
            // its music: a name of a music (the document's music, or a name only the pack numbers) or stop; the fade in ms
            if (s.music !== undefined && (typeof s.music !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(s.music)))
                say(s.name, 'music ' + JSON.stringify(s.music) + ': the name of a music, or stop', true);
            else if (s.music && s.music !== 'stop' && !(doc.music || []).includes(s.music))
                say(s.name, 'music ' + s.music + ': no music of that name in the document (Game → Music): a name only, it plays nothing', false);
            if (s.musicFade !== undefined && (!Number.isInteger(s.musicFade) || s.musicFade < 0 || s.musicFade > 65535))
                say(s.name, 'musicFade ' + JSON.stringify(s.musicFade) + ': 0..65535 ms', true);
            // the packer lays the layers, pictures, zones, entries, sources of links and actors of a scene in 64 KB (DGSC
            // v5): 36 bytes ahead (the paper, the music), 4 a layer, 18 a picture, 10 a zone, 6 an entry, 6 a source, 12 an
            // actor (with its offset) and 4 a param of it
            let bytes = 36 + 4 * s.layers.length + 6 * new Set(s.links.map(l => this.refText(l.from))).size;
            for (const o of this.objects(s)) bytes += o.type === 'picture' ? 18 : o.type === 'zone' ? 10 : o.type === 'entry' ? 6 : 12 + 4 * Object.keys(o.params || {}).length;
            if (bytes > 0xffff) say(s.name, 'its layers, pictures, zones, entries and actors take ' + bytes + ' bytes in the pack, 65535 at most', true);
            // names the game knows from its code: unique in the scene
            let names = {};
            for (const o of this.objects(s)) {
                if (!o.name) {
                    if (o.type !== 'picture') say(s.name, 'a ' + o.type + ' without a name: the game cannot name it', o.type === 'entry');
                    continue;
                }
                const k = this.constName(o.name);
                if (names[k]) say(s.name, "'" + o.name + "' and '" + names[k] + "' are both " + k, true);
                names[k] = o.name;
                if (!coord(o.x) || !coord(o.y)) say(s.name, o.name + ': the place is beyond 16 bits', true);
                if (o.type === 'picture' && !this.findFrame(doc, o.set, o.image)) say(s.name, o.name + ': no frame ' + o.set + '/' + o.image, true);
            }
            // what the packer refuses of an object, named or not
            for (const o of this.objects(s)) {
                const who = o.name || 'a ' + o.type;
                if ((o.type === 'picture' || o.type === 'actor') && o.rotation !== undefined && !this.isTurn(o.rotation))
                    say(s.name, who + ': rotation ' + JSON.stringify(o.rotation) + ': 0, 90, 180 or 270 (degrees clockwise)', true);
                if (o.type === 'picture' && !o.name && !this.findFrame(doc, o.set, o.image)) say(s.name, 'a picture: no frame ' + o.set + '/' + o.image, true);
                if (o.type === 'picture' && (!coord(o.key) || o.clip && !['x', 'y', 'width', 'height'].every(k => coord(o.clip[k]))))
                    say(s.name, who + ': the key or the clip is beyond 16 bits', true);
                if (o.type === 'zone' && (!coord(o.width) || !coord(o.height))) say(s.name, who + ': the size is beyond 16 bits', true);
                if (o.type === 'actor') {
                    const set = doc.sets.find(x => x.name === o.set);
                    if (!set) say(s.name, who + ": no set '" + o.set + "'", true);
                    else if (!set.animation || !set.animation.scripts.length) say(s.name, who + ': the set ' + o.set + ' has no animation', true);
                    else if (rulesSets.has(set.name)) say(s.name, who + ': the set ' + o.set + ' is the rules of a map, no kind of the pack', true);
                    else {
                        // no script: the first one, as the packer takes it
                        if (o.script && !set.animation.scripts.some(x => x.name === o.script)) say(s.name, who + ": the set has no script '" + o.script + "'", true);
                        for (const p in o.params || {}) {
                            if (!set.animation.params.some(x => x.name === p)) say(s.name, who + ": the set has no param '" + p + "'", true);
                            else if (!coord(o.params[p])) say(s.name, who + ': param ' + p + ' ' + o.params[p] + ' is beyond 16 bits', true);
                        }
                    }
                }
            }
            for (const g of s.grids) {
                const t = doc.tilesets.find(t => t.name === g.tileset);
                if (!t) say(s.name, 'grid ' + g.name + ": no tileset '" + g.tileset + "'", true);
                else {
                    const n = g.cells.flat().reduce((m, v) => Math.max(m, v), 0);
                    if (n > t.tiles.length) say(s.name, 'grid ' + g.name + ': a cell has tile ' + n + ', the tileset has ' + t.tiles.length, true);
                    for (const tile of t.tiles) {
                        for (const p of tile.pieces) {
                            if (!s.layers.some(l => l.name === p.layer)) say(s.name, 'grid ' + g.name + ': tile ' + tile.name + " draws in layer '" + p.layer + "' the scene has not");
                        }
                    }
                    for (const k in g.mods || {}) {
                        if (!Number.isInteger(g.mods[k]) || g.mods[k] < 0 || g.mods[k] > 255) say(s.name, 'grid ' + g.name + ': mod of cell ' + k + ' is not within 0..255', true);
                    }
                    if (g.cells.length !== g.rows || g.cells.some(r => r.length !== g.cols)) say(s.name, 'grid ' + g.name + ': its cells are not ' + g.rows + ' rows of ' + g.cols, true);
                    if (g.cells.flat().some(v => !Number.isInteger(v) || v < 0)) say(s.name, 'grid ' + g.name + ': a cell of no tile', true);
                    for (const k in g.variants || {}) {
                        if (!Number.isInteger(g.variants[k]) || g.variants[k] < 0 || g.variants[k] > 0xffffffff) say(s.name, 'grid ' + g.name + ': variant of cell ' + k + ' is not within 32 bits', true);
                    }
                }
            }
            s.exits.forEach((e, i) => {
                const to = doc.scenes.find(x => x.name === e.scene);
                if (!e.edge && !e.zone && !e.name) say(s.name, 'exit ' + (i + 1) + ': neither an edge, nor a zone, nor a name', true);
                if (e.zone && !this.objects(s).some(o => o.type === 'zone' && o.name === e.zone)) say(s.name, 'exit ' + (i + 1) + ": no zone '" + e.zone + "'", true);
                if (!to) say(s.name, 'exit ' + (i + 1) + ": no scene '" + e.scene + "'", true);
                else if (e.entry && to.kind !== 'show' && !this.objects(to).some(o => o.type === 'entry' && o.name === e.entry)) say(s.name, 'exit ' + (i + 1) + ': scene ' + to.name + " has no entry '" + e.entry + "'", true);
            });
            s.links.forEach((l, i) => {
                for (const end of [l.from, l.to]) {
                    if (end.object !== undefined ? !this.objects(s).some(o => o.name === end.object) : !s.grids.some(g => g.name === end.grid && end.col < g.cols && end.row < g.rows))
                        say(s.name, 'link ' + (i + 1) + ': nothing at ' + this.refText(end), true);
                }
                // a source is a cell, an actor or a zone (DGX_GE_LAYOUT_CELL, _ACTOR, _ZONE)
                const from = l.from.object !== undefined && this.objects(s).find(o => o.name === l.from.object && (o.type === 'picture' || o.type === 'entry'));
                if (from) say(s.name, 'link ' + (i + 1) + ': the ' + from.type + ' ' + from.name + ' fires nothing: a source of links is a cell, an actor or a zone', true);
            });
            // the links are a map's: the packer lays them in the blob of the map's links
            if (s.links.length && !(s.map && (doc.maps || []).some(m => m.name === s.map) && doc.graph && doc.graph.name))
                say(s.name, s.links.length + ' links, but the scene is in no map of the graph: the links are a map\'s', true);
        }
        // blobs of the pack by their names: the animations of the sets, the sets of tiles, and the packer's own; two of
        // one name the packer refuses (their #defines would be one)
        let blobs = {
            STYLES: 'the styles of dialogs',
            STRINGS: 'the strings of dialogs',
            TIMERS: 'the timers of the game',
            GAME: 'the numbers of the game',
            CHASE: 'the chases of the kinds'
        };
        const blob = (name, what, raw) => {
            const n = raw ? name : Anim.packName('', name).slice(1);
            if (n in blobs) say(null, what + ' and ' + blobs[n] + ' are one blob ' + n + ' in the pack: rename one', true);
            else blobs[n] = what;
        };
        blobs.SOUNDS = 'the sounds of the game';
        for (const set of doc.sets || [])
            if (set.animation && set.animation.scripts.length && !rulesSets.has(set.name)) blob(set.name, 'the animation of the set ' + set.name);
        for (const t of doc.tilesets) blob(t.name, 'the tileset ' + t.name);
        for (const s of doc.scenes) blob('SCENE_' + s.name, 'the scene ' + s.name);
        if (doc.graph && doc.graph.name) blob(doc.graph.name, 'the graph ' + doc.graph.name);
        // the links of a map with links: <GRAPH>_<MAP>_LINKS
        if (doc.graph && doc.graph.name)
            for (const m of doc.maps || [])
                if (doc.scenes.some(s => s.map === m.name && s.links.length)) blob(doc.graph.name + '_' + m.name + '_LINKS', 'the links of the map ' + m.name);
        for (const d of doc.dialogs || []) {
            const m = /^\s*dialog\s+(\w+)/m.exec(d.text || '');
            if (m) blob(m[1], 'the dialog ' + m[1]);
        }
        // a show's blob is named as it is written; a show of a kind's name Game.check tells
        for (const sh of doc.shows || [])
            if (sh.name && !(sh.name in blobs && blobs[sh.name].startsWith('the animation'))) blob(sh.name, 'the show ' + sh.name, true);
        // palettes: names of their own, none a set's (a color names either)
        let palNames = new Set();
        for (const p of doc.palettes || []) {
            if (!p.name || palNames.has(p.name)) say(null, "palette '" + p.name + "': no name, or two of it", true);
            if ((doc.sets || []).some(s => s.name === p.name)) say(null, "palette '" + p.name + "' and a set have one name: a color names either", true);
            if (!p.colors.length || p.colors.length > 255) say(null, 'palette ' + p.name + ': ' + p.colors.length + ' colors, 1 .. 255', true);
            palNames.add(p.name);
        }
        // a palette is a set of the pack: the header names it <PREFIX>_SET_<NAME> as it names the sets
        let setHeader = new Map();
        for (const x of [...(doc.sets || []), ...(doc.palettes || [])]) {
            const h = Anim.nameOf(x.name || '');
            if (setHeader.has(h) && setHeader.get(h) !== x.name) say(null, "'" + setHeader.get(h) + "' and '" + x.name + "' are one name in the header: SET_" + h, true);
            else setHeader.set(h, x.name);
        }
        for (const t of doc.tilesets) {
            if (t.tiles.length > this.maxTiles) say(null, 'tileset ' + t.name + ': more than ' + this.maxTiles + ' tiles', true);
            for (const [n, f] of Object.entries(t.fields || {})) {
                // an identifier, as the packer takes it
                if (!Anim.isIdent(n) || n === 'mod' || n === 'variant' || Anim.reserved(n)) say(null, 'tileset ' + t.name + ": field '" + n + "' is no name or it is taken", true);
                const bits = f[0] === 'mod' ? 8 : 32;
                if (f[0] !== 'mod' && f[0] !== 'variant') say(null, 'tileset ' + t.name + ', field ' + n + ': of mod or variant', true);
                else if (!(f[1] >= 0 && f[2] >= 1 && f[1] + f[2] <= bits)) say(null, 'tileset ' + t.name + ', field ' + n + ': bits ' + f[1] + '..' + (f[1] + f[2] - 1) + ' are not in the ' + bits + ' of ' + f[0], true);
            }
            const names = new Set();
            for (const tile of t.tiles) {
                const where = 'tileset ' + t.name + ', tile ' + tile.name;
                if (names.has(tile.name)) say(null, where + ': the name is given to another tile too: around names tiles', true);
                names.add(tile.name);
                if (tile.pieces.length > 255) say(null, where + ': ' + tile.pieces.length + ' pieces, 255 at most', true);
                // the names expressions of pieces may use: mod, variant, the fields
                const exprs = this.exprNames(t);
                if ((tile.bodies || []).length > 255) say(null, where + ': ' + tile.bodies.length + ' bodies, 255 at most', true);
                if (tile.veil !== undefined && !(Number.isInteger(tile.veil) && tile.veil >= 0 && tile.veil <= 7)) say(null, where + ': veil ' + tile.veil + ': 0..7', true);
                if (tile.seen_as !== undefined && (tile.seen_as === tile.name || !t.tiles.some(x => x.name === tile.seen_as)))
                    say(null, where + ': seen as ' + tile.seen_as + ', which is no other tile of the set', false);
                if (tile.life !== undefined) {
                    // the animations of the sets come into the pack before the tilesets
                    // by its name in the pack: letters and digits, the rest '_', upper case
                    const set = (doc.sets || []).find(s => Anim.packName(s.name, '').slice(0, -1) === Anim.packName('', tile.life).slice(1));
                    if (!set) say(null, where + ': life ' + tile.life + ' is no animation of a set here: the pack must have it before the tileset', false);
                    else if (!set.animation || !set.animation.scripts.length) say(null, where + ': life ' + tile.life + ': the set ' + set.name + ' has no animation', true);
                    else if (set.animation.params.length < 2) say(null, where + ': life ' + tile.life + ': its params 0 and 1 are the modifier and the tile of the cell, it has ' + set.animation.params.length, false);
                }
                [...(tile.bodies || []), ...(tile.opening ? [tile.opening] : [])].forEach((b, k) => {
                    const w = where + (b === tile.opening ? ', its opening' : ', body ' + (k + 1));
                    if (b === tile.opening && b.for !== undefined) {
                        say(null, w + ': an opening holds no masks (for), it is not solid', true);
                        return;
                    }
                    for (const k2 of ['dx', 'dy', 'w', 'h', 'when']) {
                        if (b[k2] === undefined) continue;
                        const e = this.offsetProblem(b[k2], exprs);
                        if (e) say(null, w + ': ' + k2 + ': ' + e + ' (numbers, ' + exprs.join(', ') + ')', true);
                    }
                    if (b.when !== undefined && !this.offsetProblem(b.when, exprs) && this.constantZero(b.when, exprs)) say(null, w + ': when ' + b.when + ' is never', true);
                    for (const k2 of ['w', 'h'])
                        if (Number.isInteger(b[k2]) && b[k2] <= 0) say(null, w + ': ' + k2 + ' ' + b[k2] + (b === tile.opening ? ': an opening of no size shows nothing' : ': a body of no size stops nothing'), false);
                    if (b.for !== undefined) {
                        if (!Array.isArray(b.for) || !b.for.length) say(null, w + ': for: a list of masks 0..15 it holds, or none for every mask', true);
                        else {
                            const bad = b.for.filter(m => !Number.isInteger(m) || m < 0 || m > 15);
                            if (bad.length) say(null, w + ': for: holds mask ' + bad.join(', ') + ', masks are 0..15', true);
                            if (new Set(b.for).size !== b.for.length) say(null, w + ': for: a mask is given twice', false);
                            const unknown = b.for.filter(m => Number.isInteger(m) && m >= 0 && m <= 15 && !(doc.masks || []).some(x => x.index === m));
                            if (unknown.length) say(null, w + ': for: no mask ' + unknown.join(', ') + ' in this file: nothing of the file touches with it', false);
                        }
                    }
                });
                tile.pieces.forEach((p, k) => {
                    const w = where + ', piece ' + (k + 1);
                    const refs = this.pieceRefs(p);
                    // by mod or pick with no picture at all never draws: legal, likely a slip
                    if (!refs.length && p.draw !== 'fill' && !p.by_mod && !p.pictures) say(null, w + ': no picture', true);
                    if (refs.length > 255) say(null, w + ': ' + refs.length + ' pictures, 255 at most', true);
                    for (const r of refs) {
                        if (!this.findFrame(doc, r.set, r.image)) say(null, w + ': no frame ' + r.set + '/' + r.image, true);
                    }
                    if (p.by_mod && !p.by_mod.some(r => r)) say(null, w + ': by mod has no picture at all: the piece never draws', false);
                    if (p.with !== undefined && !this.withOrder.includes(p.with)) say(null, w + ": with: no side '" + p.with + "'", true);
                    if (p.step !== undefined && (!Number.isInteger(p.step) || p.step < 0 || p.step > 255)) say(null, w + ': step ' + p.step + ' is not within 0..255', true);
                    if (p.draw !== undefined && !this.draws.includes(p.draw)) say(null, w + ": draw: no way '" + p.draw + "'", true);
                    if (p.color !== undefined) {
                        const n = Array.isArray(p.color) ? p.color[1] : p.color;
                        if (typeof n === 'string') {
                            const e = this.offsetProblem(n, exprs);
                            if (e) say(null, w + ': color: ' + e, true);
                        } else if (!Number.isInteger(n) || n < 0 || n > 255) say(null, w + ': color ' + n + ' is not within 0..255', true);
                        if (Array.isArray(p.color) && !doc.sets.some(x => x.name === p.color[0]) && !(doc.palettes || []).some(x => x.name === p.color[0]))
                            say(null, w + ": color: no set or palette '" + p.color[0] + "'", true);
                        const pal = Array.isArray(p.color) && (doc.palettes || []).find(x => x.name === p.color[0]);
                        if (pal && Number.isInteger(p.color[1]) && (p.color[1] < 0 || p.color[1] > pal.colors.length))
                            say(null, w + ': color ' + p.color[1] + ' of palette ' + pal.name + ', which has ' + pal.colors.length, true);
                    }
                    for (const c of p.cycle || []) {
                        if (!Number.isInteger(c.ms) || c.ms < 1 || c.ms > 65535) say(null, w + ': a picture of the cycle has ' + c.ms + ' ms, not 1..65535', true);
                    }
                    if (!p.layer) say(null, w + ': no layer', true);
                    if (p.when !== undefined) {
                        const e = this.offsetProblem(p.when, exprs);
                        if (e) say(null, w + ': when: ' + e, true);
                        else if (this.constantZero(p.when, exprs)) say(null, w + ': when is always 0: the piece is never drawn', true);
                    }
                    for (const k2 of ['dx', 'dy', 'pick']) {
                        if (p[k2] === undefined) continue;
                        const e = this.offsetProblem(p[k2], exprs);
                        if (e) say(null, w + ': ' + k2 + ': ' + e + ' (numbers, ' + exprs.join(', ') + ')', true);
                    }
                    if (p.pictures && p.pick === undefined) say(null, w + ': pictures without pick', true);
                    if (p.pictures && !p.pictures.some(r => r)) say(null, w + ': pick has no picture at all: the piece never draws', false);
                    if (p.draw === 'fill' && !(Array.isArray(p.size) && p.size.length === 2 && p.size.every(v => Number.isInteger(v) && v >= 1 && v <= 32767)))
                        say(null, w + ': a fill needs size [width, height]', true);
                    for (const side in p.around || {}) {
                        if (!this.around[side]) say(null, w + ": around: no side '" + side + "'", true);
                        const e = this.aroundProblem(p.around[side], t);
                        if (e) say(null, w + ': around ' + side + ': ' + e, true);
                    }
                    if (p.variant !== undefined && p.variant !== null && (!Number.isInteger(p.variant) || p.variant < 0 || p.variant > 0xffffffff))
                        say(null, w + ': variant ' + p.variant + ' is not within 32 bits', true);
                });
            }
        }
        return problems;
    },

    // a body of a tile from a file: numbers or texts of expressions, 0 for what it has not
    readBody(b) {
        const value = v => Number.isInteger(v) ? v : typeof v === 'string' && v.trim() ? v.trim() : 0;
        let body = {
            dx: value(b.dx),
            dy: value(b.dy),
            w: value(b.w),
            h: value(b.h)
        };
        if (Number.isInteger(b.when) || typeof b.when === 'string' && b.when.trim()) body.when = value(b.when);
        // the masks it holds, as given (the check says what is wrong with them); none or empty: every mask
        if (Array.isArray(b.for) && b.for.length) body.for = b.for.map(m => Number.isInteger(m) ? m : typeof m === 'string' && /^\d+$/.test(m.trim()) ? parseInt(m, 10) : m);
        return body;
    },
    // the box of the opening of a tile in a cell, as bodyRects finds boxes; null when it has none there
    openingRect(tile, base, env) {
        return tile.opening ? this.bodyRects({
            bodies: [tile.opening]
        }, base, env)[0] || null : null;
    },
    // whether a body holds a mask (its for names it, or it has none: every mask)
    bodyHolds(body, mask) {
        return !Array.isArray(body.for) || !body.for.length || body.for.includes(mask);
    },
    // the boxes of the bodies of a tile in a cell whose bottom-left point is base, as the engine finds them:
    // [{x, y, width, height, for}] in points of the scene; those whose when is 0 or whose size is not above 0 are not
    // there; asking: a mask (0..15), only the bodies that hold it, as the engine sees them for that mask; else all
    bodyRects(tile, base, env, asking) {
        let rects = [];
        for (const b of tile.bodies || []) {
            if (asking !== undefined && asking !== null && asking >= 0 && !this.bodyHolds(b, asking)) continue;
            if (b.when !== undefined && !this.pieceValue(b.when, env)) continue;
            const dx = this.pieceValue(b.dx, env),
                dy = this.pieceValue(b.dy, env),
                w = this.pieceValue(b.w, env),
                h = this.pieceValue(b.h, env);
            if (w > 0 && h > 0) rects.push({
                x: base.x + dx,
                y: base.y + dy - h + 1,
                width: w,
                height: h,
                for: b.for
            });
        }
        return rects;
    },
    // a piece of a tile from a file, null when it is no piece; fields it has not stay out of it
    readPiece(p) {
        if (!p || typeof p !== 'object') return null;
        const isInt = Number.isInteger;
        const ref = r => r && typeof r.set === 'string' && typeof r.image === 'string';
        const offset = v => isInt(v) ? v : typeof v === 'string' && v.trim() ? v.trim() : 0;
        let piece = {
            layer: typeof p.layer === 'string' ? p.layer : '',
            key: isInt(p.key) ? p.key : 0,
            dx: offset(p.dx),
            dy: offset(p.dy)
        };
        if (Array.isArray(p.by_mod) && p.by_mod.length) piece.by_mod = p.by_mod.map(r => ref(r) ? {
            set: r.set,
            image: r.image
        } : null);
        else if (Array.isArray(p.pictures) && p.pictures.length) {
            piece.pick = offset(p.pick);
            piece.pictures = p.pictures.map(r => ref(r) ? {
                set: r.set,
                image: r.image
            } : null);
        } else if (Array.isArray(p.cycle) && p.cycle.length) piece.cycle = p.cycle.filter(ref).map(r => ({
            set: r.set,
            image: r.image,
            ms: isInt(r.ms) ? r.ms : 100
        }));
        else if (ref(p)) {
            piece.set = p.set;
            piece.image = p.image;
        } else if (p.draw !== 'fill') return null;
        if (p.around && typeof p.around === 'object') {
            let around = {};
            for (const side in p.around) {
                const w = p.around[side];
                if (typeof w === 'string' || (Array.isArray(w) && w.every(x => typeof x === 'string'))) around[side] = w;
            }
            if (Object.keys(around).length) piece.around = around;
        }
        if (isInt(p.variant)) piece.variant = p.variant;
        if (isInt(p.when) || (typeof p.when === 'string' && p.when.trim())) piece.when = isInt(p.when) ? p.when : p.when.trim();
        if (typeof p.with === 'string' && p.with !== 'self') piece.with = p.with;
        if (isInt(p.step) && p.step) piece.step = p.step;
        if (typeof p.draw === 'string' && p.draw !== 'normal') piece.draw = p.draw;
        const n = v => isInt(v) || (typeof v === 'string' && v.trim() !== '');
        if (n(p.color) || (Array.isArray(p.color) && typeof p.color[0] === 'string' && n(p.color[1]))) piece.color = Array.isArray(p.color) ? [p.color[0], p.color[1]] : p.color;
        if (p.draw === 'fill' && Array.isArray(p.size) && p.size.length === 2) piece.size = [p.size[0] | 0, p.size[1] | 0];
        return piece;
    },

    // the scenes, tilesets and screen of a file, checked, unknown keys dropped: {screen, tilesets, scenes} or {error}
    read(file) {
        const isInt = Number.isInteger;
        const str = v => typeof v === 'string' ? v : '';
        const bad = text => ({
            error: 'Bad scenes: ' + text
        });
        const screen = file.screen && isInt(file.screen.width) && isInt(file.screen.height) && file.screen.width > 0 && file.screen.height > 0 ? {
            width: file.screen.width,
            height: file.screen.height
        } : {
            width: 320,
            height: 240
        };
        let tilesets = [];
        for (const t of file.tilesets || []) {
            if (!t || typeof t.name !== 'string' || !isInt(t.cellWidth) || !isInt(t.cellHeight) || !Array.isArray(t.tiles)) return bad('a tileset');
            let fields = {};
            for (const [n, f] of Object.entries(t.fields || {})) {
                if (Array.isArray(f) && f.length === 3 && typeof f[0] === 'string' && isInt(f[1]) && isInt(f[2])) fields[n] = [f[0], f[1], f[2]];
            }
            tilesets.push({
                name: t.name,
                cellWidth: Math.max(1, t.cellWidth),
                cellHeight: Math.max(1, t.cellHeight),
                fields: fields,
                tiles: t.tiles.filter(x => x).map(x => {
                    let tile = {
                        name: str(x.name),
                        kind: isInt(x.kind) ? x.kind : 0,
                        solid: Object.fromEntries(this.sides.map(k => [k, !!(x.solid && x.solid[k])])),
                        pieces: (Array.isArray(x.pieces) ? x.pieces : []).map(p => this.readPiece(p)).filter(p => p)
                    };
                    // the sides that end the open space an actor is seen in; without it they are the solid ones
                    if (x.closes && typeof x.closes === 'object') tile.closes = Object.fromEntries(this.sides.map(k => [k, !!x.closes[k]]));
                    if (Array.isArray(x.bodies) && x.bodies.length) tile.bodies = x.bodies.filter(b => b && typeof b === 'object').map(b => this.readBody(b));
                    // what an actor gone into the tile is seen through: a box as a body (a for kept for the check to refuse)
                    if (x.opening && typeof x.opening === 'object' && !Array.isArray(x.opening)) tile.opening = this.readBody(x.opening);
                    if (typeof x.life === 'string' && x.life.trim()) tile.life = x.life.trim();
                    if (typeof x.seen_as === 'string' && x.seen_as.trim()) tile.seen_as = x.seen_as.trim();
                    // kept as given when not 0: the check says what is wrong with it
                    if (x.veil !== undefined && x.veil !== 0) tile.veil = x.veil;
                    return tile;
                })
            });
        }
        const ref = r => r && typeof r.object === 'string' ? {
            object: r.object
        } : r && typeof r.grid === 'string' && isInt(r.col) && isInt(r.row) ? {
            grid: r.grid,
            col: r.col,
            row: r.row
        } : null;
        let scenes = [];
        for (const s of file.scenes || []) {
            if (!s || typeof s.name !== 'string' || !isInt(s.width) || !isInt(s.height) || !Array.isArray(s.layers)) return bad('a scene');
            let scene = {
                name: s.name,
                width: Math.max(1, s.width),
                height: Math.max(1, s.height),
                background: typeof s.background === 'string' ? s.background : '#000000',
                layers: [],
                grids: [],
                exits: [],
                links: [],
                map: str(s.map),
                index: isInt(s.index) ? s.index : 0,
                kind: s.kind === 'show' ? 'show' : 'room',
                onEnter: str(s.onEnter),
                leave: Maps.readLeave(s.leave)
            };
            // its music, as the game enters it (a music's name, or stop; none: what plays goes on), and how long the
            // change fades (500 ms when not said): kept as given, the check says what is wrong
            if (s.music !== undefined && s.music !== null) scene.music = s.music;
            if (s.musicFade !== undefined && s.musicFade !== null) scene.musicFade = s.musicFade;
            // a picture's or an actor's turn, degrees clockwise after its mirror: kept as given when there is one
            const turned = (o, out) => {
                if (o.rotation !== undefined && o.rotation !== null) out.rotation = o.rotation;
                return out;
            };
            for (const l of s.layers) {
                if (!l || typeof l.name !== 'string') return bad('a layer of scene ' + s.name);
                let layer = {
                    name: l.name,
                    factor: isInt(l.factor) ? l.factor : 256,
                    order: l.order === 'key' ? 'key' : 'added',
                    visible: l.visible !== false,
                    locked: !!l.locked,
                    objects: []
                };
                for (const o of l.objects || []) {
                    if (!o || !isInt(o.x) || !isInt(o.y)) return bad('an object of layer ' + l.name);
                    const name = str(o.name);
                    if (o.type === 'picture' && typeof o.set === 'string' && typeof o.image === 'string') layer.objects.push(turned(o, {
                        type: 'picture',
                        name: name,
                        set: o.set,
                        image: o.image,
                        x: o.x,
                        y: o.y,
                        key: isInt(o.key) ? o.key : 0,
                        flip: !!o.flip,
                        clip: o.clip && ['x', 'y', 'width', 'height'].every(k => isInt(o.clip[k])) ? {
                            x: o.clip.x,
                            y: o.clip.y,
                            width: o.clip.width,
                            height: o.clip.height
                        } : null
                    }));
                    else if (o.type === 'actor' && typeof o.set === 'string') layer.objects.push(turned(o, {
                        type: 'actor',
                        name: name,
                        set: o.set,
                        script: str(o.script),
                        x: o.x,
                        y: o.y,
                        flip: !!o.flip,
                        params: Object.fromEntries(Object.entries(o.params || {}).filter(([k, v]) => isInt(v)))
                    }));
                    else if (o.type === 'zone' && isInt(o.width) && isInt(o.height)) layer.objects.push({
                        type: 'zone',
                        name: name,
                        kind: str(o.kind),
                        x: o.x,
                        y: o.y,
                        width: o.width,
                        height: o.height
                    });
                    else if (o.type === 'entry') layer.objects.push({
                        type: 'entry',
                        name: name,
                        x: o.x,
                        y: o.y,
                        flip: !!o.flip,
                        arrive: str(o.arrive),
                        fires: Maps.readFires(o.fires)
                    });
                    else return bad('an object ' + JSON.stringify(o).slice(0, 80));
                }
                scene.layers.push(layer);
            }
            for (const g of s.grids || []) {
                if (!g || typeof g.tileset !== 'string' || !isInt(g.cols) || !isInt(g.rows) || !Array.isArray(g.cells)) return bad('a grid of scene ' + s.name);
                let grid = {
                    name: str(g.name) || 'grid',
                    tileset: g.tileset,
                    x: isInt(g.x) ? g.x : 0,
                    y: isInt(g.y) ? g.y : 0,
                    cols: 0,
                    rows: 0,
                    cells: g.cells.map(row => Array.isArray(row) ? row.map(v => isInt(v) && v >= 0 ? v : 0) : []),
                    mods: Object.fromEntries(Object.entries(g.mods || {}).filter(([k, v]) => /^\d+,\d+$/.test(k) && isInt(v))),
                    variants: Object.fromEntries(Object.entries(g.variants || {}).filter(([k, v]) => /^\d+,\d+$/.test(k) && isInt(v)))
                };
                this.resizeGrid(grid, Math.max(1, g.cols), Math.max(1, g.rows));
                scene.grids.push(grid);
            }
            for (const e of s.exits || []) {
                if (!e || typeof e.scene !== 'string') return bad('an exit of scene ' + s.name);
                scene.exits.push({
                    edge: this.edges.includes(e.edge) ? e.edge : '',
                    zone: str(e.zone),
                    scene: e.scene,
                    entry: str(e.entry),
                    name: str(e.name),
                    transition: Maps.transitions.includes(e.transition) ? e.transition : 'cut'
                });
            }
            for (const l of s.links || []) {
                const from = ref(l && l.from),
                    to = ref(l && l.to);
                if (!from || !to) return bad('a link of scene ' + s.name);
                scene.links.push({
                    from: from,
                    to: to,
                    event: str(l.event),
                    value: isInt(l.value) ? l.value : null
                });
            }
            scenes.push(scene);
        }
        return {
            screen: screen,
            tilesets: tilesets,
            scenes: scenes
        };
    },
};
