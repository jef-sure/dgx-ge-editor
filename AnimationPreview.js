// Frames of the set one after another, as a game shows them: every frame stands on its base point.
// Stopped, it shows the current frame, so the mirrored frame can be seen too
const AnimationPreview = {
    data() {
        return {
            shown: 0, // index of the frame shown while playing
        };
    },
    mounted() {
        this.ctx = this.$refs.canvas.getContext('2d');
        if (this.playing) this.start();
        this.draw();
    },
    unmounted() {
        this.stop();
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        set() {
            return this.spritesStore.currentSet;
        },
        playing() {
            return this.spritesStore.playing;
        },
        // frames played, indexes from 0; animTo 0 is the last frame
        range() {
            const n = this.set ? this.set.frames.length : 0;
            if (!n) return {
                from: 0,
                to: -1
            };
            const clamp = v => Math.min(Math.max(v | 0, 1), n);
            let from = clamp(this.edit.animFrom);
            let to = this.edit.animTo ? clamp(this.edit.animTo) : n;
            if (to < from)[from, to] = [to, from];
            return {
                from: from - 1,
                to: to - 1
            };
        },
        frameIndex() {
            return this.playing ? this.shown : this.edit.frameIndex;
        },
        frame() {
            return this.set ? this.set.frames[this.frameIndex] : undefined;
        },
        zoom() {
            return Math.max(1, this.edit.animZoom | 0);
        },
        // the canvas of the set, mirrored around the base column when the frames are
        area() {
            const c = this.set ? this.set.canvas : null;
            const a = c && c.width && c.height ? c : {
                left: -8,
                top: -15,
                width: 16,
                height: 16
            };
            return this.edit.animMirror ? Object.assign({}, a, {
                left: 1 - a.left - a.width
            }) : a;
        },
        label() {
            if (!this.frame) return '';
            return (this.frameIndex + 1) + ' / ' + this.set.frames.length + ': ' + this.frame.image;
        },
    },
    watch: {
        playing(p) {
            if (p) this.start();
            else this.stop();
            this.draw();
        },
        'edit.animFps'() {
            if (this.playing) this.start();
        },
        'spritesStore.sprites': {
            handler() {
                this.draw();
            },
            deep: true
        },
        'spritesStore.edit': {
            handler() {
                this.draw();
            },
            deep: true
        },
        'spritesStore.imagesVersion'() {
            this.draw();
        },
        shown() {
            this.draw();
        },
    },
    methods: {
        start() {
            this.stop();
            const r = this.range;
            // the animation starts from the current frame when it is in the range
            this.shown = this.edit.frameIndex >= r.from && this.edit.frameIndex <= r.to ? this.edit.frameIndex : r.from;
            this.timer = setInterval(() => this.step(), 1000 / Math.max(1, this.edit.animFps));
        },
        stop() {
            if (this.timer) clearInterval(this.timer);
            this.timer = 0;
        },
        step() {
            const r = this.range;
            if (r.to < 0) return;
            this.shown = this.shown >= r.to || this.shown < r.from ? r.from : this.shown + 1;
        },
        setFrom(event) {
            const v = parseInt(event.target.value);
            if (Number.isInteger(v)) this.edit.animFrom = v;
            event.target.value = this.range.from + 1;
        },
        setTo(event) {
            const v = parseInt(event.target.value);
            if (Number.isInteger(v)) this.edit.animTo = v;
            event.target.value = this.range.to + 1;
        },
        // screen x of the left edge of a column from the base point, as shown: mirrored, x goes to -x
        screenX(x) {
            return ((this.edit.animMirror ? -x : x) - this.area.left) * this.zoom;
        },
        screenY(y) {
            return (y - this.area.top) * this.zoom;
        },
        draw() {
            const canvas = this.$refs.canvas;
            if (!canvas) return;
            const z = this.zoom;
            const a = this.area;
            const width = a.width * z;
            const height = a.height * z;
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            const ctx = this.ctx;
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            // the floor is the lower edge of the base row, the mirror axis is the middle of the base column
            ctx.fillStyle = 'rgba(0, 90, 255, 0.5)';
            ctx.fillRect(0, this.screenY(1), width, 1);
            ctx.fillStyle = 'rgba(0, 90, 255, 0.2)';
            ctx.fillRect(this.screenX(0) + Math.floor(z / 2), 0, 1, height);
            const frame = this.frame;
            if (!frame) return;
            const picture = FrameImages.get(this.set.name, frame.image);
            if (picture) {
                ctx.save();
                if (this.edit.animMirror) {
                    // the right column of the picture comes to the left
                    ctx.translate(this.screenX(-frame.origin.x) + z, this.screenY(-frame.origin.y));
                    ctx.scale(-1, 1);
                } else {
                    ctx.translate(this.screenX(-frame.origin.x), this.screenY(-frame.origin.y));
                }
                ctx.drawImage(picture.canvas, 0, 0, picture.width * z, picture.height * z);
                ctx.restore();
            }
            if (this.edit.animMasks) {
                for (const m of this.spritesStore.sprites.masks) {
                    if (this.edit.hiddenMasks[m.index] || !(m.index in frame.masks)) continue;
                    ctx.fillStyle = m.color;
                    ctx.globalAlpha = 0.45;
                    Mask.forEach(frame.masks[m.index], (x, y) => ctx.fillRect(this.screenX(x), this.screenY(y), z, z));
                    ctx.globalAlpha = 1;
                }
            }
        },
    },
    template: `
        <div class="anim-preview">
            <div class="view-toolbar">
                <button class="btn btn-sm" :class="playing ? 'btn-primary' : 'btn-outline-primary'" @click="spritesStore.togglePlaying()"
                    :title="T('Play the frames of the set one after another, by the list (space). The real animations are the kind’s Scripts in the tree', 'Проиграть кадры набора подряд, по списку (пробел). Настоящие анимации — «Скрипты» вида в дереве')">{{playing ? T('■ Stop', '■ Стоп') : T('▶ Play', '▶ Пуск')}}</button>
                <label :title="T('Which frames to play: the numbers of the first and the last', 'Какие кадры проигрывать: номера первого и последнего')">{{T('Frames', 'Кадры')}}
                    <input class="coord" :value="range.from + 1" @change="setFrom">
                    <button class="btn btn-sm btn-outline-secondary" @click="edit.animFrom = edit.frameIndex + 1" :title="T('From the current frame', 'С текущего кадра')">⇤</button>
                    –
                    <input class="coord" :value="range.to + 1" @change="setTo">
                    <button class="btn btn-sm btn-outline-secondary" @click="edit.animTo = edit.frameIndex + 1" :title="T('To the current frame', 'До текущего кадра')">⇥</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="edit.animFrom = 1; edit.animTo = 0" :title="T('All frames of the set', 'Все кадры набора')">{{T('all', 'все')}}</button>
                </label>
                <label :title="T('Frames per second', 'Кадров в секунду')">{{T('FPS', 'Кадр/с')}}
                    <select v-model.number="edit.animFps">
                        <option v-for="f in [1, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30]" :value="f">{{f}}</option>
                    </select>
                </label>
                <label :title="T('The zoom of the view', 'Масштаб окна')">{{T('Zoom', 'Масштаб')}}
                    <select v-model.number="edit.animZoom">
                        <option v-for="z in [1, 2, 3, 4, 6, 8]" :value="z">{{z}}</option>
                    </select>
                </label>
                <label :title="T('Mirrored: as a character turned the other way (around the base column)', 'Зеркально — как персонаж, развернувшийся в другую сторону (вокруг базовой колонки)')"><input type="checkbox" v-model="edit.animMirror"> {{T('Mirror', 'Зеркально')}}</label>
                <label :title="T('Show the masks over the frames', 'Показать маски поверх кадров')"><input type="checkbox" v-model="edit.animMasks"> {{T('Masks', 'Маски')}}</label>
            </div>
            <canvas class="anim-canvas" ref="canvas"></canvas>
            <div class="cursor-text">{{label}}&nbsp;</div>
        </div>
    `
};
