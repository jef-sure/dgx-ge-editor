// The mode of scenes on the workbench: the tools at the top (SceneToolbar), the part of the tree under the chosen
// scene (SceneTreePart: its layers, grids, exits, links), the scene in the middle (SceneCanvas or SceneMap), the
// properties of what is selected on the right (SceneProps), the palette of pictures, tiles and actors below
// (ScenePalette), the line of state at the bottom (SceneStatus). Undo and redo are the shell's, for everything
const SceneTools = {
    select: {
        get name() {
            return T('Select', 'Выбор');
        },
        key: 'v',
        get hint() {
            return T('Select: click an object to select it, then drag it; click a grid cell to select the cell. Delete removes, arrows move',
                'Выбор: щёлкните объект — он выделится, его можно тащить; клетку сетки — выделится клетка. Delete — удалить, стрелки — сдвинуть');
        }
    },
    pan: {
        get name() {
            return T('Pan', 'Рука');
        },
        key: 'h',
        get hint() {
            return T('Move the view with the mouse (in any tool with the middle button; the wheel zooms)',
                'Двигать вид мышью (в любом инструменте — средней кнопкой; колёсико — масштаб)');
        }
    },
    picture: {
        get name() {
            return T('Picture', 'Картинка');
        },
        key: 'p',
        get hint() {
            return T('Picture: click, and the picture chosen in the palette is put here by its base point, into the active layer',
                'Картинка: щёлкните — выбранная в палитре картинка встанет сюда базовой точкой, в активный слой');
        }
    },
    tile: {
        get name() {
            return T('Tile', 'Плитка');
        },
        key: 't',
        get hint() {
            return T('Tile: paint grid cells with the chosen tile; the right button erases',
                'Плитка: красьте клетки сетки выбранной плиткой; правой кнопкой — стирать');
        }
    },
    actor: {
        get name() {
            return T('Actor', 'Персонаж');
        },
        key: 'a',
        get hint() {
            return T('Actor: click, and the actor appears here when the scene starts',
                'Персонаж: щёлкните — здесь он появится в начале сцены');
        }
    },
    zone: {
        get name() {
            return T('Zone', 'Зона');
        },
        key: 'z',
        get hint() {
            return T('Zone: drag a rectangle, an area for the game’s logic (an exit, a trap, a camera bound)',
                'Зона: протяните прямоугольник — область для логики игры (выход, ловушка, граница камеры)');
        }
    },
    entry: {
        get name() {
            return T('Entry', 'Вход');
        },
        key: 'e',
        get hint() {
            return T('Entry: click, a point where an actor arrives from another scene',
                'Вход: щёлкните — точка, куда персонаж попадает из другой сцены');
        }
    },
    link: {
        get name() {
            return T('Link', 'Связь');
        },
        key: 'l',
        get hint() {
            return T('Link: click an object or a cell, then the second one, e.g. a button → a gate',
                'Связь: щёлкните объект или клетку, потом второй — например, кнопка → ворота');
        }
    },
    camera: {
        get name() {
            return T('Camera', 'Камера');
        },
        key: 'c',
        get hint() {
            return T('Camera: drag the screen frame, the layers with parallax shift as in the game',
                'Камера: тащите рамку экрана — слои с параллаксом сдвинутся, как в игре');
        }
    },
};

