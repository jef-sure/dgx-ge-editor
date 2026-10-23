// The mode of frames on the workbench: the tools at the top, the canvas of the frame in the middle (FrameCanvas),
// the properties of the kind and the frame on the right, the frames of the kind in a strip below with the preview of
// them one after another, and the line of state. The pages Masks and Palettes show the same canvas with other
// properties: all the masks and the meets, the palettes
const FrameUi = Vue.reactive({
    cursorText: '', // what the canvas says about the pixel under the mouse
});

// what the frames mode shares: the store, the set, the frame, the tool hint
const FramesBase = {
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        Tools() {
            return Tools;
        },
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        set() {
            return this.spritesStore.currentSet;
        },
        frame() {
            return this.spritesStore.currentFrame;
        },
        selection() {
            return this.spritesStore.selection;
        },
        hasPicture() {
            this.spritesStore.imagesVersion;
            return this.frame ? !!FrameImages.get(this.set.name, this.frame.image) : false;
        },
        // the picture of the current frame, for its palette
        picture() {
            this.spritesStore.imagesVersion;
            return this.frame ? FrameImages.get(this.set.name, this.frame.image) || null : null;
        },
    },
    methods: {
        hex(rgb) {
            return '#' + rgb.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
        },
        rgbOf(hex) {
            return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        },
        maskState(index) {
            if (!this.frame) return '';
            // a frame without masks has the default one
            if (!Object.keys(this.frame.masks).length && this.set.defaultMask === index) return 'default';
            if (!(index in this.frame.masks)) return 'none';
            return Mask.count(this.frame.masks[index]) + ' px';
        },
        maskStateHint(index) {
            const t = this.maskState(index);
            if (t === 'default') return T('The frame has no masks drawn: the default mask holds, all opaque pixels',
                'В кадре нет нарисованных масок: действует маска по умолчанию — все непрозрачные пиксели');
            if (t === 'none') return T('This mask is not in the frame', 'Этой маски в кадре нет');
            return T('The mask is drawn: this many pixels', 'Маска нарисована: столько пикселей');
        },
    },
};

const FramesToolbar = {
    mixins: [FramesBase],
    data() {
        return {
            zooms: [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24],
        };
    },
    mounted() {
        window.addEventListener('keydown', this.onkeydown);
    },
    unmounted() {
        window.removeEventListener('keydown', this.onkeydown);
    },
    methods: {
        zoomBy(d) {
            const i = this.zooms.indexOf(this.edit.zoom);
            const j = Math.max(0, Math.min(this.zooms.length - 1, (i < 0 ? 5 : i) + d));
            this.edit.zoom = this.zooms[j];
        },
        // the whole canvas of the kind in the view
        fit() {
            const box = document.querySelector('.bench-main');
            const c = this.set && this.set.canvas;
            if (!box || !c || !c.width) return;
            const z = Math.min((box.clientWidth - 24) / c.width, (box.clientHeight - 24) / c.height);
            this.edit.zoom = [...this.zooms].reverse().find(v => v <= z) || 1;
        },
        // keys work when no input has the focus; the shell takes undo and redo
        onkeydown(event) {
            const t = event.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            const store = this.spritesStore;
            const arrows = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1]
            };
            if (event.key in arrows) {
                const [dx, dy] = arrows[event.key];
                // points move with the arrows when they are edited, the selected area with the Move tool,
                // otherwise the base point moves on the picture
                if (this.edit.tool === 'move') {
                    if (store.selection) store.moveSelection(dx, dy);
                } else if (this.edit.tool === 'point' && this.frame && this.edit.pointName in this.frame.points)
                    store.movePoint(this.edit.pointName, dx, dy);
                else
                    store.moveOrigin(dx, dy);
                event.preventDefault();
                return;
            }
            // a button with the focus presses itself by the space
            if (event.key === ' ' && t.tagName !== 'BUTTON') {
                store.togglePlaying();
                event.preventDefault();
                return;
            }
            if (event.key === 'Escape' && store.selection) {
                store.dropSelection();
                event.preventDefault();
                return;
            }
            if (event.key === 'PageUp' || event.key === ',') {
                store.selectFrame(this.edit.frameIndex - 1);
                event.preventDefault();
                return;
            }
            if (event.key === 'PageDown' || event.key === '.') {
                store.selectFrame(this.edit.frameIndex + 1);
                event.preventDefault();
                return;
            }
            const key = event.key.toLowerCase();
            // F is the Fill tool here; 0 fits the canvas into the view
            if (key === '0') {
                this.fit();
                return;
            }
            if (key === '+' || key === '=') {
                this.zoomBy(1);
                return;
            }
            if (key === '-') {
                this.zoomBy(-1);
                return;
            }
            for (const tool in Tools) {
                if (key === Tools[tool].key) {
                    store.setTool(tool);
                    event.preventDefault();
                    return;
                }
            }
        },
    },
    template: `
        <div class="mode-toolbar">
            <div class="btn-group btn-group-sm">
                <button v-for="(tool, tk) in Tools" class="btn" :class="edit.tool === tk ? 'btn-primary' : 'btn-outline-primary'"
                    @click="spritesStore.setTool(tk)" :title="tool.hint + T(' (key ', ' (клавиша ') + tool.key.toUpperCase() + ')'">{{tool.name}}</button>
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" @click="zoomBy(-1)" :title="T('Smaller (−, the wheel over the canvas)', 'Мельче (−, колёсико над холстом)')">−</button>
                <select class="btn btn-outline-secondary bench-zoom" v-model.number="edit.zoom" :title="T('Zoom: how many screen dots in one pixel of the frame', 'Масштаб: сколько точек экрана в одном пикселе кадра')">
                    <option v-for="z in zooms" :value="z">{{z}}×</option>
                </select>
                <button class="btn btn-outline-secondary" @click="zoomBy(1)" :title="T('Larger (+, the wheel over the canvas)', 'Крупнее (+, колёсико над холстом)')">+</button>
                <button class="btn btn-outline-secondary" @click="fit" :title="T('The whole canvas of the kind in the view (key 0)', 'Весь холст вида в окне (клавиша 0)')">{{T('Fit', 'Вписать')}}</button>
            </div>
            <span class="bench-ghosts" :title="T('Pale neighbour frames under the current one, matched by the base point (“onion skin”): you see how the character shifts from frame to frame. The previous are reddish, the next bluish', 'Бледные соседние кадры под текущим, совмещённые по базовой точке («луковая кожура»): видно, как персонаж сдвигается от кадра к кадру. Предыдущие — красноватые, следующие — синеватые')">{{T('Show', 'Показать')}}
                <label :title="T('Show the frames before the current one, pale and reddish', 'Показать бледно, красноватым, кадры перед текущим')"><input type="checkbox" v-model="edit.onionPrev" :disabled="edit.allFrames"> {{T('previous', 'предыдущие')}}</label>
                <label :title="T('Show the frames after the current one, pale and bluish', 'Показать бледно, синеватым, кадры после текущего')"><input type="checkbox" v-model="edit.onionNext" :disabled="edit.allFrames"> {{T('next', 'следующие')}}</label>
                <select v-model.number="edit.onion" :disabled="edit.allFrames || !(edit.onionPrev || edit.onionNext)" :title="T('How many neighbour frames on each side chosen: the far ones are paler', 'Сколько соседних кадров с каждой выбранной стороны: дальние бледнее')">
                    <option v-for="n in [1, 2, 3]" :value="n">{{n}}</option>
                </select> {{T('frames', edit.onion === 1 ? 'кадр' : 'кадра')}}</span>
            <label :title="T('Show all the frames of the kind pale under the current one: if the base points are right, the feet of all frames match', 'Показать под текущим бледно все кадры вида: если базовые точки поставлены верно, ноги всех кадров совпадают')">
                <input type="checkbox" v-model="edit.allFrames"> {{T('All frames', 'Все кадры')}}</label>
            <label :title="T('Show the picture of the frame', 'Показывать картинку кадра')"><input type="checkbox" v-model="edit.showImage"> {{T('Picture', 'Картинка')}}</label>
            <label :title="T('Show the collision masks', 'Показывать маски столкновений')"><input type="checkbox" v-model="edit.showMasks"> {{T('Masks', 'Маски')}}</label>
            <label :title="T('Show the attachment points', 'Показывать точки привязки')"><input type="checkbox" v-model="edit.showPoints"> {{T('Points', 'Точки')}}</label>
        </div>
    `
};

