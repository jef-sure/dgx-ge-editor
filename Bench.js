// The tree of the project on the left and the list of problems: what the workbench is made of.
// The tree repeats what the pack of the engine is made of: kinds (sets) with their frames, animation and game frames,
// palettes, masks and meets, tilesets, scenes, dialogs, styles, fonts, translations, and the problems of it all.
// A click on a node opens it in the middle and its properties on the right
const ProjectTree = {
    props: ['problems'],
    data() {
        return {
            Controls: Controls,
            MaskLimit: MaskLimit,
            Game: Game,
        };
    },
    watch: {
        // the kind chosen elsewhere (a problem, the player) is scrolled into view
        'edit.setIndex'() {
            this.$nextTick(() => {
                const el = this.$el.querySelector('.tree-kind.current');
                if (el && el.scrollIntoView) el.scrollIntoView({
                    block: 'nearest'
                });
            });
        },
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        set() {
            return this.spritesStore.currentSet;
        },
        open() {
            return this.edit.treeOpen;
        },
        filter() {
            return this.edit.treeFilter.trim().toLowerCase();
        },
        counts() {
            return Problems.counts(this.problems);
        },
        errors() {
            return this.problems.filter(p => p.error).length;
        },
        isFrames() {
            return ['frames', 'masks', 'palettes'].includes(this.edit.page);
        },
    },
    methods: {
        // the scripts of a kind by the groups of its state machine, then those in no group
        scriptGroups(s) {
            const a = s.animation;
            let seen = new Set();
            let groups = a.groups.map(g => {
                g.scripts.forEach(n => seen.add(n));
                return {
                    name: g.name,
                    scripts: g.scripts.filter(n => a.scripts.some(s => s.name === n))
                };
            });
            const rest = a.scripts.map(s => s.name).filter(n => !seen.has(n));
            if (rest.length) groups.push({
                name: '',
                scripts: rest
            });
            return groups;
        },
        // nodes are open unless closed; kinds are closed unless opened
        isOpen(key, closedByDefault) {
            const v = this.open[key];
            return v === undefined ? !closedByDefault : v !== false;
        },
        toggle(key, closedByDefault) {
            this.open[key] = !this.isOpen(key, closedByDefault);
        },
        matches(name) {
            return !this.filter || String(name).toLowerCase().includes(this.filter);
        },
        mark(map, name) {
            return Problems.mark(map && map[name]);
        },
        markClass(map, name) {
            return this.mark(map, name) === '✖' ? 'error-text' : 'warning-text';
        },
        kindSummary(s) {
            const parts = [];
            if (s.frames.length) parts.push(T(s.frames.length + (s.frames.length === 1 ? ' picture' : ' pictures'), 'картинок: ' + s.frames.length));
            if (s.animation.scripts.length) parts.push(T(s.animation.scripts.length + ' scripts', 'скриптов: ' + s.animation.scripts.length));
            return parts.join(' · ') || T('empty', 'пусто');
        },
        selectKind(i, what) {
            this.spritesStore.selectKind(i, what);
        },
        isKindPage(si, what) {
            if (si !== this.edit.setIndex) return false;
            if (what === 'frames') return this.isFrames;
            if (what === 'anim') return this.edit.page === 'anim' && this.edit.animView === 'scripts';
            return this.edit.page === 'anim' && this.edit.animView === what;
        },
        addScript(si) {
            this.selectKind(si, 'anim');
            this.$nextTick(() => {
                if (AnimUi.scripts) AnimUi.scripts.addScript('');
            });
        },
        selectScript(si, name) {
            this.spritesStore.selectKind(si, 'anim');
            this.edit.animScript = name;
            this.edit.animStep = 0;
        },
        addSet() {
            this.spritesStore.addSet();
            this.edit.treeOpen.kinds = true;
            this.spritesStore.selectKind(this.edit.setIndex, 'frames');
        },
        addControl(event) {
            const kind = event.target.value;
            event.target.value = '';
            const errors = this.spritesStore.addControl(kind);
            if (errors) this.spritesStore.setUploadErrorMessage(kind + ': ' + errors.join('; '));
            else this.spritesStore.selectKind(this.edit.setIndex, 'frames');
        },
        openPage(page) {
            this.edit.page = page;
        },
        addMap() {
            const m = Maps.newMap(Scene.freeName(this.sprites.maps, 'map'));
            this.sprites.maps.push(m);
            this.edit.treeOpen.maps = true;
            this.edit.page = 'maps';
            this.edit.mapName = m.name;
        },
        gameCount(part) {
            const list = part === 'constants' ? this.sprites.game : part === 'packConstants' ? Object.keys(this.sprites.constants || {}) : this.sprites[part];
            return list ? list.length : 0;
        },
        openScenes(view) {
            this.edit.page = 'scenes';
            if (view) this.edit.sceneView = view;
        },
        isSceneSel(kind, extra) {
            if (this.edit.page !== 'scenes') return false;
            const s = this.edit.sceneSel;
            if (!s || s.kind !== kind) return false;
            for (const k in extra)
                if (s[k] !== extra[k]) return false;
            return true;
        },
    },
    template: `
        <div class="project-tree">
            <div class="tree-filter">
                <input v-model="edit.treeFilter" :placeholder="T('filter…', 'фильтр…')" ref="filter" :title="T('Keep in the tree only the names with this text: kinds, scripts, scenes, styles (Ctrl+F)', 'Оставить в дереве только имена с этим текстом: виды, скрипты, сцены, стили (Ctrl+F)')">
                <button v-if="edit.treeFilter" class="tree-add" @click="edit.treeFilter = ''" :title="T('Show everything', 'Показать всё')">×</button>
            </div>

            <div class="tree-head"><a href="#" @click.prevent="toggle('kinds')">{{isOpen('kinds') ? '▾' : '▸'}}</a>
                <b :title="T('Kinds: a character, a thing or rules with an animation of their own; a kind may have pictures (frames). In the JSON — sets', 'Виды: персонаж, предмет или правила со своей анимацией; у вида бывают картинки (кадры). В JSON — sets')">{{T('Kinds', 'Виды')}}</b>
                <span class="help-text">{{sprites.sets.length}}</span>
                <button class="tree-add" @click="addSet" :title="T('A new empty kind', 'Новый пустой вид')">+</button>
                <select class="tree-select" value="" @change="addControl($event)"
                    :title="T('A new control of dialogs and settings pages from a ready template: a kind with frames of states (simple pictures — redraw them and download them with Download changed PNG) and an animation that answers the interface events focus, blur, activate, more, less', 'Новый контрол диалогов и страниц настроек из готового шаблона: вид с кадрами состояний (простые картинки — перерисуйте их и скачайте кнопкой «Скачать изменённые PNG») и анимацией, отвечающей на события интерфейса focus, blur, activate, more, less')">
                    <option value="">{{T('+ control…', '+ контрол…')}}</option>
                    <option v-for="(t, k) in Controls.templates" :value="k" :title="t.title">{{k}}</option>
                </select>
            </div>
            <template v-if="isOpen('kinds')">
                <template v-for="(s, si) in sprites.sets" :key="s.name">
                    <template v-if="matches(s.name) || (filter && s.animation.scripts.some(x => matches(x.name)))">
                        <div class="tree-item tree-kind" :class="{current: si === edit.setIndex}">
                            <a href="#" @click.prevent="toggle('kind:' + s.name, si !== edit.setIndex)">{{isOpen('kind:' + s.name, si !== edit.setIndex) ? '▾' : '▸'}}</a>
                            <span class="tree-name" @click="selectKind(si)" :title="s.name + ': ' + kindSummary(s) + T('. A click opens the frames (or the scripts, if there are no pictures)', '. Щелчок открывает кадры (или скрипты, если картинок нет)')">{{s.name}}</span>
                            <span class="help-text tree-count">{{s.frames.length || '—'}} · {{s.animation.scripts.length || '—'}}</span>
                            <span class="anim-mark" :class="markClass(counts.bySet, s.name)" :title="counts.bySet[s.name] ? T(counts.bySet[s.name].errors + ' errors, ' + counts.bySet[s.name].warnings + ' warnings', 'ошибок: ' + counts.bySet[s.name].errors + ', предупреждений: ' + counts.bySet[s.name].warnings) : ''">{{mark(counts.bySet, s.name)}}</span>
                        </div>
                        <template v-if="isOpen('kind:' + s.name, si !== edit.setIndex)">
                            <div class="tree-item tree-sub" :class="{selected: isKindPage(si, 'frames')}" @click="selectKind(si, 'frames')" :title="T('The frames of the kind: pictures, base points, masks, attachment points', 'Кадры вида: картинки, базовые точки, маски, точки привязки')">
                                <span class="tree-name">{{T('Frames', 'Кадры')}}</span> <span class="help-text">{{s.frames.length}}</span></div>
                            <div class="tree-item tree-sub tree-scripts" :class="{selected: isKindPage(si, 'anim')}" @click="selectKind(si, 'anim')"
                                :title="T('The scripts of the kind — all it does: frames and their times, movement, hits, touches, senses and chase, pockets, messages to the game. A click on the name of a script opens its steps', 'Скрипты вида — всё, что он делает: кадры и их время, движение, удары, касания, чутьё и погоня, карманы, сообщения игре. Щелчок по имени скрипта открывает его шаги')">
                                <a v-if="s.animation.scripts.length" href="#" @click.prevent.stop="toggle('scripts:' + s.name)" :title="T('Fold or unfold the list of scripts', 'Свернуть или развернуть список скриптов')">{{isOpen('scripts:' + s.name) ? '▾' : '▸'}}</a>
                                <span class="tree-name">{{T('Scripts', 'Скрипты')}}</span> <span class="help-text">{{s.animation.scripts.length}}</span>
                                <button class="tree-add" @click.stop="addScript(si)" :title="T('A new script after the one chosen', 'Новый скрипт после выбранного')">+</button></div>
                            <template v-if="isOpen('scripts:' + s.name)">
                                <template v-for="g in scriptGroups(s)" :key="g.name">
                                    <div v-if="g.name || scriptGroups(s).length > 1" class="tree-item tree-group" @click="toggle('group:' + s.name + ':' + g.name)"
                                        :title="T((g.name ? 'Group ' + g.name + ': transitions common to all its state scripts (edit them in Transitions → Groups)' : 'Scripts that are in no group') + '. A click folds and unfolds', (g.name ? 'Группа ' + g.name + ': общие переходы у всех её скриптов-состояний (правьте в «Переходы → Группы»)' : 'Скрипты, что не входят ни в одну группу') + '. Щелчок сворачивает и разворачивает')">
                                        <a href="#" @click.prevent>{{isOpen('group:' + s.name + ':' + g.name) ? '▾' : '▸'}}</a>
                                        <span class="tree-name">{{g.name ? T('group ', 'группа ') + g.name : T('not in a group', 'вне групп')}}</span>
                                        <span v-if="!isOpen('group:' + s.name + ':' + g.name)" class="help-text">{{g.scripts.length}} {{T('scripts', 'скриптов')}}</span></div>
                                    <div v-for="n in g.scripts" v-show="matches(n) && (!(g.name || scriptGroups(s).length > 1) || isOpen('group:' + s.name + ':' + g.name))"
                                        class="tree-item tree-script" :class="{'tree-in-group': g.name || scriptGroups(s).length > 1, selected: si === edit.setIndex && edit.page === 'anim' && edit.animView === 'scripts' && n === edit.animScript}"
                                        @click="selectScript(si, n)" :title="T('Script ' + n + ': its steps in the middle, the transitions on the right', 'Скрипт ' + n + ': его шаги в середине, переходы справа')">
                                        <span class="tree-name">{{n}}</span>
                                        <span class="anim-mark" :class="markClass(counts.byScript, s.name + '/' + n)">{{mark(counts.byScript, s.name + '/' + n)}}</span></div>
                                </template>
                            </template>
                            <div class="tree-item tree-sub" :class="{selected: isKindPage(si, 'transitions')}" @click="selectKind(si, 'transitions')" :title="T('Transitions between scripts by events: what an event (a button pressed, a hit taken) does in each state script. Rules, by event, groups, graph, matrix', 'Переходы между скриптами по событиям: что делает событие (нажата кнопка, получен удар) в каждом скрипте-состоянии. Правила, по событию, группы, граф, матрица')">
                                <span class="tree-name">{{T('Transitions', 'Переходы')}}</span> <span class="help-text">{{s.animation.rules.length}}</span></div>
                            <div class="tree-item tree-sub" :class="{selected: isKindPage(si, 'numbers')}" @click="selectKind(si, 'numbers')" :title="T('The table of game frames: number → picture and offset, for «frame N» in scripts', 'Таблица кадров игры: номер → картинка и сдвиг, для «frame N» в скриптах')">
                                <span class="tree-name">{{T('Game frames', 'Кадры игры')}}</span> <span class="help-text">{{s.frameTable ? s.frameTable.length : '—'}}</span></div>
                        </template>
                    </template>
                </template>
                <div v-if="!sprites.sets.length" class="help-text tree-note">{{T('none — «+»', 'нет — «+»')}}</div>
            </template>

            <div class="tree-head tree-leafhead" :class="{selected: edit.page === 'palettes'}" @click="openPage('palettes')">
                <b :title="T('The palettes of the file: sets of colors without pictures (the EGA colors, the seven palettes of the guard) and the palette of the current frame’s picture', 'Палитры файла: наборы цветов без картинок (цвета EGA, семь палитр стражника) и палитра картинки текущего кадра')">{{T('Palettes', 'Палитры')}}</b>
                <span class="help-text">{{sprites.palettes.length}}</span>
                <button class="tree-add" @click.stop="openPage('palettes'); spritesStore.addPalette()" :title="T('A new palette of two colors', 'Новая палитра из двух цветов')">+</button></div>
            <div class="tree-head tree-leafhead" :class="{selected: edit.page === 'masks'}" @click="openPage('masks')">
                <b :title="T('The collision masks of the whole project: indexes, names, colors, and which of them meet (Meets)', 'Маски столкновений всего проекта: индексы, имена, цвета, и какие из них встречаются (Встречи)')">{{T('Masks', 'Маски')}}</b>
                <span class="help-text">{{sprites.masks.length}} · {{T('meets', 'встречи')}}</span>
                <button class="tree-add" @click.stop="openPage('masks'); spritesStore.addMask()" :disabled="sprites.masks.length >= MaskLimit" :title="T('A new mask (zone), up to 16', 'Новая маска (зона), до 16')">+</button></div>

            <div class="tree-head"><a href="#" @click.prevent="toggle('tilesets')">{{isOpen('tilesets') ? '▾' : '▸'}}</a>
                <b :title="T('Tilesets: common to all the scenes; a tile is drawn in pieces by rules', 'Наборы плиток: общие для всех сцен; плитка рисуется кусками по правилам')">{{T('Tilesets', 'Наборы плиток')}}</b>
                <span class="help-text">{{sprites.tilesets.length}}</span>
                <button class="tree-add" @click="$refs.sceneTree.addTileset()" :title="T('A new tileset', 'Новый набор плиток')">+</button></div>
            <template v-if="isOpen('tilesets')">
                <div v-for="t in sprites.tilesets" v-show="matches(t.name)" class="tree-item tree-leaf" :class="{selected: isSceneSel('tileset', {tileset: t.name}) || isSceneSel('tile', {tileset: t.name})}"
                    @click="$refs.sceneTree.selectTileset(t)"><span class="tree-name">▥ {{t.name}}</span> <span class="help-text">{{t.tiles.length}} {{T('tiles', 'плиток')}} {{t.cellWidth}}×{{t.cellHeight}}</span></div>
                <div v-if="!sprites.tilesets.length" class="help-text tree-note">{{T('none — «+»', 'нет — «+»')}}</div>
            </template>

            <div class="tree-head"><a href="#" @click.prevent="toggle('scenes')">{{isOpen('scenes') ? '▾' : '▸'}}</a>
                <b :title="T('Scenes — levels or rooms of the game: layers with objects, grids of tiles, exits, links', 'Сцены — уровни или комнаты игры: слои с объектами, сетки плиток, выходы, связи')" @click="openScenes('scene')">{{T('Scenes', 'Сцены')}}</b>
                <span class="help-text">{{sprites.scenes.length}}</span>
                <button class="tree-add" @click="$refs.sceneTree.addScene()" :title="T('A new scene the size of the screen', 'Новая сцена размером с экран')">+</button>
                <button class="tree-add" :class="{on: edit.page === 'scenes' && edit.sceneView === 'map'}" @click="openScenes('map')" :title="T('The map: all the scenes and the exits between them', 'Карта: все сцены и выходы между ними')">{{T('Map', 'Карта')}}</button></div>
            <template v-if="isOpen('scenes')">
                <template v-for="(s, i) in sprites.scenes" :key="s.name">
                    <div v-show="matches(s.name)" class="tree-item tree-leaf" :class="{current: edit.page === 'scenes' && i === edit.sceneIndex, selected: i === edit.sceneIndex && isSceneSel('scene')}" @click="$refs.sceneTree.selectScene(i)">
                        <span class="tree-name">▦ {{s.name}}</span> <span class="help-text">{{s.width}}×{{s.height}}</span>
                        <span class="anim-mark" :class="markClass(counts.byScene, s.name)">{{mark(counts.byScene, s.name)}}</span></div>
                    <SceneTreePart v-if="edit.page === 'scenes' && i === edit.sceneIndex" class="tree-nested"></SceneTreePart>
                </template>
                <div v-if="!sprites.scenes.length" class="help-text tree-note">{{T('none — «+»', 'нет — «+»')}}</div>
            </template>
            <SceneTreePart v-show="false" ref="sceneTree"></SceneTreePart>

            <div class="tree-head"><a href="#" @click.prevent="toggle('maps')">{{isOpen('maps') ? '▾' : '▸'}}</a>
                <b :title="T('The graph of scenes: maps (levels, shows) with their scenes, exits and rules, the start of the game. Exits by sides and by names, entries and links are of the scenes themselves', 'Граф сцен: карты (уровни, показы) со своими сценами, выходами и правилами, начало игры. Выходы по сторонам и по имени, входы и связи — у самих сцен')" @click="edit.page = 'maps'">{{T('Maps', 'Карты')}}</b>
                <span class="help-text">{{sprites.maps.length}}</span>
                <button class="tree-add" @click="addMap" :title="T('A new map', 'Новая карта')">+</button>
                <span class="anim-mark" :class="markClass(counts.byMap, '')">{{mark(counts.byMap, '')}}</span></div>
            <template v-if="isOpen('maps')">
                <div v-for="m in sprites.maps" v-show="matches(m.name)" class="tree-item tree-leaf" :class="{selected: edit.page === 'maps' && edit.mapName === m.name}" @click="edit.page = 'maps'; edit.mapName = m.name">
                    <span class="tree-name">▧ {{m.name}}</span> <span class="help-text">{{sprites.scenes.filter(s => s.map === m.name).length}} {{T('scenes', 'сцен')}}</span>
                    <span class="anim-mark" :class="markClass(counts.byMap, m.name)">{{mark(counts.byMap, m.name)}}</span></div>
                <div v-if="!sprites.maps.length" class="help-text tree-note">{{T('none — «+»', 'нет — «+»')}}</div>
            </template>

            <DialogTreePart :filter="filter" :counts="counts"></DialogTreePart>

            <div class="tree-head"><a href="#" @click.prevent="toggle('game')">{{isOpen('game') ? '▾' : '▸'}}</a>
                <b :title="T('The game as a whole: constants, timers, sounds, shows (splash screens) and chase — what the packer takes by the calls add_game, add_timer, add_sound, add_show, add_chase', 'Игра целиком: константы, таймеры, звуки, показы (заставки) и погоня — то, что упаковщик берёт вызовами add_game, add_timer, add_sound, add_show, add_chase')" @click="edit.page = 'game'">{{T('Game', 'Игра')}}</b></div>
            <template v-if="isOpen('game')">
                <div v-for="p in Game.parts" class="tree-item tree-leaf" :class="{selected: edit.page === 'game' && edit.gamePart === p[0]}"
                    @click="edit.page = 'game'; edit.gamePart = p[0]" :title="Game.hint(p)">
                    <span class="tree-name">{{Game.label(p)}}</span> <span class="help-text">{{gameCount(p[0])}}</span>
                    <span class="anim-mark" :class="markClass(counts.byGame, p[0])">{{mark(counts.byGame, p[0])}}</span></div>
            </template>

            <div class="tree-head tree-leafhead tree-problems" :class="{selected: edit.page === 'problems'}" @click="openPage('problems')">
                <b :class="errors ? 'error-text' : problems.length ? 'warning-text' : ''" :title="T('All the errors and warnings of the project: animations, scenes, styles, dialogs, meets of masks, frames without pictures', 'Все ошибки и предупреждения проекта: анимации, сцены, стили, диалоги, встречи масок, кадры без картинок')">{{T('Problems', 'Проблемы')}}</b>
                <span class="help-text">{{errors}} ✖ · {{problems.length - errors}} ⚠</span></div>
        </div>
    `
};