// what the parts of the mode share
const SceneEditBase = {
    data() {
        return {
            ui: SceneUi,
        };
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        SceneTools() {
            return SceneTools;
        },
        Scene() {
            return Scene;
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
        activeLayer() {
            if (!this.scene) return null;
            return this.scene.layers.find(l => l.name === this.edit.sceneLayer) || this.scene.layers[0] || null;
        },
    },
    methods: {
        setTool(t) {
            this.edit.sceneTool = t;
            this.ui.linkFrom = null;
            this.ui.message = '';
        },
        viewSize() {
            const view = this.ui.view;
            return [view ? view.width : 800, view ? view.height : 500];
        },
        zoom(k) {
            const [w, h] = this.viewSize();
            const cx = this.edit.scenePanX + w / 2 / this.edit.sceneZoom,
                cy = this.edit.scenePanY + h / 2 / this.edit.sceneZoom;
            const z = Math.min(32, Math.max(0.25, this.edit.sceneZoom * k));
            this.edit.sceneZoom = z;
            this.edit.scenePanX = cx - w / 2 / z;
            this.edit.scenePanY = cy - h / 2 / z;
        },
        // the whole scene in the view
        fit() {
            if (!this.scene) return;
            const [w, h] = this.viewSize();
            const z = Math.max(0.25, Math.min((w - 40) / this.scene.width, (h - 40) / this.scene.height));
            this.edit.sceneZoom = z;
            this.edit.scenePanX = (this.scene.width - w / z) / 2;
            this.edit.scenePanY = (this.scene.height - h / z) / 2;
        },
        selectScene(i) {
            this.edit.page = 'scenes';
            this.edit.sceneIndex = i;
            this.edit.sceneSel = {
                kind: 'scene'
            };
            this.edit.sceneView = 'scene';
            this.ui.linkFrom = null;
            const s = this.sprites.scenes[i];
            if (s && !s.layers.some(l => l.name === this.edit.sceneLayer)) this.edit.sceneLayer = s.layers.length ? s.layers[0].name : '';
            if (s && !s.grids.some(g => g.name === this.edit.sceneGrid)) this.edit.sceneGrid = s.grids.length ? s.grids[0].name : '';
            this.$nextTick(() => this.fit());
        },
        addScene() {
            const name = Scene.freeName(this.sprites.scenes, 'scene');
            this.sprites.scenes.push(Scene.newScene(name, this.sprites.screen));
            this.edit.treeOpen.scenes = true;
            this.selectScene(this.sprites.scenes.length - 1);
        },
        addLayer() {
            const s = this.scene;
            if (s.layers.length >= Scene.maxLayers) {
                this.ui.message = T('The engine draws no more than ' + Scene.maxLayers + ' layers', 'Движок рисует не больше ' + Scene.maxLayers + ' слоёв');
                return;
            }
            const l = Scene.newLayer(Scene.freeName(s.layers, 'layer'));
            s.layers.push(l);
            this.selectLayer(l);
        },
        selectLayer(l) {
            this.edit.sceneLayer = l.name;
            this.edit.sceneSel = {
                kind: 'layer',
                layer: l.name
            };
        },
        // the order of layers is the order they are drawn: the first at the back
        moveLayer(l, d) {
            const list = this.scene.layers;
            const i = list.indexOf(l),
                j = i + d;
            if (j < 0 || j >= list.length) return;
            [list[i], list[j]] = [list[j], list[i]];
        },
        selectObject(l, i) {
            this.edit.sceneLayer = l.name;
            this.edit.sceneSel = {
                kind: 'object',
                layer: l.name,
                index: i
            };
        },
        objectLabel(o) {
            const icon = {
                picture: '▣',
                actor: '◆',
                zone: '▭',
                entry: '▼'
            } [o.type];
            return icon + ' ' + (o.name || (o.type === 'picture' ? o.image : o.type));
        },
        addGrid() {
            if (!this.sprites.tilesets.length) this.sprites.tilesets.push(Scene.newTileset('tiles'));
            const t = this.sprites.tilesets.find(t => t.name === this.edit.sceneTileset) || this.sprites.tilesets[0];
            const g = Scene.newGrid(Scene.freeName(this.scene.grids, 'grid'), t.name,
                Math.max(1, Math.floor(this.scene.width / t.cellWidth)), Math.max(1, Math.floor(this.scene.height / t.cellHeight)));
            this.scene.grids.push(g);
            this.selectGrid(g);
        },
        selectGrid(g) {
            this.edit.sceneGrid = g.name;
            this.edit.sceneSel = {
                kind: 'grid',
                grid: g.name
            };
            this.edit.sceneTileset = g.tileset;
        },
        addExit() {
            const other = this.sprites.scenes.find(s => s !== this.scene);
            this.scene.exits.push({
                edge: 'right',
                zone: '',
                scene: other ? other.name : this.scene.name,
                entry: '',
                name: '',
                transition: 'cut'
            });
            this.edit.sceneSel = {
                kind: 'exit',
                index: this.scene.exits.length - 1
            };
        },
        addTileset() {
            const t = Scene.newTileset(Scene.freeName(this.sprites.tilesets, 'tiles'));
            this.sprites.tilesets.push(t);
            this.edit.treeOpen.tilesets = true;
            this.selectTileset(t);
        },
        selectTileset(t) {
            this.edit.page = 'scenes';
            this.edit.sceneView = 'scene';
            this.edit.sceneTileset = t.name;
            this.edit.sceneSel = {
                kind: 'tileset',
                tileset: t.name
            };
        },
        isSel(kind, extra) {
            const s = this.edit.sceneSel;
            if (!s || s.kind !== kind) return false;
            for (const k in extra)
                if (s[k] !== extra[k]) return false;
            return true;
        },
        selectedObject() {
            const sel = this.edit.sceneSel;
            if (!sel || sel.kind !== 'object' || !this.scene) return null;
            const l = this.scene.layers.find(l => l.name === sel.layer);
            return l ? l.objects[sel.index] || null : null;
        },
        removeSelected() {
            const sel = this.edit.sceneSel;
            if (!sel || !this.scene) return;
            if (sel.kind === 'object') {
                const l = this.scene.layers.find(l => l.name === sel.layer);
                if (l) l.objects.splice(sel.index, 1);
            } else if (sel.kind === 'link') this.scene.links.splice(sel.index, 1);
            else if (sel.kind === 'exit') this.scene.exits.splice(sel.index, 1);
            else if (sel.kind === 'cell') {
                const g = this.scene.grids.find(g => g.name === sel.grid);
                if (g) g.cells[sel.row][sel.col] = 0;
                return;
            } else return;
            this.edit.sceneSel = null;
        },
        duplicate() {
            const o = this.selectedObject();
            if (!o) return;
            const copy = JSON.parse(JSON.stringify(o));
            if (copy.name) copy.name = Scene.freeName(Scene.objects(this.scene), copy.name);
            copy.x += 8;
            copy.y += 8;
            const l = this.scene.layers.find(l => l.name === this.edit.sceneSel.layer);
            l.objects.push(copy);
            this.selectObject(l, l.objects.length - 1);
        },
    },
};

const SceneToolbar = {
    mixins: [SceneEditBase],
    mounted() {
        window.addEventListener('keydown', this.onkeydown);
        // without scenes nothing of a scene is chosen; a tileset and its tiles are of no scene
        const sel = this.edit.sceneSel;
        if (!this.sprites.scenes.length && !(sel && (sel.kind === 'tileset' || sel.kind === 'tile'))) this.edit.sceneSel = null;
    },
    unmounted() {
        window.removeEventListener('keydown', this.onkeydown);
    },
    methods: {
        // keys work when no input has the focus; the shell takes undo and redo
        onkeydown(event) {
            const t = event.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
            const ctrl = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();
            if (ctrl && key === 'd') {
                this.duplicate();
                event.preventDefault();
                return;
            }
            if (ctrl || event.altKey) return;
            if (event.key === 'Delete' || event.key === 'Backspace') {
                this.removeSelected();
                event.preventDefault();
                return;
            }
            if (event.key === 'Escape') {
                this.ui.linkFrom = null;
                this.ui.message = '';
                this.edit.sceneSel = null;
                return;
            }
            const arrows = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1]
            };
            if (event.key in arrows) {
                const o = this.selectedObject();
                if (o) {
                    const step = event.shiftKey ? 8 : 1;
                    o.x += arrows[event.key][0] * step;
                    o.y += arrows[event.key][1] * step;
                    event.preventDefault();
                }
                return;
            }
            if (key === 'f') {
                this.fit();
                return;
            }
            if (key === '+' || key === '=') {
                this.zoom(1.25);
                return;
            }
            if (key === '-') {
                this.zoom(0.8);
                return;
            }
            for (const tk in SceneTools) {
                if (key === SceneTools[tk].key) {
                    this.setTool(tk);
                    event.preventDefault();
                    return;
                }
            }
        },
    },
    template: `
        <div class="mode-toolbar">
            <div class="btn-group btn-group-sm">
                <button v-for="(tool, tk) in SceneTools" class="btn" :class="edit.sceneTool === tk ? 'btn-primary' : 'btn-outline-primary'"
                    @click="setTool(tk)" :title="tool.hint + T(' (key ', ' (клавиша ') + tool.key.toUpperCase() + ')'">{{tool.name}}</button>
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" @click="zoom(0.8)" :title="T('Smaller (−, wheel)', 'Мельче (−, колёсико)')">−</button>
                <button class="btn btn-outline-secondary" disabled>{{Math.round(edit.sceneZoom * 100)}}%</button>
                <button class="btn btn-outline-secondary" @click="zoom(1.25)" :title="T('Larger (+, wheel)', 'Крупнее (+, колёсико)')">+</button>
                <button class="btn btn-outline-secondary" @click="fit" :title="T('The whole scene in the view (F)', 'Вся сцена в окне (F)')">{{T('Fit', 'Вписать')}}</button>
            </div>
            <label :title="T('Snap: coordinates when placing and dragging are multiples of this number of pixels', 'Привязка: координаты при установке и перетаскивании кратны этому числу пикселей')">{{T('Snap', 'Привязка')}}
                <select v-model.number="edit.sceneSnap"><option v-for="s in [1, 2, 4, 8, 16, 32]" :value="s">{{s}}</option></select></label>
            <label :title="T('Lines of the tile grids', 'Линии сеток плиток')"><input type="checkbox" v-model="edit.sceneShowGrid"> {{T('Grids', 'Сетки')}}</label>
            <label :title="T('Zones and entry points', 'Зоны и точки входа')"><input type="checkbox" v-model="edit.sceneShowZones"> {{T('Zones', 'Зоны')}}</label>
            <label :title="T('Bodies of tiles (bodies): what is solid in a cell, red frames (dashed: the body does not hold every mask); openings (opening), blue. Only for tiles that have them', 'Тела плиток (bodies): что в клетке сплошное — красные рамки (пунктир — тело держит не все маски); проёмы (opening) — синие. Только у плиток, где они заданы')"><input type="checkbox" v-model="edit.sceneShowBodies"> {{T('Bodies', 'Тела')}}</label>
            <label :title="T('Which bodies to show: all, or only those that hold this mask (for), as the engine sees them when it asks the grid with this mask', 'Какие тела показывать: все или только те, что держат эту маску (for) — так их видит движок, когда спрашивает сетку этой маской')"><select v-model.number="edit.sceneBodiesMask" :disabled="!edit.sceneShowBodies"><option :value="-1">{{T('for every mask', 'для всех масок')}}</option><option v-for="m in sprites.masks" :value="m.index">for {{m.index}} {{m.name}}</option></select></label>
            <label :title="T('Links between objects and cells', 'Связи между объектами и клетками')"><input type="checkbox" v-model="edit.sceneShowLinks"> {{T('Links', 'Связи')}}</label>
            <label :title="T('The screen frame where the camera is', 'Рамка экрана в месте камеры')"><input type="checkbox" v-model="edit.sceneShowScreen"> {{T('Screen', 'Экран')}}</label>
            <label :title="T('Tiles with pictures in a cycle (cycle: water, lava) run as in the game; otherwise the first picture', 'Плитки с картинками по кругу (cycle: вода, лава) идут, как в игре; иначе — первая картинка')"><input type="checkbox" v-model="edit.sceneCycles"> {{T('Cycles', 'Циклы')}}</label>
            <button class="btn btn-sm btn-outline-secondary" @click="edit.sceneCamera = {x: 0, y: 0}" :title="T('The camera to the top left corner of the scene: layers without shift', 'Камеру в левый верхний угол сцены: слои без сдвига')">{{T('Camera 0,0', 'Камера 0,0')}}</button>
            <div class="btn-group btn-group-sm">
                <button class="btn" :class="edit.sceneView === 'scene' ? 'btn-secondary' : 'btn-outline-secondary'" @click="edit.sceneView = 'scene'" :title="T('Scene', 'Сцена')">{{T('Scene', 'Сцена')}}</button>
                <button class="btn" :class="edit.sceneView === 'map' ? 'btn-secondary' : 'btn-outline-secondary'" @click="edit.sceneView = 'map'" :title="T('Map: all scenes and the exits between them', 'Карта: все сцены и выходы между ними')">{{T('Map', 'Карта')}}</button>
            </div>
        </div>
    `
};

