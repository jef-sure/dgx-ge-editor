// The panels of the page of scenes: the properties of what is selected, the palette of pictures, tiles and actors,
// the map of scenes and their exits

// a tile drawn as it stands in its cell: the cell faint, the pieces over it
const TileThumb = {
    props: ['tile', 'tileset', 'size'],
    mounted() {
        this.draw();
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        key() {
            return JSON.stringify([this.tile, this.tileset.cellWidth, this.tileset.cellHeight, this.spritesStore.imagesVersion]);
        },
    },
    watch: {
        key() {
            this.draw();
        },
    },
    methods: {
        draw() {
            const canvas = this.$refs.canvas;
            const t = this.tileset;
            const sprites = this.spritesStore.sprites;
            const base = {
                x: 0,
                y: t.cellHeight - 1
            };
            let box = {
                x0: 0,
                y0: 0,
                x1: t.cellWidth,
                y1: t.cellHeight
            };
            const env = Scene.cellEnv({}, t, 0, 0);
            const pieces = this.tile.pieces.filter(p => Scene.pieceRef(p, env, 0)).map(p => {
                const ref = Scene.pieceRef(p, env, 0);
                const dx = Scene.pieceOffset(p.dx, env),
                    dy = Scene.pieceOffset(p.dy, env);
                const size = p.size || [1, 1];
                const f = ref.fill ? null : Scene.findFrame(sprites, ref.set, ref.image);
                const r = ref.fill ? {
                    x: base.x + dx,
                    y: base.y + dy - size[1] + 1,
                    width: size[0],
                    height: size[1]
                } : Scene.frameRect(f, base.x + dx, base.y + dy, false);
                box.x0 = Math.min(box.x0, r.x);
                box.y0 = Math.min(box.y0, r.y);
                box.x1 = Math.max(box.x1, r.x + r.width);
                box.y1 = Math.max(box.y1, r.y + r.height);
                return {
                    p: p,
                    f: f,
                    set: ref.set,
                    dx: dx,
                    dy: dy,
                    rect: r
                };
            });
            const w = box.x1 - box.x0,
                h = box.y1 - box.y0;
            const z = Math.max(1, Math.floor((this.size || 48) / Math.max(w, h)));
            canvas.width = w * z;
            canvas.height = h * z;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.strokeRect(-box.x0 * z + 0.5, -box.y0 * z + 0.5, t.cellWidth * z - 1, t.cellHeight * z - 1);
            // a piece that depends on its neighbours or the variant of the cell is drawn faint
            for (const it of pieces) {
                ctx.globalAlpha = it.p.around || it.p.variant !== undefined ? 0.45 : 1;
                const rgb = it.p.draw ? Scene.pieceColor(sprites, it.p, [0, 0, 0], env) : null;
                if (it.p.draw === 'fill') {
                    ctx.fillStyle = 'rgb(' + rgb.join(',') + ')';
                    ctx.fillRect((it.rect.x - box.x0) * z, (it.rect.y - box.y0) * z, it.rect.width * z, it.rect.height * z);
                } else Scene.drawFrameAs(ctx, it.set, it.f, (base.x + it.dx - box.x0) * z, (base.y + it.dy - box.y0) * z, false, z, it.p.draw, rgb);
            }
            ctx.globalAlpha = 1;
            // its bodies, as in a cell of mod 0 and variant 0; one that holds some masks only is dashed
            ctx.strokeStyle = 'rgba(255, 40, 40, 0.9)';
            for (const b of Scene.bodyRects(this.tile, base, env)) {
                ctx.setLineDash(b.for ? [4, 3] : []);
                ctx.strokeRect((b.x - box.x0) * z + 0.5, (b.y - box.y0) * z + 0.5, b.width * z - 1, b.height * z - 1);
            }
            // its opening, blue
            const o = Scene.openingRect(this.tile, base, env);
            if (o) {
                ctx.strokeStyle = 'rgba(60, 140, 255, 0.95)';
                ctx.setLineDash([2, 2]);
                ctx.strokeRect((o.x - box.x0) * z + 0.5, (o.y - box.y0) * z + 0.5, o.width * z - 1, o.height * z - 1);
            }
            ctx.setLineDash([]);
        },
    },
    template: `<canvas ref="canvas" class="tile-thumb"></canvas>`
};