// the list of problems of the whole project; a click leads to the place
const ProblemsView = {
    props: ['problems'],
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        sprites() {
            return this.spritesStore.sprites;
        },
        errors() {
            return this.problems.filter(p => p.error);
        },
        warnings() {
            return this.problems.filter(p => !p.error);
        },
        // the warnings of scripts that are entries of the game or go on into the next one by intent, to mark them all
        unreached() {
            return this.warnings.filter(p => p.where.script && /^no rule and no goto leads to it/.test(p.text));
        },
        falling() {
            return this.warnings.filter(p => p.where.script && /^goes on into the next script/.test(p.text));
        },
    },
    methods: {
        open(p) {
            this.spritesStore.open(p.where);
        },
        markAll(list, mark) {
            for (const p of list) {
                const set = this.sprites.sets.find(s => s.name === p.where.set);
                const script = set && set.animation.scripts.find(s => s.name === p.where.script);
                if (script) script[mark] = true;
            }
        },
    },
    template: `
        <div class="problems-view">
            <div v-if="!problems.length" class="anim-empty">{{T('Nothing found: no errors, no warnings.', 'Ничего не найдено: ни ошибок, ни предупреждений.')}}</div>
            <template v-if="errors.length">
                <h6 class="error-text">{{T('Errors: the engine would refuse the file', 'Ошибки: движок не примет файл')}} ({{errors.length}})</h6>
                <div v-for="p in errors" class="problem-line error-text"><a href="#" @click.prevent="open(p)">{{p.source}}</a> {{p.text}}</div>
            </template>
            <template v-if="warnings.length">
                <h6 class="warning-text">{{T('Warnings', 'Предупреждения')}} ({{warnings.length}})
                    <button v-if="unreached.length" class="btn btn-sm btn-outline-secondary" @click="markAll(unreached, 'entry')"
                        :title="T('Mark all the scripts nothing leads to as started by the game (entry) — when the code of the game does start them', 'Отметить все скрипты, в которые никто не ведёт, как запускаемые игрой (entry) — когда их и правда запускает код игры')">{{T('mark unreached as entry', 'отметить недостижимые как entry')}}</button>
                    <button v-if="falling.length" class="btn btn-sm btn-outline-secondary" @click="markAll(falling, 'through')"
                        :title="T('Mark all the scripts that go on into the next one as meant (through)', 'Отметить все скрипты, что переходят в следующий, как нарочно (through)')">{{T('mark falling ones as through', 'отметить переходящие дальше как through')}}</button></h6>
                <div v-for="p in warnings" class="problem-line warning-text"><a href="#" @click.prevent="open(p)">{{p.source}}</a> {{p.text}}</div>
            </template>
        </div>
    `
};
