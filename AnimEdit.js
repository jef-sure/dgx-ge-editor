// The mode of animations on the workbench: the toolbar at the top (import and export of .anim, the views, new
// scripts and steps), in the middle the steps of the chosen script, or the transitions in their views, or the table of
// game frames; on the right the header of the kind (defines, params, pockets) and the chosen state with its
// transitions; below, the player (AnimPlayer). The scripts themselves are in the tree of the project
const AnimBase = {
    computed: {
        ...Pinia.mapStores(useSpriteStore),
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
            return this.set ? this.set.animation : null;
        },
        script() {
            return this.animation ? this.animation.scripts.find(s => s.name === this.edit.animScript) : null;
        },
    },
};

const AnimToolbar = {
    mixins: [AnimBase],
    data() {
        return {
            message: '',
            importErrors: [],
            newName: '',
        };
    },
    mounted() {
        window.addEventListener('keydown', this.onkeydown);
    },
    unmounted() {
        window.removeEventListener('keydown', this.onkeydown);
    },
    computed: {
        views() {
            return [
                ['scripts', T('Scripts', 'Скрипты'), T('The steps of the chosen script: frames, time, statements', 'Шаги выбранного скрипта: кадры, время, команды')],
                ['transitions', T('Transitions', 'Переходы'), T('Transitions between states on events: rules, by event, groups, graph, matrix', 'Переходы между состояниями по событиям: правила, по событию, группы, граф, матрица')],
                ['numbers', T('Game frames', 'Кадры игры'), T('The table of frames by number: which picture the player shows for «frame N» (game frames)', 'Таблица кадров по номерам: какой картинкой проигрыватель показывает «frame N» (кадры игры)')],
            ];
        },
        result() {
            return this.set ? Anim.check(this.set, this.spritesStore.sprites.sets) : {
                errors: [],
                warnings: []
            };
        },
        fileName() {
            return this.set.name.replace(/[^\p{L}\p{N}_.-]/gu, '_') + '.anim';
        },
    },
    methods: {
        importAnim(event) {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const r = Anim.parse(evt.target.result, this.set);
                if (r.errors) {
                    this.importErrors = r.errors;
                    return;
                }
                this.importErrors = [];
                if (this.animation.scripts.length && !confirm(T('Put the animations of ' + file.name + ' in place of those of kind ' + this.set.name + '?',
                        'Поставить анимации из ' + file.name + ' вместо анимаций вида ' + this.set.name + '?'))) return;
                this.set.animation = r.animation;
                this.edit.animScript = r.animation.scripts.length ? r.animation.scripts[0].name : '';
                this.edit.animStep = 0;
                this.edit.animRule = -1;
                this.edit.animEvent = r.animation.events[0] || '';
                const notes = r.notes.length ? '; ' + r.notes.join('; ') : '';
                const named = r.animation.scripts.reduce((n, s) => n + s.lines.filter(l => l.op === 'frame' && l.name !== undefined).length, 0);
                const a = r.animation;
                this.message = file.name + ': ' + T(a.scripts.length + ' scripts, ' + a.events.length + ' events, ' +
                    a.rules.length + ' rules, ' + a.params.length + ' params' + (named ? '; ' + named + ' frames name pictures the kind has not' : ''),
                    'скриптов: ' + a.scripts.length + ', событий: ' + a.events.length + ', правил: ' + a.rules.length + ', параметров: ' + a.params.length +
                    (named ? '; кадров с картинками, которых у вида нет: ' + named : '')) + notes;
            };
            reader.readAsText(file);
        },
        exportAnim() {
            if (this.result.errors.length) {
                this.message = T('The assembler would refuse it: ' + this.result.errors.length + ' errors, see Problems',
                    'Ассемблер его не примет: ошибок — ' + this.result.errors.length + ', см. Проблемы');
                this.edit.page = 'problems';
                return;
            }
            const url = URL.createObjectURL(new Blob([Anim.text(this.set)], {
                type: 'text/plain'
            }));
            const a = document.createElement('a');
            a.href = url;
            a.download = this.fileName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            this.message = this.fileName + T(' exported' + (this.result.warnings.length ? ', with ' + this.result.warnings.length + ' warnings' : ''),
                ' скачан' + (this.result.warnings.length ? ', предупреждений: ' + this.result.warnings.length : ''));
        },
        // a new script: the view of scripts shows it (in the text: at its end)
        addScript() {
            this.edit.animView = 'scripts';
            this.$nextTick(() => {
                if (this.edit.scriptsAs !== 'steps' && AnimUi.text) AnimUi.text.addScript(this.newName);
                else if (AnimUi.scripts) AnimUi.scripts.addScript(this.newName);
                this.newName = '';
            });
        },
        addStep() {
            this.edit.animView = 'scripts';
            this.edit.scriptsAs = 'steps';
            this.$nextTick(() => {
                if (AnimUi.scripts && this.script) AnimUi.scripts.addStep();
            });
        },
        // keys work when no input has the focus: the player plays by them
        onkeydown(event) {
            const t = event.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            const player = AnimUi.player;
            if (!player) return;
            if (event.key === ' ') player.toggle();
            else if (event.key === 'ArrowRight' || event.key === '.') player.stepForward();
            else if (event.key === 'ArrowLeft' || event.key === ',') player.stepBack();
            else if (event.key === 'Home') player.restart();
            else return;
            event.preventDefault();
        },
    },
    template: `
        <div class="mode-toolbar" v-if="set">
            <div class="btn-group btn-group-sm">
                <button v-for="[k, name, hint] in views" class="btn" :class="edit.animView === k ? 'btn-primary' : 'btn-outline-primary'"
                    @click="edit.animView = k" :title="hint">{{name}}</button>
            </div>
            <div class="btn-group btn-group-sm" v-if="edit.animView === 'scripts'">
                <button class="btn" :class="edit.scriptsAs !== 'steps' ? 'btn-secondary' : 'btn-outline-secondary'" @click="edit.scriptsAs = 'text'"
                    :title="T('The scripts as their text, the engine’s language .anim: read as one types, comments kept, errors at their lines', 'Скрипты текстом, языком движка .anim: читается по мере набора, комментарии сохраняются, ошибки — у строк')">{{T('Text', 'Текст')}}</button>
                <button class="btn" :class="edit.scriptsAs === 'steps' ? 'btn-secondary' : 'btn-outline-secondary'" @click="edit.scriptsAs = 'steps'"
                    :title="T('The chosen script as cards of steps: a frame and the statements before it', 'Выбранный скрипт карточками шагов: кадр и команды перед ним')">{{T('Steps', 'Шаги')}}</button>
            </div>
            <span class="toolbar-add">
                <input v-model="newName" :placeholder="T('name', 'имя')" size="7" @keyup.enter="addScript" :title="T('The name of the new script (empty: script)', 'Имя нового скрипта (пусто — script)')">
                <button class="btn btn-sm btn-outline-secondary" @click="addScript" :title="T('A new script after the chosen one; the kind’s scripts are in the tree on the left under Scripts', 'Новый скрипт после выбранного; скрипты вида — в дереве слева под Скриптами')">{{T('+ script', '+ скрипт')}}</button>
                <button class="btn btn-sm btn-outline-secondary" @click="addStep" :disabled="!script" :title="T('A new step with a frame after the chosen step', 'Новый шаг с кадром после выбранного шага')">{{T('+ step', '+ шаг')}}</button>
            </span>
            <input type="file" accept=".anim,text/plain" @change="importAnim" style="display: none" ref="importFile"/>
            <button class="btn btn-sm btn-outline-secondary" @click="$refs.importFile.click()" :title="T('Open a text of animations .anim (the engine’s language) in place of the animations of this kind', 'Открыть текст анимаций .anim (язык движка) вместо анимаций этого вида')">{{T('Import .anim…', 'Импорт .anim…')}}</button>
            <button class="btn btn-sm btn-outline-secondary" @click="exportAnim" :title="T('Download the animations of the kind as .anim text for the engine: ' + fileName + '. While there are errors, it is not downloaded', 'Скачать анимации вида текстом .anim для движка: ' + fileName + '. Пока есть ошибки, не скачивается')">{{T('Export .anim ⭳', 'Экспорт .anim ⭳')}}</button>
            <span class="help-text">{{T(animation.scripts.length + ' scripts, ' + animation.events.length + ' events, ' + animation.rules.length + ' rules', 'скриптов: ' + animation.scripts.length + ', событий: ' + animation.events.length + ', правил: ' + animation.rules.length)}}</span>
            <span v-if="message" class="toolbar-message">{{message}} <button @click="message = ''">x</button></span>
            <span v-if="importErrors.length" class="error-text toolbar-message">{{T('not imported:', 'не импортирован:')}} {{importErrors.slice(0, 3).join('; ')}}<span v-if="importErrors.length > 3"> {{T('and ' + (importErrors.length - 3) + ' more', 'и ещё ' + (importErrors.length - 3))}}</span>
                <button @click="importErrors = []">x</button></span>
        </div>
    `
};