const SceneProps = {
    data() {
        return {
            message: '',
        };
    },
    computed: {
        // the hint of the for field of a body, with the masks of the file
        masksTitle() {
            return T('Masks the body holds (for): numbers 0..15 or names of the masks of the file, separated by spaces or commas; empty — every mask. The engine, asking the grid with a mask, sees only the bodies that hold it: bodies by the rules of the game for people next to bodies as drawn for things. Masks of the file: ',
                    'Маски, которые тело держит (for): номера 0..15 или имена масок файла через пробел или запятую; пусто — все маски. Движок, спрашивая сетку маской, видит только тела, которые её держат: тела по правилам игры для людей рядом с телами как нарисовано для вещей. Маски файла: ') +
                (this.sprites.masks.map(m => m.index + (m.name ? ' ' + m.name : '')).join(', ') || T('none', 'нет'));
        },
        ...Pinia.mapStores(useSpriteStore),
        Scene() {
            return Scene;
        },
        Anim() {
            return Anim;
        },
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        scene() {
            return this.sprites.scenes[this.edit.sceneIndex];
        },
        sel() {
            return this.edit.sceneSel || (this.scene ? {
                kind: 'scene'
            } : null);
        },
        layer() {
            const s = this.sel;
            return s && s.layer && this.scene ? this.scene.layers.find(l => l.name === s.layer) || null : null;
        },
        object() {
            return this.sel && this.sel.kind === 'object' && this.layer ? this.layer.objects[this.sel.index] || null : null;
        },
        grid() {
            const s = this.sel;
            return s && s.grid && this.scene ? this.scene.grids.find(g => g.name === s.grid) || null : null;
        },
        tileset() {
            if (this.sel && this.sel.tileset) return this.sprites.tilesets.find(t => t.name === this.sel.tileset) || null;
            if (this.grid) return this.sprites.tilesets.find(t => t.name === this.grid.tileset) || null;
            return null;
        },
        tile() {
            return this.sel && this.sel.kind === 'tile' && this.tileset ? this.tileset.tiles[this.sel.tile] || null : null;
        },
        exit() {
            return this.sel && this.sel.kind === 'exit' && this.scene ? this.scene.exits[this.sel.index] || null : null;
        },
        link() {
            return this.sel && this.sel.kind === 'link' && this.scene ? this.scene.links[this.sel.index] || null : null;
        },
        setNames() {
            return this.sprites.sets.map(s => s.name);
        },
        animatedSets() {
            return this.sprites.sets.filter(s => s.animation.scripts.length);
        },
        Maps() {
            return Maps;
        },
        events() {
            return Game.events(this.sprites);
        },
        // what an entry may fire: the sources of links in the scenes of the map
        linkSources() {
            return this.scene && this.scene.map ? Maps.sourcesOf(this.sprites, this.scene.map) : [];
        },
        layerNames() {
            let names = new Set();
            for (const s of this.sprites.scenes)
                for (const l of s.layers) names.add(l.name);
            return [...names];
        },
        zones() {
            return this.scene ? Scene.objects(this.scene).filter(o => o.type === 'zone') : [];
        },
        cellValue: {
            get() {
                return this.grid ? this.grid.cells[this.sel.row][this.sel.col] : 0;
            },
            set(v) {
                this.grid.cells[this.sel.row][this.sel.col] = v;
            },
        },
        cellMod() {
            return this.grid ? this.grid.mods[this.sel.col + ',' + this.sel.row] : undefined;
        },
        cellVariant() {
            return this.grid && this.grid.variants ? this.grid.variants[this.sel.col + ',' + this.sel.row] : undefined;
        },
        // the names expressions of pieces may use here
        exprNames() {
            return Scene.exprNames(this.tileset);
        },
        // the fields of the selected cell, worked out
        cellFields() {
            if (!this.grid || !this.tileset) return [];
            const env = Scene.cellEnv(this.grid, this.tileset, this.sel.col, this.sel.row);
            return Object.keys(this.tileset.fields || {}).map(n => n + ' = ' + env[n]);
        },
        // what a neighbour may be: words, tiles of the tileset, and not before them
        aroundWords() {
            const words = [...Scene.aroundWords, ...(this.tileset ? this.tileset.tiles.map(t => t.name) : [])];
            return [...words, ...words.map(w => 'not ' + w)];
        },
    },
    methods: {
        setLinkValue(event) {
            const text = event.target.value.trim();
            if (!text) {
                this.link.value = null;
                return;
            }
            const v = parseInt(text, 10);
            if (Number.isInteger(v) && v >= -32767 && v <= 32767) this.link.value = v;
            else event.target.value = this.link.value ?? '';
        },
        framesOf(setName) {
            const set = this.sprites.sets.find(s => s.name === setName);
            return set ? set.frames.map(f => f.image) : [];
        },
        scriptsOf(setName) {
            const set = this.sprites.sets.find(s => s.name === setName);
            return set ? set.animation.scripts.map(s => s.name) : [];
        },
        paramsOf(setName) {
            const set = this.sprites.sets.find(s => s.name === setName);
            return set ? set.animation.params : [];
        },
        entriesOf(sceneName) {
            const s = this.sprites.scenes.find(s => s.name === sceneName);
            return s ? Scene.objects(s).filter(o => o.type === 'entry').map(o => o.name) : [];
        },
        int(event, low, high) {
            const v = parseInt(event.target.value);
            if (!Number.isInteger(v) || v < low || v > high) {
                this.message = event.target.value + T(' — needs a whole number from ' + low + ' to ' + high, ' — нужно целое число от ' + low + ' до ' + high);
                return null;
            }
            this.message = '';
            return v;
        },
        setInt(obj, key, event, low, high) {
            const v = this.int(event, low, high);
            if (v === null) event.target.value = obj[key];
            else obj[key] = v;
        },
        // the fade of the scene's music, ms; empty: 500, the packer's own, not written
        setFade(event) {
            if (!event.target.value.trim()) {
                delete this.scene.musicFade;
                return;
            }
            this.setInt(this.scene, 'musicFade', event, 0, 65535);
        },
        renameScene(event) {
            const name = event.target.value.trim();
            if (!name || this.sprites.scenes.some(s => s.name === name)) {
                event.target.value = this.scene.name;
                if (name !== this.scene.name) this.message = T('The name is empty or taken', 'Имя пустое или занято');
                return;
            }
            Scene.renameScene(this.sprites, this.scene.name, name);
        },
        removeScene() {
            if (!confirm(T('Delete scene ' + this.scene.name + '?', 'Удалить сцену ' + this.scene.name + '?'))) return;
            this.sprites.scenes.splice(this.edit.sceneIndex, 1);
            this.edit.sceneIndex = Math.max(0, this.edit.sceneIndex - 1);
            this.edit.sceneSel = null;
        },
        sceneToScreen() {
            this.scene.width = this.sprites.screen.width;
            this.scene.height = this.sprites.screen.height;
        },
        renameLayer(event) {
            const name = event.target.value.trim();
            if (!name || this.scene.layers.some(l => l.name === name)) {
                event.target.value = this.layer.name;
                return;
            }
            const old = this.layer.name;
            Scene.renameLayer(this.sprites, this.scene, old, name);
            this.edit.sceneSel = {
                kind: 'layer',
                layer: name
            };
            if (this.edit.sceneLayer === old) this.edit.sceneLayer = name;
        },
        removeLayer() {
            if (this.layer.objects.length && !confirm(T('Delete layer ' + this.layer.name + ' and the ' + this.layer.objects.length + ' objects on it?', 'Удалить слой ' + this.layer.name + ' и ' + this.layer.objects.length + ' объектов на нём?'))) return;
            this.scene.layers.splice(this.scene.layers.indexOf(this.layer), 1);
            this.edit.sceneSel = null;
        },
        renameObject(event) {
            const name = event.target.value.trim();
            const o = this.object;
            if (name && Scene.objects(this.scene).some(x => x !== o && Scene.constName(x.name) === Scene.constName(name))) {
                this.message = T('The scene already has this name (' + Scene.constName(name) + ')', 'Такое имя (' + Scene.constName(name) + ') в сцене уже есть');
                event.target.value = o.name;
                return;
            }
            Scene.renameObject(this.sprites, this.scene, o, name);
        },
        moveToLayer(event) {
            const to = this.scene.layers.find(l => l.name === event.target.value);
            if (!to || to === this.layer) return;
            const o = this.object;
            this.layer.objects.splice(this.sel.index, 1);
            to.objects.push(o);
            this.edit.sceneSel = {
                kind: 'object',
                layer: to.name,
                index: to.objects.length - 1
            };
        },
        removeObject() {
            this.layer.objects.splice(this.sel.index, 1);
            this.edit.sceneSel = null;
        },
        setPictureSet(event) {
            this.object.set = event.target.value;
            this.object.image = this.framesOf(this.object.set)[0] || '';
        },
        setActorSet(event) {
            this.object.set = event.target.value;
            this.object.script = this.scriptsOf(this.object.set)[0] || '';
            this.object.params = {};
        },
        toggleClip(event) {
            if (event.target.checked) {
                const r = Scene.bounds(this.sprites, this.object);
                this.object.clip = {
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height
                };
            } else this.object.clip = null;
        },
        setParam(name, event) {
            const t = event.target.value.trim();
            if (!t) {
                delete this.object.params[name];
                return;
            }
            const v = this.int(event, -32768, 32767);
            if (v === null) event.target.value = this.object.params[name] ?? '';
            else this.object.params[name] = v;
        },
        renameGrid(event) {
            const name = event.target.value.trim();
            if (!name || this.scene.grids.some(g => g.name === name)) {
                event.target.value = this.grid.name;
                return;
            }
            const old = this.grid.name;
            Scene.renameGrid(this.sprites, this.scene, old, name);
            this.edit.sceneSel = Object.assign({}, this.sel, {
                grid: name
            });
            if (this.edit.sceneGrid === old) this.edit.sceneGrid = name;
        },
        resize(key, event) {
            const v = this.int(event, 1, 1000);
            if (v === null) {
                event.target.value = this.grid[key];
                return;
            }
            Scene.resizeGrid(this.grid, key === 'cols' ? v : this.grid.cols, key === 'rows' ? v : this.grid.rows);
        },
        removeGrid() {
            if (!confirm(T('Delete grid ' + this.grid.name + '?', 'Удалить сетку ' + this.grid.name + '?'))) return;
            this.scene.grids.splice(this.scene.grids.indexOf(this.grid), 1);
            this.edit.sceneSel = null;
        },
        setMod(event) {
            const k = this.sel.col + ',' + this.sel.row;
            const t = event.target.value.trim();
            if (!t) {
                delete this.grid.mods[k];
                return;
            }
            const v = this.int(event, -32768, 32767);
            if (v === null) event.target.value = this.grid.mods[k] ?? '';
            else this.grid.mods[k] = v;
        },
        renameTileset(event) {
            const name = event.target.value.trim();
            if (!name || this.sprites.tilesets.some(t => t.name === name)) {
                event.target.value = this.tileset.name;
                return;
            }
            const old = this.tileset.name;
            Scene.renameTileset(this.sprites, old, name);
            if (this.edit.sceneTileset === old) this.edit.sceneTileset = name;
            this.edit.sceneSel = Object.assign({}, this.sel, {
                tileset: name
            });
        },
        removeTileset() {
            const used = this.sprites.scenes.some(s => s.grids.some(g => g.tileset === this.tileset.name));
            if (!confirm(T('Delete tileset ' + this.tileset.name + '?' + (used ? ' The grids that use it will become errors.' : ''),
                    'Удалить набор плиток ' + this.tileset.name + '?' + (used ? ' Сетки, которые его используют, станут ошибками.' : '')))) return;
            this.sprites.tilesets.splice(this.sprites.tilesets.indexOf(this.tileset), 1);
            this.edit.sceneSel = null;
        },
        addField() {
            const fields = this.tileset.fields || (this.tileset.fields = {});
            let n = 1;
            while (('field' + n) in fields) ++n;
            fields['field' + n] = ['variant', 0, 1];
        },
        // a field renamed keeps its place in the list; an empty name removes it
        renameField(old, event) {
            const name = event.target.value.trim();
            const fields = this.tileset.fields;
            if (name === old) return;
            if (name && (!Anim.isIdent(name) || name in fields || name === 'mod' || name === 'variant' || Anim.reserved(name))) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или оно занято");
                event.target.value = old;
                return;
            }
            let renamed = {};
            for (const k in fields) {
                if (k !== old) renamed[k] = fields[k];
                else if (name) renamed[name] = fields[k];
            }
            this.tileset.fields = renamed;
        },
        setField(n, k, v) {
            const f = [...this.tileset.fields[n]];
            f[k] = v;
            const bits = f[0] === 'mod' ? 8 : 32;
            if (!(Number.isInteger(f[1]) && Number.isInteger(f[2]) && f[1] >= 0 && f[2] >= 1 && f[1] + f[2] <= bits)) {
                this.message = T(n + ': bits ' + f[1] + '..' + (f[1] + f[2] - 1) + ' are not in the ' + bits + ' bits of ' + f[0],
                    n + ': биты ' + f[1] + '..' + (f[1] + f[2] - 1) + ' не входят в ' + bits + ' бит ' + f[0]);
                this.tileset.fields = Object.assign({}, this.tileset.fields);
                return;
            }
            this.message = '';
            this.tileset.fields[n] = f;
        },
        // its own closes start as the solid sides; as solid again drops the field
        toggleCloses(event) {
            if (event.target.checked) delete this.tile.closes;
            else this.tile.closes = Object.assign({}, this.tile.solid);
        },
        addBody() {
            if (!this.tile.bodies) this.tile.bodies = [];
            this.tile.bodies.push({
                dx: 0,
                dy: 0,
                w: this.tileset.cellWidth,
                h: this.tileset.cellHeight
            });
        },
        removeBody(k) {
            this.tile.bodies.splice(k, 1);
            if (!this.tile.bodies.length) delete this.tile.bodies;
        },
        // the opening: the whole cell to begin with
        addOpening() {
            this.tile.opening = {
                dx: 0,
                dy: 0,
                w: this.tileset.cellWidth,
                h: this.tileset.cellHeight
            };
        },
        // the masks a body holds: numbers 0..15 or names of the masks of the file, separated by spaces or commas; empty:
        // every mask
        setFor(b, event) {
            const text = event.target.value.trim();
            if (!text) {
                delete b.for;
                this.message = '';
                return;
            }
            let masks = [];
            for (const word of text.split(/[\s,]+/).filter(w => w)) {
                let m = /^\d+$/.test(word) ? parseInt(word, 10) : (this.sprites.masks.find(x => x.name === word) || {}).index;
                if (m === undefined || m < 0 || m > 15) {
                    this.message = T('for: ' + word + ' is no mask of the file and no number 0..15', 'for: ' + word + ' — не маска файла и не число 0..15');
                    return;
                }
                if (!masks.includes(m)) masks.push(m);
            }
            b.for = masks;
            this.message = '';
        },
        // the masks a body holds as text: the numbers, each with its name in the file
        forText(b) {
            return (b.for || []).map(m => {
                const mask = this.sprites.masks.find(x => x.index === m);
                return mask && mask.name ? m + ' ' + mask.name : String(m);
            }).join(', ');
        },
        addTile() {
            const t = Scene.newTile(Scene.freeName(this.tileset.tiles, 'tile'));
            const pick = this.edit.scenePick;
            if (pick) t.pieces.push({
                layer: this.edit.sceneLayer || 'back',
                key: 0,
                dx: 0,
                dy: 0,
                set: pick.set,
                image: pick.image
            });
            this.tileset.tiles.push(t);
            this.selectTile(this.tileset.tiles.length - 1);
        },
        selectTile(i) {
            this.edit.sceneTileset = this.tileset.name;
            this.edit.sceneTile = i + 1;
            this.edit.sceneSel = {
                kind: 'tile',
                tileset: this.tileset.name,
                tile: i
            };
        },
        removeTile() {
            const i = this.sel.tile;
            if (!confirm(T('Delete tile ' + this.tile.name + '? The cells with it will be empty, the numbers of the tiles after it go down.',
                    'Удалить плитку ' + this.tile.name + '? Клетки с ней опустеют, номера следующих плиток уменьшатся.'))) return;
            this.tileset.tiles.splice(i, 1);
            // the cells keep their tiles: numbers after it go down
            for (const s of this.sprites.scenes) {
                for (const g of s.grids) {
                    if (g.tileset !== this.tileset.name) continue;
                    for (const row of g.cells)
                        for (let c = 0; c < row.length; ++c) {
                            if (row[c] === i + 1) row[c] = 0;
                            else if (row[c] > i + 1) row[c]--;
                        }
                }
            }
            // the tile the Tile tool paints follows the numbers, and stays a tile of the set
            if (this.edit.sceneTileset === this.tileset.name) {
                if (this.edit.sceneTile > i + 1) this.edit.sceneTile--;
                this.edit.sceneTile = Math.max(1, Math.min(this.edit.sceneTile, this.tileset.tiles.length));
            }
            this.edit.sceneSel = {
                kind: 'tileset',
                tileset: this.tileset.name
            };
        },
        addPiece() {
            const pick = this.edit.scenePick;
            const set = pick ? pick.set : this.setNames[0];
            this.tile.pieces.push({
                layer: this.edit.sceneLayer || this.layerNames[0] || 'back',
                key: 0,
                dx: 0,
                dy: 0,
                set: set,
                image: pick ? pick.image : this.framesOf(set)[0] || ''
            });
        },
        setPieceSet(p, event) {
            p.set = event.target.value;
            p.image = this.framesOf(p.set)[0] || '';
        },
        // a picture of by mod or of a cycle: another set, or none for this mod
        setRefSet(p, j, event) {
            const list = this.listOf(p);
            const v = event.target.value;
            if (!v) {
                list.splice(j, 1, null);
                return;
            }
            const r = {
                set: v,
                image: this.framesOf(v)[0] || ''
            };
            if (p.cycle) r.ms = list[j] && list[j].ms || 100;
            list.splice(j, 1, r);
        },
        setPieceWith(p, event) {
            if (event.target.value === 'self') delete p.with;
            else p.with = event.target.value;
        },
        setPieceDraw(p, event) {
            if (event.target.value === 'normal') {
                delete p.draw;
                delete p.color;
            } else p.draw = event.target.value;
        },
        setPieceNumber(p, key, event, low, high) {
            const v = this.int(event, low, high);
            if (v === null) event.target.value = p[key] || 0;
            else if (v) p[key] = v;
            else delete p[key];
        },
        // a color: n of the palette of the piece's own set, or [set, n] of another
        // a color: n of the set, or an expression of the cell
        setPieceColor(p, event) {
            const text = event.target.value.trim();
            let v;
            if (/^\d+$/.test(text)) {
                v = parseInt(text, 10);
                if (v > 255) {
                    this.message = text + T(' — a color from 0 to 255', ' — цвет от 0 до 255');
                    event.target.value = Array.isArray(p.color) ? p.color[1] : (p.color ?? 0);
                    return;
                }
            } else {
                const e = text ? Scene.offsetProblem(text, this.exprNames) : 'empty';
                if (e) {
                    this.message = text + ': ' + e;
                    event.target.value = Array.isArray(p.color) ? p.color[1] : (p.color ?? 0);
                    return;
                }
                v = text;
            }
            this.message = '';
            p.color = Array.isArray(p.color) ? [p.color[0], v] : v;
        },
        setPieceColorSet(p, event) {
            const n = Array.isArray(p.color) ? p.color[1] : (p.color || 0);
            p.color = event.target.value ? [event.target.value, n] : n;
        },
        pieceMode(p) {
            return p.draw === 'fill' ? 'fill' : p.by_mod ? 'by_mod' : p.pictures ? 'pick' : p.cycle ? 'cycle' : 'image';
        },
        listOf(p) {
            return p.by_mod || p.pictures || p.cycle || [];
        },
        setSize(p, k, event) {
            const v = this.int(event, 1, 32767);
            if (v === null) {
                event.target.value = (p.size || [1, 1])[k];
                return;
            }
            const size = [...(p.size || [1, 1])];
            size[k] = v;
            p.size = size;
        },
        // one picture, pictures by mod or in turn: the pictures it had go along
        setPieceMode(p, event) {
            const mode = event.target.value;
            const refs = Scene.pieceRefs(p);
            const first = refs[0] || {
                set: this.setNames[0],
                image: this.framesOf(this.setNames[0])[0] || ''
            };
            delete p.set;
            delete p.image;
            delete p.by_mod;
            delete p.pick;
            delete p.pictures;
            delete p.cycle;
            delete p.size;
            if (p.draw === 'fill') {
                delete p.draw;
                delete p.color;
            }
            if (mode === 'fill') {
                p.draw = 'fill';
                p.size = [this.tileset.cellWidth, this.tileset.cellHeight];
                p.color = 1;
            } else if (mode === 'pick') {
                p.pick = 'variant';
                p.pictures = (refs.length ? refs : [first]).map(r => ({
                    set: r.set,
                    image: r.image
                }));
            } else if (mode === 'image') {
                p.set = first.set;
                p.image = first.image;
            } else if (mode === 'by_mod') p.by_mod = (refs.length ? refs : [first]).map(r => ({
                set: r.set,
                image: r.image
            }));
            else p.cycle = (refs.length ? refs : [first]).map(r => ({
                set: r.set,
                image: r.image,
                ms: r.ms || 100
            }));
        },
        addRef(p) {
            const list = this.listOf(p);
            const pick = this.edit.scenePick;
            const last = [...list].reverse().find(r => r) || {
                set: this.setNames[0],
                image: this.framesOf(this.setNames[0])[0] || ''
            };
            let r = pick ? {
                set: pick.set,
                image: pick.image
            } : {
                set: last.set,
                image: last.image
            };
            if (p.cycle) r.ms = last.ms || 100;
            list.push(r);
        },
        // dx, dy: a number, or an expression of mod
        setOffset(p, key, event) {
            const text = event.target.value.trim();
            if (/^-?\d+$/.test(text)) {
                p[key] = parseInt(text, 10);
                this.message = '';
                return;
            }
            const e = text ? Scene.offsetProblem(text, this.exprNames) : 'empty';
            if (e) {
                this.message = text + ': ' + e + T(' — needs a number or an expression of ', ' — нужно число или выражение из ') + this.exprNames.join(', ');
                event.target.value = p[key];
                return;
            }
            p[key] = text;
            this.message = '';
        },
        setWhen(p, event) {
            const text = event.target.value.trim();
            if (!text) {
                delete p.when;
                return;
            }
            const e = Scene.offsetProblem(/^-?\d+$/.test(text) ? parseInt(text, 10) : text, this.exprNames);
            if (e) {
                this.message = text + ': ' + e;
                event.target.value = p.when ?? '';
                return;
            }
            this.message = '';
            p.when = /^-?\d+$/.test(text) ? parseInt(text, 10) : text;
        },
        setVariant(p, event) {
            const text = event.target.value.trim();
            if (!text) {
                delete p.variant;
                return;
            }
            const v = this.int(event, 0, 4294967295);
            if (v === null) event.target.value = p.variant ?? '';
            else p.variant = v;
        },
        aroundValue(p, side) {
            return p.around && p.around[side] !== undefined ? Scene.aroundText(p.around[side]) : '';
        },
        setAround(p, side, event) {
            const what = Scene.aroundRead(event.target.value);
            if (what === null) {
                if (p.around) {
                    delete p.around[side];
                    if (!Object.keys(p.around).length) delete p.around;
                }
                return;
            }
            const e = Scene.aroundProblem(what, this.tileset);
            if (e) {
                this.message = side + ': ' + e;
                event.target.value = this.aroundValue(p, side);
                return;
            }
            if (!p.around) p.around = {};
            p.around[side] = what;
            this.message = '';
        },
        setCellVariant(event) {
            const k = this.sel.col + ',' + this.sel.row;
            if (!this.grid.variants) this.grid.variants = {};
            const t = event.target.value.trim();
            if (!t) {
                delete this.grid.variants[k];
                return;
            }
            const v = this.int(event, 0, 4294967295);
            if (v === null) event.target.value = this.grid.variants[k] ?? '';
            else this.grid.variants[k] = v;
        },
        setExitTarget(event) {
            this.exit.scene = event.target.value;
            this.exit.entry = this.entriesOf(this.exit.scene)[0] || '';
        },
        removeExit() {
            this.scene.exits.splice(this.sel.index, 1);
            this.edit.sceneSel = null;
        },
        removeLink() {
            this.scene.links.splice(this.sel.index, 1);
            this.edit.sceneSel = null;
        },
    },
    template: `
        <div class="scene-props-body">
            <div v-if="message" class="error-text">{{message}} <button @click="message = ''">x</button></div>
            <div v-if="!sel" class="help-text">{{T('Nothing is selected. Make a scene (in the tree Scenes, «+») or select a tileset in Tilesets — it can be edited without a scene too.', 'Ничего не выбрано. Создайте сцену (в дереве «Сцены», «+») или выберите набор плиток в «Наборах плиток» — его можно править и без сцены.')}}</div>

            <template v-else-if="sel.kind === 'scene' && scene">
                <h6 :title="T('A scene: a level or a room', 'Сцена — уровень или комната')">{{T('Scene', 'Сцена')}}</h6>
                <label class="prop">{{T('name', 'имя')}} <input :value="scene.name" @change="renameScene" :title="T('The name of the scene; in the game, a constant', 'Имя сцены; в игре — константа')"></label>
                <label class="prop">{{T('width', 'ширина')}} <input class="num" :value="scene.width" @change="setInt(scene, 'width', $event, 1, 32767)" :title="T('The width of the scene, pixels; wider than the screen — the scene scrolls', 'Ширина сцены, пикселей; больше экрана — сцена прокручивается')"></label>
                <label class="prop">{{T('height', 'высота')}} <input class="num" :value="scene.height" @change="setInt(scene, 'height', $event, 1, 32767)" :title="T('The height of the scene, pixels', 'Высота сцены, пикселей')"></label>
                <button class="btn btn-sm btn-outline-secondary" @click="sceneToScreen" :title="T('The scene as big as the screen: a room', 'Сцена размером с экран: комната')">= {{T('screen', 'экран')}}</button>
                <label class="prop">{{T('background', 'фон')}} <input type="color" v-model="scene.background" :title="T('The background color of the scene (in the editor; in the game, the paper of the frame)', 'Цвет фона сцены (в редакторе; в игре — бумага кадра)')"></label>
                <label class="prop" :title="T('The music the game plays as it enters the scene (Game → Music); stop — silence; none — what plays goes on', 'Музыка, которую игра включает, когда входит в сцену (Игра → Музыка); stop — тишина; нет — что играет, то и играет')">{{T('music', 'музыка')}}
                    <select :value="scene.music === undefined ? '' : scene.music" @change="$event.target.value ? scene.music = $event.target.value : delete scene.music">
                        <option value="">— {{T('goes on', 'как было')}}</option><option value="stop">stop</option>
                        <option v-for="m in (sprites.music || []).concat(scene.music && scene.music !== 'stop' && !(sprites.music || []).includes(scene.music) ? [scene.music] : [])" :value="m">{{m}}</option></select></label>
                <label v-if="scene.music !== undefined" class="prop" :title="T('How long the music before fades out and this one comes in, ms (musicFade); empty — 500', 'За сколько мс прежняя музыка затихает и входит эта (musicFade); пусто — 500')">{{T('fade', 'переход')}}
                    <input class="num" :value="scene.musicFade === undefined ? '' : scene.musicFade" placeholder="500" @change="setFade($event)"> ms</label>
                <h6 :title="T('The screen size of the device: one for all scenes', 'Размер экрана устройства: общий для всех сцен')">{{T('Screen', 'Экран')}}</h6>
                <label class="prop">{{T('width', 'ширина')}} <input class="num" :value="sprites.screen.width" @change="setInt(sprites.screen, 'width', $event, 1, 4096)"></label>
                <label class="prop">{{T('height', 'высота')}} <input class="num" :value="sprites.screen.height" @change="setInt(sprites.screen, 'height', $event, 1, 4096)"></label>
                <div class="help-text">{{scene.layers.length}} {{T('layers', 'слоёв')}}, {{scene.grids.length}} {{T('grids', 'сеток')}}, {{scene.exits.length}} {{T('exits', 'выходов')}}, {{scene.links.length}} {{T('links', 'связей')}}</div>
                <h6 :title="T('The place of the scene in the graph of scenes (the Maps node): map, number in the map, kind, event to the rules of the map on entering', 'Место сцены в графе сцен (узел «Карты»): карта, номер в карте, вид, событие правилам карты при входе')">{{T('Graph', 'Граф')}}</h6>
                <label class="prop" :title="T('A map: a cloud of scenes with common data (a level, a show); a scene outside a map is unknown to the graph', 'Карта — облако сцен с общими данными (уровень, показ); сцена вне карты графу не известна')">map
                    <select v-model="scene.map"><option value="">— {{T('none', 'нет')}}</option><option v-for="m in sprites.maps" :value="m.name">{{m.name}}</option></select></label>
                <label class="prop" :title="T('The number of the scene in the map, 0…255 (a room of the level): a constant of the game', 'Номер сцены в карте, 0…255 (комната уровня): константа игры')">index <input class="num" :value="scene.index" @change="setInt(scene, 'index', $event, 0, 255)"></label>
                <label class="prop" :title="T('room — a room of the data map; show — a show, the data of the map is a show from Game → Shows', 'room — комната карты данных; show — показ, данные карты — показ из «Игра → Показы»')">kind
                    <select v-model="scene.kind"><option v-for="k in Maps.kinds" :value="k">{{k}}</option></select></label>
                <label class="prop" :title="T('The event to the rules of the map when the scene is entered (checkpoint); empty — none', 'Событие правилам карты, когда в сцену входят (checkpoint); пусто — нет')">on enter
                    <input :value="scene.onEnter" list="scene-events" @change="scene.onEnter = $event.target.value.trim()"></label>
                <div class="prop" :title="T('Events to the rules of the map when the scene is left by a side (fell down where there is no room); empty — none. A side with an event but no scene next to it is an exit from the map', 'События правилам карты, когда со сцены уходят по стороне (упал вниз, где нет комнаты); пусто — нет. Сторона с событием, но без сцены рядом — выход с карты')">leave</div>
                <label v-for="side in Maps.sides" class="prop prop-indent">{{side}}
                    <input :value="scene.leave[side]" list="scene-events" @change="scene.leave[side] = $event.target.value.trim()"></label>
                <datalist id="scene-events"><option v-for="e in events" :value="e"></option></datalist>
                <button class="btn btn-sm btn-remove" @click="removeScene">{{T('Delete scene', 'Удалить сцену')}}</button>
            </template>

            <template v-else-if="sel.kind === 'layer' && layer">
                <h6 :title="T('A layer: drawn whole over the ones before it', 'Слой: рисуется целиком поверх предыдущих')">{{T('Layer', 'Слой')}}</h6>
                <label class="prop">{{T('name', 'имя')}} <input :value="layer.name" @change="renameLayer" :title="T('The name of the layer; pieces of tiles name the layer by its name', 'Имя слоя; куски плиток называют слой по имени')"></label>
                <label class="prop" :title="T('How much the layer moves with the window: 256 — with it, 128 — half as fast (far background), 0 — does not move (sky, panel)', 'Насколько слой движется вместе с окном: 256 — вместе с ним, 128 — вдвое медленнее (дальний план), 0 — не движется (небо, панель)')">factor
                    <input class="num" :value="layer.factor" @change="setInt(layer, 'factor', $event, -32768, 32767)"></label>
                <div class="prop-buttons">
                    <button class="btn btn-sm btn-outline-secondary" @click="layer.factor = 256" :title="T('Moves with the window', 'Движется вместе с окном')">256 {{T('normal', 'обычный')}}</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="layer.factor = 128" :title="T('Half as fast: far background', 'Вдвое медленнее: дальний план')">128 {{T('far', 'дальний')}}</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="layer.factor = 0" :title="T('Does not move: sky, panel', 'Не движется: небо, панель')">0 {{T('fixed', 'неподвижный')}}</button>
                </div>
                <label class="prop" :title="T('The order of pictures in the layer: as added, or by key — the smaller is farther (for a top view the key is the y of the feet)', 'Порядок картинок в слое: как добавлены, или по ключу — меньший дальше (для вида сверху ключ — y ног)')">order
                    <select v-model="layer.order"><option value="added">added</option><option value="key">key</option></select></label>
                <label class="prop"><input type="checkbox" v-model="layer.visible"> {{T('visible', 'видим')}}</label>
                <label class="prop"><input type="checkbox" v-model="layer.locked"> {{T('locked', 'заперт')}}</label>
                <div class="help-text">{{T('With the camera (the Camera tool) you can see how the layer moves.', 'Камерой (инструмент «Камера») можно посмотреть, как слой едет.')}}</div>
                <button class="btn btn-sm btn-remove" @click="removeLayer">{{T('Delete layer', 'Удалить слой')}}</button>
            </template>

            <template v-else-if="sel.kind === 'object' && object">
                <h6>{{object.type === 'picture' ? T('Picture', 'Картинка') : object.type === 'actor' ? T('Actor', 'Персонаж') : object.type === 'zone' ? T('Zone', 'Зона') : T('Entry', 'Вход')}}</h6>
                <label class="prop" :title="T('The name the game knows the object by (a constant). A picture may have no name', 'Имя, по которому объект знает игра (константа). Картинке можно без имени')">{{T('name', 'имя')}} <input :value="object.name" @change="renameObject"></label>
                <label class="prop" :title="T('The layer of the object', 'Слой объекта')">{{T('layer', 'слой')}}
                    <select :value="layer.name" @change="moveToLayer"><option v-for="l in scene.layers" :value="l.name">{{l.name}}</option></select></label>
                <template v-if="object.type === 'picture'">
                    <label class="prop">set <select :value="object.set" @change="setPictureSet"><option v-for="s in setNames" :value="s">{{s}}</option></select></label>
                    <label class="prop">image <select v-model="object.image"><option v-for="f in framesOf(object.set)" :value="f">{{f}}</option></select></label>
                </template>
                <template v-if="object.type === 'actor'">
                    <label class="prop" :title="T('The set of frames of the actor, with its animations', 'Набор кадров персонажа, с его анимациями')">set <select :value="object.set" @change="setActorSet"><option v-for="s in animatedSets" :value="s.name">{{s.name}}</option></select></label>
                    <label class="prop" :title="T('The script (state) the actor starts with', 'С какого скрипта (состояния) персонаж начинает')">script <select v-model="object.script"><option v-for="s in scriptsOf(object.set)" :value="s">{{s}}</option></select></label>
                </template>
                <template v-if="object.type === 'zone'">
                    <label class="prop" :title="T('The kind of the zone for the game: exit, trap, camera… (a word the game understands)', 'Вид зоны для игры: exit, trap, camera… (слово, которое понимает игра)')">kind <input v-model="object.kind"></label>
                </template>
                <label class="prop" :title="object.type === 'zone' ? T('The left edge', 'Левый край') : T('Where the base point stands', 'Где стоит базовая точка')">x <input class="num" :value="object.x" @change="setInt(object, 'x', $event, -32768, 32767)"></label>
                <label class="prop" :title="object.type === 'zone' ? T('The top edge', 'Верхний край') : T('Where the base point stands (the floor row)', 'Где стоит базовая точка (строка пола)')">y <input class="num" :value="object.y" @change="setInt(object, 'y', $event, -32768, 32767)"></label>
                <template v-if="object.type === 'zone'">
                    <label class="prop">{{T('width', 'ширина')}} <input class="num" :value="object.width" @change="setInt(object, 'width', $event, 1, 32767)"></label>
                    <label class="prop">{{T('height', 'высота')}} <input class="num" :value="object.height" @change="setInt(object, 'height', $event, 1, 32767)"></label>
                </template>
                <label v-if="object.type !== 'zone'" class="prop" :title="T('Mirrored: looks the other way', 'Зеркально: смотрит в другую сторону')"><input type="checkbox" v-model="object.flip"> {{T('flip', 'зеркально')}}</label>
                <label v-if="object.type === 'picture' || object.type === 'actor'" class="prop" :title="T('Turned clockwise about the base point, after the mirror (rotation); an actor turned so carries its axes with it: forward, down, its velocity, its points', 'Повёрнут по часовой вокруг базовой точки, после отражения (rotation); актёр, повёрнутый так, несёт с собой свои оси: вперёд, вниз, скорость, точки')">{{T('rotation', 'поворот')}}
                    <select :value="Scene.isTurn(object.rotation) ? Scene.turnsOf(object.rotation) * 90 : 0" @change="+$event.target.value ? object.rotation = +$event.target.value : delete object.rotation">
                        <option v-for="d in [0, 90, 180, 270]" :value="d">{{d}}°</option></select></label>
                <template v-if="object.type === 'entry'">
                    <label class="prop" :title="T('The event to whoever came by this entry (falls, comes out of a door); empty — none', 'Событие тому, кто пришёл этим входом (падает, выходит из двери); пусто — нет')">arrive
                        <input :value="object.arrive" list="scene-events" @change="object.arrive = $event.target.value.trim()"></label>
                    <label class="prop" :title="T('The links the entry fires when someone comes by it (back at a checkpoint — the floor there has already fallen): a source of links in the map of this scene; empty — none', 'Связи, которые вход запускает, когда в него приходят (вернулись к контрольной точке — пол там уже обвалился): источник связей в карте этой сцены; пусто — нет')">fires
                        <select :value="object.fires ? JSON.stringify(object.fires) : ''" @change="object.fires = $event.target.value ? JSON.parse($event.target.value) : null">
                            <option value="">— {{T('none', 'нет')}}</option><option v-for="src in linkSources" :value="JSON.stringify(src)">{{Maps.fireText(src)}}</option></select></label>
                    <datalist id="scene-events"><option v-for="e in events" :value="e"></option></datalist>
                </template>
                <template v-if="object.type === 'picture'">
                    <label class="prop" :title="T('The key: in a layer with the order «key» the smaller is drawn first (farther)', 'Ключ: в слое с порядком «key» меньший рисуется раньше (дальше)')">key <input class="num" :value="object.key" @change="setInt(object, 'key', $event, -32768, 32767)"></label>
                    <label class="prop" :title="T('Clip: the picture is drawn only inside this rectangle of the scene (the hero under a ledge, in a doorway)', 'Обрезка: картинка рисуется только внутри этого прямоугольника сцены (герой под карнизом, в проёме)')"><input type="checkbox" :checked="!!object.clip" @change="toggleClip"> {{T('clip', 'обрезка')}}</label>
                    <div v-if="object.clip" class="prop-row">
                        x <input class="num" :value="object.clip.x" @change="setInt(object.clip, 'x', $event, -32768, 32767)">
                        y <input class="num" :value="object.clip.y" @change="setInt(object.clip, 'y', $event, -32768, 32767)">
                        w <input class="num" :value="object.clip.width" @change="setInt(object.clip, 'width', $event, 0, 32767)">
                        h <input class="num" :value="object.clip.height" @change="setInt(object.clip, 'height', $event, 0, 32767)">
                    </div>
                </template>
                <template v-if="object.type === 'actor' && paramsOf(object.set).length">
                    <h6 :title="T('The starting params of this actor; empty — as in the animations of the set', 'Начальные параметры этого персонажа; пусто — как в анимациях набора')">{{T('Params', 'Параметры')}}</h6>
                    <label v-for="p in paramsOf(object.set)" class="prop">{{p.name}}
                        <input class="num" :value="object.params[p.name] ?? ''" :placeholder="String(p.value)" @change="setParam(p.name, $event)" :title="T('Empty — ' + p.value + ', as in the set', 'Пусто — ' + p.value + ', как в наборе')"></label>
                </template>
                <button class="btn btn-sm btn-remove" @click="removeObject" :title="T('Delete (Delete)', 'Удалить (Delete)')">{{T('Delete', 'Удалить')}}</button>
            </template>

            <template v-else-if="sel.kind === 'grid' && grid">
                <h6 :title="T('A grid of tiles', 'Сетка плиток')">{{T('Grid', 'Сетка')}}</h6>
                <label class="prop">{{T('name', 'имя')}} <input :value="grid.name" @change="renameGrid"></label>
                <label class="prop" :title="T('The tileset of the grid', 'Набор плиток сетки')">{{T('tileset', 'набор плиток')}} <select v-model="grid.tileset"><option v-for="t in sprites.tilesets" :value="t.name">{{t.name}}</option></select></label>
                <label class="prop" :title="T('The left edge of the grid in the scene', 'Левый край сетки в сцене')">x <input class="num" :value="grid.x" @change="setInt(grid, 'x', $event, -32768, 32767)"></label>
                <label class="prop" :title="T('The top edge of the grid in the scene', 'Верхний край сетки в сцене')">y <input class="num" :value="grid.y" @change="setInt(grid, 'y', $event, -32768, 32767)"></label>
                <label class="prop" :title="T('Columns', 'Столбцов')">{{T('cols', 'столбцы')}} <input class="num" :value="grid.cols" @change="resize('cols', $event)"></label>
                <label class="prop" :title="T('Rows', 'Строк')">{{T('rows', 'строки')}} <input class="num" :value="grid.rows" @change="resize('rows', $event)"></label>
                <div class="help-text">{{T('Paint with the Tile tool, pick the tile in the palette below.', 'Красить — инструмент «Плитка», плитку выбрать в палитре внизу.')}}</div>
                <button class="btn btn-sm btn-remove" @click="removeGrid">{{T('Delete grid', 'Удалить сетку')}}</button>
            </template>

            <template v-else-if="sel.kind === 'cell' && grid">
                <h6 :title="T('A cell of the grid', 'Клетка сетки')">{{T('Cell', 'Клетка')}} {{grid.name}} [{{sel.col}}, {{sel.row}}]</h6>
                <label class="prop" :title="T('The tile in the cell', 'Плитка в клетке')">{{T('tile', 'плитка')}}
                    <select :value="cellValue" @change="cellValue = parseInt($event.target.value)">
                        <option :value="0">— {{T('empty', 'пусто')}}</option>
                        <option v-for="(t, i) in (tileset ? tileset.tiles : [])" :value="i + 1">{{i + 1}}: {{t.name}}</option>
                    </select></label>
                <label class="prop" :title="T('The modifier of the cell for the game: the state of a gate, the kind of a potion, the number of a link. By it the pieces of the tile pick their picture (by mod) and offset. Empty — 0', 'Модификатор клетки для игры: состояние ворот, вид зелья, номер связи. По нему куски плитки выбирают картинку (by mod) и сдвиг. Пусто — 0')">mod
                    <input class="num" :value="cellMod ?? ''" @change="setMod"></label>
                <label class="prop" :title="T('The decoration variant of the cell, 32 bits: pieces with the field variant are drawn only in cells of their variant, and expressions of pieces read its bits by the fields of the tileset. Empty — 0', 'Вариант оформления клетки, 32 бита: куски с полем variant рисуются только в клетках своего варианта, а выражения кусков читают его биты по полям набора плиток. Пусто — 0')">variant
                    <input class="num" :value="cellVariant ?? ''" @change="setCellVariant"></label>
                <div v-if="cellFields.length" class="help-text" :title="T('The fields of the tileset in this cell: bits of mod and variant', 'Поля набора плиток в этой клетке: биты mod и variant')">{{cellFields.join(', ')}}</div>
            </template>

            <template v-else-if="sel.kind === 'tileset' && tileset">
                <h6 :title="T('A tileset: one for all scenes', 'Набор плиток: общий для всех сцен')">{{T('Tileset', 'Набор плиток')}}</h6>
                <label class="prop">{{T('name', 'имя')}} <input :value="tileset.name" @change="renameTileset"></label>
                <label class="prop" :title="T('The width of a cell, pixels', 'Ширина клетки, пикселей')">{{T('cell width', 'ширина клетки')}} <input class="num" :value="tileset.cellWidth" @change="setInt(tileset, 'cellWidth', $event, 1, 1024)"></label>
                <label class="prop" :title="T('The height of a cell, pixels', 'Высота клетки, пикселей')">{{T('cell height', 'высота клетки')}} <input class="num" :value="tileset.cellHeight" @change="setInt(tileset, 'cellHeight', $event, 1, 1024)"></label>
                <h6 :title="T('Names for bits of the modifier (8 bits) and the variant (32 bits) of a cell: they can be written in expressions of pieces (dx, dy, pick, color)', 'Имена для битов модификатора (8 бит) и варианта (32 бита) клетки: их можно писать в выражениях кусков (dx, dy, pick, color)')">{{T('Fields', 'Поля')}}</h6>
                <div v-for="(f, n) in tileset.fields" class="prop-row field-row">
                    <input :value="n" size="8" @change="renameField(n, $event)" :title="T('The name of the field; erase it — the field is removed', 'Имя поля; сотрите — поле удалится')">
                    <select :value="f[0]" @change="setField(n, 0, $event.target.value)" :title="T('Whose bits: mod (8 bits) or variant (32 bits)', 'Чьи биты: mod (8 бит) или variant (32 бита)')"><option value="variant">variant</option><option value="mod">mod</option></select>
                    {{T('bits', 'биты')}} <input class="num" :value="f[1]" @change="setField(n, 1, parseInt($event.target.value))" :title="T('The first bit, from 0', 'Первый бит, от 0')">
                    + <input class="num" :value="f[2]" @change="setField(n, 2, parseInt($event.target.value))" :title="T('How many bits', 'Сколько битов')">
                </div>
                <button class="btn btn-sm btn-outline-secondary" @click="addField" :title="T('A new field: a name for bits of the variant of a cell', 'Новое поле: имя для битов варианта клетки')">+ {{T('field', 'поле')}}</button>
                <h6>{{T('Tiles', 'Плитки')}}</h6>
                <div class="tile-list">
                    <div v-for="(t, i) in tileset.tiles" class="tile-cell" @click="selectTile(i)" :title="t.name + T(': click to edit', ': щёлкните, чтобы править')">
                        <TileThumb :tile="t" :tileset="tileset" :size="40"></TileThumb><div>{{i + 1}} {{t.name}}</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline-secondary" @click="addTile" :title="T('A new tile; if a picture is picked in the palette — with it', 'Новая плитка; если в палитре выбрана картинка — с ней')">+ {{T('tile', 'плитка')}}</button>
                <button class="btn btn-sm btn-remove" @click="removeTileset">{{T('Delete tileset', 'Удалить набор плиток')}}</button>
            </template>

            <template v-else-if="sel.kind === 'tile' && tile">
                <h6>{{T('Tile', 'Плитка')}} {{sel.tile + 1}} {{T('of', 'из')}} {{tileset.name}}</h6>
                <TileThumb :tile="tile" :tileset="tileset" :size="64"></TileThumb>
                <label class="prop">{{T('name', 'имя')}} <input v-model="tile.name"></label>
                <label class="prop" :title="T('The kind of the tile for the game (a number)', 'Вид плитки для игры (число)')">kind <input class="num" :value="tile.kind" @change="setInt(tile, 'kind', $event, -32768, 32767)"></label>
                <div class="prop" :title="T('Which sides of the tile are solid: an actor does not pass through them', 'Какие стороны плитки сплошные: сквозь них персонаж не проходит')">solid:
                    <label v-for="side in Scene.sides"><input type="checkbox" v-model="tile.solid[side]"> {{side}}</label></div>
                <div class="prop" :title="T('Which sides close the open space in which an actor is seen: behind them he is not seen. Usually the same as solid; separately — when one passes through the tile but it closes (a doorway closes on the right)', 'Какие стороны закрывают открытое пространство, в котором персонаж виден: за ними его не видно. Обычно те же, что solid; отдельно — когда сквозь плитку проходят, но она закрывает (дверной проём закрывает справа)')">closes:
                    <label :title="T('As solid: no field of its own', 'Как solid: отдельного поля нет')"><input type="checkbox" :checked="!tile.closes" @change="toggleCloses"> {{T('as solid', 'как solid')}}</label>
                    <template v-if="tile.closes"><label v-for="side in Scene.sides"><input type="checkbox" v-model="tile.closes[side]"> {{side}}</label></template></div>
                <div class="prop" :title="T('Veil: what a look through the tile costs for sense … seen. 0 — clear, 1…6 — a point through it costs 2…7 points of the radius, 7 — nothing is seen through it', 'Завеса (veil): сколько стоит взгляд сквозь плитку для sense … seen. 0 — прозрачна, 1…6 — точка сквозь неё стоит 2…7 точек радиуса, 7 — сквозь неё не видно')">veil
                    <select :value="tile.veil || 0" @change="+$event.target.value ? tile.veil = +$event.target.value : delete tile.veil">
                        <option v-for="v in 8" :value="v - 1">{{v - 1}}{{v === 1 ? ' ' + T('clear', 'прозрачна') : v === 8 ? ' ' + T('opaque', 'непрозрачна') : ' (×' + v + ')'}}</option></select></div>
                <div class="prop" :title="T('Seen as: neighbouring pieces that look for that tile (around) see this one too — a pressure plate that goes down is seen as floor. Empty — only as itself', 'Видна как: соседние куски, что смотрят на ту плитку (around), видят и эту — опускающаяся кнопка-плита видна как пол. Пусто — только как сама')">seen as
                    <select :value="tile.seen_as || ''" @change="$event.target.value ? tile.seen_as = $event.target.value : delete tile.seen_as">
                        <option value="">{{T('itself', 'сама')}}</option><option v-for="x in tileset.tiles.filter(x => x !== tile)" :value="x.name">{{x.name}}</option></select></div>
                <div class="prop" :title="T('The life of the tile: an animation (a set with an animation, by its name in the pack) the cell plays itself — a gate goes up, a floor crumbles, spikes jump out. Its params: 0 — the modifier of the cell, 1 — the tile, then its own. Empty — no life', 'Жизнь плитки: анимация (набор с анимацией, по имени в пакете), которую клетка играет сама — ворота поднимаются, пол осыпается, шипы выскакивают. Её параметры: 0 — модификатор клетки, 1 — плитка, дальше — свои. Пусто — без жизни')">life
                    <input :value="tile.life || ''" list="tile-lives" size="12" :placeholder="T('none', 'нет')" @change="$event.target.value.trim() ? tile.life = $event.target.value.trim() : delete tile.life">
                    <datalist id="tile-lives"><option v-for="s in sprites.sets.filter(s => s.animation && s.animation.scripts.length)" :value="Anim.packName(s.name, '').slice(0, -1)"></option></datalist></div>
                <h6 :title="T('Bodies — what is solid in the cell: rectangles from the bottom left corner of the cell. If bodies are given, they stop the actor, and solid stays only for around of pieces and for visibility. Without bodies the solid sides work', 'Тела (bodies) — что в клетке сплошное: прямоугольники от левого нижнего угла клетки. Если тела заданы, они и останавливают персонажа, а solid остаются только для around кусков и для видимости. Без тел действуют стороны solid')">{{T('Bodies', 'Тела')}}
                    <span v-if="!tile.bodies" class="meets-state">{{T('none: solid sides stop', 'нет: останавливают стороны solid')}}</span></h6>
                <div v-for="(b, k) in tile.bodies || []" class="prop-row">
                    <b>{{k + 1}}</b>
                    dx <input class="num" :value="b.dx" @change="setOffset(b, 'dx', $event)" :title="T('The offset of the bottom left corner of the body to the right of the bottom left corner of the cell: a number or an expression of ' + exprNames.join(', '), 'Сдвиг левого нижнего угла тела вправо от левого нижнего угла клетки: число или выражение из ' + exprNames.join(', '))">
                    dy <input class="num" :value="b.dy" @change="setOffset(b, 'dy', $event)" :title="T('The offset down (up — below zero): a number or an expression of ' + exprNames.join(', '), 'Сдвиг вниз (вверх — меньше нуля): число или выражение из ' + exprNames.join(', '))">
                    w <input class="num" :value="b.w" @change="setOffset(b, 'w', $event)" :title="T('The width — to the right of the corner: a number or an expression of ' + exprNames.join(', '), 'Ширина — вправо от угла: число или выражение из ' + exprNames.join(', '))">
                    h <input class="num" :value="b.h" @change="setOffset(b, 'h', $event)" :title="T('The height — up from the corner: a number or an expression of ' + exprNames.join(', ') + '; a gate: q * 2 — goes down by the modifier', 'Высота — вверх от угла: число или выражение из ' + exprNames.join(', ') + '; ворота: q * 2 — опускаются по модификатору')">
                    when <input class="anim-expr" :value="b.when ?? ''" @change="setWhen(b, $event)" :placeholder="T('always', 'всегда')" :title="T('The body is there only where the expression is not 0: q < 39. Empty — always', 'Тело есть только там, где выражение не 0: q < 39. Пусто — всегда')">
                    for <input class="anim-expr" :value="forText(b)" @change="setFor(b, $event)" :placeholder="T('every mask', 'все маски')" :title="masksTitle">
                    <button class="btn btn-sm btn-remove" @click="removeBody(k)" :title="T('Delete the body', 'Удалить тело')">×</button>
                </div>
                <button class="btn btn-sm btn-outline-secondary" @click="addBody" :title="T('A new body: the whole cell; adjust dx, dy, w, h', 'Новое тело: вся клетка; поправьте dx, dy, w, h')">+ {{T('body', 'тело')}}</button>
                <h6 :title="T('The opening — not solid: through it an actor who went inside the tile is seen (up the stairs of an exit). A rectangle, like a body: from the bottom left corner of the cell; no for. A blue frame on the scene and in the thumbnail', 'Проём (opening) — не сплошной: через него виден персонаж, ушедший внутрь плитки (вверх по лестнице выхода). Прямоугольник, как тело: от левого нижнего угла клетки; без for. Синяя рамка на сцене и в миниатюре')">{{T('Opening', 'Проём')}}
                    <span v-if="!tile.opening" class="meets-state">{{T('none', 'нет')}}</span></h6>
                <div v-if="tile.opening" class="prop-row">
                    dx <input class="num" :value="tile.opening.dx" @change="setOffset(tile.opening, 'dx', $event)" :title="T('The offset of the bottom left corner of the opening to the right: a number or an expression of ' + exprNames.join(', '), 'Сдвиг левого нижнего угла проёма вправо: число или выражение из ' + exprNames.join(', '))">
                    dy <input class="num" :value="tile.opening.dy" @change="setOffset(tile.opening, 'dy', $event)" :title="T('The offset down (up — below zero): a number or an expression of ' + exprNames.join(', '), 'Сдвиг вниз (вверх — меньше нуля): число или выражение из ' + exprNames.join(', '))">
                    w <input class="num" :value="tile.opening.w" @change="setOffset(tile.opening, 'w', $event)" :title="T('The width — to the right of the corner: a number or an expression of ' + exprNames.join(', '), 'Ширина — вправо от угла: число или выражение из ' + exprNames.join(', '))">
                    h <input class="num" :value="tile.opening.h" @change="setOffset(tile.opening, 'h', $event)" :title="T('The height — up from the corner: a number or an expression of ' + exprNames.join(', ') + '; a door: 16 + 4 * min(q, 12)', 'Высота — вверх от угла: число или выражение из ' + exprNames.join(', ') + '; дверь: 16 + 4 * min(q, 12)')">
                    when <input class="anim-expr" :value="tile.opening.when ?? ''" @change="setWhen(tile.opening, $event)" :placeholder="T('always', 'всегда')" :title="T('The opening is there only where the expression is not 0. Empty — always', 'Проём есть только там, где выражение не 0. Пусто — всегда')">
                    <button class="btn btn-sm btn-remove" @click="delete tile.opening" :title="T('Remove the opening', 'Убрать проём')">×</button>
                </div>
                <button v-else class="btn btn-sm btn-outline-secondary" @click="addOpening" :title="T('An opening: the whole cell; adjust dx, dy, w, h', 'Проём: вся клетка; поправьте dx, dy, w, h')">+ {{T('opening', 'проём')}}</button>
                <h6 :title="T('A tile is drawn in pieces: each is a picture in its own layer of the scene, offset from the bottom left corner of the cell', 'Плитка рисуется кусками: каждый — картинка в своём слое сцены, сдвинутая от левого нижнего угла клетки')">{{T('Pieces', 'Куски')}}</h6>
                <div v-for="(p, k) in tile.pieces" class="piece">
                    <div class="piece-head">
                        <b>{{k + 1}}</b>
                        <select :value="pieceMode(p)" @change="setPieceMode(p, $event)"
                            :title="T('The picture of the piece: one; by the modifier of the cell (a gate closed/open, the kind of a potion); in turn over time (water, lava)', 'Картинка куска: одна; по модификатору клетки (ворота закрыты/открыты, вид зелья); по кругу во времени (вода, лава)')">
                            <option value="image">{{T('one picture', 'одна картинка')}}</option>
                            <option value="by_mod">by mod</option>
                            <option value="pick">pick</option>
                            <option value="cycle">cycle</option>
                            <option value="fill">fill</option>
                        </select>
                        <button class="btn btn-sm btn-remove" @click="tile.pieces.splice(k, 1)" :title="T('Delete the piece', 'Удалить кусок')">×</button>
                    </div>
                    <template v-if="pieceMode(p) === 'image'">
                        <select :value="p.set" @change="setPieceSet(p, $event)" :title="T('The set of the picture', 'Набор картинки')"><option v-for="s in setNames" :value="s">{{s}}</option></select>
                        <select v-model="p.image" :title="T('Picture', 'Картинка')"><option v-for="f in framesOf(p.set)" :value="f">{{f}}</option></select>
                    </template>
                    <template v-else-if="pieceMode(p) === 'fill'">
                        <div class="prop-row">size <input class="num" :value="(p.size || [1, 1])[0]" @change="setSize(p, 0, $event)" :title="T('The width of the rectangle, pixels', 'Ширина прямоугольника, пикселей')">
                            × <input class="num" :value="(p.size || [1, 1])[1]" @change="setSize(p, 1, $event)" :title="T('The height; the bottom left corner is at the bottom left corner of the cell, offset by dx, dy', 'Высота; левый нижний угол — в левом нижнем углу клетки, сдвинутом на dx, dy')"></div>
                    </template>
                    <template v-else>
                        <div v-if="p.pictures" class="prop-row">pick <input class="anim-expr" :value="p.pick" @change="setOffset(p, 'pick', $event)"
                            :title="T('The number of the picture in the list: an expression of ' + exprNames.join(', ') + '; rounded, held to the ends of the list', 'Номер картинки списка: выражение из ' + exprNames.join(', ') + '; округляется, прижимается к краям списка')"></div>
                        <div v-for="(r, j) in listOf(p)" class="piece-ref">
                            <span v-if="p.by_mod" class="help-text" :title="j === p.by_mod.length - 1 ? T('This picture is for all greater modifiers too', 'Эта картинка — и для всех модификаторов больше') : ''">mod {{j}}{{j === p.by_mod.length - 1 ? '+' : ''}}</span>
                            <span v-if="p.pictures" class="help-text">#{{j}}</span>
                            <select :value="r ? r.set : ''" @change="setRefSet(p, j, $event)" :title="T('The set; «— none» — then there is no piece', 'Набор; «— нет» — куска тогда нет')">
                                <option v-if="p.by_mod || p.pictures" value="">— {{T('none', 'нет')}}</option>
                                <option v-for="s in setNames" :value="s">{{s}}</option></select>
                            <select v-if="r" v-model="r.image" :title="T('Picture', 'Картинка')"><option v-for="f in framesOf(r.set)" :value="f">{{f}}</option></select>
                            <span v-if="p.cycle"><input class="num" :value="r.ms" @change="setInt(r, 'ms', $event, 1, 65535)" :title="T('How many milliseconds to show', 'Сколько миллисекунд показывать')"> ms</span>
                            <button @click="listOf(p).length > 1 && listOf(p).splice(j, 1)" :title="T('Remove the picture', 'Убрать картинку')">×</button>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" @click="addRef(p)" :title="T('One more picture (if a picture is picked in the palette — that one)', 'Ещё картинка (если в палитре выбрана картинка — она)')">+ {{T('picture', 'картинка')}}</button>
                    </template>
                    <div class="prop-row">dx <input class="num" :value="p.dx" @change="setOffset(p, 'dx', $event)" :title="T('The offset to the right of the bottom left corner of the cell: a number or an expression of ' + exprNames.join(', ') + ', for example mod * 2', 'Сдвиг вправо от левого нижнего угла клетки: число или выражение из ' + exprNames.join(', ') + ', например mod * 2')">
                        dy <input class="num" :value="p.dy" @change="setOffset(p, 'dy', $event)" :title="T('The offset down (up — below zero): a number or an expression of ' + exprNames.join(', ') + ', for example -mod / 4 — a gate goes up', 'Сдвиг вниз (вверх — меньше нуля): число или выражение из ' + exprNames.join(', ') + ', например -mod / 4 — ворота поднимаются')">
                        key <input class="num" :value="p.key" @change="setInt(p, 'key', $event, -32768, 32767)" :title="T('The key in a layer with the order key', 'Ключ в слое с порядком key')"></div>
                    <div class="prop-row">
                        with <select :value="p.with || 'self'" @change="setPieceWith(p, $event)"
                            :title="T('With which cell the piece is laid: self — with its own; up, right… — with the neighbour on that side (the place and the rules are of its own cell). The edge of a floor on the right: right and dx = the width of the cell', 'С какой клеткой кладётся кусок: self — со своей; up, right… — с соседней с той стороны (место и правила — своей клетки). Край пола справа: right и dx = ширина клетки')">
                            <option v-for="w in Scene.withOrder" :value="w">{{w}}</option></select>
                        step <input class="num" :value="p.step || 0" @change="setPieceNumber(p, 'step', $event, 0, 255)" :title="T('The turn among the pieces laid with the cell: 0 — first; in one turn — its own, then from the neighbours', 'Очередь среди кусков, кладущихся с клеткой: 0 — первыми; в одной очереди — свои, потом от соседей')">
                    </div>
                    <div class="prop-row">
                        <template v-if="p.draw !== 'fill'">draw <select :value="p.draw || 'normal'" @change="setPieceDraw(p, $event)"
                            :title="T('normal — as it is; card — on a rectangle of its color that covers what is behind it; silhouette — the shape in one color', 'normal — как есть; card — на прямоугольнике своего цвета, закрывающем то, что за ним; silhouette — форма одним цветом')">
                            <option v-for="d in ['normal', 'card', 'silhouette']" :value="d">{{d}}</option></select></template>
                        <template v-if="p.draw">
                            color <input class="anim-expr" :value="Array.isArray(p.color) ? p.color[1] : (p.color ?? 0)" @change="setPieceColor(p, $event)"
                                :title="T('Color: 0 — the paper of the frame (background), n — the color of pixels of value n of the set; may be an expression of ' + exprNames.join(', '), 'Цвет: 0 — бумага кадра (фон), n — цвет пикселей значения n набора; можно выражение из ' + exprNames.join(', '))">
                            <select :value="Array.isArray(p.color) ? p.color[0] : ''" @change="setPieceColorSet(p, $event)" :title="T('The color from the palette of which set (of the piece’s own or another) or from a palette of the file (Palettes on Frames)', 'Цвет из палитры какого набора (своего куска или другого) или из палитры файла («Палитры» в дереве)')">
                                <option value="">{{T('own set', 'свой набор')}}</option><optgroup :label="T('palettes', 'палитры')"><option v-for="x in sprites.palettes" :value="x.name">{{x.name}}</option></optgroup>
                                <optgroup :label="T('sets', 'наборы')"><option v-for="s in setNames" :value="s">{{s}}</option></optgroup></select>
                        </template>
                    </div>
                    <div class="prop-row">layer <input v-model="p.layer" list="scene-layer-names" size="8" :title="T('The layer of the scene the piece is drawn in', 'Слой сцены, в котором рисуется кусок')">
                        when <input class="anim-expr" :value="p.when ?? ''" @change="setWhen(p, $event)"
                            :title="T('Draw the piece only where this expression is not 0: of ' + exprNames.join(', ') + ', comparisons and and, or, not; for example mod > 0 and variant == 0. Empty — always', 'Рисовать кусок только там, где это выражение не 0: из ' + exprNames.join(', ') + ', сравнения и and, or, not; например mod > 0 and variant == 0. Пусто — всегда')">
                        variant <input class="num" :value="p.variant ?? ''" @change="setVariant(p, $event)" :title="T('Draw only in cells where the decoration variant (32 bits) equals this number; empty — in all', 'Рисовать только в клетках, где вариант оформления (32 бита) равен этому числу; пусто — во всех')"></div>
                    <div class="around" :title="T('Draw the piece only if the neighbours of the cell are such (all the conditions together). Empty — any. empty, a tile name, names separated by commas, solid_top/left/right/bottom/any, «not » before any of them', 'Рисовать кусок, только если соседи клетки такие (все условия вместе). Пусто — всё равно. empty, имя плитки, имена через запятую, solid_top/left/right/bottom/any, «not » перед любым')">
                        <template v-for="side in ['up_left', 'up', 'up_right', 'left', '', 'right', 'down_left', 'down', 'down_right']">
                            <input v-if="side" :value="aroundValue(p, side)" @change="setAround(p, side, $event)" list="around-words" :placeholder="side" :title="side + T(': which neighbour is needed', ': какой сосед нужен')">
                            <span v-else class="around-center">{{tile.name}}</span>
                        </template>
                    </div>
                </div>
                <datalist id="scene-layer-names"><option v-for="n in layerNames" :value="n"></option></datalist>
                <datalist id="around-words"><option v-for="w in aroundWords" :value="w"></option></datalist>
                <button class="btn btn-sm btn-outline-secondary" @click="addPiece" :title="T('A new piece; if a picture is picked in the palette — that one', 'Новый кусок; если в палитре выбрана картинка — она')">+ {{T('piece', 'кусок')}}</button>
                <button class="btn btn-sm btn-remove" @click="removeTile">{{T('Delete tile', 'Удалить плитку')}}</button>
            </template>

            <template v-else-if="sel.kind === 'exit' && exit">
                <h6 :title="T('An exit to another scene', 'Выход в другую сцену')">{{T('Exit', 'Выход')}}</h6>
                <label class="prop" :title="T('An exit through an edge of the scene (room)', 'Выход через край сцены (комнаты)')">edge
                    <select v-model="exit.edge"><option value="">—</option><option v-for="e in Scene.edges" :value="e">{{e}}</option></select></label>
                <label class="prop" :title="T('Or an exit through a zone of this scene (a door, stairs)', 'Или выход через зону этой сцены (дверь, лестница)')">zone
                    <select v-model="exit.zone"><option value="">—</option><option v-for="z in zones" :value="z.name">{{z.name}}</option></select></label>
                <label class="prop" :title="T('Where to', 'Куда')">scene
                    <select :value="exit.scene" @change="setExitTarget"><option v-for="s in sprites.scenes" :value="s.name">{{s.name}}</option></select></label>
                <label class="prop" :title="T('The entry point in that scene. An exit by an edge needs none: one enters by the opposite edge; an exit by name must have one', 'Точка входа в той сцене. У выхода по краю не нужна: входят по краю, напротив; у выхода по имени обязательна')">entry
                    <select v-model="exit.entry"><option value="">—</option><option v-for="e in entriesOf(exit.scene)" :value="e">{{e}}</option></select></label>
                <label class="prop" :title="T('The name of the exit (a door, stairs, a hatch): the game takes the exit by name — the constant WORLD_EXIT_NAME. An exit by an edge has no name', 'Имя выхода (дверь, лестница, люк): игра берёт выход по имени — константа WORLD_EXIT_ИМЯ. Выход по краю имени не имеет')">{{T('name', 'имя')}}
                    <input :value="exit.name" @change="exit.name = $event.target.value.trim()" :disabled="!!exit.edge"></label>
                <label class="prop" :title="T('The transition of an exit by name: cut — at once, fade — through dark, wipe — a curtain from left to right, seamless — at once and as it went (whoever came is not started anew)', 'Переход у выхода по имени: cut — сразу, fade — затемнение, wipe — шторкой слева направо, seamless — сразу и как шёл (пришедшего не заводят заново)')">transition
                    <select v-model="exit.transition" :disabled="!!exit.edge"><option v-for="t in Maps.transitions" :value="t">{{t}}</option></select></label>
                <button class="btn btn-sm btn-remove" @click="removeExit">{{T('Delete exit', 'Удалить выход')}}</button>
            </template>

            <template v-else-if="sel.kind === 'link' && link">
                <h6 :title="T('A link: a source (a plate, a lever) fires its links — each tells the life of a cell an event (dgx_ge_links.h)', 'Связь: источник (плита, рычаг) запускает свои связи — каждая говорит жизни клетки событие (dgx_ge_links.h)')">{{T('Link', 'Связь')}}</h6>
                <div>{{Scene.refText(link.from)}} → {{Scene.refText(link.to)}}</div>
                <label class="prop" :title="T('The event to the life of the target cell; empty — the one the source sends (opener: open, closer: shut)', 'Событие жизни клетки-цели; пусто — то, которое шлёт источник (opener: open, closer: shut)')">event
                    <input :value="link.event" list="scene-events" @change="link.event = $event.target.value.trim()"></label>
                <label class="prop" :title="T('A number into param 0 of the life of the target before the event (how long the gate stays open from this plate); empty — none', 'Число в свой параметр 0 жизни цели перед событием (сколько ворота стоят открытыми от этой плиты); пусто — нет')">value
                    <input class="num" :value="link.value ?? ''" @change="setLinkValue($event)"></label>
                <datalist id="scene-events"><option v-for="e in events" :value="e"></option></datalist>
                <button class="btn btn-sm btn-outline-secondary" @click="link.from = [link.to, link.to = link.from][0]" :title="T('Swap the ends', 'Поменять концы местами')">⇄ {{T('swap', 'обменять')}}</button>
                <button class="btn btn-sm btn-remove" @click="removeLink">{{T('Delete link', 'Удалить связь')}}</button>
            </template>
        </div>
    `
};

