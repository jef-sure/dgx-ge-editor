// The view of a scene: its layers from the back to the front, the tiles of its grids drawn piece by piece in their
// layers, layers moved by their factors as the window (the camera) moves; over them zones, entries, links, the frame
// of the screen and what is selected. The wheel zooms, the middle button moves the view; the left button does what
// the tool does
const SceneUi = Vue.reactive({
    cursor: null, // {x, y} of the scene under the mouse
    cell: null, // {grid, col, row} under the mouse
    linkFrom: null, // the first end of a link being made
    message: '',
    view: null, // the SceneCanvas shown, for its size
});

const SceneCanvas = {
    data() {
        return {
            width: 800,
            height: 520,
            drag: null,
            zoneRect: null,
            ui: SceneUi,
        };
    },
    mounted() {
        this.ctx = this.$refs.canvas.getContext('2d');
        this.resize = new ResizeObserver(() => {
            const r = this.$el.getBoundingClientRect();
            this.width = Math.max(200, Math.floor(r.width));
            this.height = Math.max(200, Math.floor(r.height));
        });
        this.resize.observe(this.$el);
        SceneUi.view = this;
        window.addEventListener('mouseup', this.onmouseup);
        // tiles that cycle go on by the time of the scene while it is asked
        this.time = 0;
        this.cycleTimer = setInterval(() => {
            if (!this.edit.sceneCycles) return;
            this.time = performance.now();
            this.requestDraw();
        }, 50);
        this.draw();
    },
    unmounted() {
        clearInterval(this.cycleTimer);
        if (SceneUi.view === this) SceneUi.view = null;
        this.resize.disconnect();
        window.removeEventListener('mouseup', this.onmouseup);
        if (this.drawRequest) cancelAnimationFrame(this.drawRequest);
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        scene() {
            return this.sprites.scenes[this.edit.sceneIndex];
        },
        z() {
            return this.edit.sceneZoom;
        },
        activeLayer() {
            if (!this.scene) return null;
            return this.scene.layers.find(l => l.name === this.edit.sceneLayer) || this.scene.layers[0] || null;
        },
    },
    watch: {
        'spritesStore.sprites': {
            handler() {
                this.requestDraw();
            },
            deep: true
        },
        'spritesStore.edit': {
            handler() {
                this.requestDraw();
            },
            deep: true
        },
        'spritesStore.imagesVersion'() {
            this.requestDraw();
        },
        width() {
            this.requestDraw();
        },
        height() {
            this.requestDraw();
        },
        zoneRect: {
            handler() {
                this.requestDraw();
            },
            deep: true
        },
        'ui.cursor'() {
            if (this.edit.sceneTool === 'tile' || this.edit.sceneTool === 'link') this.requestDraw();
        },
    },
    methods: {
        requestDraw() {
            if (this.drawRequest) return;
            this.drawRequest = requestAnimationFrame(() => {
                this.drawRequest = 0;
                this.draw();
            });
        },
        // screen pixels of a point of the scene
        vx(x) {
            return Math.round((x - this.edit.scenePanX) * this.z);
        },
        vy(y) {
            return Math.round((y - this.edit.scenePanY) * this.z);
        },
        sceneAt(event) {
            const r = this.$refs.canvas.getBoundingClientRect();
            return {
                x: Math.floor((event.clientX - r.left) / this.z + this.edit.scenePanX),
                y: Math.floor((event.clientY - r.top) / this.z + this.edit.scenePanY)
            };
        },
        // a layer stands moved by its factor when the window is not at 0, 0
        offset(layer) {
            const c = this.edit.sceneCamera;
            const k = 1 - layer.factor / 256;
            return {
                x: Math.round(c.x * k),
                y: Math.round(c.y * k)
            };
        },
        snap(v) {
            const s = Math.max(1, this.edit.sceneSnap | 0);
            return Math.round(v / s) * s;
        },
        tilesetOf(grid) {
            return this.sprites.tilesets.find(t => t.name === grid.tileset) || null;
        },

        draw() {
            const canvas = this.$refs.canvas;
            if (!canvas) return;
            if (canvas.width !== this.width) canvas.width = this.width;
            if (canvas.height !== this.height) canvas.height = this.height;
            const ctx = this.ctx;
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = '#b8bcc4';
            ctx.fillRect(0, 0, this.width, this.height);
            const s = this.scene;
            if (!s) return;
            const z = this.z;
            ctx.fillStyle = s.background;
            ctx.fillRect(this.vx(0), this.vy(0), s.width * z, s.height * z);
            const known = new Set(s.layers.map(l => l.name));
            for (const layer of s.layers) {
                if (layer.visible) this.drawLayer(layer, s);
            }
            // pieces of tiles in layers the scene has not: drawn over all, faint, to be seen
            ctx.globalAlpha = 0.5;
            this.drawPieces(s, p => !known.has(p.layer), {
                x: 0,
                y: 0
            }).forEach(d => d());
            ctx.globalAlpha = 1;
            if (z >= 8) this.drawPixelGrid(s);
            if (this.edit.sceneShowGrid) this.drawGrids(s);
            if (this.edit.sceneShowBodies) this.drawBodies(s);
            if (this.edit.sceneShowZones) this.drawMarks(s);
            if (this.edit.sceneShowLinks) this.drawLinks(s);
            if (this.edit.sceneShowScreen) this.drawScreen(s);
            this.drawSelection(s);
            if (this.zoneRect) this.drawDashed(this.normal(this.zoneRect), '#ff30ff');
            if (this.edit.sceneTool === 'tile' && SceneUi.cell) this.drawCellHover();
        },
        // what a layer draws, as functions in the order it draws them
        drawLayer(layer, s) {
            const off = this.offset(layer);
            let items = this.drawPieces(s, p => p.layer === layer.name, off, true);
            layer.objects.forEach((o, i) => {
                if (o.type !== 'picture' && o.type !== 'actor') return;
                items.push({
                    key: o.type === 'actor' ? o.y : o.key,
                    order: items.length,
                    draw: () => this.drawObject(o, off)
                });
            });
            if (layer.order === 'key') items.sort((a, b) => a.key - b.key || a.order - b.order);
            for (const it of items) it.draw();
        },
        // the pieces of tiles of all grids that pass a test; with keys they are items of a layer
        drawPieces(s, test, off, keyed) {
            let items = [];
            for (const g of s.grids) {
                const t = this.tilesetOf(g);
                if (!t) continue;
                const paper = this.hexRgb(s.background);
                for (let r = 0; r < g.rows; ++r) {
                    for (let c = 0; c < g.cols; ++c) {
                        // the pieces the grid lays with this cell: its own and those of the cells around laid with it;
                        // each stands at its own cell, by its rules there
                        for (const {
                                p,
                                col,
                                row
                            } of Scene.laidWith(g, t, c, r)) {
                            if (!test(p) || !Scene.pieceShown(p, g, t, col, row)) continue;
                            // the mod, the variant and the fields of its own cell
                            const env = Scene.cellEnv(g, t, col, row);
                            const ref = Scene.pieceRef(p, env, this.time);
                            if (!ref) continue;
                            const base = Scene.cellBase(g, t, col, row);
                            const draw = () => {
                                const x = this.vx(base.x + Scene.pieceOffset(p.dx, env) + off.x);
                                const y = this.vy(base.y + Scene.pieceOffset(p.dy, env) + off.y);
                                const rgb = p.draw ? Scene.pieceColor(this.sprites, p, paper, env) : null;
                                if (p.draw === 'fill') {
                                    // a rectangle of its color alone, its left lower pixel at the place
                                    const size = p.size || [1, 1];
                                    this.ctx.fillStyle = 'rgb(' + rgb.join(',') + ')';
                                    this.ctx.fillRect(x, y - (size[1] - 1) * this.z, size[0] * this.z, size[1] * this.z);
                                    return;
                                }
                                const live = Scene.pieceRef(p, env, this.time);
                                const f = Scene.findFrame(this.sprites, live.set, live.image);
                                Scene.drawFrameAs(this.ctx, live.set, f, x, y, false, this.z, p.draw, rgb);
                            };
                            items.push(keyed ? {
                                key: p.key,
                                order: items.length,
                                draw: draw
                            } : draw);
                        }
                    }
                }
            }
            return items;
        },
        drawObject(o, off) {
            const ctx = this.ctx;
            const f = o.type === 'actor' ? Scene.actorFrame(this.sprites, o) : Scene.findFrame(this.sprites, o.set, o.image);
            const x = this.vx(o.x + off.x),
                y = this.vy(o.y + off.y);
            if (o.type === 'picture' && o.clip) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(this.vx(o.clip.x + off.x), this.vy(o.clip.y + off.y), o.clip.width * this.z, o.clip.height * this.z);
                ctx.clip();
            }
            // an actor: the picture of its frame, of whatever set, so far forward and down
            const ap = o.type === 'actor' ? Scene.actorPicture(this.sprites, o) : null;
            const [dx, dy] = Scene.shiftOf(o, ap);
            const drawn = ap ? Scene.drawFrame(ctx, ap.setName, ap.frame, x + dx * this.z, y + dy * this.z, o.flip, this.z, o.rotation) :
                Scene.drawFrame(ctx, o.set, f, x, y, o.flip, this.z, o.rotation);
            if (!drawn) {
                // a picture not loaded: its place
                const r = Scene.bounds(this.sprites, o);
                this.drawDashed({
                    x: r.x + off.x,
                    y: r.y + off.y,
                    width: r.width,
                    height: r.height
                }, '#808080', o.name || o.image);
            }
            if (o.type === 'picture' && o.clip) ctx.restore();
            if (o.type === 'actor') {
                ctx.font = '11px sans-serif';
                ctx.fillStyle = '#0060c0';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                const label = '◆ ' + (o.name || o.set) + ': ' + o.script;
                ctx.strokeText(label, x + 4, y + 12);
                ctx.fillText(label, x + 4, y + 12);
                ctx.lineWidth = 1;
            }
        },
        drawPixelGrid(s) {
            const ctx = this.ctx;
            const z = this.z;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.beginPath();
            const x0 = Math.max(0, Math.floor(this.edit.scenePanX)),
                x1 = Math.min(s.width, Math.ceil(this.edit.scenePanX + this.width / z));
            const y0 = Math.max(0, Math.floor(this.edit.scenePanY)),
                y1 = Math.min(s.height, Math.ceil(this.edit.scenePanY + this.height / z));
            for (let x = x0; x <= x1; ++x) {
                ctx.moveTo(this.vx(x) + 0.5, this.vy(y0));
                ctx.lineTo(this.vx(x) + 0.5, this.vy(y1));
            }
            for (let y = y0; y <= y1; ++y) {
                ctx.moveTo(this.vx(x0), this.vy(y) + 0.5);
                ctx.lineTo(this.vx(x1), this.vy(y) + 0.5);
            }
            ctx.stroke();
        },
        // what of the cells is solid, by the bodies of their tiles in each cell
        drawBodies(s) {
            const ctx = this.ctx;
            ctx.strokeStyle = 'rgba(255, 40, 40, 0.9)';
            ctx.fillStyle = 'rgba(255, 40, 40, 0.15)';
            for (const g of s.grids) {
                const t = this.tilesetOf(g);
                if (!t || !t.tiles.some(x => x.bodies && x.bodies.length || x.opening)) continue;
                for (let r = 0; r < g.rows; ++r)
                    for (let c = 0; c < g.cols; ++c) {
                        const tile = t.tiles[g.cells[r][c] - 1];
                        if (!tile) continue;
                        // an opening: what an actor gone into the tile is seen through, blue
                        const o = Scene.openingRect(tile, Scene.cellBase(g, t, c, r), Scene.cellEnv(g, t, c, r));
                        if (o) {
                            const x = this.vx(o.x),
                                y = this.vy(o.y);
                            ctx.save();
                            ctx.strokeStyle = 'rgba(60, 140, 255, 0.95)';
                            ctx.fillStyle = 'rgba(60, 140, 255, 0.15)';
                            ctx.setLineDash([2, 2]);
                            ctx.fillRect(x, y, this.vx(o.x + o.width) - x, this.vy(o.y + o.height) - y);
                            ctx.strokeRect(x + 0.5, y + 0.5, this.vx(o.x + o.width) - x - 1, this.vy(o.y + o.height) - y - 1);
                            ctx.restore();
                        }
                        if (!tile.bodies) continue;
                        // the bodies the engine sees for the mask chosen (every one when none is); a body that holds
                        // some masks only is dashed
                        for (const b of Scene.bodyRects(tile, Scene.cellBase(g, t, c, r), Scene.cellEnv(g, t, c, r), this.edit.sceneBodiesMask)) {
                            const x = this.vx(b.x),
                                y = this.vy(b.y),
                                w = this.vx(b.x + b.width) - x,
                                h = this.vy(b.y + b.height) - y;
                            ctx.fillRect(x, y, w, h);
                            ctx.setLineDash(b.for ? [4, 3] : []);
                            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
                        }
                    }
            }
            ctx.setLineDash([]);
        },
        drawGrids(s) {
            const ctx = this.ctx;
            for (const g of s.grids) {
                const t = this.tilesetOf(g);
                if (!t) continue;
                const active = g.name === this.edit.sceneGrid;
                ctx.strokeStyle = active ? 'rgba(255, 160, 0, 0.7)' : 'rgba(255, 255, 255, 0.25)';
                ctx.beginPath();
                for (let c = 0; c <= g.cols; ++c) {
                    const x = this.vx(g.x + c * t.cellWidth) + 0.5;
                    ctx.moveTo(x, this.vy(g.y));
                    ctx.lineTo(x, this.vy(g.y + g.rows * t.cellHeight));
                }
                for (let r = 0; r <= g.rows; ++r) {
                    const y = this.vy(g.y + r * t.cellHeight) + 0.5;
                    ctx.moveTo(this.vx(g.x), y);
                    ctx.lineTo(this.vx(g.x + g.cols * t.cellWidth), y);
                }
                ctx.stroke();
                // mods of cells, small numbers
                ctx.font = '10px monospace';
                ctx.fillStyle = '#ffd040';
                for (const k in g.mods) {
                    const [c, r] = k.split(',').map(Number);
                    ctx.fillText(String(g.mods[k]), this.vx(g.x + c * t.cellWidth) + 2, this.vy(g.y + r * t.cellHeight) + 10);
                }
            }
        },
        // zones and entries: the logic of the game, not drawn by it
        drawMarks(s) {
            const ctx = this.ctx;
            for (const layer of s.layers) {
                if (!layer.visible) continue;
                for (const o of layer.objects) {
                    if (o.type === 'zone') this.drawDashed(o, '#00c070', (o.name || 'zone') + (o.kind ? ' (' + o.kind + ')' : ''));
                    if (o.type === 'entry') {
                        const x = this.vx(o.x) + this.z / 2,
                            y = this.vy(o.y + 1);
                        ctx.fillStyle = '#e04080';
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x - 6, y - 16);
                        ctx.lineTo(x + 6, y - 16);
                        ctx.closePath();
                        ctx.fill();
                        ctx.beginPath();
                        ctx.moveTo(x, y - 20);
                        ctx.lineTo(x + (o.flip ? -12 : 12), y - 20);
                        ctx.strokeStyle = '#e04080';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.lineWidth = 1;
                        this.label('→ ' + (o.name || 'entry'), x + 8, y - 24, '#e04080');
                    }
                }
            }
        },
        // the middle of what a link end names, in the view
        refPoint(s, ref) {
            if (ref.object !== undefined) {
                const o = Scene.objects(s).find(o => o.name === ref.object);
                if (!o) return null;
                const r = Scene.bounds(this.sprites, o);
                return [this.vx(r.x + r.width / 2), this.vy(r.y + r.height / 2)];
            }
            const g = s.grids.find(g => g.name === ref.grid);
            const t = g && this.tilesetOf(g);
            if (!t) return null;
            return [this.vx(g.x + (ref.col + 0.5) * t.cellWidth), this.vy(g.y + (ref.row + 0.5) * t.cellHeight)];
        },
        drawLinks(s) {
            const ctx = this.ctx;
            ctx.strokeStyle = '#ff8000';
            ctx.fillStyle = '#ff8000';
            ctx.lineWidth = 2;
            for (const l of s.links) {
                const a = this.refPoint(s, l.from),
                    b = this.refPoint(s, l.to);
                if (!a || !b) continue;
                ctx.beginPath();
                ctx.moveTo(a[0], a[1]);
                ctx.lineTo(b[0], b[1]);
                ctx.stroke();
                const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
                ctx.beginPath();
                ctx.moveTo(b[0], b[1]);
                ctx.lineTo(b[0] - 9 * Math.cos(ang - 0.4), b[1] - 9 * Math.sin(ang - 0.4));
                ctx.lineTo(b[0] - 9 * Math.cos(ang + 0.4), b[1] - 9 * Math.sin(ang + 0.4));
                ctx.fill();
            }
            if (SceneUi.linkFrom && SceneUi.cursor) {
                const a = this.refPoint(s, SceneUi.linkFrom);
                if (a) {
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(a[0], a[1]);
                    ctx.lineTo(this.vx(SceneUi.cursor.x), this.vy(SceneUi.cursor.y));
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
            ctx.lineWidth = 1;
        },
        // the window of the screen at the camera, and the edges of the scene
        drawScreen(s) {
            const c = this.edit.sceneCamera;
            const sc = this.sprites.screen;
            const ctx = this.ctx;
            ctx.strokeStyle = '#ffe000';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.vx(c.x) - 1, this.vy(c.y) - 1, sc.width * this.z + 2, sc.height * this.z + 2);
            ctx.lineWidth = 1;
            this.label('screen ' + sc.width + '×' + sc.height + ' at ' + c.x + ',' + c.y, this.vx(c.x) + 2, this.vy(c.y) - 5, '#806000');
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.strokeRect(this.vx(0) - 0.5, this.vy(0) - 0.5, s.width * this.z + 1, s.height * this.z + 1);
        },
        drawSelection(s) {
            const sel = this.edit.sceneSel;
            if (!sel) return;
            if (sel.kind === 'object') {
                const layer = s.layers.find(l => l.name === sel.layer);
                const o = layer && layer.objects[sel.index];
                if (!o) return;
                const off = o.type === 'zone' || o.type === 'entry' ? {
                    x: 0,
                    y: 0
                } : this.offset(layer);
                const r = Scene.bounds(this.sprites, o);
                this.drawDashed({
                    x: r.x + off.x,
                    y: r.y + off.y,
                    width: r.width,
                    height: r.height
                }, '#ff30ff');
                if (o.type !== 'zone') {
                    // the base point
                    this.ctx.fillStyle = '#ff30ff';
                    this.ctx.fillRect(this.vx(o.x + off.x), this.vy(o.y + off.y), Math.max(2, this.z), Math.max(2, this.z));
                }
            } else if (sel.kind === 'cell' || sel.kind === 'grid') {
                const g = s.grids.find(g => g.name === sel.grid);
                const t = g && this.tilesetOf(g);
                if (!t) return;
                if (sel.kind === 'grid') this.drawDashed({
                    x: g.x,
                    y: g.y,
                    width: g.cols * t.cellWidth,
                    height: g.rows * t.cellHeight
                }, '#ff30ff');
                else this.drawDashed({
                    x: g.x + sel.col * t.cellWidth,
                    y: g.y + sel.row * t.cellHeight,
                    width: t.cellWidth,
                    height: t.cellHeight
                }, '#ff30ff');
            }
        },
        drawCellHover() {
            const c = SceneUi.cell;
            const g = this.scene.grids.find(g => g.name === c.grid);
            const t = g && this.tilesetOf(g);
            if (!t) return;
            this.drawDashed({
                x: g.x + c.col * t.cellWidth,
                y: g.y + c.row * t.cellHeight,
                width: t.cellWidth,
                height: t.cellHeight
            }, '#ffa000');
        },
        drawDashed(r, color, text) {
            const ctx = this.ctx;
            ctx.strokeStyle = 'white';
            ctx.strokeRect(this.vx(r.x) + 0.5, this.vy(r.y) + 0.5, r.width * this.z - 1, r.height * this.z - 1);
            ctx.strokeStyle = color;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(this.vx(r.x) + 0.5, this.vy(r.y) + 0.5, r.width * this.z - 1, r.height * this.z - 1);
            ctx.setLineDash([]);
            if (text) this.label(text, this.vx(r.x) + 3, this.vy(r.y) + 12, color);
        },
        label(text, x, y, color) {
            const ctx = this.ctx;
            ctx.font = '11px sans-serif';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'white';
            ctx.strokeText(text, x, y);
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
            ctx.lineWidth = 1;
        },
        hexRgb(hex) {
            const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
            return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
        },
        normal(r) {
            return {
                x: Math.min(r.x0, r.x1),
                y: Math.min(r.y0, r.y1),
                width: Math.abs(r.x1 - r.x0) + 1,
                height: Math.abs(r.y1 - r.y0) + 1
            };
        },

        // the topmost object of visible, open layers at a point: {layer, index}
        hit(p) {
            const s = this.scene;
            for (let li = s.layers.length - 1; li >= 0; --li) {
                const layer = s.layers[li];
                if (!layer.visible || layer.locked) continue;
                const off = this.offset(layer);
                for (let i = layer.objects.length - 1; i >= 0; --i) {
                    const o = layer.objects[i];
                    if ((o.type === 'zone' || o.type === 'entry')) {
                        if (this.edit.sceneShowZones && Scene.inside(Scene.bounds(this.sprites, o), p.x, p.y)) return {
                            layer: layer,
                            index: i
                        };
                        continue;
                    }
                    // an actor shows a picture of whatever set, so far forward and down, as it is drawn
                    const ap = o.type === 'actor' ? Scene.actorPicture(this.sprites, o) : null;
                    const f = ap ? ap.frame : o.type === 'actor' ? null : Scene.findFrame(this.sprites, o.set, o.image);
                    const setName = ap ? ap.setName : o.set;
                    const [dx, dy] = Scene.shiftOf(o, ap);
                    const ox = o.x + dx,
                        oy = o.y + dy;
                    const loaded = f && FrameImages.get(setName, f.image);
                    const inRect = Scene.inside(Scene.bounds(this.sprites, o), p.x - off.x, p.y - off.y);
                    if (loaded ? Scene.framePixel(setName, f, ox, oy, o.flip, p.x - off.x, p.y - off.y, o.rotation) : inRect) return {
                        layer: layer,
                        index: i
                    };
                }
            }
            return null;
        },
        cellUnder(p) {
            const s = this.scene;
            // the active grid first
            const grids = [...s.grids].sort((a, b) => (b.name === this.edit.sceneGrid) - (a.name === this.edit.sceneGrid));
            for (const g of grids) {
                const t = this.tilesetOf(g);
                if (!t) continue;
                const c = Scene.cellAt(g, t, p.x, p.y);
                if (c) return {
                    grid: g.name,
                    col: c.col,
                    row: c.row
                };
            }
            return null;
        },
        // the layer new objects go on; null with a message when it is locked or there is none
        targetLayer() {
            const layer = this.activeLayer;
            if (!layer) {
                SceneUi.message = T('The scene has no layers: add a layer on the left', 'В сцене нет слоёв: добавьте слой слева');
                return null;
            }
            if (layer.locked) {
                SceneUi.message = T('Layer ' + layer.name + ' is locked: remove the lock on the left', 'Слой ' + layer.name + ' заблокирован: снимите замок слева');
                return null;
            }
            return layer;
        },
        put(o) {
            const layer = this.targetLayer();
            if (!layer) return;
            layer.objects.push(o);
            this.edit.sceneSel = {
                kind: 'object',
                layer: layer.name,
                index: layer.objects.length - 1
            };
            this.$emit('changed');
        },
        paint(p, value) {
            const c = this.cellUnder(p);
            if (!c) return;
            const g = this.scene.grids.find(g => g.name === c.grid);
            if (g.cells[c.row][c.col] !== value) {
                g.cells[c.row][c.col] = value;
                this.drag.painted = true;
            }
            this.edit.sceneGrid = g.name;
        },

        onmousedown(event) {
            if (!this.scene) return;
            this.$refs.canvas.focus();
            SceneUi.message = '';
            const p = this.sceneAt(event);
            const tool = this.edit.sceneTool;
            if (event.button === 1 || tool === 'pan' || (event.button === 0 && event.shiftKey && tool === 'select' && !this.hit(p))) {
                this.drag = {
                    kind: 'pan',
                    sx: event.clientX,
                    sy: event.clientY,
                    px: this.edit.scenePanX,
                    py: this.edit.scenePanY
                };
                event.preventDefault();
                return;
            }
            if (event.button !== 0 && !(event.button === 2 && tool === 'tile')) return;
            switch (tool) {
                case 'select': {
                    const h = this.hit(p);
                    if (h) {
                        const o = h.layer.objects[h.index];
                        this.edit.sceneSel = {
                            kind: 'object',
                            layer: h.layer.name,
                            index: h.index
                        };
                        this.edit.sceneLayer = h.layer.name;
                        this.drag = {
                            kind: 'move',
                            o: o,
                            sx: p.x,
                            sy: p.y,
                            ox: o.x,
                            oy: o.y
                        };
                        return;
                    }
                    const c = this.cellUnder(p);
                    if (c) {
                        this.edit.sceneSel = Object.assign({
                            kind: 'cell'
                        }, c);
                        this.edit.sceneGrid = c.grid;
                        return;
                    }
                    this.edit.sceneSel = {
                        kind: 'scene'
                    };
                    return;
                }
                case 'picture': {
                    const pick = this.edit.scenePick;
                    if (!pick) {
                        SceneUi.message = T('Choose a picture in the palette below', 'Выберите картинку в палитре внизу');
                        return;
                    }
                    this.put({
                        type: 'picture',
                        name: '',
                        set: pick.set,
                        image: pick.image,
                        x: this.snap(p.x),
                        y: this.snap(p.y),
                        key: 0,
                        flip: false,
                        clip: null
                    });
                    return;
                }
                case 'tile': {
                    if (!this.scene.grids.length) {
                        SceneUi.message = T('The scene has no grid: add one on the left (Grids, +)', 'В сцене нет сетки: добавьте её слева («Сетки», +)');
                        return;
                    }
                    if (!this.cellUnder(p)) {
                        SceneUi.message = T('There are no grid cells here', 'Здесь нет клеток сетки');
                        return;
                    }
                    this.drag = {
                        kind: 'paint',
                        value: event.button === 2 ? 0 : this.edit.sceneTile
                    };
                    this.paint(p, this.drag.value);
                    return;
                }
                case 'actor': {
                    const set = this.sprites.sets.find(s => s.name === this.edit.sceneActorSet);
                    if (!set) {
                        SceneUi.message = T('Choose an actor in the palette below (the Actors tab)', 'Выберите персонажа в палитре внизу (вкладка «Персонажи»)');
                        return;
                    }
                    this.put({
                        type: 'actor',
                        name: Scene.freeName(Scene.objects(this.scene), 'actor'),
                        set: set.name,
                        script: set.animation.scripts.length ? set.animation.scripts[0].name : '',
                        x: this.snap(p.x),
                        y: this.snap(p.y),
                        flip: false,
                        params: {}
                    });
                    return;
                }
                case 'entry':
                    this.put({
                        type: 'entry',
                        name: Scene.freeName(Scene.objects(this.scene), 'entry'),
                        x: this.snap(p.x),
                        y: this.snap(p.y),
                        flip: false,
                        arrive: '',
                        fires: null
                    });
                    return;
                case 'zone':
                    this.zoneRect = {
                        x0: this.snap(p.x),
                        y0: this.snap(p.y),
                        x1: this.snap(p.x),
                        y1: this.snap(p.y)
                    };
                    this.drag = {
                        kind: 'zone'
                    };
                    return;
                case 'camera':
                    this.drag = {
                        kind: 'camera',
                        sx: p.x,
                        sy: p.y,
                        cx: this.edit.sceneCamera.x,
                        cy: this.edit.sceneCamera.y
                    };
                    return;
                case 'link': {
                    const h = this.hit(p);
                    let ref = null;
                    if (h && h.layer.objects[h.index].name) ref = {
                        object: h.layer.objects[h.index].name
                    };
                    else if (h) {
                        SceneUi.message = T('The object has no name: give it a name on the right, then a link can be drawn to it', 'У объекта нет имени: дайте ему имя справа, тогда к нему можно провести связь');
                        return;
                    } else {
                        const c = this.cellUnder(p);
                        if (c) ref = c;
                    }
                    if (!ref) {
                        SceneUi.message = T('A link is drawn from an object with a name or from a grid cell', 'Связь проводят от объекта с именем или от клетки сетки');
                        return;
                    }
                    if (!SceneUi.linkFrom) {
                        SceneUi.linkFrom = ref;
                        return;
                    }
                    this.scene.links.push({
                        from: SceneUi.linkFrom,
                        to: ref,
                        event: '',
                        value: null
                    });
                    this.edit.sceneSel = {
                        kind: 'link',
                        index: this.scene.links.length - 1
                    };
                    SceneUi.linkFrom = null;
                    this.$emit('changed');
                    return;
                }
            }
        },
        onmousemove(event) {
            if (!this.scene) return;
            const p = this.sceneAt(event);
            if (!SceneUi.cursor || SceneUi.cursor.x !== p.x || SceneUi.cursor.y !== p.y) {
                SceneUi.cursor = p;
                SceneUi.cell = this.cellUnder(p);
            }
            const d = this.drag;
            if (!d) return;
            if (d.kind === 'pan') {
                this.edit.scenePanX = d.px - (event.clientX - d.sx) / this.z;
                this.edit.scenePanY = d.py - (event.clientY - d.sy) / this.z;
            } else if (d.kind === 'move') {
                const nx = this.snap(d.ox + p.x - d.sx),
                    ny = this.snap(d.oy + p.y - d.sy);
                if (nx !== d.o.x || ny !== d.o.y) {
                    d.o.x = nx;
                    d.o.y = ny;
                    d.moved = true;
                }
            } else if (d.kind === 'paint') {
                this.paint(p, d.value);
            } else if (d.kind === 'zone') {
                this.zoneRect.x1 = this.snap(p.x);
                this.zoneRect.y1 = this.snap(p.y);
            } else if (d.kind === 'camera') {
                this.edit.sceneCamera = {
                    x: this.snap(d.cx + p.x - d.sx),
                    y: this.snap(d.cy + p.y - d.sy)
                };
            }
        },
        onmouseleave() {
            SceneUi.cursor = null;
            SceneUi.cell = null;
        },
        onmouseup() {
            const d = this.drag;
            this.drag = null;
            if (!d) return;
            if (d.kind === 'zone' && this.zoneRect) {
                const r = this.normal(this.zoneRect);
                this.zoneRect = null;
                if (r.width > 1 || r.height > 1) this.put({
                    type: 'zone',
                    name: Scene.freeName(Scene.objects(this.scene), 'zone'),
                    kind: '',
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height
                });
            }
            if (d.moved || d.painted) this.$emit('changed');
        },
        // the wheel zooms around the point under the mouse
        onwheel(event) {
            event.preventDefault();
            const r = this.$refs.canvas.getBoundingClientRect();
            const mx = event.clientX - r.left,
                my = event.clientY - r.top;
            const sx = mx / this.z + this.edit.scenePanX,
                sy = my / this.z + this.edit.scenePanY;
            const z = Math.min(32, Math.max(0.25, this.z * (event.deltaY < 0 ? 1.25 : 0.8)));
            this.edit.sceneZoom = z;
            this.edit.scenePanX = sx - mx / z;
            this.edit.scenePanY = sy - my / z;
        },
    },
    template: `
        <div class="scene-canvas-box">
            <canvas ref="canvas" class="scene-canvas" tabindex="0" :class="'tool-' + edit.sceneTool"
                @mousedown="onmousedown" @mousemove="onmousemove" @mouseleave="onmouseleave" @wheel="onwheel" @contextmenu.prevent></canvas>
        </div>
    `
};