// the part of the tree under the chosen scene: its layers with their objects, grids, exits, links
const SceneTreePart = {
    mixins: [SceneEditBase],
    computed: {
        open() {
            return this.edit.treeOpen;
        },
    },
    methods: {
        toggle(key) {
            if (this.open[key] === false) delete this.open[key];
            else this.open[key] = false;
        },
        isOpen(key) {
            return this.open[key] !== false;
        },
    },
    template: `
        <div class="scene-tree-part" v-if="scene">
            <div class="tree-head"><a href="#" @click.prevent="toggle('layers')">{{isOpen('layers') ? '▾' : '▸'}}</a>
                <b :title="T('Layers are drawn from the top of the list down: the first is the farthest', 'Слои рисуются сверху вниз по списку: первый — самый дальний')">{{T('Layers', 'Слои')}}</b> <span class="help-text">{{scene.layers.length}}</span>
                <button class="tree-add" @click="addLayer" :title="T('New layer (over the others)', 'Новый слой (поверх остальных)')">+</button></div>
            <template v-if="isOpen('layers')">
                <template v-for="l in scene.layers" :key="l.name">
                    <div class="tree-item layer-item" :class="{current: activeLayer === l, selected: isSel('layer', {layer: l.name})}">
                        <input type="checkbox" v-model="l.visible" :title="T('Visibility of the layer', 'Видимость слоя')" @click.stop>
                        <span class="tree-lock" :class="{locked: l.locked}" @click.stop="l.locked = !l.locked" :title="l.locked ? T('Locked: click to unlock', 'Заблокирован: щёлкните, чтобы открыть') : T('Unlocked: click to forbid editing', 'Открыт: щёлкните, чтобы запретить правку')">{{l.locked ? '🔒' : '🔓'}}</span>
                        <span class="tree-name" @click="selectLayer(l)" :title="T('Active layer: new objects are put here. Parallax ' + l.factor + '/256', 'Активный слой: сюда ставятся новые объекты. Параллакс ' + l.factor + '/256')">{{l.name}}</span>
                        <span class="help-text">{{l.objects.length}}</span>
                        <span class="tree-move"><button @click.stop="moveLayer(l, -1)" :title="T('Farther (drawn earlier)', 'Дальше (раньше рисуется)')">↑</button><button @click.stop="moveLayer(l, 1)" :title="T('Nearer (drawn later)', 'Ближе (позже рисуется)')">↓</button></span>
                    </div>
                    <template v-if="activeLayer === l">
                        <div v-for="(o, i) in l.objects" class="tree-item tree-object" :class="{selected: isSel('object', {layer: l.name, index: i})}" @click="selectObject(l, i)">{{objectLabel(o)}}</div>
                    </template>
                </template>
            </template>
            <div class="tree-head"><a href="#" @click.prevent="toggle('grids')">{{isOpen('grids') ? '▾' : '▸'}}</a>
                <b :title="T('Tile grids: cells, each holds a tile of a tileset', 'Сетки плиток: клетки, в каждой — плитка набора плиток')">{{T('Grids', 'Сетки')}}</b> <span class="help-text">{{scene.grids.length}}</span>
                <button class="tree-add" @click="addGrid" :title="T('New grid over the whole scene', 'Новая сетка во всю сцену')">+</button></div>
            <template v-if="isOpen('grids')">
                <div v-for="g in scene.grids" class="tree-item" :class="{current: g.name === edit.sceneGrid, selected: isSel('grid', {grid: g.name})}" @click="selectGrid(g)">▤ {{g.name}} <span class="help-text">{{g.tileset}} {{g.cols}}×{{g.rows}}</span></div>
            </template>
            <div class="tree-head"><a href="#" @click.prevent="toggle('exits')">{{isOpen('exits') ? '▾' : '▸'}}</a>
                <b :title="T('Exits: from this scene to another (through an edge or a zone)', 'Выходы: из этой сцены — в другую (через край или зону)')">{{T('Exits', 'Выходы')}}</b> <span class="help-text">{{scene.exits.length}}</span>
                <button class="tree-add" @click="addExit" :title="T('New exit', 'Новый выход')">+</button></div>
            <template v-if="isOpen('exits')">
                <div v-for="(e, i) in scene.exits" class="tree-item" :class="{selected: isSel('exit', {index: i})}" @click="edit.sceneSel = {kind: 'exit', index: i}">⇥ {{e.edge || e.zone}} → {{e.scene}}<span v-if="e.entry">/{{e.entry}}</span></div>
            </template>
            <div class="tree-head"><a href="#" @click.prevent="toggle('links')">{{isOpen('links') ? '▾' : '▸'}}</a>
                <b :title="T('Links: a button → a gate and the like. Added with the Link tool', 'Связи: кнопка → ворота и т.п. Добавляются инструментом «Связь»')">{{T('Links', 'Связи')}}</b> <span class="help-text">{{scene.links.length}}</span></div>
            <template v-if="isOpen('links')">
                <div v-for="(l, i) in scene.links" class="tree-item" :class="{selected: isSel('link', {index: i})}" @click="edit.sceneSel = {kind: 'link', index: i}">↯ {{Scene.refText(l.from)}} → {{Scene.refText(l.to)}}</div>
            </template>
        </div>
    `
};