// the palette: pictures of the sets to put, tiles to paint, sets with animations to put as actors
const ScenePalette = {
    data() {
        return {
            tab: 'pictures',
            set: '',
        };
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        currentSet() {
            return this.sprites.sets.find(s => s.name === this.set) || this.sprites.sets[0];
        },
        tileset() {
            return this.sprites.tilesets.find(t => t.name === this.edit.sceneTileset) || this.sprites.tilesets[0] || null;
        },
        animatedSets() {
            return this.sprites.sets.filter(s => s.animation.scripts.length);
        },
    },
    methods: {
        pickPicture(f) {
            this.edit.scenePick = {
                set: this.currentSet.name,
                image: f.image
            };
            this.edit.sceneTool = 'picture';
        },
        isPicked(f) {
            const p = this.edit.scenePick;
            return p && p.set === this.currentSet.name && p.image === f.image;
        },
        pickTile(i) {
            this.edit.sceneTileset = this.tileset.name;
            this.edit.sceneTile = i + 1;
            this.edit.sceneTool = 'tile';
        },
        editTile(i) {
            this.edit.sceneSel = {
                kind: 'tile',
                tileset: this.tileset.name,
                tile: i
            };
        },
        pickActor(s) {
            this.edit.sceneActorSet = s.name;
            this.edit.sceneTool = 'actor';
        },
    },
    template: `
        <div class="palette">
            <div class="palette-tabs">
                <a href="#" :class="{active: tab === 'pictures'}" @click.prevent="tab = 'pictures'" :title="T('Pictures of the sets: pick one and put it with the Picture tool', 'Картинки наборов: выбрать и поставить инструментом «Картинка»')">{{T('Pictures', 'Картинки')}}</a>
                <a href="#" :class="{active: tab === 'tiles'}" @click.prevent="tab = 'tiles'" :title="T('Tiles: pick one and paint with the Tile tool', 'Плитки: выбрать и красить инструментом «Плитка»')">{{T('Tiles', 'Плитки')}}</a>
                <a href="#" :class="{active: tab === 'actors'}" @click.prevent="tab = 'actors'" :title="T('Actors: sets with animations, put with the Actor tool', 'Персонажи: наборы с анимациями, ставятся инструментом «Персонаж»')">{{T('Actors', 'Персонажи')}}</a>
                <select v-if="tab === 'pictures'" v-model="set" :title="T('The set of pictures', 'Набор картинок')"><option v-for="s in sprites.sets" :value="s.name">{{s.name}}</option></select>
                <select v-if="tab === 'tiles'" v-model="edit.sceneTileset" :title="T('The tileset', 'Набор плиток')"><option v-for="t in sprites.tilesets" :value="t.name">{{t.name}}</option></select>
                <span class="help-text">{{tab === 'pictures' ? T('click a picture, then a place on the scene', 'щёлкните картинку, потом место на сцене') : tab === 'tiles' ? T('click a tile and paint the grid; double click — edit the tile', 'щёлкните плитку и красьте сетку; двойной щелчок — править плитку') : T('click an actor, then a place on the scene', 'щёлкните персонажа, потом место на сцене')}}</span>
            </div>
            <div class="palette-items">
                <template v-if="tab === 'pictures' && currentSet">
                    <div v-for="f in currentSet.frames" class="palette-cell" :class="{picked: isPicked(f)}" @click="pickPicture(f)" :title="f.image">
                        <FrameThumb :set-name="currentSet.name" :frame="f" :scale="1"></FrameThumb>
                    </div>
                    <span v-if="!currentSet.frames.length" class="help-text">{{T('The set has no frames: load PNG on the Frames tab.', 'В наборе нет кадров: загрузите PNG на вкладке «Кадры».')}}</span>
                </template>
                <template v-if="tab === 'tiles'">
                    <template v-if="tileset">
                        <div v-for="(t, i) in tileset.tiles" class="palette-cell" :class="{picked: edit.sceneTile === i + 1 && edit.sceneTileset === tileset.name}"
                            @click="pickTile(i)" @dblclick="editTile(i)" :title="(i + 1) + ': ' + t.name">
                            <TileThumb :tile="t" :tileset="tileset" :size="40"></TileThumb><div class="palette-label">{{i + 1}}</div>
                        </div>
                        <span v-if="!tileset.tiles.length" class="help-text">{{T('No tiles: select a tileset on the left (Tilesets) and press «+ tile» on the right.', 'Плиток нет: выберите набор плиток слева («Наборы плиток») и нажмите «+ плитка» справа.')}}</span>
                    </template>
                    <span v-else class="help-text">{{T('No tilesets: Tilesets on the left, «+».', 'Наборов плиток нет: слева «Наборы плиток», «+».')}}</span>
                </template>
                <template v-if="tab === 'actors'">
                    <div v-for="s in animatedSets" class="palette-cell" :class="{picked: edit.sceneActorSet === s.name}" @click="pickActor(s)" :title="s.name + ': ' + s.animation.scripts.length + ' ' + T('scripts', 'скриптов')">
                        <FrameThumb v-if="s.frames.length" :set-name="s.name" :frame="s.frames[0]" :scale="1"></FrameThumb>
                        <div class="palette-label">{{s.name}}</div>
                    </div>
                    <span v-if="!animatedSets.length" class="help-text">{{T('No kinds with scripts: make them under Scripts of a kind in the tree.', 'Нет видов со скриптами: сделайте их в «Скрипты» вида в дереве.')}}</span>
                </template>
            </div>
        </div>
    `
};