// the properties on the right: of the kind and the frame (page frames), of all the masks and the meets (page masks),
// of the palettes (page palettes)
const FramesProps = {
    mixins: [FramesBase],
    data() {
        return {
            MaskLimit: MaskLimit,
            Anim: Anim,
            Meets: Meets,
            newPointName: '',
            newWidth: 32,
            newHeight: 32,
            paletteAll: false,
        };
    },
    computed: {
        page() {
            return this.edit.page;
        },
        Game() {
            return Game;
        },
        // which masks meet, read from the text as the packer reads it
        meets() {
            return Meets.parse(this.sprites.meets, this.sprites.masks);
        },
        meetsText() {
            return typeof this.sprites.meets === 'string' ? this.sprites.meets : null;
        },
        originX: {
            get() {
                return this.frame ? this.frame.origin.x : '';
            },
            set(x) {
                if (this.frame) this.spritesStore.setOrigin(x, this.frame.origin.y);
            },
        },
        originY: {
            get() {
                return this.frame ? this.frame.origin.y : '';
            },
            set(y) {
                if (this.frame) this.spritesStore.setOrigin(this.frame.origin.x, y);
            },
        },
        missingCount() {
            return this.spritesStore.framesWithoutImages.length;
        },
        changedFrames() {
            return this.spritesStore.framesWithChangedImages;
        },
        pictureChanged() {
            return this.changedFrames.includes(this.frame);
        },
        // names of points of all frames of the set, a new point usually is one of them
        knownPointNames() {
            let names = new Set();
            if (this.set) {
                for (const f of this.set.frames) {
                    for (const n in f.points) names.add(n);
                }
            }
            return [...names].sort(compareNames);
        },
    },
    methods: {
        loadImages(event) {
            const files = [...event.target.files];
            event.target.value = '';
            if (files.length) this.spritesStore.loadImages(files);
        },
        renameSet(event) {
            if (!this.spritesStore.renameSet(event.target.value)) event.target.value = this.set.name;
        },
        removeSet() {
            if (confirm(T('Remove kind ' + this.set.name + ' with all its frames and animations?',
                    'Удалить вид ' + this.set.name + ' со всеми его кадрами и анимациями?'))) this.spritesStore.removeSet();
        },
        setCanvasValue(key, event) {
            let c = Object.assign({}, this.set.canvas);
            c[key] = parseInt(event.target.value);
            if (!Number.isInteger(c[key])) c[key] = this.set.canvas[key];
            this.spritesStore.setCanvas(c);
            event.target.value = this.set.canvas[key];
        },
        removeFrame() {
            if (confirm(T('Remove frame ' + this.frame.image + ' with its masks and points?',
                    'Удалить кадр ' + this.frame.image + ' с его масками и точками?'))) this.spritesStore.removeFrame();
        },
        setFramePackName(event) {
            const name = event.target.value.trim();
            if (name) this.frame.packName = name;
            else delete this.frame.packName;
        },
        async downloadPicture(frame) {
            const picture = FrameImages.get(this.set.name, frame.image);
            if (!picture) return;
            const url = URL.createObjectURL(new Blob([await PngIndexed.encode(picture)], {
                type: 'image/png'
            }));
            const a = document.createElement('a');
            a.href = url;
            a.download = frame.image;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        },
        // the browser may ask once whether the page may download several files
        async downloadChangedPictures() {
            for (const frame of [...this.changedFrames]) {
                await this.downloadPicture(frame);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        },
        // a colour to draw with: the pencil takes it, unless the fill is the tool
        pickSwatch(i) {
            this.edit.colorIndex = i;
            if (this.edit.tool !== 'pencil' && this.edit.tool !== 'fill') this.spritesStore.setTool('pencil');
        },
        newFrame() {
            const w = parseInt(this.newWidth, 10),
                h = parseInt(this.newHeight, 10);
            if (!(w >= 1 && h >= 1 && w <= 1024 && h <= 1024)) return;
            this.spritesStore.newFrame(w, h);
            this.spritesStore.setTool('pencil');
        },
        // a palette renamed: the colors of pieces and the previews that name it follow it
        renamePalette(p, event) {
            const name = event.target.value.trim();
            if (!name || this.sprites.palettes.some(x => x !== p && x.name === name) || this.sprites.sets.some(s => s.name === name)) {
                event.target.value = p.name;
                return;
            }
            for (const t of this.sprites.tilesets)
                for (const tile of t.tiles)
                    for (const piece of tile.pieces)
                        if (Array.isArray(piece.color) && piece.color[0] === p.name) piece.color[0] = name;
            for (const s in this.edit.previewPalette)
                if (this.edit.previewPalette[s] === p.name) this.edit.previewPalette[s] = name;
            p.name = name;
        },
        // the sets previewed in a palette shown again in its new colors
        refreshPreview(p) {
            for (const s in this.edit.previewPalette)
                if (this.edit.previewPalette[s] === p.name) this.spritesStore.applyPreviewPalette(s);
        },
        freeMaskIndexes(own) {
            let indexes = [];
            for (let i = 0; i < MaskLimit; ++i) {
                if (i === own || !this.spritesStore.maskDefinition(i)) indexes.push(i);
            }
            return indexes;
        },
        changeMaskIndex(oldIndex, event) {
            this.spritesStore.changeMaskIndex(oldIndex, parseInt(event.target.value));
        },
        maskWord(index) {
            return Meets.word(index, this.sprites.masks);
        },
        meetHint(kind, a, b) {
            const pair = kind + ' ' + this.maskWord(a) + ' ' + this.maskWord(b);
            const who = kind === 'own' ?
                T('bodies of one side (a sword in the hand and its bearer, a thrown stone and the thrower)',
                    'тел одной стороны (меч в руке и его носитель, брошенный камень и бросивший)') :
                T('bodies of different sides (enemies)', 'тел разных сторон (враги)');
            return pair + T(': whether masks ' + a + ' and ' + b + ' of ' + who + ' meet. The checkbox writes or removes a line in the text below',
                    ': встречаются ли маски ' + a + ' и ' + b + ' у ' + who + '. Флажок пишет или убирает строку в тексте ниже') +
                (this.meetsText === null ? T('. The engine defaults hold now; the first click writes them as text',
                    '. Сейчас действуют умолчания движка; первый щелчок запишет их текстом') : '');
        },
        useMeetsDefaults() {
            if (!this.meetsText || confirm(T('Remove the meets text? The engine defaults will hold: own nothing, foreign every pair',
                    'Убрать текст meets? Будут действовать умолчания движка: own — ничего, foreign — каждая пара'))) this.spritesStore.setMeets(null);
        },
        removeMask(m) {
            if (confirm(T('Remove mask ' + m.index + ' (' + m.name + ') from all frames of all kinds?',
                    'Удалить маску ' + m.index + ' (' + m.name + ') из всех кадров всех видов?'))) this.spritesStore.removeMask(m.index);
        },
        addPoint() {
            this.spritesStore.addPoint(this.newPointName);
            this.newPointName = '';
            this.spritesStore.setTool('point');
        },
        renamePoint(oldName, event) {
            if (!this.spritesStore.renamePoint(oldName, event.target.value)) event.target.value = oldName;
        },
        setPointValue(name, key, event) {
            const p = this.frame.points[name];
            const v = parseInt(event.target.value);
            if (Number.isInteger(v)) this.spritesStore.setPoint(name, key === 'x' ? v : p.x, key === 'y' ? v : p.y);
            event.target.value = p[key];
        },
    },
    template: `
        <div class="frames-props">
            <div v-if="!set" class="help-text">{{T('No kinds: press “+” in the Kinds tree.', 'Видов нет: в дереве Виды нажмите «+».')}}</div>

            <template v-if="set && page === 'frames'">
                <h6 :title="T('Kind: a character, a thing or rules with its own animation; a kind may have pictures', 'Вид: персонаж, предмет или правила со своей анимацией; у вида бывают картинки')">{{T('Kind', 'Вид')}}</h6>
                <div class="prop">{{T('name', 'имя')}} <input :value="set.name" @change="renameSet" :title="T('The name of the kind. With the file name it makes the name of the picture in the engine: KID_401', 'Имя вида. Из него и имени файла складывается имя картинки в движке: KID_401')">
                    <button class="btn btn-sm btn-remove" @click="removeSet" :disabled="sprites.sets.length < 2" :title="T('Remove the kind with all its frames and animations', 'Удалить вид со всеми кадрами и анимациями')">×</button></div>
                <div class="prop">
                    <input type="file" multiple accept=".png,image/png" @change="loadImages" style="display: none" ref="images"/>
                    <button @click="$refs.images.click()" class="btn btn-sm btn-primary"
                        :title="T('Load frames: indexed PNG, many at once. Files with names already known give pictures to the marked-up frames', 'Загрузить кадры: индексированные PNG, можно выбрать сразу много. Файлы с уже известными именами дают картинки размеченным кадрам')">{{T('Load PNG frames…', 'Загрузить PNG-кадры…')}}</button>
                    <span class="help-text">{{T(set.frames.length + ' frames', 'кадров: ' + set.frames.length)}}</span>
                </div>
                <div v-if="missingCount" class="error-text" :title="T('The markup is here, the pictures are not: after reloading the page or opening JSON load the PNG again', 'Разметка есть, а картинок нет: после перезагрузки страницы или открытия JSON загрузите PNG снова')">{{T(missingCount + ' frames have no pictures: load them', 'кадров без картинок: ' + missingCount + ', загрузите их')}}</div>
                <div v-if="changedFrames.length" class="prop">
                    <span class="error-text" :title="T('Pictures changed by the pencil or a move. They are kept in the browser until files with the same pixels are loaded', 'Картинки, изменённые карандашом или сдвигом. Они хранятся в браузере, пока не будут загружены файлы с теми же пикселями')">{{T('changed pictures not saved', 'изменённые картинки не сохранены')}}: {{changedFrames.length}}</span>
                    <button @click="downloadChangedPictures" class="btn btn-sm btn-outline-secondary" :title="T('Download the changed pictures; put them over the old files', 'Скачать изменённые картинки; положите их поверх старых файлов')">{{T('Download changed PNG', 'Скачать изменённые PNG')}}</button>
                </div>
                <div v-if="spritesStore.loadMessages.length">
                    <div v-for="m in spritesStore.loadMessages" class="error-text">{{m}}</div>
                    <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.clearLoadMessages()">x</button>
                </div>
                <div class="prop" :title="T('Which mask a frame with no mask drawn counts as: all its opaque pixels', 'Какой маской считать кадр, в котором не нарисовано ни одной маски: все его непрозрачные пиксели')">{{T('default mask', 'маска по умолчанию')}}
                    <select :value="set.defaultMask === null ? '' : set.defaultMask" @change="spritesStore.setDefaultMask($event.target.value === '' ? null : parseInt($event.target.value))"
                        :title="T('A frame with no masks drawn collides by all its opaque pixels under this mask. “none”: such a frame collides with nothing (scenery)', 'Кадр без нарисованных масок сталкивается всеми непрозрачными пикселями под этой маской. «none» — такой кадр ни с чем не сталкивается (декорации)')">
                        <option value="">{{T('none: collides with nothing', 'none: ни с чем не сталкивается')}}</option>
                        <option v-for="m in sprites.masks" :value="m.index">{{m.index}}: {{m.name}}</option>
                    </select>
                </div>
                <div class="prop" :title="T('Show the pictures of the kind in the colors of a palette of the file (preview only: the color numbers stay, the pictures do not change): a guard in the colors of the level', 'Показать картинки вида в цветах палитры файла (только просмотр: номера цветов те же, сами картинки не меняются) — стражник в цветах уровня')">{{T('preview in', 'смотреть в')}}
                    <select :value="edit.previewPalette[set.name] || ''" @change="spritesStore.setPreviewPalette(set.name, $event.target.value)">
                        <option value="">{{T('its own colors', 'своих цветах')}}</option><option v-for="p in sprites.palettes" :value="p.name">{{p.name}}</option>
                        <option v-if="set.palette !== undefined" value="@pack" :title="T('Every color of the pictures as its nearest of the palette (CIE76), as the packer takes it', 'Каждый цвет картинок — ближайший цвет палитры (CIE76), как берёт упаковщик')">{{T('the pack: ', 'пакета: ')}}{{set.palette}}</option></select>
                </div>
                <div class="prop" :title="T('A ready palette of the set in the pack (palette, DGX-GE 0.4.0): the packer brings every color of its pictures to the palette’s nearest (CIE76, as the eye sees it) and the set gets the colors taken, in the palette’s order — the frames need not share their values. nes, gameboy, pico8 — the engine’s; or a palette of the file. None: the colors of the pictures as they are', 'Готовая палитра набора в пакете (palette, DGX-GE 0.4.0): упаковщик приводит каждый цвет картинок к ближайшему цвету палитры (CIE76, как видит глаз), и набор получает взятые цвета в порядке палитры — кадрам не обязательно делить номера цветов. nes, gameboy, pico8 — палитры движка; или палитра файла. Нет — цвета картинок как есть')">{{T('palette in the pack', 'палитра в пакете')}}
                    <select :value="set.palette === undefined ? '' : set.palette" @change="$event.target.value ? set.palette = $event.target.value : delete set.palette">
                        <option value="">{{T('none: the pictures’ colors', 'нет: цвета картинок')}}</option><option v-for="n in Game.palettes" :value="n">{{n}}</option>
                        <option v-for="p in sprites.palettes" :value="p.name">{{p.name}}</option>
                        <option v-if="set.palette !== undefined && !Game.palettes.includes(set.palette) && !sprites.palettes.some(p => p.name === set.palette)" :value="set.palette">{{set.palette}} ✖</option></select>
                </div>
                <label class="prop" :title="T('The pictures of the kind look left (as in PoP): “forward” is left. The player shows them so', 'Картинки вида смотрят влево (как в PoP): «вперёд» — влево. Проигрыватель показывает их так')"><input type="checkbox" :checked="!!set.facesLeft" @change="$event.target.checked ? set.facesLeft = true : delete set.facesLeft"> {{T('faces left', 'смотрит влево')}}</label>
                <div class="prop prop-row" :title="T('The canvas is the common rectangle of the kind (the grid in the middle): all frames stand on it by their base points in one place. Masks are drawn only inside it', 'Холст — общий прямоугольник вида (сетка в середине): все кадры стоят на нём базовыми точками в одном месте. Маски рисуются только внутри него')">{{T('canvas', 'холст')}}
                    <input class="num" :value="set.canvas.left" @change="setCanvasValue('left', $event)" :title="T('The left edge of the canvas from the base point, pixels (usually below zero)', 'Левый край холста от базовой точки, пикселей (обычно меньше нуля)')">
                    <input class="num" :value="set.canvas.top" @change="setCanvasValue('top', $event)" :title="T('The top edge of the canvas from the base point (usually below zero)', 'Верхний край холста от базовой точки (обычно меньше нуля)')">
                    <input class="num" :value="set.canvas.width" @change="setCanvasValue('width', $event)" :title="T('The width of the canvas; it does not get less than the frames need', 'Ширина холста; меньше, чем нужно кадрам, не станет')">
                    <input class="num" :value="set.canvas.height" @change="setCanvasValue('height', $event)" :title="T('The height of the canvas', 'Высота холста')">
                    <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.fitCanvas()" :title="T('Make the canvas just as the frames need (by itself it only grows)', 'Сделать холст ровно таким, как нужно кадрам (сам он только растёт)')">{{T('Fit', 'Вписать')}}</button>
                </div>
                <div class="prop" :title="T('A new frame: an empty transparent picture of this size, the palette as the current one has (or a simple one). Draw it with the pencil, then Download PNG', 'Новый кадр: пустая прозрачная картинка этого размера, палитра — как у текущей (или простая). Рисуйте её карандашом, потом «Скачать PNG»')">{{T('new frame', 'новый кадр')}}
                    <input class="num" v-model.number="newWidth" :title="T('Width, dots', 'Ширина, точек')"> × <input class="num" v-model.number="newHeight" :title="T('Height, dots', 'Высота, точек')">
                    <button class="btn btn-sm btn-outline-secondary" @click="newFrame">{{T('+ frame', '+ кадр')}}</button></div>

                <template v-if="frame">
                    <h6 :title="T('The current frame', 'Текущий кадр')">{{T('Frame', 'Кадр')}}</h6>
                    <div class="prop">
                        <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.selectFrame(edit.frameIndex - 1)" :title="T('The previous frame (PageUp or ,)', 'Предыдущий кадр (PageUp или ,)')">&lt;</button>
                        <span>{{edit.frameIndex + 1}} / {{set.frames.length}}: <b>{{frame.image}}</b> {{frame.width}}×{{frame.height}}</span>
                        <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.selectFrame(edit.frameIndex + 1)" :title="T('The next frame (PageDown or .)', 'Следующий кадр (PageDown или .)')">&gt;</button>
                        <button class="btn btn-sm btn-remove" @click="removeFrame" :title="T('Remove the frame from the markup (the PNG file is not touched)', 'Убрать кадр из разметки (файл PNG не трогается)')">×</button>
                    </div>
                    <div class="prop prop-row" :title="T('The base point is the pixel by which the sprite stands on the floor. Here: in pixels of the picture from its top left corner', 'Базовая точка — пиксель, которым спрайт ставится на пол. Здесь — в пикселях картинки от её левого верхнего угла')">{{T('base point', 'базовая точка')}}
                        x <input class="num" v-model.number.lazy="originX" :title="T('The column of the base point in the picture, from the left edge', 'Столбец базовой точки в картинке, от левого края')">
                        y <input class="num" v-model.number.lazy="originY" :title="T('The row of the base point in the picture, from the top edge', 'Строка базовой точки в картинке, от верхнего края')">
                    </div>
                    <div class="prop" :title="T('The name of the picture in the pack: animations and tiles call it by it, the constant IMG_NAME in the header', 'Имя картинки в пакете: по нему её называют анимации и плитки, константа IMG_ИМЯ в заголовке')">{{T('pack name', 'имя в пакете')}}
                        <input :value="frame.packName || ''" :placeholder="Anim.packName(set.name, frame.image)" @change="setFramePackName"
                            :title="T('An own name of the picture in the pack (DAGGER). Empty: KIND_FILE, as usual. Letters and digits, the rest becomes “_”, in capitals', 'Своё имя картинки в пакете (DAGGER). Пусто — ВИД_ФАЙЛ, как обычно. Буквы и цифры, остальное станет «_», заглавными')">
                    </div>
                    <div v-if="frame.packName" class="help-text">{{Anim.nameOf(frame.packName)}}</div>
                    <div v-if="pictureChanged" class="prop" :title="T('The picture of this frame is changed', 'Картинка этого кадра изменена')">{{T('picture', 'картинка')}} <span class="error-text">{{T('changed', 'изменена')}}</span>
                        <button @click="downloadPicture(frame)" class="btn btn-sm btn-outline-secondary" :title="T('Download the changed picture of the frame', 'Скачать изменённую картинку кадра')">{{T('Download PNG', 'Скачать PNG')}}</button>
                    </div>
                    <div v-if="selection" class="prop" :title="T('The area selected by the Move tool', 'Область, выделенная инструментом «Сдвиг»')">
                        <span>{{T('selection', 'выделено')}} {{selection.width}}×{{selection.height}} {{T('at', 'в')}} {{selection.left + selection.dx}}, {{selection.top + selection.dy}}, {{T('moved by', 'сдвиг на')}} {{selection.dx}}, {{selection.dy}}</span>
                        <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.dropSelection()" :title="T('Finish the move (Esc)', 'Закончить сдвиг (Esc)')">{{T('Drop', 'Отпустить')}}</button>
                    </div>

                    <h6 v-if="picture" :title="T('The palette of the picture of the frame: the pencil and the fill draw with its colors. 0 is transparent', 'Палитра картинки кадра: ими рисуют карандаш и заливка. 0 — прозрачный')">{{T('Palette', 'Палитра')}} <span class="help-text">{{T(picture.palette.length + ' colors · ' + picture.bitDepth + ' bits', 'цветов: ' + picture.palette.length + ' · бит: ' + picture.bitDepth)}}</span></h6>
                    <template v-if="picture">
                        <div class="palette-swatches">
                            <span v-for="(c, i) in picture.palette" class="palette-swatch" :class="{current: i === edit.colorIndex, transparent: !i}"
                                :style="i ? {background: hex(c)} : {}" @click="pickSwatch(i)"
                                :title="i ? T('Color ' + i + ': ' + hex(c) + '. Click: draw with it', 'Цвет ' + i + ': ' + hex(c) + '. Щелчок — рисовать им') : T('Color 0: transparent', 'Цвет 0: прозрачный')">{{i}}</span>
                        </div>
                        <div v-if="edit.colorIndex > 0 && edit.colorIndex < picture.palette.length" class="palette-edit">
                            {{T('color', 'цвет')}} {{edit.colorIndex}} <input type="color" :value="hex(picture.palette[edit.colorIndex])" @change="spritesStore.setPaletteColor(edit.colorIndex, rgbOf($event.target.value), paletteAll)"
                                :title="T('Change this color of the palette: all pixels of this color change their look', 'Изменить этот цвет палитры: меняется вид всех пикселей этого цвета')">
                            <label :title="T('Change this color in all pictures of the kind, not only in this frame', 'Изменить этот цвет у всех картинок вида, а не только у этого кадра')"><input type="checkbox" v-model="paletteAll"> {{T('in all frames', 'во всех кадрах')}}</label>
                        </div>
                        <div class="prop-buttons">
                            <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.addPaletteColor([128, 128, 128])" :disabled="picture.palette.length >= 256"
                                :title="T('Add a color to the palette of this picture (up to 256; the depth of the picture grows by itself)', 'Добавить цвет в палитру этой картинки (до 256; глубина картинки растёт сама)')">{{T('+ color', '+ цвет')}}</button>
                        </div>
                    </template>

                    <h6 :title="T('The collision masks in this frame: the circle is which one the brush, the eraser and the rectangle draw; the checkbox is whether to show it. All masks, their names, colors and meets: the Masks node in the tree', 'Маски столкновений в этом кадре: кружок — какую рисуют кисть, ластик и прямоугольник; флажок — показывать ли. Все маски, их имена, цвета и встречи — узел «Маски» в дереве')">{{T('Masks', 'Маски')}}
                        <a href="#" class="help-text" @click.prevent="edit.page = 'masks'" :title="T('All masks of the project: indexes, names, colors, Fill all, meets', 'Все маски проекта: индексы, имена, цвета, «Залить все», встречи')">{{T('all masks & meets →', 'все маски и встречи →')}}</a></h6>
                    <table class="masks-table masks-compact"><tbody>
                        <tr v-for="m in sprites.masks" :key="m.index" :class="{'mask-current': m.index === edit.maskIndex}">
                            <td><input type="radio" :checked="m.index === edit.maskIndex" @change="spritesStore.selectMask(m.index)" :title="T('Draw this mask', 'Рисовать эту маску')"></td>
                            <td><input type="checkbox" :checked="!edit.hiddenMasks[m.index]" @change="spritesStore.toggleMaskShown(m.index)" :title="T('Show this mask', 'Показывать эту маску')"></td>
                            <td><span class="mask-swatch" :style="{background: m.color}"></span> {{m.index}} {{m.name}}</td>
                            <td class="mask-state" :title="maskStateHint(m.index)">{{maskState(m.index)}}</td>
                            <td class="mask-buttons">
                                <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.fillMask(m.index)" :disabled="!hasPicture"
                                    :title="T('Fill the mask in this frame by the opaque pixels of the picture (a handy start, then correct it with the brush)', 'Залить маску в этом кадре по непрозрачным пикселям картинки (с этого удобно начинать, потом поправить кистью)')">{{T('Fill', 'Залить')}}</button>
                                <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.clearMask(m.index)"
                                    :title="T('The mask is in the frame but empty: in this frame the zone collides with nothing', 'Маска в кадре есть, но пустая: в этом кадре зона ни с чем не сталкивается')">{{T('Clear', 'Очистить')}}</button>
                                <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.removeFrameMask(m.index)"
                                    :title="T('Remove the mask from this frame entirely', 'Убрать маску из этого кадра совсем')">{{T('None', 'Нет')}}</button>
                            </td>
                        </tr>
                    </tbody></table>
                    <div v-if="!sprites.masks.length" class="help-text">{{T('no masks: the Masks node, “+”', 'масок нет: узел «Маски», «+»')}}</div>

                    <h6 :title="T('The attachment points of the current frame: other sprites hang on them (a sword in the hand). Coordinates are from the base point', 'Точки привязки текущего кадра: к ним цепляются другие спрайты (меч в руке). Координаты — от базовой точки')">{{T('Points', 'Точки')}}</h6>
                    <table class="points-table"><tbody>
                        <tr v-for="(p, pn) in frame.points" :key="pn" :class="{'mask-current': pn === edit.pointName}">
                            <td><input type="radio" :checked="pn === edit.pointName" @change="spritesStore.selectPoint(pn); spritesStore.setTool('point')" :title="T('Choose the point: the mouse and the arrows move it', 'Выбрать точку: её двигают мышью и стрелками')"></td>
                            <td><input :value="pn" @change="renamePoint(pn, $event)" size="7" :title="T('The name of the point; in different frames one point has the same name', 'Имя точки; в разных кадрах одна и та же точка называется одинаково')"></td>
                            <td>x <input class="coord" :value="p.x" @change="setPointValue(pn, 'x', $event)" :title="T('Right of the base point, pixels', 'Вправо от базовой точки, пикселей')"></td>
                            <td>y <input class="coord" :value="p.y" @change="setPointValue(pn, 'y', $event)" :title="T('Down from the base point (up is below zero)', 'Вниз от базовой точки (вверх — меньше нуля)')"></td>
                            <td><select :value="p.z" @change="spritesStore.setPointZ(pn, parseInt($event.target.value))" class="point-z"
                                :title="T('What is attached to the point is drawn in front of the body (front) or behind it (behind). Its own in every frame: a hand in a swing is behind the body. The number is the order among the attached', 'Что прикреплено к точке, рисуется перед телом (front) или за ним (behind). Своё в каждом кадре: рука на замахе — за телом. Число — порядок среди прикреплённых')">
                                <option v-for="z in [7, 6, 5, 4, 3, 2, 1, -1, -2, -3, -4, -5, -6, -7, -8]" :value="z">{{z > 0 ? 'front ' + z : 'behind ' + z}}</option>
                            </select></td>
                            <td><button class="btn btn-sm btn-remove" @click="spritesStore.removePoint(pn)" :title="T('Remove the point from the frame', 'Удалить точку из кадра')">×</button></td>
                        </tr>
                    </tbody></table>
                    <div class="prop">
                        <input v-model="newPointName" list="point-names" size="8" :placeholder="T('name', 'имя')" @keyup.enter="addPoint" :title="T('The name of a new point: hand, tip…', 'Имя новой точки: hand, tip…')">
                        <datalist id="point-names"><option v-for="n in knownPointNames" :value="n"></option></datalist>
                        <button class="btn btn-sm btn-outline-secondary" @click="addPoint" :title="T('Add a point at the base point of the frame; then click with the Points tool where to put it', 'Добавить точку в базовую точку кадра; потом инструментом «Точки» щёлкните, куда её поставить')">{{T('Add point', 'Добавить точку')}}</button>
                    </div>
                </template>
                <div v-else class="help-text">{{T('No frames: Load PNG frames… or + frame.', 'Кадров нет: «Загрузить PNG-кадры…» или «+ кадр».')}}</div>
            </template>

            <template v-if="page === 'masks'">
                <h6 :title="T('Collision masks: which pixels of a frame are the body, the head, the blade. The index of a mask is the number of the zone for the game', 'Маски столкновений: какие пиксели кадра — тело, голова, клинок. Индекс маски — номер зоны для игры')">{{T('Masks', 'Маски')}}
                    <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.addMask()" :disabled="sprites.masks.length >= MaskLimit" :title="T('A new mask (zone), up to 16', 'Новая маска (зона), до 16')">+</button></h6>
                <table class="masks-table"><tbody>
                    <tr class="masks-columns">
                        <td :title="T('Which mask the brush, the eraser and the rectangle draw', 'Какую маску рисуют кисть, ластик и прямоугольник')">{{T('draw', 'рис.')}}</td>
                        <td :title="T('Whether to show the mask', 'Показывать ли маску')">{{T('show', 'показ')}}</td>
                        <td :title="T('The index is the number of the zone for the game', 'Индекс — номер зоны для игры')">{{T('index', 'индекс')}}</td>
                        <td>{{T('name', 'имя')}}</td>
                        <td>{{T('color', 'цвет')}}</td>
                        <td :title="T('The mask in the current frame: how many pixels; none: not drawn; default: the default mask holds. Fill, Clear and None for the frame are in the properties of the frame (Frames)', 'Маска в текущем кадре: сколько пикселей; none — не нарисована; default — действует маска по умолчанию. «Залить», «Очистить» и «Нет» для кадра — в свойствах кадра (Кадры)')">{{T('in frame', 'в кадре')}}</td>
                        <td></td>
                    </tr>
                    <tr v-for="m in sprites.masks" :key="m.index" :class="{'mask-current': m.index === edit.maskIndex}">
                        <td><input type="radio" :checked="m.index === edit.maskIndex" @change="spritesStore.selectMask(m.index)" :title="T('Draw this mask', 'Рисовать эту маску')"></td>
                        <td><input type="checkbox" :checked="!edit.hiddenMasks[m.index]" @change="spritesStore.toggleMaskShown(m.index)" :title="T('Show this mask', 'Показывать эту маску')"></td>
                        <td>
                            <select :value="m.index" @change="changeMaskIndex(m.index, $event)" :title="T('The index is the number of the zone for the game; a change changes it in all frames', 'Индекс — номер зоны для игры; смена меняет его во всех кадрах')">
                                <option v-for="i in freeMaskIndexes(m.index)" :value="i">{{i}}</option>
                            </select>
                        </td>
                        <td><input :value="m.name" @input="spritesStore.renameMask(m.index, $event.target.value)" size="6"
                            :title="T('The name of the mask: body, head, blade. In the pack: the constant MASK_<NAME> (letters and digits, the rest “_”, capitals); the Meets text calls the mask by this name', 'Имя маски: body, head, blade. В пакете — константа MASK_<ИМЯ> (буквы и цифры, остальное «_», заглавные); по этому имени маску называет текст «Встречи»')"></td>
                        <td><input type="color" v-model="m.color" :title="T('The color of the mask on the screen', 'Цвет маски на экране')"></td>
                        <td class="mask-state" :title="maskStateHint(m.index)">{{maskState(m.index)}}</td>
                        <td class="mask-buttons">
                            <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.fillMaskInAllFrames(m.index)" :disabled="!set"
                                :title="T('Fill the mask by the opaque pixels of the picture in all frames of the kind that do not have this mask yet (in one frame: Fill of the frame)', 'Залить маску по непрозрачным пикселям картинки во всех кадрах вида, где этой маски ещё нет (в одном кадре — «Залить» у кадра)')">{{T('Fill all', 'Залить все')}}</button>
                            <button class="btn btn-sm btn-remove" @click="removeMask(m)" :title="T('Remove the mask from all frames of all kinds', 'Удалить маску из всех кадров всех видов')">×</button>
                        </td>
                    </tr>
                </tbody></table>
                <div v-if="!sprites.masks.length" class="help-text">{{T('no masks: “+”', 'нет масок — «+»')}}</div>

                <h6 :title="T('Which masks meet (are checked for overlap). A body has an owner (a hand and the sword in it are parts of one whole, they never meet) and a side (a thrown stone is on the side of the thrower). own: pairs of masks of bodies of one side, foreign: of different sides', 'Какие маски встречаются (проверяются на пересечение). У тела есть хозяин (рука и меч в ней — части одного целого, они не встречаются никогда) и сторона (брошенный камень — на стороне бросившего). own — пары масок тел одной стороны, foreign — разных сторон')">{{T('Meets', 'Встречи')}}
                    <span class="meets-state" v-if="meetsText === null" :title="T('The file has no meets field: own nothing, foreign every pair', 'Поля meets в файле нет: own — ничего, foreign — каждая пара')">{{T('engine defaults', 'умолчания движка')}}</span>
                    <span class="meets-state" v-else-if="!meetsText.trim()" :title="T('The text is empty: no pair meets', 'Текст пуст: ни одна пара не встречается')">{{T('nothing meets', 'ничто не встречается')}}</span>
                    <span class="meets-state" v-else :title="T('Only the pairs listed in the text meet', 'Встречаются только пары, перечисленные в тексте')">{{T('from the text', 'по тексту')}}</span>
                    <button class="btn btn-sm btn-outline-secondary" @click="useMeetsDefaults" :disabled="meetsText === null"
                        :title="T('Remove the text: the engine defaults hold (own nothing, foreign every pair)', 'Убрать текст: действуют умолчания движка (own — ничего, foreign — каждая пара)')">{{T('Defaults', 'Умолчания')}}</button>
                </h6>
                <table v-for="kind in Meets.kinds" class="meets-grid"><tbody>
                    <tr>
                        <th :title="kind === 'own' ? T('own: bodies of one side', 'own: тела одной стороны') : T('foreign: bodies of different sides', 'foreign: тела разных сторон')">{{kind}}</th>
                        <th v-for="b in sprites.masks" class="meets-column" :title="b.index + ': ' + b.name">{{b.index}}</th>
                    </tr>
                    <tr v-for="a in sprites.masks">
                        <th class="meets-row" :title="T('Mask ' + a.index + ', in the text ' + maskWord(a.index), 'Маска ' + a.index + ', в тексте ' + maskWord(a.index))">{{a.index}} {{a.name}}</th>
                        <td v-for="b in sprites.masks" :class="{'meets-diagonal': a.index === b.index}">
                            <input type="checkbox" :checked="Meets.meet(meets, kind, a.index, b.index)" :class="{'meets-default': meetsText === null}"
                                @change="spritesStore.toggleMeet(kind, a.index, b.index, $event.target.checked)" :title="meetHint(kind, a.index, b.index)">
                        </td>
                    </tr>
                </tbody></table>
                <textarea class="meets-text" rows="5" :value="meetsText === null ? '' : meetsText" @input="spritesStore.setMeets($event.target.value)"
                    :placeholder="T('(no text: engine defaults)\\nforeign BLADE BODY    # a strike lands\\nown STONE BODY', '(текста нет: умолчания движка)\\nforeign BLADE BODY    # удар достиг цели\\nown STONE BODY')"
                    :title="T('The meets text as the packer reads it: a line is “own|foreign mask mask”, a mask is a name (as in the pack) or an index 0…15, # is a comment. A pair is symmetric; a pair not given does not meet; one pair twice is an error', 'Текст meets, как его читает упаковщик: строка — «own|foreign маска маска», маска — имя (как в пакете) или индекс 0…15, # — комментарий. Пара симметрична; пара, которой нет, не встречается; одна пара дважды — ошибка')"></textarea>
                <div v-for="e in meets.errors" class="error-text">{{e}}</div>
                <div v-for="w in meets.warnings" class="warning-text">{{w}}</div>
            </template>

            <template v-if="page === 'palettes'">
                <h6 :title="T('The palette of the picture of the current frame: the pencil and the fill draw with its colors. 0 is transparent', 'Палитра картинки текущего кадра: ими рисуют карандаш и заливка. 0 — прозрачный')">{{T('Palette of', 'Палитра')}} {{frame ? frame.image : '—'}}
                    <span v-if="picture" class="help-text">{{T(picture.palette.length + ' colors · ' + picture.bitDepth + ' bits', 'цветов: ' + picture.palette.length + ' · бит: ' + picture.bitDepth)}}</span></h6>
                <template v-if="picture">
                    <div class="palette-swatches">
                        <span v-for="(c, i) in picture.palette" class="palette-swatch" :class="{current: i === edit.colorIndex, transparent: !i}"
                            :style="i ? {background: hex(c)} : {}" @click="pickSwatch(i)"
                            :title="i ? T('Color ' + i + ': ' + hex(c) + '. Click: draw with it', 'Цвет ' + i + ': ' + hex(c) + '. Щелчок — рисовать им') : T('Color 0: transparent', 'Цвет 0: прозрачный')">{{i}}</span>
                    </div>
                    <div v-if="edit.colorIndex > 0 && edit.colorIndex < picture.palette.length" class="palette-edit">
                        {{T('color', 'цвет')}} {{edit.colorIndex}} <input type="color" :value="hex(picture.palette[edit.colorIndex])" @change="spritesStore.setPaletteColor(edit.colorIndex, rgbOf($event.target.value), paletteAll)"
                            :title="T('Change this color of the palette: all pixels of this color change their look', 'Изменить этот цвет палитры: меняется вид всех пикселей этого цвета')">
                        <label :title="T('Change this color in all pictures of the kind, not only in this frame', 'Изменить этот цвет у всех картинок вида, а не только у этого кадра')"><input type="checkbox" v-model="paletteAll"> {{T('in all frames', 'во всех кадрах')}}</label>
                    </div>
                    <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.addPaletteColor([128, 128, 128])" :disabled="picture.palette.length >= 256"
                        :title="T('Add a color to the palette of this picture (up to 256; the depth of the picture grows by itself)', 'Добавить цвет в палитру этой картинки (до 256; глубина картинки растёт сама)')">{{T('+ color', '+ цвет')}}</button>
                </template>
                <div v-else class="help-text">{{T('the current frame has no picture', 'у текущего кадра нет картинки')}}</div>

                <h6 :title="T('The palettes of the file: sets of colors without pictures. The color of a piece of a tile may name a palette ([NAME, n]), a kind can be viewed in a palette (preview in). Color n of a palette is the n-th in the list', 'Палитры файла: наборы цветов без картинок. Цвет куска плитки может назвать палитру ([ИМЯ, n]), вид можно смотреть в палитре («смотреть в»). Цвет n палитры — n-й в списке')">{{T('Palettes', 'Палитры')}}
                    <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.addPalette()" :title="T('A new palette of two colors', 'Новая палитра из двух цветов')">+</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="spritesStore.addPalette(picture.palette.slice(1), set.name + '_colors')" :disabled="!picture" :title="T('A palette of the colors of the picture of the current frame (1…)', 'Палитра из цветов картинки текущего кадра (1…)')">{{T('+ from picture', '+ из картинки')}}</button></h6>
                <div v-for="p in sprites.palettes" class="palette-row">
                    <div class="prop"><input :value="p.name" size="10" @change="renamePalette(p, $event)" :title="T('The name of the palette: the color of a piece calls it so ([NAME, n])', 'Имя палитры: так её называет цвет куска ([ИМЯ, n])')">
                        <button class="btn btn-sm btn-outline-secondary" @click="p.colors.push([128, 128, 128])" :title="T('One more color', 'Ещё цвет')">+</button>
                        <button class="btn btn-sm btn-outline-secondary" @click="p.colors.pop(); refreshPreview(p)" :disabled="p.colors.length < 2" :title="T('Remove the last color', 'Убрать последний цвет')">−</button>
                        <button class="btn btn-sm btn-remove" @click="spritesStore.removePalette(p.name)" :title="T('Remove the palette', 'Удалить палитру')">×</button></div>
                    <span class="palette-swatches"><input v-for="(c, i) in p.colors" type="color" class="palette-color" :value="hex(c)" @change="p.colors[i] = rgbOf($event.target.value); refreshPreview(p)" :title="T('Color ' + (i + 1), 'Цвет ' + (i + 1))"></span>
                </div>
                <div v-if="!sprites.palettes.length" class="help-text">{{T('none', 'нет')}}</div>
            </template>
        </div>
    `
};

// the strip below: the frames of the kind in a row, and the preview of them one after another
const FramesStrip = {
    mixins: [FramesBase],
    template: `
        <div class="frames-strip">
            <div class="frames-strip-list"><FrameList></FrameList></div>
            <div class="frames-strip-preview"><AnimationPreview></AnimationPreview></div>
        </div>
    `
};

const FramesStatus = {
    mixins: [FramesBase],
    data() {
        return {
            ui: FrameUi,
        };
    },
    computed: {
        // what the mouse and the keys do now, in words
        toolHint() {
            if (!this.frame) return T('Start: at the top Open folder for the folder of the project, Example for a ready example; or in the properties on the right Load PNG frames for your own frames.',
                'Начните: сверху «Открыть папку…» — каталог проекта, «Пример» — готовый пример; или в свойствах справа «Загрузить PNG-кадры…» — свои кадры.');
            const m = this.spritesStore.maskDefinition(this.edit.maskIndex);
            const mask = m ? T('“' + m.name + '”', '«' + m.name + '»') : T('(choose a mask on the right)', '(выберите маску справа)');
            const noMasks = !Object.keys(this.frame.masks).length;
            const fillFirst = noMasks ? T(' The frame has no masks yet: first press Fill on the right, or the mask will be only what is drawn.',
                ' В кадре ещё нет масок: сначала нажмите «Залить» справа, иначе маска будет только из нарисованного.') : '';
            const color = this.edit.colorIndex;
            switch (this.edit.tool) {
                case 'origin':
                    return T('Base point: click a cell and it becomes the base point (the feet on the light blue floor line). The arrows move the point over the picture by a pixel: the picture goes the other way.',
                        'Базовая точка: щёлкните клетку — она станет базовой точкой (ноги — на голубую линию пола). Стрелки сдвигают точку по картинке на пиксель: картинка уходит в обратную сторону.');
                case 'brush':
                    return T('Brush: the left button draws mask ' + mask + ', the right one erases. Only in this frame.',
                        'Кисть: левая кнопка рисует маску ' + mask + ', правая стирает. Только в этом кадре.') + fillFirst;
                case 'eraser':
                    return T('Eraser: the left button erases mask ' + mask + ', the right one draws.',
                        'Ластик: левая кнопка стирает маску ' + mask + ', правая рисует.');
                case 'rect':
                    return T('Rectangle: drag a frame with the left button and it is painted in mask ' + mask + ', with the right one erased.',
                        'Прямоугольник: протяните рамку левой кнопкой — она закрасится в маске ' + mask + ', правой — сотрётся.') + fillFirst;
                case 'pencil':
                    return T('Pencil: the left button draws pixels of the picture itself with color ' + color + ' of the palette (on the right), the right one with transparent. Ctrl+Z steps back. Download the changed picture: Download PNG.',
                        'Карандаш: левая кнопка рисует пиксели самой картинки цветом ' + color + ' палитры (справа), правая — прозрачным. Ctrl+Z — шаг назад. Изменённую картинку скачайте: «Скачать PNG».');
                case 'fill':
                    return T('Fill: a click fills an area of one color of the picture with color ' + color + ' (the right button with transparent). Ctrl+Z steps back.',
                        'Заливка: щелчок заливает область одного цвета картинки цветом ' + color + ' (правой кнопкой — прозрачным). Ctrl+Z — шаг назад.');
                case 'picker':
                    return T('Picker: a click on a pixel of the picture makes its color the color of the pencil.',
                        'Пипетка: щелчок по пикселю картинки — его цвет становится цветом карандаша.');
                case 'point':
                    return T('Points: a click on a point chooses it (it can be dragged), a click elsewhere moves the chosen point there. The arrows move it. A new point: “Add point” on the right.',
                        'Точки: щелчок по точке выбирает её (её можно тащить), щелчок мимо переносит туда выбранную точку. Стрелки двигают её. Новая точка — «Добавить точку» справа.');
                case 'move':
                    return this.selection ? T('Move: drag the frame with the mouse or move it with the arrows: the pixels of the picture and the masks inside go along. Esc finishes.',
                            'Сдвиг: тащите рамку мышью или двигайте стрелками — едут пиксели картинки и масок внутри. Esc — закончить.') :
                        T('Move: drag a frame over the part of the picture to be moved (it changes the picture itself!).',
                            'Сдвиг: протяните рамку по части картинки, которую надо сдвинуть (меняет саму картинку!).');
            }
            return '';
        },
        maskName() {
            const m = this.spritesStore.maskDefinition(this.edit.maskIndex);
            return m ? m.name : '—';
        },
    },
    template: `
        <div class="bench-status-row">
            <span class="status-prompt">{{toolHint}}</span>
            <span class="status-where">{{ui.cursorText}}</span>
            <span class="status-extra" :title="T('Which mask is drawn, and the zoom', 'Какую маску рисуют, и масштаб')">{{T('mask', 'маска')}}: {{maskName}} · {{edit.zoom}}×</span>
        </div>
    `
};