// the middle: the steps, the transitions in one of their views, or the game frames
const AnimMain = {
    mixins: [AnimBase],
    computed: {
        tabs() {
            return [
                ['rules', T('Rules', 'Правила'), T('The list of events and all the rules of transitions', 'Список событий и все правила переходов')],
                ['byEvent', T('By event', 'По событию'), T('An event: what it does in all the states', 'Событие: что оно делает во всех состояниях')],
                ['groups', T('Groups', 'Группы'), T('Groups of states: one transition for several at once', 'Группы состояний: общий переход сразу для нескольких')],
                ['graph', T('Graph', 'Граф'), T('Graph: the states and the arrows of transitions between them', 'Граф: состояния и стрелки переходов между ними')],
                ['matrix', T('Matrix', 'Матрица'), T('A table «state × event» for an overview', 'Таблица «состояние × событие» для обзора')],
            ];
        },
    },
    template: `
        <div class="anim-main" v-if="set">
            <template v-if="edit.animView === 'scripts'">
                <AnimScripts v-if="edit.scriptsAs === 'steps'"></AnimScripts>
                <AnimText v-else></AnimText>
            </template>
            <template v-else-if="edit.animView === 'transitions'">
                <div class="anim-subtabs">
                    <a v-for="[k, name, hint] in tabs" href="#" :class="{active: edit.animTab === k}" @click.prevent="edit.animTab = k" :title="hint">{{name}}</a>
                </div>
                <AnimRules v-if="edit.animTab === 'rules'"></AnimRules>
                <AnimByEvent v-else-if="edit.animTab === 'byEvent'"></AnimByEvent>
                <AnimGroups v-else-if="edit.animTab === 'groups'"></AnimGroups>
                <AnimGraph v-else-if="edit.animTab === 'graph'"></AnimGraph>
                <AnimMatrix v-else></AnimMatrix>
            </template>
            <AnimNumbers v-else></AnimNumbers>
        </div>
        <div v-else class="help-text">{{T('No kinds: press «+» in the tree under Kinds.', 'Видов нет: в дереве Виды нажмите «+».')}}</div>
    `
};