const SceneStatus = {
    mixins: [SceneEditBase],
    computed: {
        // what the tool waits for, in words
        prompt() {
            if (this.ui.message) return '⚠ ' + this.ui.message;
            if (!this.scene) return T('No scenes yet: press «+» at Scenes in the tree to create the first.',
                'Сцен ещё нет: в дереве у «Сцены» нажмите «+», чтобы создать первую.');
            if (this.edit.sceneView === 'map') return T('Map: a click selects a scene, a double click opens it. Arrows are the exits between scenes.',
                'Карта: щелчок — выбрать сцену, двойной — открыть. Стрелки — выходы между сценами.');
            const t = this.edit.sceneTool;
            const layer = this.activeLayer ? this.activeLayer.name : '—';
            switch (t) {
                case 'select':
                    return T('Select: click an object or a cell. Drag an object with the mouse. Shift + drag on empty space moves the view.',
                        'Выбор: щёлкните объект или клетку. Тащите объект мышью. Shift + тащить по пустому — двигать вид.');
                case 'pan':
                    return T('Pan: drag the view with the mouse. The wheel zooms.', 'Рука: тащите вид мышью. Колёсико — масштаб.');
                case 'picture':
                    if (this.edit.scenePick) {
                        const pick = this.edit.scenePick.set + '/' + this.edit.scenePick.image;
                        return T('Picture: click where to put «' + pick + '», into the layer «' + layer + '».',
                            'Картинка: щёлкните, куда поставить «' + pick + '» — в слой «' + layer + '».');
                    }
                    return T('Picture: first choose a picture in the palette below (Pictures).',
                        'Картинка: сначала выберите картинку в палитре внизу («Картинки»).');
                case 'tile':
                    if (!this.scene.grids.length) return T('Tile: the scene has no grid; press «+» at Grids in the tree.',
                        'Плитка: в сцене нет сетки — в дереве у «Сетки» нажмите «+».');
                    return T('Tile: the left button paints cells with tile ' + this.edit.sceneTile + ', the right one erases. Choose the tile in the palette (Tiles).',
                        'Плитка: левая кнопка красит клетки плиткой ' + this.edit.sceneTile + ', правая стирает. Плитку выберите в палитре («Плитки»).');
                case 'actor':
                    if (this.edit.sceneActorSet) return T('Actor: click where an actor of the kind «' + this.edit.sceneActorSet + '» appears, into the layer «' + layer + '».',
                        'Персонаж: щёлкните, где появится персонаж вида «' + this.edit.sceneActorSet + '» — в слой «' + layer + '».');
                    return T('Actor: first choose an actor in the palette below (Actors).',
                        'Персонаж: сначала выберите персонажа в палитре внизу («Персонажи»).');
                case 'zone':
                    return T('Zone: drag the rectangle of the zone. Its name and kind are on the right.',
                        'Зона: протяните прямоугольник зоны. Её имя и вид — справа.');
                case 'entry':
                    return T('Entry: click where an actor will be on coming into this scene.',
                        'Вход: щёлкните, где персонаж окажется, придя в эту сцену.');
                case 'link':
                    return this.ui.linkFrom ?
                        T('Link: now click the second end of the link, a cell (Esc cancels).',
                            'Связь: теперь щёлкните второй конец связи — клетку (Esc — отменить).') :
                        T('Link: click the first end of the link, a cell, an actor or a zone with a name; the second end is a cell.',
                            'Связь: щёлкните первый конец связи — клетку, персонажа или зону с именем; второй конец — клетка.');
                case 'camera':
                    return T('Camera: drag, and the screen frame moves; the layers shift by their parallax.',
                        'Камера: тащите — рамка экрана поедет, слои сдвинутся по своему параллаксу.');
            }
            return '';
        },
        where() {
            const c = this.ui.cursor;
            if (!c) return '';
            let text = 'x ' + c.x + ', y ' + c.y;
            const cell = this.ui.cell;
            if (cell && this.scene) {
                // the grid may have grown smaller under the cursor since
                const g = this.scene.grids.find(g => g.name === cell.grid);
                const v = g && g.cells[cell.row] ? g.cells[cell.row][cell.col] || 0 : 0;
                text += ' · ' + cell.grid + ' [' + cell.col + ',' + cell.row + '] = ' + (v || T('empty', 'пусто'));
            }
            return text;
        },
    },
    template: `
        <div class="bench-status-row">
            <span class="status-prompt">{{prompt}}</span>
            <span class="status-where">{{where}}</span>
            <span class="status-extra" :title="T('Active layer: new objects are put here', 'Активный слой: сюда ставятся новые объекты')">{{T('layer', 'слой')}}: {{activeLayer ? activeLayer.name : '—'}} · {{Math.round(edit.sceneZoom * 100)}}%</span>
        </div>
    `
};