// the map of scenes: rooms joined by edges stand next to each other, exits are arrows
const SceneMap = {
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        // places of scenes: joined by edges they make a grid, the rest go below
        layout() {
            const scenes = this.sprites.scenes;
            let pos = {};
            const step = {
                left: [-1, 0],
                right: [1, 0],
                up: [0, -1],
                down: [0, 1]
            };
            let row = 0;
            for (const start of scenes) {
                if (pos[start.name]) continue;
                // a group of scenes joined by edges, laid in places of its own from its first scene
                let group = {
                    [start.name]: [0, 0]
                };
                let taken = new Set(['0,0']);
                let queue = [start.name];
                while (queue.length) {
                    const n = queue.shift();
                    const s = scenes.find(x => x.name === n);
                    for (const e of s.exits) {
                        if (!e.edge || !step[e.edge] || pos[e.scene] || group[e.scene] || !scenes.some(x => x.name === e.scene)) continue;
                        const [x, y] = [group[n][0] + step[e.edge][0], group[n][1] + step[e.edge][1]];
                        if (taken.has(x + ',' + y)) continue;
                        group[e.scene] = [x, y];
                        taken.add(x + ',' + y);
                        queue.push(e.scene);
                    }
                }
                // below the groups before it, a free row between, even when it grew upwards
                const ys = Object.values(group).map(p => p[1]);
                const top = Math.min(...ys);
                for (const n in group) pos[n] = [group[n][0], group[n][1] - top + row];
                row += Math.max(...ys) - top + 2;
            }
            const xs = Object.values(pos).map(p => p[0]);
            const minX = Math.min(0, ...xs);
            for (const n in pos) pos[n] = {
                x: 80 + (pos[n][0] - minX) * 170,
                y: 50 + pos[n][1] * 90
            };
            return pos;
        },
        size() {
            const ps = Object.values(this.layout);
            return {
                width: Math.max(600, ...ps.map(p => p.x + 120)),
                height: Math.max(300, ...ps.map(p => p.y + 70))
            };
        },
        arrows() {
            let list = [];
            for (const s of this.sprites.scenes) {
                s.exits.forEach((e, i) => {
                    const a = this.layout[s.name],
                        b = this.layout[e.scene];
                    if (!a || !b) return;
                    const label = (e.edge || e.name || e.zone) + (e.entry && !e.edge ? ' → ' + e.entry : '') + (e.transition && e.transition !== 'cut' && !e.edge ? ' (' + e.transition + ')' : '');
                    const bend = e.edge ? 8 : 30;
                    const dx = b.x - a.x,
                        dy = b.y - a.y,
                        len = Math.hypot(dx, dy) || 1;
                    const mx = (a.x + b.x) / 2 - dy / len * bend,
                        my = (a.y + b.y) / 2 + dx / len * bend;
                    list.push({
                        key: s.name + i,
                        d: 'M' + a.x + ',' + a.y + ' Q' + mx + ',' + my + ' ' + b.x + ',' + b.y,
                        label: label,
                        lx: mx,
                        ly: my,
                        zone: !e.edge
                    });
                });
            }
            return list;
        },
    },
    methods: {
        open(i) {
            this.edit.sceneIndex = i;
            this.edit.sceneSel = {
                kind: 'scene'
            };
        },
    },
    template: `
        <div class="scene-map">
            <div class="help-text">{{T('The map of scenes: arrows are exits (solid — through an edge, dashed — through a zone). Scenes joined by edges stand next to each other, like rooms. Click — select a scene, double click — open it.', 'Карта сцен: стрелки — выходы (сплошные — через край, пунктир — через зону). Сцены, связанные краями, стоят рядом, как комнаты. Щелчок — выбрать сцену, двойной — открыть.')}}</div>
            <svg :width="size.width" :height="size.height" class="scene-map-svg">
                <defs><marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#4060a0"></path></marker></defs>
                <g v-for="a in arrows" :key="a.key">
                    <path :d="a.d" fill="none" stroke="#4060a0" :stroke-dasharray="a.zone ? '5 4' : ''" marker-end="url(#map-arrow)"></path>
                    <text :x="a.lx" :y="a.ly" class="edge-label">{{a.label}}</text>
                </g>
                <g v-for="(s, i) in sprites.scenes" :key="s.name" class="graph-node" :class="{center: i === edit.sceneIndex}"
                    :transform="'translate(' + layout[s.name].x + ',' + layout[s.name].y + ')'" @click="open(i)" @dblclick="open(i); edit.sceneView = 'scene'">
                    <rect x="-60" y="-16" width="120" height="32" rx="4"></rect>
                    <text y="-1">{{s.name}}</text>
                    <text y="11" class="map-size">{{s.width}}×{{s.height}}</text>
                </g>
            </svg>
            <div v-if="!sprites.scenes.length" class="anim-empty">{{T('No scenes.', 'Сцен нет.')}}</div>
        </div>
    `
};