// the right: the header of the kind, and the state chosen with its transitions
const AnimProps = {
    mixins: [AnimBase],
    data() {
        return {
            message: '',
            newParam: '',
            newDefine: '',
            newTable: '',
        };
    },
    methods: {
        setQuestions(event) {
            const names = event.target.value.trim().split(/[\s,]+/).filter(n => n);
            const a = this.animation;
            const bad = names.find((n, i) => !Anim.isIdent(n) || Anim.reserved(n) || names.indexOf(n) !== i || a.defines.some(d => d.name === n) || a.params.some(p => p.name === n) || (a.tables || []).some(t => t.name === n));
            if (bad !== undefined || names.length > 255) {
                this.message = bad !== undefined ? T("'" + bad + "' is no name or it is taken", "'" + bad + "' — не имя или уже занято") : T('255 questions at most', 'не больше 255 вопросов');
                event.target.value = (a.questions || []).join(' ');
                return;
            }
            a.questions = names;
            this.message = '';
        },
        tableNameFree(name, except) {
            const a = this.animation;
            return Anim.isIdent(name) && !Anim.reserved(name) && !a.defines.some(d => d.name === name) && !a.params.some(p => p.name === name) &&
                !(a.tables || []).some(t => t !== except && t.name === name);
        },
        addTable() {
            const name = this.newTable.trim();
            if (!this.tableNameFree(name)) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или уже занято");
                return;
            }
            if (!this.animation.tables) this.animation.tables = [];
            this.animation.tables.push({
                name: name,
                values: [0]
            });
            this.newTable = '';
        },
        // a table renamed takes the expressions that read it along; an empty name removes it
        renameTable(t, event) {
            const name = event.target.value.trim();
            const a = this.animation;
            if (name === t.name) return;
            if (!name) {
                if (confirm(T('Remove table ' + t.name + '? Expressions that read it become errors', 'Удалить таблицу ' + t.name + '? Выражения, которые её читают, станут ошибками'))) a.tables.splice(a.tables.indexOf(t), 1);
                else event.target.value = t.name;
                return;
            }
            if (!this.tableNameFree(name, t)) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или уже занято");
                event.target.value = t.name;
                return;
            }
            Anim.renameTable(a, t.name, name);
        },
        setTableValues(t, event) {
            const words = event.target.value.trim().split(/[\s,]+/).filter(w => w);
            const values = words.map(w => /^-?\d+$/.test(w) ? parseInt(w, 10) : NaN);
            if (!values.length || values.some(v => !Number.isInteger(v) || v < -32768 || v > 32767)) {
                this.message = T('a table is whole numbers within 16 bits, separated by spaces', 'таблица — целые числа в 16 битах через пробел');
                event.target.value = t.values.join(' ');
                return;
            }
            t.values = values;
            this.message = '';
        },
        addParam() {
            const name = this.newParam.trim();
            if (!Anim.isIdent(name) || this.animation.params.some(p => p.name === name) || this.animation.defines.some(d => d.name === name) || (this.animation.tables || []).some(t => t.name === name) || Anim.reserved(name)) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или уже занято");
                return;
            }
            this.animation.params.push({
                name: name,
                value: 0
            });
            this.newParam = '';
        },
        // a param renamed takes its statements with it; an empty name takes it away
        renameParam(p, event) {
            const name = event.target.value.trim();
            if (name === p.name) return;
            if (!name) {
                const n = Anim.paramUses(this.animation, p.name);
                if (confirm(T('Remove param ' + p.name + (n ? '? ' + n + ' statements set or add of it become errors' : '?'),
                        'Удалить параметр ' + p.name + (n ? '? Команды set и add с ним станут ошибками: ' + n : '?'))))
                    this.animation.params.splice(this.animation.params.indexOf(p), 1);
                else event.target.value = p.name;
                return;
            }
            if (!Anim.isIdent(name) || this.animation.params.some(x => x.name === name) || this.animation.defines.some(d => d.name === name) || Anim.reserved(name)) {
                this.message = T("'" + name + "' is no name or there is such a param", "'" + name + "' — не имя или такой параметр уже есть");
                event.target.value = p.name;
                return;
            }
            Anim.renameParam(this.animation, p.name, name);
        },
        setParamValue(p, event) {
            try {
                p.value = Anim.operand(event.target.value, Anim.contextOf(this.animation), -32768, 32767, 'const');
            } catch (e) {
                this.message = event.target.value + ': ' + e.message;
                event.target.value = p.value;
            }
        },
        // pockets 0..255, stack 1..255; empty: the key goes away (the assembler's default: none, 1)
        setHeader(key, event) {
            const text = event.target.value.trim();
            if (!text) {
                delete this.animation[key];
                return;
            }
            try {
                this.animation[key] = Anim.operand(text, Anim.contextOf(this.animation), key === 'pockets' ? 0 : 1, 255, 'const');
            } catch (e) {
                this.message = text + ': ' + e.message;
                event.target.value = this.animation[key] ?? '';
            }
        },
        addDefine() {
            const name = this.newDefine.trim();
            const a = this.animation;
            if (!Anim.isIdent(name) || a.defines.some(d => d.name === name) || a.params.some(p => p.name === name) || (a.tables || []).some(t => t.name === name) || Anim.reserved(name)) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или уже занято");
                return;
            }
            a.defines.push({
                name: name,
                value: 0
            });
            this.newDefine = '';
        },
        // a define renamed takes the expressions that name it along; an empty name removes it
        renameDefine(d, event) {
            const name = event.target.value.trim();
            const a = this.animation;
            if (name === d.name) return;
            if (!name) {
                if (confirm(T('Remove define ' + d.name + '? Expressions that name it become errors', 'Удалить define ' + d.name + '? Выражения, которые его называют, станут ошибками'))) a.defines.splice(a.defines.indexOf(d), 1);
                else event.target.value = d.name;
                return;
            }
            if (!Anim.isIdent(name) || a.defines.some(x => x.name === name) || a.params.some(p => p.name === name) || Anim.reserved(name)) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или уже занято");
                event.target.value = d.name;
                return;
            }
            Anim.renameDefine(a, d.name, name);
        },
        // a define may name only those before it
        setDefineValue(d, event) {
            const a = this.animation;
            const before = {
                defines: Anim.defineValues({
                    defines: a.defines.slice(0, a.defines.indexOf(d))
                }),
                params: []
            };
            try {
                const text = event.target.value.trim();
                const tree = Anim.parseExpr(text, Object.assign(before, {
                    allowParams: false,
                    allowT: false
                }));
                d.value = /^-?\d+$/.test(text) ? parseInt(text, 10) : text;
                this.message = '';
                void tree;
            } catch (e) {
                this.message = event.target.value + ': ' + e.message;
                event.target.value = d.value;
            }
        },
        moveDefine(d, k) {
            const list = this.animation.defines;
            const i = list.indexOf(d),
                j = i + k;
            if (j < 0 || j >= list.length) return;
            [list[i], list[j]] = [list[j], list[i]];
        },
        moveParam(p, d) {
            const list = this.animation.params;
            const i = list.indexOf(p);
            const j = i + d;
            if (j < 0 || j >= list.length) return;
            [list[i], list[j]] = [list[j], list[i]];
        },
    },
    template: `
        <div class="anim-props" v-if="set">
            <h6 :title="T('Kind ' + set.name + ': its constants, params and pockets: the header of the .anim text', 'Вид ' + set.name + ': его константы, параметры и карманы — заголовок текста .anim')">{{T('Kind', 'Вид')}} {{set.name}}</h6>
            <div class="anim-params">
                <b :title="T('Named constants: a number or an expression of numbers and earlier defines. In scripts their names and expressions with them may stand in place of a number', 'Именованные константы: число или выражение из чисел и прежних define. В скриптах вместо числа можно писать их имена и выражения с ними')">Defines</b>
                <span v-for="d in animation.defines" class="anim-param">
                    <input :value="d.name" :size="Math.max(4, d.name.length)" @change="renameDefine(d, $event)" :title="T('The name of the constant; renaming changes the expressions with it too; erase it and it is removed', 'Имя константы; переименование меняет и выражения с ней; сотрите — удалится')">
                    = <input class="anim-expr" :value="d.value" :size="Math.max(4, String(d.value).length)" @change="setDefineValue(d, $event)" :title="T('The value: a number or an expression of numbers and the defines above', 'Значение: число или выражение из чисел и define выше')">
                    <button @click="moveDefine(d, -1)" :title="T('Earlier', 'Раньше')">‹</button><button @click="moveDefine(d, 1)" :title="T('Later', 'Позже')">›</button>
                </span>
                <input v-model="newDefine" :placeholder="T('new define', 'новый define')" size="8" @keyup.enter="addDefine">
                <button class="btn btn-sm btn-outline-secondary" @click="addDefine" :title="T('Add a constant, for example gravity = 3 * 12 * 12', 'Добавить константу, например gravity = 3 * 12 * 12')">+ define</button>
            </div>
            <div class="anim-params">
                <b :title="T('Tables of constants: a row of whole numbers (16 bits), read by number in expressions: chance[skill]; outside the table, 0. A table is declared before it is read', 'Таблицы констант: ряд целых чисел (16 бит), в выражениях читается по номеру — chance[skill]; за пределами таблицы — 0. Таблица объявляется раньше, чем читается')">{{T('Tables', 'Таблицы')}}</b>
                <span v-for="t in (animation.tables || [])" class="anim-param">
                    <input :value="t.name" :size="Math.max(4, t.name.length)" @change="renameTable(t, $event)" :title="T('The name of the table; renaming changes the expressions with it too; erase it and it is removed', 'Имя таблицы; переименование меняет и выражения с ней; сотрите — удалится')">
                    [ <input class="anim-expr" :value="t.values.join(' ')" :size="Math.max(6, t.values.join(' ').length)" @change="setTableValues(t, $event)" :title="T('Values separated by spaces: whole numbers from −32768 to 32767', 'Значения через пробел: целые числа от −32768 до 32767')"> ]
                </span>
                <input v-model="newTable" :placeholder="T('new table', 'новая таблица')" size="8" @keyup.enter="addTable">
                <button class="btn btn-sm btn-outline-secondary" @click="addTable" :title="T('Add a table: chance 75 100 75 50', 'Добавить таблицу: chance 75 100 75 50')">+ table</button>
            </div>
            <div class="anim-params">
                <b :title="T('Questions to the game: names; in expressions game.name is the game’s answer at the moment of the step (the game’s function dgx_ge_expr_ask; without it, 0). Numbers go in order; in the package header PREFIX_KIND_GAME_NAME', 'Вопросы игре: имена, в выражениях game.имя — ответ игры в момент шага (функция dgx_ge_expr_ask игры; без неё 0). Номера — по порядку; в заголовке пакета PREFIX_ВИД_GAME_ИМЯ')">Game</b>
                <input class="anim-expr" :value="(animation.questions || []).join(' ')" :size="Math.max(8, (animation.questions || []).join(' ').length)" @change="setQuestions($event)"
                    placeholder="see hear" :title="T('The names of the questions separated by spaces; renaming does not change expressions: fix them yourself', 'Имена вопросов через пробел; переименование не меняет выражения — поправьте их сами')">
            </div>
            <div class="anim-params">
                <b :title="T('Params are numbers every actor keeps: lives, «what it is doing». Scripts change them with the statements set and add, the game reads them by number, in this order', 'Параметры — числа, которые хранит каждый персонаж: жизни, «что он делает». Скрипты меняют их командами set и add, игра читает их по номерам — в этом порядке')">{{T('Params', 'Параметры')}}</b>
                <span v-for="p in animation.params" class="anim-param">
                    <input :value="p.name" :size="Math.max(4, p.name.length)" @change="renameParam(p, $event)" :title="T('The name of the param; renaming changes the statements set/add too; erase the name and the param is removed', 'Имя параметра; переименование меняет и команды set/add; сотрите имя — параметр удалится')">
                    = <input class="anim-expr" :value="p.value" @change="setParamValue(p, $event)" :title="T('The initial value: a number or an expression of numbers and defines', 'Начальное значение: число или выражение из чисел и define')">
                    <button @click="moveParam(p, -1)" :title="T('Earlier (a smaller number)', 'Раньше (номер меньше)')">‹</button><button @click="moveParam(p, 1)" :title="T('Later', 'Позже')">›</button>
                </span>
                <input v-model="newParam" :placeholder="T('new param', 'новый параметр')" size="8" @keyup.enter="addParam">
                <button class="btn btn-sm btn-outline-secondary" @click="addParam" :title="T('Add a param with this name', 'Добавить параметр с этим именем')">{{T('+ param', '+ параметр')}}</button>
                <span v-if="animation.params.length > Anim.runtimeParams" class="warning-text" :title="T('The engine keeps 4 params for an actor; it will not open a file with more', 'Движок держит у персонажа 4 параметра; файл с большим числом он не откроет')">⚠ {{T('the engine keeps ' + Anim.runtimeParams + ' params an actor', 'движок держит у персонажа ' + Anim.runtimeParams + ' параметра')}}</span>
                <span v-if="!animation.params.length" class="help-text">{{T('none; for example, «action»: what the actor is doing', 'нет — например, «action»: что делает персонаж')}}</span>
            </div>
            <div class="anim-params">
                <b :title="T('The actor’s pockets: how many places for things it has (pockets) and how many things of this kind fit in one place (stack) when this kind lies in others’ pockets', 'Карманы персонажа: сколько мест для вещей у него (pockets) и сколько вещей этого вида помещается в одно место (stack), когда этот вид лежит в чужих карманах')">{{T('Pockets', 'Карманы')}}</b>
                <input class="anim-expr" size="4" :value="animation.pockets ?? ''" @change="setHeader('pockets', $event)" :placeholder="T('none', 'нет')"
                    :title="T('pockets N: how many places for things the actor has, 0…255 (a number or a define). Empty: no pockets. The statements draw and stow take from the pockets and put into them; shoot of an actor with pockets shoots from them', 'pockets N: сколько мест для вещей у персонажа, 0…255 (число или define). Пусто — карманов нет. Команды draw и stow берут из карманов и кладут в них; shoot персонажа с карманами стреляет из них')">
                <b :title="T('stack N: how many things of this kind fit in one place of a pocket, 1…255. Empty: 1', 'stack N: сколько вещей этого вида помещается в одно место кармана, 1…255. Пусто — 1')">{{T('Stack', 'Стопка')}}</b>
                <input class="anim-expr" size="4" :value="animation.stack ?? ''" @change="setHeader('stack', $event)" placeholder="1"
                    :title="T('stack N: how many things of this kind in one place of a pocket (daggers: 10), 1…255. Empty: 1', 'stack N: сколько вещей этого вида в одном месте кармана (кинжалы — 10), 1…255. Пусто — 1')">
            </div>

            <div v-if="message" class="anim-message error-text">{{message}} <button @click="message = ''">x</button></div>
            <template v-if="edit.animView !== 'numbers' && animation.scripts.length">
                <h6 :title="T('The chosen script as a state: which events it answers and where it goes', 'Выбранный скрипт как состояние: на какие события он отвечает и куда переходит')">{{T('State', 'Состояние')}}</h6>
                <div class="anim-state-scroll"><AnimState></AnimState></div>
            </template>
        </div>
    `
};

