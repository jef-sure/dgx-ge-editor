// The actor of the animation in motion along the floor, as the engine plays it: frames by their times, moves,
// turns, gotos and holds. Buttons send events, so the rules are tried without a game
// what the mode of animations shares between its parts: the player and the scripts, for the toolbar and the keys
const AnimUi = Vue.reactive({
    player: null,
    scripts: null,
});

const AnimPlayer = {
    data() {
        return {
            playing: false,
            view: null, // a copy of the state of the runner, what the template shows
            history: [], // states at the frames before, to step back
            message: '',
        };
    },
    created() {
        this.runner = null;
        this.rebuild();
    },
    mounted() {
        this.ctx = this.$refs.canvas.getContext('2d');
        // the stage is as large as its box in the strip
        this.resize = new ResizeObserver(() => {
            const r = this.$refs.box.getBoundingClientRect();
            const canvas = this.$refs.canvas;
            canvas.width = Math.max(160, Math.floor(r.width));
            canvas.height = Math.max(80, Math.floor(r.height));
            this.draw();
        });
        this.resize.observe(this.$refs.box);
        AnimUi.player = this;
        this.draw();
    },
    unmounted() {
        this.pause();
        clearTimeout(this.rebuildTimer);
        this.resize.disconnect();
        if (AnimUi.player === this) AnimUi.player = null;
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        // the pictures look to the left: the set says so, or the player is asked to
        faceLeft() {
            return !!this.set.facesLeft || this.edit.playFaceLeft;
        },
        Anim() {
            return Anim;
        },
        edit() {
            return this.spritesStore.edit;
        },
        set() {
            return this.spritesStore.currentSet;
        },
        animation() {
            return this.set.animation;
        },
        zoom() {
            return Math.max(1, this.edit.playZoom | 0);
        },
        startScript: {
            get() {
                return this.edit.animScript;
            },
            set(name) {
                this.edit.animScript = name;
                this.edit.animStep = 0;
            },
        },
        // events with a cell for the script the actor is in
        live() {
            if (!this.view || !this.runner) return {};
            return this.runner.matrix[this.view.script] || {};
        },
        where() {
            const v = this.view;
            if (!v || !v.frameLine) return '';
            const s = this.animation.scripts[v.frameLine[0]];
            if (!s) return '';
            const steps = Anim.steps(s);
            const k = steps.findIndex(st => st.frame === v.frameLine[1]);
            return s.name + T(', step ', ', шаг ') + (k + 1);
        },
        frameText() {
            return this.view && this.view.frame ? Anim.statementText(this.view.frame, this.set) : '';
        },
    },
    watch: {
        // any change of the animation starts it again, from the script and the step chosen
        'set.animation': {
            handler() {
                clearTimeout(this.rebuildTimer);
                this.rebuildTimer = setTimeout(() => this.rebuild(), 150);
            },
            deep: true
        },
        'edit.animScript'() {
            if (!this.playing) this.seek();
        },
        'edit.animStep'() {
            if (!this.playing) this.seek();
        },
        'spritesStore.imagesVersion'() {
            this.draw();
        },
        'edit.playZoom'() {
            this.draw();
        },
        'edit.playOnion'() {
            this.draw();
        },
        'edit.playFollow'() {
            this.draw();
        },
        'edit.playNumbers'() {
            this.draw();
        },
        faceLeft() {
            this.draw();
        },
        'edit.playMasks'() {
            this.draw();
        },
    },
    methods: {
        rebuild() {
            const wasPlaying = this.playing;
            this.pause();
            this.runner = new AnimRunner(this.animation);
            // the numbers of the pictures as the packer gives them from this file: set after set, frame after frame
            const names = this.spritesStore.sprites.sets.flatMap(s => s.frames.map(f => Anim.imageName(s, f.image)));
            const numbers = Object.fromEntries(names.map((n, i) => [n, i]));
            this.runner.pictures = {
                number: name => numbers[name] ?? 0,
                name: n => names[n]
            };
            // the pockets and the amount the player is told; a thing drawn into the hand shows its kind's first frame
            let counts = {};
            for (const part of (this.edit.playPockets || '').split(/[,;]/)) {
                const m = /^\s*(\w+)\s*(?:[x×*:]?\s*(\d+))?\s*$/.exec(part);
                if (m) counts[m[1]] = (counts[m[1]] || 0) + (m[2] ? parseInt(m[2], 10) : 1);
            }
            this.runner.startCounts = counts;
            this.runner.amount = parseInt(this.edit.playAmount, 10) || 1;
            // the game's answers to the questions of the animation (game.<name>): 'see 1, hear 0'; unsaid: 0
            let answers = {};
            for (const part of (this.edit.playAnswers || '').split(/[,;]/)) {
                const m = /^\s*(\w+)\s*[=:]?\s*(-?\d+)\s*$/.exec(part);
                if (m) answers[m[1]] = parseInt(m[2], 10);
            }
            this.runner.answers = answers;
            this.runner.kindPicture = kind => this.kindPicture(kind);
            if (!this.animation.scripts.some(s => s.name === this.edit.animScript) && this.animation.scripts.length)
                this.edit.animScript = this.animation.scripts[0].name;
            this.seek();
            if (wasPlaying) this.play();
        },
        // the actor at the start of the chosen script, stepped up to the chosen step
        seek() {
            if (!this.runner) return;
            this.runner.start(this.edit.animScript);
            this.history = [];
            const si = this.animation.scripts.findIndex(s => s.name === this.edit.animScript);
            const script = this.animation.scripts[si];
            if (script) {
                const step = Anim.steps(script)[this.edit.animStep];
                if (step && step.frame >= 0) {
                    for (let n = 0; n < 200; ++n) {
                        const fl = this.runner.state.frameLine;
                        if (fl && fl[0] === si && fl[1] === step.frame) break;
                        if (this.runner.state.holding) break;
                        const before = this.runner.copy();
                        this.runner.stepFrame();
                        this.keep(before);
                    }
                }
            }
            this.sync();
        },
        restart() {
            this.runner.start(this.edit.animScript);
            this.history = [];
            this.sync();
        },
        sync() {
            this.view = this.runner.copy();
            this.draw();
        },
        play() {
            if (this.playing) return;
            this.playing = true;
            this.last = performance.now();
            const tick = (now) => {
                if (!this.playing) return;
                const speed = this.edit.playSpeed || 1;
                // whole milliseconds, as a game gives the engine; the fraction waits for the next frame
                this.spare = (this.spare || 0) + Math.min(250, now - this.last) * speed;
                const ms = Math.floor(this.spare);
                this.spare -= ms;
                this.last = now;
                const due = this.runner.state.due;
                const before = this.runner.copy();
                this.runner.advance(ms);
                if (this.runner.state.due !== due) {
                    this.history.push(before);
                    if (this.history.length > 300) this.history.shift();
                }
                this.sync();
                this.raf = requestAnimationFrame(tick);
            };
            this.raf = requestAnimationFrame(tick);
        },
        pause() {
            this.playing = false;
            if (this.raf) cancelAnimationFrame(this.raf);
            this.raf = 0;
        },
        toggle() {
            if (this.playing) this.pause();
            else this.play();
        },
        // a state to step back to, when the actor moved on from it; 300 at most
        keep(before) {
            if (JSON.stringify(before) === JSON.stringify(this.runner.state)) return;
            this.history.push(before);
            if (this.history.length > 300) this.history.shift();
        },
        stepForward() {
            this.pause();
            const before = this.runner.copy();
            this.runner.stepFrame();
            this.keep(before);
            this.sync();
        },
        stepBack() {
            this.pause();
            if (!this.history.length) return;
            this.runner.restore(this.history.pop());
            this.sync();
        },
        send(event) {
            const before = this.runner.copy();
            this.runner.event(event);
            this.keep(before);
            this.sync();
        },
        // the picture a kind is shown by: the first frame of its script 0, as a picture of the pack
        kindPicture(kind) {
            const sets = this.spritesStore.sprites.sets;
            const set = sets.find(s => Anim.nameOf(s.name) === kind || String(sets.indexOf(s)) === kind);
            const script = set && set.animation && set.animation.scripts[0];
            const first = script && script.lines.find(l => l.op === 'frame');
            if (first && first.image !== undefined) return {
                name: Anim.imageName(set, first.image)
            };
            if (first && first.name !== undefined) return {
                name: first.name
            };
            if (first && first.number !== undefined && set.frameTable && set.frameTable[first.number]) {
                const e = set.frameTable[first.number];
                const s = sets.find(x => x.name === e.set);
                return s ? {
                    name: Anim.imageName(s, e.image)
                } : null;
            }
            return set && set.frames.length ? {
                name: Anim.imageName(set, set.frames[0].image)
            } : null;
        },
        // the frame a frame statement shows: of this set, of another set by its pack name,
        // or by number the frame of the set in its order when that is asked
        frameOf(statement) {
            if (!statement) return null;
            if (statement.image !== undefined) {
                const f = this.set.frames.find(f => f.image === statement.image);
                return f ? {
                    setName: this.set.name,
                    frame: f
                } : null;
            }
            if (statement.number !== undefined && this.set.frameTable) {
                // the game's frame by its table: a picture of any set, and how far it stands forward and down
                const e = this.set.frameTable[statement.number];
                const s = e && this.spritesStore.sprites.sets.find(s => s.name === e.set);
                const f = s && s.frames.find(f => f.image === e.image);
                return f ? {
                    setName: s.name,
                    frame: f,
                    dx: e.dx,
                    dy: e.dy
                } : null;
            }
            if (statement.number !== undefined) {
                const f = this.edit.playNumbers ? this.set.frames[statement.number - 1] : null;
                return f ? {
                    setName: this.set.name,
                    frame: f
                } : null;
            }
            for (const s of this.spritesStore.sprites.sets) {
                const f = s.frames.find(f => Anim.imageName(s, f.image) === statement.name);
                if (f) return {
                    setName: s.name,
                    frame: f
                };
            }
            return null;
        },
        draw() {
            const canvas = this.$refs.canvas;
            if (!canvas || !this.view) return;
            const ctx = this.ctx;
            const W = canvas.width,
                H = canvas.height;
            const z = this.zoom;
            const floorY = H - 24;
            // the screen goes the way pictures look: forward is to the right, or to the left when they look left
            const dir = this.faceLeft ? -1 : 1;
            const v = this.view;
            const camX = this.edit.playFollow ? v.x : 0;
            const camY = this.edit.playFollow ? Math.min(0, v.y) : 0;
            const sx = x => W / 2 + (x - camX) * dir * z;
            const sy = y => floorY + (y - camY) * z;
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, W, H);
            // the floor, with marks every 8 pixels of the world so the motion is seen
            ctx.fillStyle = '#f2efe6';
            ctx.fillRect(0, sy(1), W, H - sy(1));
            ctx.strokeStyle = 'rgba(0, 90, 255, 0.7)';
            ctx.beginPath();
            ctx.moveTo(0, sy(1) + 0.5);
            ctx.lineTo(W, sy(1) + 0.5);
            ctx.stroke();
            ctx.fillStyle = '#909090';
            ctx.font = '10px sans-serif';
            const span = W / z / 2 + 16;
            for (let x = Math.floor((camX - span) / 8) * 8; x <= camX + span; x += 8) {
                const px = Math.round(sx(x));
                ctx.fillRect(px, sy(1), 1, x % 32 ? 4 : 8);
                if (!(x % 64)) ctx.fillText(String(x), px + 2, sy(1) + 18);
            }
            // frames before, faint
            // above 0 so many frames that come next, faint (worked out on a copy, nothing sent); −1 the frame before
            const onion = this.edit.playOnion | 0;
            if (onion < 0 && this.history.length) this.drawActor(this.history[this.history.length - 1], sx, sy, 0.35);
            const ahead = this.ahead(onion > 0 ? onion : 0);
            for (let k = ahead.length; k >= 1; --k) this.drawActor(ahead[k - 1], sx, sy, 0.35 / k);
            this.drawActor(v, sx, sy, 1);
        },
        // the next n frames of the actor as it goes on by itself: the runner is put back as it was
        ahead(n) {
            const r = this.runner;
            if (!r || n <= 0) return [];
            const saved = r.copy();
            let out = [];
            for (let k = 0; k < n && !r.state.holding; ++k) {
                r.stepFrame();
                out.push(r.copy());
            }
            r.restore(saved);
            return out;
        },
        drawActor(state, sx, sy, alpha) {
            const ctx = this.ctx;
            const z = this.zoom;
            const statement = state.frame;
            if (!statement) return;
            // the orientation of the actor: mirrored, then turned by quarters (rotate); what is of its axes turns with it
            const o = AnimRunner.orient(state.flip, state.turn || 0);
            const at = statement.at ? {
                x: Anim.constValue(statement.at.x, Anim.defineValues(this.animation)),
                y: Anim.constValue(statement.at.y, Anim.defineValues(this.animation))
            } : {
                x: 0,
                y: 0
            };
            const found = this.frameOf(statement);
            // a frame of the game's table stands so far forward and down of the actor
            if (found && found.dx) at.x += found.dx;
            if (found && found.dy) at.y += found.dy;
            const [ax, ay] = AnimRunner.apply(o, at.x, at.y);
            const bx = state.x + ax; // the base point of the picture in the world
            const by = state.y + ay;
            const dir = this.faceLeft ? -1 : 1;
            // where a step along x and y of a picture goes on the screen, whole pixels: its forward (to the left when
            // the pictures look left) and down, turned as the actor, the screen mirrored when forward is to the left
            const screen = (u, v) => {
                const [wx, wy] = AnimRunner.apply(o, this.faceLeft ? -u : u, v);
                return [dir * wx, wy];
            };
            const s1 = screen(1, 0),
                s2 = screen(0, 1);
            const picture = found ? FrameImages.get(found.setName, found.frame.image) : null;
            ctx.globalAlpha = alpha;
            // the column of the base point on the screen, its left edge. A picture is drawn around it as the actor lies
            const colX = Math.round(sx(bx) - (dir < 0 ? z : 0));
            const rowY = Math.round(sy(by));
            // what the actor carries (carry), as the engine holds it: the point of the child of the same name, or its
            // base point, stands at the point of the carrier; turned with it; behind the body when the point's z < 0
            const drawFound = (f, col, row) => {
                const pic = FrameImages.get(f.setName, f.frame.image);
                if (pic) Scene.drawOriented(ctx, pic.canvas, f.frame.origin, col, row, z, s1, s2);
            };
            const pointOf = (frame, name) => {
                const ps = frame.points || {};
                if (name in ps) return ps[name];
                const k = Object.keys(ps).find(n => Anim.packName('', n) === Anim.packName('', name));
                return k ? ps[k] : null;
            };
            let held = [];
            for (const c of found ? state.carried || [] : []) {
                const p = pointOf(found.frame, c.point);
                const child = this.frameOf(c.picture);
                if (!p || !child) continue;
                const a = pointOf(child.frame, c.point) || {
                    x: 0,
                    y: 0
                };
                const dx = p.x - a.x,
                    dy = p.y - a.y;
                held.push({
                    child: child,
                    col: colX + (dx * s1[0] + dy * s2[0]) * z,
                    row: rowY + (dx * s1[1] + dy * s2[1]) * z,
                    behind: (p.z || 1) < 0
                });
            }
            for (const h of held)
                if (h.behind) drawFound(h.child, h.col, h.row);
            if (picture) {
                Scene.drawOriented(ctx, picture.canvas, found.frame.origin, colX, rowY, z, s1, s2);
                if (this.edit.playMasks && alpha === 1) this.drawMasks(found.frame, state, colX, rowY, s1, s2);
                for (const h of held)
                    if (!h.behind) drawFound(h.child, h.col, h.row);
            } else {
                // a picture the editor has not: the game draws it
                const label = statement.number !== undefined ? '#' + statement.number : statement.name || statement.image;
                ctx.strokeStyle = '#a0a0a0';
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(colX - 6 * z + 0.5, rowY - 30 * z + 0.5, 13 * z, 31 * z);
                ctx.setLineDash([]);
                ctx.fillStyle = '#606060';
                ctx.font = '12px sans-serif';
                ctx.fillText(label, colX - 6 * z + 3, rowY - 30 * z + 14);
            }
            // the base point
            ctx.fillStyle = 'rgba(0, 90, 255, 0.8)';
            ctx.fillRect(Math.round(sx(state.x) - (dir < 0 ? z : 0)), Math.round(sy(state.y)), z, z);
            ctx.globalAlpha = 1;
        },
        // masks of the frame; with a masks statement before, only those that are active; s1, s2: where a step along x
        // and y of the picture goes on the screen
        drawMasks(frame, state, colX, rowY, s1, s2) {
            const ctx = this.ctx;
            const z = this.zoom;
            for (const m of this.spritesStore.sprites.masks) {
                if (!(m.index in frame.masks)) continue;
                if (state.masks && !state.masks.includes(m.index)) continue;
                ctx.fillStyle = m.color;
                ctx.globalAlpha = 0.45;
                Mask.forEach(frame.masks[m.index], (x, y) => ctx.fillRect(colX + (x * s1[0] + y * s2[0]) * z, rowY + (x * s1[1] + y * s2[1]) * z, z, z));
            }
            ctx.globalAlpha = 1;
        },
    },
    template: `
        <div class="anim-player">
            <div class="view-toolbar">
                <label>{{T('From', 'Начать с')}}
                    <select v-model="startScript">
                        <option v-for="s in animation.scripts" :value="s.name">{{s.name}}</option>
                    </select>
                </label>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" @click="restart" :title="T('From the start of the script', 'С начала скрипта')">⏮</button>
                    <button class="btn btn-outline-primary" @click="stepBack" :title="T('A frame back', 'Кадр назад')">◀</button>
                    <button class="btn" :class="playing ? 'btn-primary' : 'btn-outline-primary'" @click="toggle" :title="T('Space', 'Пробел')">{{playing ? '⏸' : '▶'}}</button>
                    <button class="btn btn-outline-primary" @click="stepForward" :title="T('A frame forward', 'Кадр вперёд')">▶|</button>
                </div>
                <label>{{T('Speed', 'Скорость')}}
                    <select v-model.number="edit.playSpeed">
                        <option v-for="s in [0.25, 0.5, 1, 2]" :value="s">×{{s}}</option>
                    </select>
                </label>
                <label>{{T('Zoom', 'Масштаб')}}
                    <select v-model.number="edit.playZoom">
                        <option v-for="z in [1, 2, 3, 4, 6]" :value="z">{{z}}</option>
                    </select>
                </label>
                <label :title="T('Frames shown faintly under the actor: 1…3 — so many that come next (as the actor goes on by itself, no event sent), −1 — the one before, 0 — none', 'Кадры бледно под персонажем: 1…3 — столько следующих (как персонаж пойдёт сам, без событий), −1 — прошлый, 0 — нет')">{{T('Onion', 'Луковица')}}
                    <select v-model.number="edit.playOnion">
                        <option v-for="n in [-1, 0, 1, 2, 3]" :value="n">{{n}}</option>
                    </select>
                </label>
                <label :title="T('The view goes with the actor', 'Вид движется за персонажем')"><input type="checkbox" v-model="edit.playFollow"> {{T('Follow', 'Следить')}}</label>
                <label :title="T('Pictures look to the left: forward is to the left', 'Картинки смотрят влево: вперёд — это влево')"><input type="checkbox" v-model="edit.playFaceLeft"> {{T('Look left', 'Смотрит влево')}}</label>
                <label :title="T('A frame given by a number N shows the frame N of the set, in its order', 'Кадр, заданный номером N, показывает N-й кадр набора по порядку')"><input type="checkbox" v-model="edit.playNumbers"> {{T('Numbers are frames', 'Номера — кадры')}}</label>
                <label :title="T('What the actor has in its pockets for the show: «DAGGER 3, SWORD 1»: kinds (animations of the package) and how many. count(KIND) reads it, draw takes a thing in hand (the picture: the first frame of its script 0), stow puts it back', 'Что у персонажа в карманах для показа: «DAGGER 3, SWORD 1» — виды (анимации пакета) и сколько. count(ВИД) читает это, draw берёт вещь в руку (картинка — первый кадр её скрипта 0), stow кладёт обратно')">pockets
                    <input v-model.lazy="edit.playPockets" size="14" placeholder="DAGGER 3" @change="rebuild"></label>
                <label v-if="animation.questions && animation.questions.length" :title="T('The game’s answers to the questions of the animation (game.name in expressions): «' + animation.questions.map(q => q + ' 0').join(', ') + '». Those not named: 0, as in the engine without the function', 'Ответы игры на вопросы анимации (game.имя в выражениях): «' + animation.questions.map(q => q + ' 0').join(', ') + '». Неназванные — 0, как в движке без функции')">game
                    <input v-model.lazy="edit.playAnswers" size="14" :placeholder="animation.questions[0] + ' 1'" @change="rebuild"></label>
                <label :title="T('amount: how many things are in the actor itself (a stack on the floor), for frames by expression', 'amount: сколько вещей в самом персонаже (стопка на полу), для кадров по выражению')">amount
                    <input v-model.lazy.number="edit.playAmount" class="num" size="3" @change="rebuild"></label>
                <label :title="T('Masks of the frame; after a masks statement only the active ones', 'Маски кадра; после команды masks — только действующие')"><input type="checkbox" v-model="edit.playMasks"> {{T('Masks', 'Маски')}}</label>
            </div>
            <div class="anim-player-body">
            <div class="anim-stage-box" ref="box"><canvas ref="canvas" class="anim-stage" width="480" height="260"></canvas></div>
            <div class="anim-player-side">
            <div v-if="view" class="anim-state">
                <div><b>{{view.script || '—'}}</b><span v-if="where && !where.startsWith(view.script + ',')"> · {{T('code of', 'код из')}} {{where}}</span><span v-else-if="where"> · {{where.slice(view.script.length + 2)}}</span>
                    <span v-if="view.holding" class="badge bg-secondary" :title="T('hold: the actor stays on this frame', 'hold: персонаж стоит на этом кадре')">{{T('holds', 'стоит')}}</span>
                    <span v-if="view.kept" class="badge bg-success" :title="T('keep: the world keeps the actor while it is in this script', 'keep: мир держит персонажа, пока он в этом скрипте')">{{T('kept', 'держится')}}</span>
                    <span v-if="view.counts && Object.keys(view.counts).length" class="badge bg-light text-dark" :title="T('In the pockets by kind: count(KIND) reads them, draw takes, stow puts', 'В карманах по видам: их читает count(ВИД), берёт draw, кладёт stow')">{{Object.entries(view.counts).map(([k, n]) => k + ' ' + n).join(' · ')}}</span>
                    <span v-if="view.pockets && view.pockets.length" class="badge bg-light text-dark" :title="T('In the pockets (stow): ', 'В карманах (stow): ') + view.pockets.map(p => Anim.statementText(p, set).replace(/^carry \\S+ /, '')).join(', ')">pockets {{view.pockets.length}}</span>
                    <span v-if="view.contact" class="badge bg-info text-dark" :title="T('contact on: in the game the engine looks for touches of the terrain; here there is no terrain', 'contact on: в игре движок ищет касания местности; здесь местности нет')">contact</span>
                    <button v-if="view.contact && view.contactEvent" class="btn btn-sm btn-outline-info anim-touch" @click="send(view.contactEvent)"
                        :title="T('Play a touch of the terrain: in the game at this moment the engine puts the actor at the place of the touch and sends it the event ' + view.contactEvent, 'Изобразить касание местности: в игре движок в этот момент ставит персонажа на место касания и посылает ему событие ' + view.contactEvent)">{{T('touch', 'касание')}} → {{view.contactEvent}}</button>
                    <span v-if="view.pending" class="badge bg-warning text-dark">{{T('waits:', 'ждёт:')}} {{view.pending.event}} → {{view.pending.to}} {{T('at', 'в')}} {{view.pending.when}}</span>
                </div>
                <div class="cursor-text">{{frameText}} · x {{view.x.toFixed(1)}}, y {{view.y.toFixed(1)}}<span v-if="view.flip"> · {{T('turned', 'повёрнут')}}</span><span v-if="view.turn" :title="T('rotate: turned clockwise by so many degrees, after the mirror', 'rotate: повёрнут по часовой на столько градусов, после отражения')"> · rotation {{view.turn * 90}}</span>
                    <span v-for="(v, name) in view.params"> · {{name}} {{v}}</span>
                    <span v-for="(v, name) in view.vars || {}" :title="T('A variable of the game (Game → Variables): the player keeps them from their values in the document, scripts change them (set, add game_var.)', 'Переменная игры (Игра → Переменные): проигрыватель держит их с начальных значений документа, скрипты меняют (set, add game_var.)')"> · game_var.{{name}} {{v}}</span>
                    <span v-if="view.music >= 0 || view.musicLevel !== undefined && view.musicLevel !== 100" :title="T('What scripts told the game of music: the one playing (music in expressions reads its number) and its level by design. The player plays no sound', 'Что скрипты сказали игре о музыке: какая играет (music в выражениях читает её номер) и её уровень по замыслу. Звука проигрыватель не играет')"> · music {{view.music >= 0 ? (runner && runner.musics[view.music] || view.music) : 'stop'}}<template v-if="view.musicLevel !== 100"> {{view.musicLevel}}%</template></span><span v-if="view.masks"> · masks {{view.masks.join(' ')}}</span>
                    <span v-for="c in view.carried || []" class="anim-hit" :title="T('Holds at the point ', 'Держит в точке ') + c.point"> · carry {{c.point}}: {{Anim.statementText(c.picture, set).replace(/^carry \\S+ /, '')}}</span>
                    <span v-if="view.released" class="anim-hit" :title="T('The last thing the actor let go (release): the picture and the speed, pixels a second, x to the right on the screen. From then on the game handles it', 'Последнее, что персонаж отпустил (release): картинка и скорость, пикселей в секунду, x — вправо на экране. Дальше им распоряжается игра')"> · {{T('released', 'отпущено')}} {{view.released.point}}: {{Anim.statementText(view.released.picture, set).replace(/^carry \\S+ /, '')}} {{T('at', 'со скоростью')}} {{Math.round(view.released.vx)}}, {{Math.round(view.released.vy)}}</span>
                    <span v-if="view.shot" class="anim-hit" :title="T('The last shot (shoot): from which point, the kind of the missile and the speed, pixels a second, x to the right on the screen. The game makes it fly', 'Последний выстрел (shoot): из какой точки, вид снаряда и скорость, пикселей в секунду, x — вправо на экране. Летит он силами игры')"> · {{T('shot', 'выстрел')}} {{view.shot.point}}: {{view.shot.kind}} {{T('at', 'со скоростью')}} {{Math.round(view.shot.vx)}}, {{Math.round(view.shot.vy)}}</span>
                    <span v-for="h in view.hits || []" class="anim-hit" :title="T('A hit: mask ' + h.mask + ' on masks ' + h.on.join(', ') + (h.event ? ', the event to the one met ' + h.event : '') + (h.recoil ? ', to itself ' + h.recoil : ''), 'Удар: маска ' + h.mask + ' по маскам ' + h.on.join(', ') + (h.event ? ', событие встреченному ' + h.event : '') + (h.recoil ? ', себе ' + h.recoil : ''))"> · hit {{h.mask}}→{{h.on.join(',')}}<template v-if="h.damage"> −{{h.damage}}</template></span>
                    <span v-if="view.vx || view.vy || view.ax || view.ay"> · v {{view.vx.toFixed(0)}},{{view.vy.toFixed(0)}} a {{view.ax}},{{view.ay}}</span></div>
                <div class="anim-log">{{view.log.join(' · ')}}</div>
            </div>
            <div v-if="animation.events.length" class="anim-events">
                <span class="anim-events-title">{{T('Events:', 'События:')}}</span>
                <button v-for="e in animation.events" class="btn btn-sm" :class="live[e] ? 'btn-outline-success' : 'btn-outline-secondary anim-dead'"
                    :title="live[e] ? T('to ', 'в ') + live[e].to + ' ' + live[e].when + (live[e].conflict ? T(', a conflict', ', конфликт') : '') : T('nothing in this state', 'в этом состоянии ничего')"
                    @click="send(e)">{{e}}</button>
            </div>
            <div v-else class="help-text anim-no-events">{{T('no events: Transitions → Rules, + event', 'событий нет: Переходы → Правила, + событие')}}</div>
            </div>
            </div>
        </div>
    `
};
