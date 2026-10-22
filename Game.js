// What the game as a whole gives the pack besides kinds, scenes and dialogs, as tools/dgx_ge_pack.py of the engine
// takes it: constants (add_game), timers (add_timer), sounds (add_sound), shows (add_show) and the chase of kinds
// (add_chase). The editor keeps them in the JSON (optional fields, format version 1) and checks them as the packer
// would; the packer reads them from the JSON (Pack.add_sprites).
//   game:   [{name, value}]                                   constants of the game, in this order (the header names them)
//   constants: {name: value}                                  names of numbers the scripts write (add_constants): at
//                                                             packing only, in no blob and no header
//   timers: [{name, once | every [, until], reset, event, start}]  times as "500ms" or "2s"; reset never | scene | map;
//                                                             event '' none; start 'game' or ''
//   sounds: [name]                                            sounds by name, the order is their numbers
//   shows:  [{name, pictures: [{picture, x, y, layer, flip, color}], actors: [{name, kind, script, x, y, layer, flip, color}],
//            cues: [{at, role, event}]}]                      a scene that plays by itself; the role 'end' ends it
//   chases: [{kind, sense, sides: [], hearing, near: {left, right, up, down}, steps, calm}]
const Game = {
    // [key, label, hint, label in Russian, hint in Russian]: label and hint through label() and hint(); the English
    // label is what the problems of a part are said with
    parts: [
        ['constants', 'Numbers',
            'Numbers of the game (field game, add_game): numbers the parts of the engine take as they are (kinds, lives, records, boxes…) and the game’s own numbers. They are in the pack (blob GAME), in the header — PREFIX_GAME_NAME, in this order',
            'Числа',
            'Числа игры (поле game, add_game): числа, которые части движка берут как есть (kinds, lives, records, boxes…) и свои числа игры. Лежат в пакете (блоб GAME), в заголовке — PREFIX_GAME_ИМЯ, в этом порядке'],
        ['packConstants', 'Constants',
            'Constants (field constants, add_constants): names of numbers the texts of scripts write instead of the numbers (TICK_MS, TILE_FLOOR) — wherever a number may stand, like their own define; and conditions of dialog answers (if board & BOARD_PAD). The packer makes them numbers: they go neither into the pack nor into the header. A script cannot redefine such a name',
            'Константы',
            'Константы (поле constants, add_constants): имена чисел, которые пишут тексты скриптов вместо самих чисел (TICK_MS, TILE_FLOOR) — везде, где может стоять число, как свои define; и условия ответов диалогов (if board & BOARD_PAD). Числами их делает упаковщик: в пакет и в заголовок они не идут. Переопределить такое имя в скрипте нельзя'],
        ['timers', 'Timers',
            'Timers of the game: go off once after so long, or every so often (up to a limit); reset on leaving a scene or a map; an event to the owner; timer(NAME) in expressions of scripts reads its milliseconds',
            'Таймеры',
            'Таймеры игры: сработать раз через столько-то, или каждые столько-то (до предела); сброс при уходе со сцены или карты; событие владельцу; timer(ИМЯ) в выражениях скриптов читает его миллисекунды'],
        ['sounds', 'Sounds',
            'Sounds by names: only names so far, the number is the place in the list (the command sound N of scripts). In the header — PREFIX_SOUND_NAME',
            'Звуки',
            'Звуки по именам: пока только имена, номер — порядок в списке (команда sound N скриптов). В заголовке — PREFIX_SOUND_ИМЯ'],
        ['shows', 'Shows',
            'Shows: a scene that plays by itself — background pictures, actors of kinds with their scripts and cues in time (an event to a role at such a moment); the role end ends the show. A splash screen, a story, credits',
            'Показы',
            'Показы: сцена, которая играет сама — картинки фона, актёры видов со своими скриптами и реплики по времени (событие роли в такой-то момент); роль end заканчивает показ. Заставка, история, титры'],
        ['chases', 'Chase',
            'Chase: how a kind (a guard) pursues the hero from scene to scene — what it senses with, which sides it goes through, how far from home, when it calms down',
            'Погоня',
            'Погоня: как вид (стражник) преследует героя из сцены в сцену — чем чует, через какие стороны идёт, как далеко от дома, когда успокаивается'],
        ['crops', 'Crops',
            'Crops: a part of a frame’s picture as a picture of the pack of its own, with the same set of colors — a portrait from a frame (face of a dialog role), with its own base point',
            'Вырезки',
            'Вырезки: часть картинки кадра как своя картинка пакета того же набора цветов — портрет из кадра (face у роли диалога), со своей базовой точкой'],
    ],
    label(p) {
        return T(p[1], p[3]);
    },
    hint(p) {
        return T(p[2], p[4]);
    },
    resets: ['never', 'scene', 'map'],
    senses: ['none', 'sight', 'hearing', 'always'],
    sides: ['left', 'right', 'up', 'down', 'doors'],
    nearSides: ['left', 'right', 'up', 'down'],
    timePattern: /^(\d+)\s*(ms|s)$/,

    isIdent(name) {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
    },
    isTime(text) {
        const m = this.timePattern.exec(String(text).trim());
        return !!m && parseInt(m[1], 10) >= 1 && this.ms(text) < 2 ** 32;
    },
    // milliseconds of "500ms" or "2s"; a plain number is ms
    ms(text) {
        if (typeof text === 'number') return text;
        const m = this.timePattern.exec(String(text).trim());
        if (!m) return NaN;
        return parseInt(m[1], 10) * (m[2] === 's' ? 1000 : 1);
    },
    // the fields of the file, made whole; what is not there is empty
    read(file) {
        const str = v => typeof v === 'string' ? v : '';
        const int = (v, d) => Number.isInteger(v) ? v : d;
        const out = {
            game: [],
            constants: {},
            timers: [],
            sounds: [],
            shows: [],
            chases: []
        };
        if (Array.isArray(file.game)) out.game = file.game.filter(c => c && typeof c.name === 'string').map(c => ({
            name: c.name,
            value: int(c.value, 0)
        }));
        else if (file.game && typeof file.game === 'object') out.game = Object.entries(file.game).map(([name, value]) => ({
            name: name,
            value: int(value, 0)
        }));
        if (file.constants && typeof file.constants === 'object' && !Array.isArray(file.constants))
            for (const [name, value] of Object.entries(file.constants))
                if (typeof value === 'number') out.constants[name] = value;
        if (Array.isArray(file.timers)) out.timers = file.timers.filter(t => t && typeof t.name === 'string').map(t => ({
            name: t.name,
            once: str(t.once),
            every: str(t.every),
            until: str(t.until),
            reset: this.resets.includes(t.reset) ? t.reset : 'never',
            event: str(t.event),
            start: t.start === 'game' ? 'game' : ''
        }));
        if (Array.isArray(file.sounds)) out.sounds = file.sounds.filter(s => typeof s === 'string');
        if (Array.isArray(file.shows)) out.shows = file.shows.filter(s => s && typeof s.name === 'string').map(s => ({
            name: s.name,
            pictures: (Array.isArray(s.pictures) ? s.pictures : []).filter(p => p && typeof p.picture === 'string').map(p => ({
                picture: p.picture,
                x: int(p.x, 0),
                y: int(p.y, 0),
                layer: int(p.layer, 0),
                flip: !!p.flip,
                color: int(p.color, 0)
            })),
            actors: (Array.isArray(s.actors) ? s.actors : []).filter(a => a && typeof a.name === 'string').map(a => ({
                name: a.name,
                kind: str(a.kind),
                script: str(a.script),
                x: int(a.x, 0),
                y: int(a.y, 0),
                layer: int(a.layer, 0),
                flip: !!a.flip,
                color: int(a.color, 0)
            })),
            cues: (Array.isArray(s.cues) ? s.cues : []).filter(c => c && typeof c === 'object').map(c => ({
                at: typeof c.at === 'number' ? c.at + 'ms' : str(c.at),
                role: str(c.role),
                event: str(c.event)
            }))
        }));
        out.crops = [];
        if (Array.isArray(file.crops)) out.crops = file.crops.filter(c => c && typeof c.name === 'string' && typeof c.set === 'string' && typeof c.image === 'string').map(c => ({
            name: c.name,
            set: c.set,
            image: c.image,
            x: int(c.x, 0),
            y: int(c.y, 0),
            width: int(c.width, 1),
            height: int(c.height, 1),
            originX: int(c.originX, 0),
            originY: int(c.originY, 0)
        }));
        if (Array.isArray(file.chases)) out.chases = file.chases.filter(c => c && typeof c.kind === 'string').map(c => ({
            kind: c.kind,
            sense: this.senses.includes(c.sense) ? c.sense : 'always',
            sides: (Array.isArray(c.sides) ? c.sides : []).filter(s => this.sides.includes(s)),
            hearing: int(c.hearing, 0),
            near: Object.fromEntries(this.nearSides.filter(s => c.near && Number.isInteger(c.near[s])).map(s => [s, c.near[s]])),
            steps: int(c.steps, 0),
            calm: typeof c.calm === 'number' ? c.calm + 'ms' : str(c.calm)
        }));
        return out;
    },
    // the events of the pack: those of every kind, as the packer gathers them
    events(doc) {
        let names = new Set();
        for (const s of doc.sets)
            for (const e of s.animation.events) names.add(e);
        return [...names].sort();
    },
    // kinds with an animation: blobs of the pack a show or a chase may name
    kinds(doc) {
        return doc.sets.filter(s => s.animation.scripts.length);
    },
    // every picture of the pack by its name there: the frames of the kinds and the crops
    pictureNames(doc) {
        let names = [];
        for (const s of doc.sets)
            for (const f of s.frames) names.push(Anim.imageName(s, f.image));
        for (const c of doc.crops || []) names.push(c.name);
        return names;
    },
    freeName(list, base) {
        return Scene.freeName(list.map(x => typeof x === 'string' ? {
            name: x
        } : x), base);
    },
    // what the packer would refuse (error) or what is likely a mistake
    check(doc) {
        let out = [];
        const say = (part, name, text, error) => out.push({
            part: part,
            name: name,
            text: text,
            error: error !== false
        });
        const events = new Set(this.events(doc));
        const kinds = new Set(this.kinds(doc).map(s => s.name));
        const pictures = new Set(this.pictureNames(doc));
        let seen = new Set();
        for (const c of doc.game || []) {
            if (!this.isIdent(c.name)) say('constants', c.name, "'" + c.name + "' is no name: letters, digits and _");
            else if (seen.has(c.name)) say('constants', c.name, 'the number ' + c.name + ' twice');
            seen.add(c.name);
            if (!Number.isInteger(c.value) || c.value < -(2 ** 31) || c.value >= 2 ** 31) say('constants', c.name, c.name + ': ' + c.value + ' is no 32-bit number');
        }
        for (const [n, v] of Object.entries(doc.constants || {})) {
            if (!this.isIdent(n)) say('packConstants', n, "'" + n + "' is no name: letters, digits and _");
            else if (Anim.reserved(n)) say('packConstants', n, "'" + n + "' is a word of the language of scripts: they cannot name it", false);
            if (!Number.isInteger(v) || v < -(2 ** 31) || v >= 2 ** 31) say('packConstants', n, n + ': ' + v + ' is no 32-bit number');
        }
        seen = new Set();
        for (const t of doc.timers || []) {
            const n = t.name;
            if (!this.isIdent(n)) say('timers', n, "'" + n + "' is no name");
            else if (seen.has(n)) say('timers', n, 'the timer ' + n + ' twice');
            seen.add(n);
            if (!!t.once === !!t.every) say('timers', n, 'timer ' + n + ': once or every, one of them');
            if (t.until && !t.every) say('timers', n, 'timer ' + n + ': until goes with every');
            for (const k of ['once', 'every', 'until'])
                if (t[k] && !this.isTime(t[k])) say('timers', n, 'timer ' + n + ': ' + k + ' is a time, 500ms or 1s, not ' + t[k]);
            if (t.every && t.until && this.isTime(t.every) && this.isTime(t.until) && this.ms(t.until) < this.ms(t.every))
                say('timers', n, 'timer ' + n + ': until ' + t.until + ' is shorter than its period: it would never go off');
            if (t.event && !events.has(t.event)) say('timers', n, 'timer ' + n + ': no kind has the event ' + t.event);
        }
        if ((doc.timers || []).length > 255) say('timers', null, '255 timers at most');
        seen = new Set();
        for (const s of doc.sounds || []) {
            if (!this.isIdent(s)) say('sounds', s, "'" + s + "' is no name");
            else if (seen.has(s)) say('sounds', s, 'the sound ' + s + ' twice');
            seen.add(s);
        }
        seen = new Set();
        for (const sh of doc.shows || []) {
            const n = sh.name;
            if (!this.isIdent(n)) say('shows', n, "'" + n + "' is no name");
            else if (seen.has(n) || kinds.has(n)) say('shows', n, 'the show ' + n + ' and another blob (a show or a kind) have one name');
            seen.add(n);
            for (const p of sh.pictures)
                if (!pictures.has(p.picture)) say('shows', n, 'show ' + n + ': no picture ' + p.picture + ' in the pack');
            let roles = new Set();
            for (const a of sh.actors) {
                if (!a.name || a.name === 'end' || roles.has(a.name)) say('shows', n, 'show ' + n + ": a role '" + a.name + "' twice, empty or named end");
                roles.add(a.name);
                const kind = doc.sets.find(s => s.name === a.kind);
                if (!kind || !kind.animation.scripts.length) say('shows', n, 'show ' + n + ': no kind ' + a.kind + ' with an animation');
                else if (a.script && !kind.animation.scripts.some(s => s.name === a.script)) say('shows', n, 'show ' + n + ': no script ' + a.script + ' of ' + a.kind);
            }
            let ends = 0;
            for (const c of sh.cues) {
                if (!this.isTime(c.at)) say('shows', n, 'show ' + n + ': a cue at ' + c.at + ' is no time (500ms, 2s)');
                if (c.role === 'end') ends++;
                else {
                    if (!roles.has(c.role)) say('shows', n, 'show ' + n + ": a cue for no role '" + c.role + "'");
                    if (!events.has(c.event)) say('shows', n, 'show ' + n + ': no kind has the event ' + c.event);
                }
            }
            if (!ends) say('shows', n, 'show ' + n + ': no end: add a cue with the role end');
        }
        seen = new Set();
        const frameNames = new Set();
        for (const s of doc.sets)
            for (const f of s.frames) frameNames.add(Anim.imageName(s, f.image));
        for (const c of doc.crops || []) {
            const n = c.name;
            if (!this.isIdent(n)) say('crops', n, "'" + n + "' is no name");
            else if (seen.has(n) || frameNames.has(n)) say('crops', n, 'the crop ' + n + ' and another picture of the pack have one name');
            seen.add(n);
            const set = doc.sets.find(s => s.name === c.set);
            const frame = set && set.frames.find(f => f.image === c.image);
            if (!frame) say('crops', n, 'crop ' + n + ': no frame ' + c.set + '/' + c.image);
            else if (c.x < 0 || c.y < 0 || c.width < 1 || c.height < 1 || c.x + c.width > frame.width || c.y + c.height > frame.height)
                say('crops', n, 'crop ' + n + ': ' + c.x + ', ' + c.y + ', ' + c.width + ' × ' + c.height + ' is not inside ' + c.image + ' (' + frame.width + ' × ' + frame.height + ')');
        }
        seen = new Set();
        for (const c of doc.chases || []) {
            if (!kinds.has(c.kind)) say('chases', c.kind, 'chase ' + c.kind + ': no kind with an animation');
            else if (seen.has(c.kind)) say('chases', c.kind, 'chase ' + c.kind + ' twice');
            seen.add(c.kind);
            if (!Number.isInteger(c.steps) || c.steps < 0 || c.steps > 255) say('chases', c.kind, 'chase ' + c.kind + ': steps 0…255');
            if (c.calm && (!this.isTime(c.calm) || this.ms(c.calm) > 65535)) say('chases', c.kind, 'chase ' + c.kind + ': calm is a time up to 65535 ms (65s)');
            if (!Number.isInteger(c.hearing) || c.hearing < -32768 || c.hearing > 32767) say('chases', c.kind, 'chase ' + c.kind + ': hearing is a 16-bit number');
        }
        return out;
    },
};