const AnimStatus = {
    mixins: [AnimBase],
    computed: {
        prompt() {
            if (!this.set) return T('No kinds: press «+» in the tree under Kinds.', 'Видов нет: в дереве Виды нажмите «+».');
            if (!this.animation.scripts.length) return T('No scripts: «+ script» above, or Import .anim.', 'Скриптов нет: «+ скрипт» сверху, или «Импорт .anim…».');
            const v = this.edit.animView;
            if (v === 'scripts' && this.edit.scriptsAs !== 'steps') return T('Text: the animation of the kind as the engine reads it; the line of the cursor is where the player below stands. Ctrl+Space: names, Ctrl+/: a comment.',
                'Текст: анимация вида так, как её читает движок; строка курсора — то место, где стоит проигрыватель внизу. Ctrl+Space — имена, Ctrl+/ — комментарий.');
            if (v === 'scripts') return T('Scripts: click a step and the player below stands on it; statements are edited as text (Enter). Space: play and pause, ← →: a frame, Home: from the start.',
                'Скрипты: щёлкните шаг — проигрыватель внизу встанет на него; команды правятся как текст (Enter). Пробел — пуск и пауза, ← → — кадр, Home — с начала.');
            if (v === 'numbers') return T('Game frames: number → picture and shift; this is how the player shows «frame N».', 'Кадры игры: номер → картинка и сдвиг; так проигрыватель показывает «frame N».');
            const t = this.edit.animTab;
            return {
                rules: T('Rules: the events and all the rules. A rule fills the cells «state × event»; the order means nothing.', 'Правила: события и все правила. Правило заполняет клетки «состояние × событие», порядок ничего не значит.'),
                byEvent: T('By event: what one event does in all the states.', 'По событию: что одно событие делает во всех состояниях.'),
                groups: T('Groups: a group gives a transition to all its states; «+ state» first shows what it will get.', 'Группы: группа даёт переход всем своим состояниям; «+ состояние» сначала показывает, что оно получит.'),
                graph: T('Graph: click: a state to the centre, double click: open it, drag from one to another: a new transition.', 'Граф: щелчок — состояние в центр, двойной — открыть, протянуть от одного к другому — новый переход.'),
                matrix: T('Matrix: a click on a cell opens the state; Hide group dims the transitions of one group.', 'Матрица: щелчок по клетке открывает состояние; Скрыть группу гасит переходы одной группы.'),
            } [t] || '';
        },
        where() {
            if (!this.script) return '';
            const steps = Anim.steps(this.script);
            const n = steps.filter(s => s.frame >= 0).length;
            return this.script.name + ' · ' + T(n + (n === 1 ? ' step' : ' steps'), 'шагов: ' + n);
        },
    },
    template: `
        <div class="bench-status-row">
            <span class="status-prompt">{{prompt}}</span>
            <span class="status-where">{{where}}</span>
            <span class="status-extra" v-if="set">{{set.name}}</span>
        </div>
    `
};