// the editor of the game's parts in the middle: tables of the part chosen in the tree
const GameMain = {
    data() {
        return {
            Game: Game,
            message: '',
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
        part() {
            return this.edit.gamePart;
        },
        events() {
            return Game.events(this.sprites);
        },
        kinds() {
            return Game.kinds(this.sprites);
        },
        pictureNames() {
            return Game.pictureNames(this.sprites);
        },
        show() {
            return this.sprites.shows.find(s => s.name === this.edit.gameShow) || this.sprites.shows[0] || null;
        },
        problems() {
            return Game.check(this.sprites).filter(p => p.part === this.part);
        },
    },
    methods: {
        scriptsOf(kind) {
            const s = this.sprites.sets.find(x => x.name === kind);
            return s ? s.animation.scripts.map(x => x.name) : [];
        },
        timerKind(t) {
            return t.once ? 'once' : t.until ? 'until' : 'every';
        },
        setTimerKind(t, kind) {
            const period = t.once || t.every || '1s';
            if (kind === 'once') {
                t.once = period;
                t.every = '';
                t.until = '';
            } else {
                t.every = period;
                t.once = '';
                t.until = kind === 'until' ? (t.until || '10s') : '';
            }
        },
        setInt(obj, key, event, low, high, fallback) {
            const v = parseInt(event.target.value, 10);
            if (Number.isInteger(v) && v >= low && v <= high) obj[key] = v;
            else {
                this.message = key + T(': a whole number ', ': целое число ') + low + '…' + high;
                event.target.value = obj[key] ?? fallback ?? '';
            }
        },
        // near: a number, or empty for anywhere
        setNear(c, side, event) {
            const text = event.target.value.trim();
            if (!text) {
                delete c.near[side];
                return;
            }
            const v = parseInt(text, 10);
            if (Number.isInteger(v) && v >= -32768 && v <= 32767) c.near[side] = v;
            else event.target.value = c.near[side] ?? '';
        },
        rename(list, item, event, what) {
            const name = event.target.value.trim();
            if (typeof item === 'string') {
                const i = list.indexOf(item);
                if (!name) list.splice(i, 1);
                else list[i] = name;
                return;
            }
            if (!name) {
                const whatRu = {
                    number: 'число',
                    timer: 'таймер',
                    sound: 'звук',
                    show: 'показ'
                }[what] || what;
                if (confirm(T('Remove ' + what + ' ' + item.name + '?', 'Удалить ' + whatRu + ' ' + item.name + '?'))) list.splice(list.indexOf(item), 1);
                else event.target.value = item.name;
                return;
            }
            item.name = name;
            if (what === 'show') this.edit.gameShow = name;
        },
        move(list, item, d) {
            const i = list.indexOf(item),
                j = i + d;
            if (i < 0 || j < 0 || j >= list.length) return;
            [list[i], list[j]] = [list[j], list[i]];
        },
        remove(list, item) {
            list.splice(list.indexOf(item), 1);
        },
        // the constants of the scripts: an object, its order kept on a rename; the scripts follow the new name
        packConstantRename(name, event) {
            const to = event.target.value.trim();
            const c = this.sprites.constants;
            if (to === name || !(name in c)) return;
            if (!to) {
                if (confirm(T('Remove constant ' + name + '? Scripts that name it get errors', 'Удалить константу ' + name + '? Скрипты, которые её называют, получат ошибки'))) delete c[name];
                else event.target.value = name;
                return;
            }
            if (to in c) {
                this.message = T('the constant ' + to + ' is there already', 'константа ' + to + ' уже есть');
                event.target.value = name;
                return;
            }
            this.sprites.constants = Object.fromEntries(Object.entries(c).map(([k, v]) => [k === name ? to : k, v]));
            for (const set of this.sprites.sets)
                if (set.animation) Anim.renameInExpressions(set.animation, name, to);
        },
        packConstantValue(name, event) {
            const v = parseInt(event.target.value, 10);
            if (Number.isInteger(v) && v >= -(2 ** 31) && v < 2 ** 31) this.sprites.constants[name] = v;
            else {
                this.message = name + T(': a whole number of 32 bits', ': целое число, 32 бита');
                event.target.value = this.sprites.constants[name];
            }
        },
        addPackConstant() {
            let n = 1;
            while (('CONSTANT_' + n) in this.sprites.constants) ++n;
            this.sprites.constants['CONSTANT_' + n] = 0;
        },
        addConstant() {
            this.sprites.game.push({
                name: Game.freeName(this.sprites.game, 'number'),
                value: 0
            });
        },
        addTimer() {
            this.sprites.timers.push({
                name: Game.freeName(this.sprites.timers, 'timer'),
                once: '',
                every: '1s',
                until: '',
                reset: 'never',
                event: '',
                start: ''
            });
        },
        addSound() {
            this.sprites.sounds.push(Game.freeName(this.sprites.sounds, 'sound'));
        },
        addShow() {
            const name = Game.freeName(this.sprites.shows, 'show');
            this.sprites.shows.push({
                name: name,
                pictures: [],
                actors: [],
                cues: [{
                    at: '5s',
                    role: 'end',
                    event: ''
                }]
            });
            this.edit.gameShow = name;
        },
        addShowPicture() {
            this.show.pictures.push({
                picture: this.pictureNames[0] || '',
                x: 0,
                y: 0,
                layer: 0,
                flip: false,
                color: 0
            });
        },
        addShowActor() {
            const k = this.kinds[0];
            this.show.actors.push({
                name: Game.freeName(this.show.actors, 'actor'),
                kind: k ? k.name : '',
                script: '',
                x: 0,
                y: 0,
                layer: 0,
                flip: false,
                color: 0
            });
        },
        addCue() {
            const a = this.show.actors[0];
            this.show.cues.push({
                at: '1s',
                role: a ? a.name : 'end',
                event: a ? this.events[0] || '' : ''
            });
        },
        addCrop() {
            const set = this.sprites.sets.find(s => s.frames.length);
            if (!set) {
                this.message = T('no kind with pictures to crop', 'нет вида с картинками, из которых вырезать');
                return;
            }
            this.sprites.crops.push({
                name: Game.freeName(this.sprites.crops, 'CROP'),
                set: set.name,
                image: set.frames[0].image,
                x: 0,
                y: 0,
                width: Math.min(8, set.frames[0].width),
                height: Math.min(8, set.frames[0].height),
                originX: 0,
                originY: 0
            });
        },
        framesOf(setName) {
            const s = this.sprites.sets.find(x => x.name === setName);
            return s ? s.frames.map(f => f.image) : [];
        },
        addChase() {
            const used = new Set(this.sprites.chases.map(c => c.kind));
            const k = this.kinds.find(s => !used.has(s.name));
            if (!k) {
                this.message = T('every kind with an animation has its chase already, or there is no kind', 'у каждого вида с анимацией погоня уже есть, или видов нет');
                return;
            }
            this.sprites.chases.push({
                kind: k.name,
                sense: 'always',
                sides: ['left', 'right'],
                hearing: 0,
                near: {},
                steps: 0,
                calm: ''
            });
        },
        toggleSide(c, side, on) {
            if (on && !c.sides.includes(side)) c.sides = Game.sides.filter(s => s === side || c.sides.includes(s));
            if (!on) c.sides = c.sides.filter(s => s !== side);
        },
        openPart(p) {
            this.edit.gamePart = p;
        },
    },
    template: `
        <div class="game-main">
            <div class="anim-subtabs">
                <a v-for="p in Game.parts" href="#" :class="{active: part === p[0]}" @click.prevent="openPart(p[0])" :title="Game.hint(p)">{{Game.label(p)}}</a>
            </div>
            <div v-if="message" class="error-text">{{message}} <button @click="message = ''">x</button></div>

            <template v-if="part === 'constants'">
                <div class="view-toolbar"><button class="btn btn-sm btn-outline-primary" @click="addConstant" :title="T('A new number of the game; the order is the order in the header of the pack', 'Новое число игры; порядок — порядок в заголовке пакета')">{{T('+ number', '+ число')}}</button>
                    <span class="help-text">{{T('add_game(kinds=29, lives=30, …): numbers the parts of the engine and the game take as they are; the name is PREFIX_GAME_NAME', 'add_game(kinds=29, lives=30, …): числа, которые части движка и игра берут как есть; имя — PREFIX_GAME_ИМЯ')}}</span></div>
                <table class="table table-sm game-table"><thead><tr><th>{{T('name', 'имя')}}</th><th>{{T('value', 'значение')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="c in sprites.game" :key="c.name + sprites.game.indexOf(c)">
                        <td><input :value="c.name" @change="rename(sprites.game, c, $event, 'number')" :title="T('The name of the number: letters, digits, _. Erase it to remove the number', 'Имя числа: буквы, цифры, _. Сотрите — удалится')"></td>
                        <td><input class="num" :value="c.value" @change="setInt(c, 'value', $event, -(2 ** 31), 2 ** 31 - 1)" :title="T('A whole number, 32 bits', 'Целое число, 32 бита')"></td>
                        <td><button @click="move(sprites.game, c, -1)" :title="T('Earlier', 'Раньше')">↑</button><button @click="move(sprites.game, c, 1)" :title="T('Later', 'Позже')">↓</button>
                            <button class="btn btn-sm btn-remove" @click="remove(sprites.game, c)">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!sprites.game.length" class="anim-empty">{{T('No numbers: «+ number».', 'Чисел нет: «+ число».')}}</div>
            </template>

            <template v-if="part === 'packConstants'">
                <div class="view-toolbar"><button class="btn btn-sm btn-outline-primary" @click="addPackConstant" :title="T('A new constant for the texts of scripts', 'Новая константа для текстов скриптов')">{{T('+ constant', '+ константа')}}</button>
                    <span class="help-text">{{T('add_constants(TICK_MS=83, …): scripts write the name instead of the number (frame X TICK_MS ms, signal CLOCK_OUT); it does not go into the pack', 'add_constants(TICK_MS=83, …): имя пишут в скриптах вместо числа (frame X TICK_MS ms, signal CLOCK_OUT); в пакет не идёт')}}</span></div>
                <table class="table table-sm game-table"><thead><tr><th>{{T('name', 'имя')}}</th><th>{{T('value', 'значение')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="(v, n) in sprites.constants" :key="n">
                        <td><input :value="n" @change="packConstantRename(n, $event)" :title="T('The name: letters, digits, _. A rename changes it in the scripts too. Erase it to remove the constant', 'Имя: буквы, цифры, _. Переименование меняет его и в скриптах. Сотрите — удалится')"></td>
                        <td><input class="num" :value="v" @change="packConstantValue(n, $event)" :title="T('A whole number, 32 bits', 'Целое число, 32 бита')"></td>
                        <td><button class="btn btn-sm btn-remove" @click="delete sprites.constants[n]" :title="T('Remove: scripts that name it get errors', 'Удалить: скрипты, которые его называют, получат ошибки')">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!Object.keys(sprites.constants).length" class="anim-empty">{{T('No constants: «+ constant».', 'Констант нет: «+ константа».')}}</div>
            </template>

            <template v-if="part === 'timers'">
                <div class="view-toolbar"><button class="btn btn-sm btn-outline-primary" @click="addTimer" :title="T('A new timer', 'Новый таймер')">{{T('+ timer', '+ таймер')}}</button>
                    <span class="help-text">{{T('timer(NAME) in expressions reads its milliseconds; the command timer start|stop|hold|go NAME drives it', 'timer(ИМЯ) в выражениях читает его миллисекунды; команда timer start|stop|hold|go ИМЯ управляет им')}}</span></div>
                <table class="table table-sm game-table"><thead><tr><th>{{T('name', 'имя')}}</th><th>{{T('goes off', 'срабатывает')}}</th><th>{{T('period', 'период')}}</th><th>{{T('until', 'предел')}}</th><th>{{T('reset', 'сброс')}}</th><th>{{T('event', 'событие')}}</th><th>{{T('start', 'старт')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="t in sprites.timers" :key="sprites.timers.indexOf(t)">
                        <td><input :value="t.name" size="8" @change="rename(sprites.timers, t, $event, 'timer')" :title="T('The name of the timer: PREFIX_TIMER_NAME in the header; erase it to remove the timer', 'Имя таймера: PREFIX_TIMER_ИМЯ в заголовке; сотрите — удалится')"></td>
                        <td><select :value="timerKind(t)" @change="setTimerKind(t, $event.target.value)" :title="T('once — once, so long after the start; every — every so often until stopped; until — every so often, but no longer than the limit from the start', 'once — раз, через столько после старта; every — каждые столько, пока не остановят; until — каждые столько, но не дольше предела от старта')">
                            <option value="once">once</option><option value="every">every</option><option value="until">every, until</option></select></td>
                        <td><input class="num" :value="t.once || t.every" size="6" @change="t.once ? t.once = $event.target.value.trim() : t.every = $event.target.value.trim()" :title="T('A time: 500ms or 2s', 'Время: 500ms или 2s')"></td>
                        <td><input v-if="t.until" class="num" :value="t.until" size="6" @change="t.until = $event.target.value.trim()" :title="T('The limit from the start: 500ms or 10s', 'Предел от старта: 500ms или 10s')"><span v-else class="help-text">—</span></td>
                        <td><select v-model="t.reset" :title="T('When the timer stops by itself: never — never; scene — on leaving the scene it was started in; map — on leaving the map (the level)', 'Когда таймер останавливается сам: never — никогда; scene — при уходе со сцены, где его запустили; map — при уходе с карты (уровня)')"><option v-for="r in Game.resets" :value="r">{{r}}</option></select></td>
                        <td><input :value="t.event" size="8" list="game-events" @change="t.event = $event.target.value.trim()" :title="T('The event of the pack sent to the owner of the timer when it goes off; empty — none (a clock)', 'Событие пакета, которое посылается владельцу таймера, когда он срабатывает; пусто — никакого (часы)')"></td>
                        <td><label :title="T('Runs from the start of the game, the owner is the game (a clock); otherwise the game or a script starts it', 'Идёт с начала игры, владелец — игра (часы); иначе его запускает игра или скрипт')"><input type="checkbox" :checked="t.start === 'game'" @change="t.start = $event.target.checked ? 'game' : ''"> game</label></td>
                        <td><button class="btn btn-sm btn-remove" @click="remove(sprites.timers, t)">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!sprites.timers.length" class="anim-empty">{{T('No timers: «+ timer».', 'Таймеров нет: «+ таймер».')}}</div>
            </template>

            <template v-if="part === 'sounds'">
                <div class="view-toolbar"><button class="btn btn-sm btn-outline-primary" @click="addSound" :title="T('A new sound', 'Новый звук')">{{T('+ sound', '+ звук')}}</button>
                    <span class="help-text">{{T('the number of a sound is its place in the list (from 0): the command sound N of scripts; no data of sounds yet, only names', 'номер звука — его место в списке (с 0): команда sound N скриптов; данных звука пока нет, только имена')}}</span></div>
                <table class="table table-sm game-table"><thead><tr><th>N</th><th>{{T('name', 'имя')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="(s, i) in sprites.sounds" :key="i">
                        <td>{{i}}</td>
                        <td><input :value="s" @change="rename(sprites.sounds, s, $event, 'sound')" :title="T('The name of the sound: PREFIX_SOUND_NAME; erase it to remove the sound', 'Имя звука: PREFIX_SOUND_ИМЯ; сотрите — удалится')"></td>
                        <td><button @click="move(sprites.sounds, s, -1)" :title="T('Earlier (a smaller number)', 'Раньше (номер меньше)')">↑</button><button @click="move(sprites.sounds, s, 1)" :title="T('Later', 'Позже')">↓</button>
                            <button class="btn btn-sm btn-remove" @click="remove(sprites.sounds, s)">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!sprites.sounds.length" class="anim-empty">{{T('No sounds: «+ sound».', 'Звуков нет: «+ звук».')}}</div>
            </template>

            <template v-if="part === 'shows'">
                <div class="view-toolbar">
                    <label>{{T('Show', 'Показ')}} <select v-model="edit.gameShow" :title="T('The show', 'Показ')"><option v-for="s in sprites.shows" :value="s.name">{{s.name}}</option></select></label>
                    <button class="btn btn-sm btn-outline-primary" @click="addShow" :title="T('A new show with one cue, end', 'Новый показ с одной репликой end')">{{T('+ show', '+ показ')}}</button>
                    <template v-if="show">
                        <input :value="show.name" size="10" @change="rename(sprites.shows, show, $event, 'show')" :title="T('The name of the show is the name of the blob in the pack; erase it to remove the show', 'Имя показа — имя блоба в пакете; сотрите — удалится')">
                        <button class="btn btn-sm btn-remove" @click="remove(sprites.shows, show); edit.gameShow = sprites.shows.length ? sprites.shows[0].name : ''">{{T('× show', '× показ')}}</button>
                    </template>
                </div>
                <template v-if="show">
                    <h6 :title="T('The background of the show: pictures of the pack in their places (by the base point), in layers', 'Фон показа: картинки пакета на своих местах (базовой точкой), в слоях')">{{T('Pictures', 'Картинки')}} <button class="btn btn-sm btn-outline-secondary" @click="addShowPicture">{{T('+ picture', '+ картинка')}}</button></h6>
                    <table class="table table-sm game-table"><thead><tr><th>{{T('picture', 'картинка')}}</th><th>x</th><th>y</th><th>{{T('layer', 'слой')}}</th><th>{{T('flip', 'отражение')}}</th><th>{{T('color', 'цвет')}}</th><th></th></tr></thead><tbody>
                        <tr v-for="p in show.pictures" :key="show.pictures.indexOf(p)">
                            <td><input :value="p.picture" list="game-pictures" size="18" @change="p.picture = $event.target.value.trim()" :title="T('The name of the picture in the pack (KIND_FILE or the frame’s own name)', 'Имя картинки в пакете (ВИД_ФАЙЛ или своё имя кадра)')"></td>
                            <td><input class="num" :value="p.x" @change="setInt(p, 'x', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="p.y" @change="setInt(p, 'y', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="p.layer" @change="setInt(p, 'layer', $event, 0, 7)" :title="T('The layer of the show’s scene, 0…7', 'Слой сцены показа, 0…7')"></td>
                            <td><input type="checkbox" v-model="p.flip" :title="T('Mirrored', 'Отражена')"></td>
                            <td><input class="num" :value="p.color" @change="setInt(p, 'color', $event, 0, 255)" :title="T('The color of a one-bit picture: the number of a color of its set', 'Цвет однобитной картинки: номер цвета её набора')"></td>
                            <td><button class="btn btn-sm btn-remove" @click="remove(show.pictures, p)">×</button></td>
                        </tr>
                    </tbody></table>
                    <h6 :title="T('The actors of the show: a role, a kind (an animation of the pack), the script it begins with, a place', 'Актёры показа: роль, вид (анимация пакета), скрипт, с которого он начинает, место')">{{T('Actors', 'Актёры')}} <button class="btn btn-sm btn-outline-secondary" @click="addShowActor">{{T('+ actor', '+ актёр')}}</button></h6>
                    <table class="table table-sm game-table"><thead><tr><th>{{T('role', 'роль')}}</th><th>{{T('kind', 'вид')}}</th><th>{{T('script', 'скрипт')}}</th><th>x</th><th>y</th><th>{{T('layer', 'слой')}}</th><th>{{T('flip', 'отражение')}}</th><th>{{T('color', 'цвет')}}</th><th></th></tr></thead><tbody>
                        <tr v-for="a in show.actors" :key="show.actors.indexOf(a)">
                            <td><input :value="a.name" size="8" @change="a.name = $event.target.value.trim()" :title="T('The role: cues call the actor by it; end is not allowed', 'Роль: так реплики называют актёра; end — нельзя')"></td>
                            <td><select v-model="a.kind" :title="T('A kind with an animation', 'Вид с анимацией')"><option v-for="k in kinds" :value="k.name">{{k.name}}</option></select></td>
                            <td><select v-model="a.script" :title="T('The script the actor begins with; empty — the first', 'Скрипт, с которого актёр начинает; пусто — первый')"><option value="">{{T('(first)', '(первый)')}}</option><option v-for="s in scriptsOf(a.kind)" :value="s">{{s}}</option></select></td>
                            <td><input class="num" :value="a.x" @change="setInt(a, 'x', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="a.y" @change="setInt(a, 'y', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="a.layer" @change="setInt(a, 'layer', $event, 0, 7)"></td>
                            <td><input type="checkbox" v-model="a.flip"></td>
                            <td><input class="num" :value="a.color" @change="setInt(a, 'color', $event, 0, 255)" :title="T('The color of the actor’s one-bit pictures', 'Цвет однобитных картинок актёра')"></td>
                            <td><button class="btn btn-sm btn-remove" @click="remove(show.actors, a)">×</button></td>
                        </tr>
                    </tbody></table>
                    <h6 :title="T('Cues in time: at such a moment from the beginning the actor of the role is sent an event; the role end is the end of the show. The order does not matter, the packer sorts them by time', 'Реплики по времени: в такой-то момент от начала актёру роли посылается событие; роль end — конец показа. Порядок не важен, упаковщик ставит их по времени')">{{T('Cues', 'Реплики')}} <button class="btn btn-sm btn-outline-secondary" @click="addCue">{{T('+ cue', '+ реплика')}}</button></h6>
                    <table class="table table-sm game-table"><thead><tr><th>{{T('at', 'время')}}</th><th>{{T('role', 'роль')}}</th><th>{{T('event', 'событие')}}</th><th></th></tr></thead><tbody>
                        <tr v-for="c in show.cues" :key="show.cues.indexOf(c)">
                            <td><input class="num" :value="c.at" size="6" @change="c.at = $event.target.value.trim()" :title="T('The time from the beginning: 500ms or 2s', 'Время от начала: 500ms или 2s')"></td>
                            <td><select v-model="c.role" :title="T('The role of an actor, or end — the end of the show', 'Роль актёра, или end — конец показа')"><option value="end">end</option><option v-for="a in show.actors" :value="a.name">{{a.name}}</option></select></td>
                            <td><input v-if="c.role !== 'end'" :value="c.event" size="10" list="game-events" @change="c.event = $event.target.value.trim()" :title="T('The event of the pack the actor gets', 'Событие пакета, которое получит актёр')"><span v-else class="help-text">—</span></td>
                            <td><button class="btn btn-sm btn-remove" @click="remove(show.cues, c)">×</button></td>
                        </tr>
                    </tbody></table>
                </template>
                <div v-else class="anim-empty">{{T('No shows: «+ show».', 'Показов нет: «+ показ».')}}</div>
            </template>

            <template v-if="part === 'chases'">
                <div class="view-toolbar"><button class="btn btn-sm btn-outline-primary" @click="addChase" :title="T('A chase for a kind that has none yet', 'Погоня для вида, у которого её ещё нет')">{{T('+ chase', '+ погоня')}}</button>
                    <span class="help-text">{{T('how a kind pursues the hero from scene to scene; all the chases are one blob, CHASE', 'как вид преследует героя из сцены в сцену; все погони — один блоб CHASE')}}</span></div>
                <table class="table table-sm game-table"><thead><tr><th>{{T('kind', 'вид')}}</th><th>{{T('sense', 'чутьё')}}</th><th>{{T('sides', 'стороны')}}</th><th>{{T('hearing', 'слух')}}</th><th :title="T('How near the side one must be to go through it; empty — anywhere; below zero — beyond it', 'Как близко к стороне надо быть, чтобы пойти через неё; пусто — где угодно; меньше нуля — за ней')">{{T('near', 'близко')}} left · right · up · down</th><th>{{T('steps', 'шаги')}}</th><th>{{T('calm', 'покой')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="c in sprites.chases" :key="sprites.chases.indexOf(c)">
                        <td><select v-model="c.kind"><option v-for="k in kinds" :value="k.name">{{k.name}}</option></select></td>
                        <td><select v-model="c.sense" :title="T('What it senses the hero with: sight — sees, hearing — hears (within hearing), always — always knows, none — does not pursue', 'Чем чует героя: sight — видит, hearing — слышит (в пределах hearing), always — всегда знает, none — не преследует')"><option v-for="s in Game.senses" :value="s">{{s}}</option></select></td>
                        <td><label v-for="s in Game.sides" class="game-side"><input type="checkbox" :checked="c.sides.includes(s)" @change="toggleSide(c, s, $event.target.checked)"> {{s}}</label></td>
                        <td><input class="num" :value="c.hearing" @change="setInt(c, 'hearing', $event, -32768, 32767)" :title="T('How near it hears, in points of the scene', 'Как близко слышит, точек сцены')"></td>
                        <td><input v-for="s in Game.nearSides" class="num game-near" :value="c.near[s] ?? ''" :placeholder="s" @change="setNear(c, s, $event)"></td>
                        <td><input class="num" :value="c.steps" @change="setInt(c, 'steps', $event, 0, 255)" :title="T('How many scenes from home it goes; 0 — no limit', 'Сколько сцен от дома уходит; 0 — без предела')"></td>
                        <td><input class="num" :value="c.calm" size="6" @change="c.calm = $event.target.value.trim()" :title="T('How long out of its senses before it calms down: 5s; empty or 0 — never', 'Через сколько вне чувств успокаивается: 5s; пусто или 0 — никогда')"></td>
                        <td><button class="btn btn-sm btn-remove" @click="remove(sprites.chases, c)">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!sprites.chases.length" class="anim-empty">{{T('No chases: «+ chase».', 'Погонь нет: «+ погоня».')}}</div>
            </template>

            <template v-if="part === 'crops'">
                <div class="view-toolbar"><button class="btn btn-sm btn-outline-primary" @click="addCrop" :title="T('A new crop of the first frame', 'Новая вырезка из первого кадра')">{{T('+ crop', '+ вырезка')}}</button>
                    <span class="help-text">{{T('add_crop(name, picture, x, y, width, height, origin): a part of a picture as a picture of the pack of its own — a portrait for face in dialogs', 'add_crop(name, picture, x, y, width, height, origin): часть картинки как своя картинка пакета — портрет для face в диалогах')}}</span></div>
                <table class="table table-sm game-table"><thead><tr><th>{{T('name', 'имя')}}</th><th>{{T('kind', 'вид')}}</th><th>{{T('picture', 'картинка')}}</th><th>x</th><th>y</th><th>{{T('width', 'ширина')}}</th><th>{{T('height', 'высота')}}</th><th :title="T('The base point of the crop, in its pixels', 'Базовая точка вырезки, в её пикселях')">{{T('origin', 'база')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="c in sprites.crops" :key="sprites.crops.indexOf(c)">
                        <td><input :value="c.name" size="10" @change="c.name = $event.target.value.trim()" :title="T('The name of the picture in the pack: IMG_NAME', 'Имя картинки в пакете: IMG_ИМЯ')"></td>
                        <td><select v-model="c.set"><option v-for="s in sprites.sets.filter(s => s.frames.length)" :value="s.name">{{s.name}}</option></select></td>
                        <td><select v-model="c.image"><option v-for="f in framesOf(c.set)" :value="f">{{f}}</option></select></td>
                        <td><input class="num" :value="c.x" @change="setInt(c, 'x', $event, 0, 32767)" :title="T('From the top left corner of the picture', 'От левого верхнего угла картинки')"></td>
                        <td><input class="num" :value="c.y" @change="setInt(c, 'y', $event, 0, 32767)"></td>
                        <td><input class="num" :value="c.width" @change="setInt(c, 'width', $event, 1, 32767)"></td>
                        <td><input class="num" :value="c.height" @change="setInt(c, 'height', $event, 1, 32767)"></td>
                        <td><input class="num" :value="c.originX" @change="setInt(c, 'originX', $event, -32768, 32767)"> <input class="num" :value="c.originY" @change="setInt(c, 'originY', $event, -32768, 32767)"></td>
                        <td><button class="btn btn-sm btn-remove" @click="remove(sprites.crops, c)">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!sprites.crops.length" class="anim-empty">{{T('No crops: «+ crop».', 'Вырезок нет: «+ вырезка».')}}</div>
            </template>

            <datalist id="game-events"><option v-for="e in events" :value="e"></option></datalist>
            <datalist id="game-pictures"><option v-for="n in pictureNames" :value="n"></option></datalist>
            <div v-if="problems.length" class="game-problems">
                <div v-for="p in problems" :class="p.error ? 'error-text' : 'warning-text'">{{p.error ? '✖' : '⚠'}} {{p.text}}</div>
            </div>
        </div>
    `
};

const GameStatus = {
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        prompt() {
            const p = Game.parts.find(x => x[0] === this.edit.gamePart);
            return p ? Game.label(p) + ': ' + Game.hint(p) : '';
        },
    },
    template: `
        <div class="bench-status-row">
            <span class="status-prompt">{{prompt}}</span>
        </div>
    `
};
