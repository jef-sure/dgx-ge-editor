// What the game as a whole gives the pack besides kinds, scenes and dialogs, as tools/dgx_ge_pack.py of the engine
// takes it: constants (add_game), timers (add_timer), sounds (add_sound), shows (add_show) and the chase of kinds
// (add_chase). The editor keeps them in the JSON (optional fields, format version 1) and checks them as the packer
// would; the packer reads them from the JSON (Pack.add_sprites).
//   game:   [{name, value}]                                   constants of the game, in this order (the header names them)
//   constants: {name: value}                                  names of numbers the scripts write (add_constants): at
//                                                             packing, in no blob; the header gives them to C (PREFIX_NAME)
//   timers: [{name, once | every [, until], reset, event, start}]  times as "500ms" or "2s"; reset never | scene | map;
//                                                             event '' none; start 'game' or ''
//   sounds: [name]                                            sounds by name, the order is their numbers
//   shows:  [{name, pictures: [{picture, x, y, layer, flip, rotation?, color}], actors: [{name, kind, script, x, y, layer, flip,
//            rotation?, color}], cues: [{at, role, event}]}] a scene that plays by itself; the role 'end' ends it;
//                                                             rotation: degrees clockwise after the mirror, 0, 90, 180, 270
//   chases: [{kind, sense, sides: [], hearing, near: {left, right, up, down}, steps, calm}]
//   variables: [{name, value}]                                the game's variables (add_variable), numbered in this order:
//                                                             game_var.<name> in scripts and dialogs; the header
//                                                             PREFIX_GAME_VAR_NAME; the value it begins with, 32 bits
//   synth: 'fm' | 'chip' | 'nes'                              the synthesizer of the musics (fm when not said)
//   music: [name]                                             musics by notes (add_music): their texts music/<name>.mml
//                                                             beside the document; a script's music <name> plays one
//   musicTexts: {name: text}                                  the notes (MML) of the musics as the editor keeps them: the
//                                                             files music/<name>.mml of the folder (the packer reads those)
const Game = {
    // [key, label, hint, label in Russian, hint in Russian]: label and hint through label() and hint(); the English
    // label is what the problems of a part are said with
    parts: [
        ['constants', 'Numbers',
            'Numbers of the game (field game, add_game): numbers the parts of the engine take as they are (kinds, lives, records, boxes…) and the game’s own numbers. They are in the pack (blob GAME), in the header — PREFIX_GAME_NAME, in this order',
            'Числа',
            'Числа игры (поле game, add_game): числа, которые части движка берут как есть (kinds, lives, records, boxes…) и свои числа игры. Лежат в пакете (блоб GAME), в заголовке — PREFIX_GAME_ИМЯ, в этом порядке'],
        ['packConstants', 'Constants',
            'Constants (field constants, add_constants): names of numbers the texts of scripts write instead of the numbers (TICK_MS, TILE_FLOOR) — wherever a number may stand, like their own define; and conditions of dialog answers (if board & BOARD_PAD). The packer makes them numbers: they are in no blob; the header gives them to C as PREFIX_NAME (DGX-GE 0.3.0), so a name must be no other name of the header. A script cannot redefine such a name',
            'Константы',
            'Константы (поле constants, add_constants): имена чисел, которые пишут тексты скриптов вместо самих чисел (TICK_MS, TILE_FLOOR) — везде, где может стоять число, как свои define; и условия ответов диалогов (if board & BOARD_PAD). Числами их делает упаковщик: в блобы они не идут; заголовок даёт их C как PREFIX_ИМЯ (DGX-GE 0.3.0), так что имя не должно совпадать с другим именем заголовка. Переопределить такое имя в скрипте нельзя'],
        ['timers', 'Timers',
            'Timers of the game: go off once after so long, or every so often (up to a limit); reset on leaving a scene or a map; an event to the owner; timer(NAME) in expressions of scripts reads its milliseconds',
            'Таймеры',
            'Таймеры игры: сработать раз через столько-то, или каждые столько-то (до предела); сброс при уходе со сцены или карты; событие владельцу; timer(ИМЯ) в выражениях скриптов читает его миллисекунды'],
        ['sounds', 'Sounds',
            'Sounds by names: the number is the place in the list (the command sound N of scripts), the samples sounds/NAME.wav beside the document. In the header — PREFIX_SOUND_NAME',
            'Звуки',
            'Звуки по именам: номер — порядок в списке (команда sound N скриптов), сэмплы — sounds/ИМЯ.wav рядом с документом. В заголовке — PREFIX_SOUND_ИМЯ'],
        ['shows', 'Shows',
            'Shows: a scene that plays by itself — background pictures, actors of kinds with their scripts and cues in time (an event to a role at such a moment); the role end ends the show. A splash screen, a story, credits',
            'Показы',
            'Показы: сцена, которая играет сама — картинки фона, актёры видов со своими скриптами и реплики по времени (событие роли в такой-то момент); роль end заканчивает показ. Заставка, история, титры'],
        ['chases', 'Chase',
            'Chase: how a kind (a guard) pursues the hero from scene to scene — what it senses with, which sides it goes through, how far from home, when it calms down',
            'Погоня',
            'Погоня: как вид (стражник) преследует героя из сцены в сцену — чем чует, через какие стороны идёт, как далеко от дома, когда успокаивается'],
        ['variables', 'Variables',
            'Variables of the game (field variables, add_variable): numbers that change as the game plays and belong to no actor — settings, a score, the state of the rules. Scripts read game_var.NAME and write it (set, add game_var.NAME), dialogs read it in conditions, edit it by a control (control SLIDER game_var.volume), show it in a line ({game_var.score}). Numbered in this order; the header gives PREFIX_GAME_VAR_NAME (DGX-GE 0.4.0)',
            'Переменные',
            'Переменные игры (поле variables, add_variable): числа, которые меняются по ходу игры и не принадлежат ни одному актёру — настройки, счёт, состояние правил. Скрипты читают game_var.ИМЯ и пишут его (set, add game_var.ИМЯ), диалоги читают в условиях, меняют контролом (control SLIDER game_var.volume), показывают в реплике ({game_var.score}). Нумеруются в этом порядке; заголовок даёт PREFIX_GAME_VAR_ИМЯ (DGX-GE 0.4.0)'],
        ['music', 'Music',
            'Music by notes (field music, add_music): songs in MML on a synthesizer of the game (synth: fm, chip, nes), their notes music/NAME.mml beside the document. Scripts play them (music NAME 500ms, music stop, music volume 30%), a scene starts its own as the game enters it; the header gives PREFIX_MUSIC_NAME (DGX-GE 0.4.0)',
            'Музыка',
            'Музыка нотами (поле music, add_music): песни на MML для синтезатора игры (synth: fm, chip, nes), их ноты — music/ИМЯ.mml рядом с документом. Скрипты играют их (music ИМЯ 500ms, music stop, music volume 30%), сцена запускает свою, когда игра в неё входит; заголовок даёт PREFIX_MUSIC_ИМЯ (DGX-GE 0.4.0)'],
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
    synths: ['fm', 'chip', 'nes'], // the synthesizers of music (dgx_ge_music.py SYNTHS), fm when the document says none
    palettes: ['gameboy', 'nes', 'pico8'], // the engine's ready palettes (tools/palettes/<name>.txt)
    // their colors, as the engine's files give them (the NES's 2C02G of the NESdev wiki, the DMG's greens, PICO-8's 16)
    readyColors: {
        gameboy: '9bbc0f 8bac0f 306230 0f380f',
        nes: '575757 000c8e 0800a6 340096 550061 630015 5a0000 3c0e00 112800 003b00 004200 003a05 002652 000000 a5a5a5 0041d9 2f1eff 6704f2 9400b4 aa0057 a31800 803900 4b5b00 137600 008100 007923 006288 ffffff 4a9fff 797eff af63ff dd55ff f757c2 f76a63 dc8810 aea900 78c400 4ad211 2fcf64 2fbdc4 414141 b9ddff cad1ff dec6ff f0c0ff fcc0ee fdc6ca f5d0aa e4dd95 d0e892 bdeea2 b2eec0 b0e8e3 b3b3b3',
        pico8: '000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa',
    },
    varsMax: 256, // VARS_MAX: a variable's number is a byte in the steps of scripts and dialogs
    musicFade: 500, // MUSIC_FADE_MS: a scene's change of music, unless it says

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
                ...(p.rotation !== undefined && p.rotation !== null ? {
                    rotation: p.rotation
                } : {}),
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
                ...(a.rotation !== undefined && a.rotation !== null ? {
                    rotation: a.rotation
                } : {}),
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
        // the game's variables, its synthesizer and musics: kept only where the file has them (as given: the check says
        // what is wrong), so a document of an older engine is saved as it was
        if (Array.isArray(file.variables)) out.variables = file.variables.filter(v => v && typeof v.name === 'string').map(v => ({
            name: v.name,
            value: typeof v.value === 'number' ? v.value : 0
        }));
        if (file.synth !== undefined && file.synth !== null) out.synth = file.synth;
        if (Array.isArray(file.music)) out.music = file.music.filter(n => typeof n === 'string');
        if (file.musicTexts && typeof file.musicTexts === 'object' && !Array.isArray(file.musicTexts))
            out.musicTexts = Object.fromEntries(Object.entries(file.musicTexts).filter(([n, t]) => typeof t === 'string'));
        return out;
    },
    // every music the pack numbers, as the packer gives them: those the scripts name (their animations are made first),
    // the document's, then those its scenes name
    musics(doc) {
        let out = [];
        for (const s of doc.sets || [])
            for (const sc of s.animation && s.animation.scripts || [])
                for (const l of sc.lines)
                    if (l.op === 'music' && l.name !== undefined && l.name !== 'stop' && !out.includes(l.name)) out.push(l.name);
        for (const n of doc.music || [])
            if (!out.includes(n)) out.push(n);
        for (const sc of doc.scenes || [])
            if (typeof sc.music === 'string' && sc.music && sc.music !== 'stop' && !out.includes(sc.music)) out.push(sc.music);
        return out;
    },
    // the colors of a ready palette by its name, as the packer takes it: a palette of the document first, else the
    // engine's; null none
    paletteColors(doc, name) {
        const own = (doc.palettes || []).find(p => p.name === name);
        if (own) return own.colors.map(c => c.slice(0, 3));
        if (!(name in this.readyColors)) return null;
        return this.readyColors[name].split(' ').map(h => [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16)));
    },
    // CIELAB of an sRGB color (D65), as the packer's _lab
    lab(rgb) {
        const linear = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        const [r, g, b] = rgb.map(linear);
        const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
        const f = xyz.map(t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
        return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
    },
    // the index of the color of colors nearest to rgb as the eye sees it (CIE76, the first of equals), as the packer's
    // nearest_color brings a picture's colors to a ready palette
    nearestColor(colors, rgb) {
        const want = this.lab(rgb);
        let best = 0,
            least = Infinity;
        colors.forEach((c, i) => {
            const l = this.lab(c);
            const d = Math.hypot(l[0] - want[0], l[1] - want[1], l[2] - want[2]);
            if (d < least) {
                least = d;
                best = i;
            }
        });
        return best;
    },
    // what the packer says of a set's ready palette (add_set): a name of the document's palettes, else of the engine's
    paletteProblem(doc, set) {
        if (set.palette === undefined) return null;
        const names = (doc.palettes || []).map(p => p.name);
        if (typeof set.palette !== 'string' || !names.includes(set.palette) && !this.palettes.includes(set.palette))
            return 'set ' + set.name + ': no palette ' + JSON.stringify(set.palette) + '; there are ' + [...names.sort(), ...this.palettes.filter(n => !names.includes(n))].join(', ');
        return null;
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
    // the names of the pack's header but the constants', as the packer writes them (header of dgx_ge_pack.py): name -> what
    // it names; without the prefix (<PREFIX>_). A constant is <PREFIX>_<NAME> there, so its name must be none of these
    headerNames(doc) {
        let out = new Map();
        const put = (name, what) => {
            if (!out.has(name)) out.set(name, what);
        };
        const N = t => Anim.nameOf(String(t));
        const kinds = this.kinds(doc);
        // the sets (and the palettes), the pictures, the blobs, each with a COUNT
        for (const s of doc.sets) put('SET_' + N(s.name), 'the set ' + s.name);
        for (const p of doc.palettes || []) put('SET_' + N(p.name), 'the palette ' + p.name);
        for (const p of this.pictureNames(doc)) put('IMG_' + N(p), 'the picture ' + p);
        let blobs = kinds.map(s => s.name).concat((doc.tilesets || []).map(t => t.name), (doc.dialogs || []).map(d => d.name),
            (doc.shows || []).map(s => s.name), (doc.scenes || []).map(s => 'SCENE_' + s.name));
        const graph = (doc.maps || []).length && doc.graph && doc.graph.name; /* without maps no graph goes into the file (Maps.saved) */
        if (graph) {
            blobs.push(graph);
            for (const m of doc.maps || []) blobs.push(graph + '_' + m.name + '_LINKS');
        }
        if ((doc.dialogs || []).length) blobs.push('STRINGS');
        if ((doc.game || []).length) blobs.push('GAME');
        if ((doc.chases || []).length) blobs.push('CHASE');
        if ((doc.timers || []).length) blobs.push('TIMERS');
        if ((doc.styles || []).length) blobs.push('STYLES');
        // the samples of the sounds and the songs of the musics (taken as there: sounds/<name>.wav, music/<name>.mml)
        const musics = this.musics(doc);
        if ((doc.sounds || []).length || (doc.music || []).length) blobs.push('SOUNDS');
        if ((doc.variables || []).length) blobs.push('VARIABLES');
        for (const b of blobs) put('BLOB_' + N(b), 'the blob ' + b);
        for (const k of ['SET', 'IMG', 'BLOB']) put(k + '_COUNT', 'how many ' + k.toLowerCase() + 's');
        put('SET_COLOR_COUNT', 'the colors of all the sets');
        // the tiles of the tile sets and the layers their pieces go to (slots)
        for (const ts of doc.tilesets || []) {
            let slots = [];
            for (const t of ts.tiles || []) {
                put(N(ts.name) + '_TILE_' + N(t.name), 'the tile ' + t.name + ' of ' + ts.name);
                for (const p of t.pieces || [])
                    if (p.layer && !slots.includes(p.layer)) slots.push(p.layer);
            }
            for (const sl of slots) put(N(ts.name) + '_SLOT_' + N(sl), 'the slot ' + sl + ' of ' + ts.name);
        }
        for (const c of doc.game || []) put('GAME_' + N(c.name), 'the number of the game ' + c.name);
        for (const v of doc.variables || []) put('GAME_VAR_' + N(v.name), 'the variable of the game ' + v.name);
        if ((doc.variables || []).length) put('GAME_VAR_COUNT', 'how many variables of the game');
        // the graph of scenes: its exits, entries, maps
        if (graph) {
            const names = Maps.names(doc);
            for (const e of names.exits || []) put(N(graph) + '_EXIT_' + N(e), 'the exit ' + e);
            for (const e of names.entries || []) put(N(graph) + '_ENTRY_' + N(e), 'the entry ' + e);
            for (const m of doc.maps || []) put(N(graph) + '_MAP_' + N(m.name), 'the map ' + m.name);
        }
        for (const m of doc.masks || [])
            if (m.name) put('MASK_' + N(m.name), 'the mask ' + m.name);
        for (const s of doc.sets)
            for (const f of s.frames)
                for (const p of Object.keys(f.points || {})) put('POINT_' + N(p), 'the point ' + p);
        for (const s of doc.sounds || []) put('SOUND_' + N(s), 'the sound ' + s);
        if ((doc.sounds || []).length) put('SOUND_COUNT', 'how many sounds');
        for (const m of musics) put('MUSIC_' + N(m), 'the music ' + m);
        if (musics.length) put('MUSIC_COUNT', 'how many musics');
        for (const t of doc.timers || []) put('TIMER_' + N(t.name), 'the timer ' + t.name);
        for (const e of this.events(doc)) put('EVENT_' + N(e), 'the event ' + e);
        // the kinds' animations: their scripts, events (the pack's, as many as are known as the kind is made, kind by kind),
        // params, questions
        if (kinds.length) put('ANIM_PARAMS', 'how many params an actor keeps');
        let known = [];
        for (const s of kinds) {
            const a = s.animation;
            for (const e of a.events)
                if (!known.includes(e)) known.push(e);
            for (const [what, items] of [['SCRIPT', a.scripts.map(x => x.name)], ['EVENT', known], ['PARAM', a.params.map(x => x.name)],
                    ['GAME', a.questions || []]])
                for (const n of items) put(N(s.name) + '_' + what + '_' + N(n), 'the ' + what.toLowerCase() + ' ' + n + ' of ' + s.name);
        }
        // the styles and the fonts they name, the dialogs' roles
        let fonts = [];
        for (const st of doc.styles || []) {
            put('STYLE_' + N(st.name), 'the style ' + st.name);
            if (st.font && !fonts.includes(st.font)) fonts.push(st.font);
        }
        for (const f of fonts) put('FONT_' + N(f), 'the font ' + f);
        if (fonts.length) {
            put('FONTS', 'the table of the fonts');
            put('FONT_COUNT', 'how many fonts');
        }
        for (const d of doc.dialogs || []) {
            const r = Dialogs.parse(d.text);
            for (const role of r.dialog ? r.dialog.roles : []) put(N(d.name) + '_ROLE_' + N(role.role), 'the role ' + role.role + ' of ' + d.name);
        }
        if (doc.screen) {
            put('SCREEN_WIDTH', 'the width of the screen');
            put('SCREEN_HEIGHT', 'the height of the screen');
        }
        // the scenes: the kinds of their zones, their layers, pictures, actors, zones, entries, grids by name
        for (const sc of doc.scenes || [])
            for (const o of Scene.objects(sc))
                if (o.type === 'zone' && o.kind) put('ZONE_' + N(o.kind), 'the kind of zones ' + o.kind);
        for (const sc of doc.scenes || []) {
            const at = 'SCENE_' + N(sc.name) + '_';
            for (const l of sc.layers || []) put(at + 'LAYER_' + N(l.name), 'the layer ' + l.name + ' of ' + sc.name);
            for (const o of Scene.objects(sc)) {
                const kind = {picture: 'PICTURE', actor: 'ACTOR', zone: 'ZONE', entry: 'ENTRY'}[o.type];
                if (kind && o.name) put(at + kind + '_' + N(o.name), 'the ' + o.type + ' ' + o.name + ' of ' + sc.name);
            }
            for (const g of sc.grids || [])
                if (g.name) put(at + 'GRID_' + N(g.name), 'the grid ' + g.name + ' of ' + sc.name);
        }
        return out;
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
        // a constant is <PREFIX>_<NAME> in the pack's header (DGX-GE 0.3.0): the packer refuses one that names another thing
        const header = this.headerNames(doc),
            prefix = Anim.nameOf(doc.name || 'PACK') + '_';
        let macros = new Map();
        for (const [n, v] of Object.entries(doc.constants || {})) {
            const macro = Anim.nameOf(n);
            if (!this.isIdent(n)) say('packConstants', n, "'" + n + "' is no name: letters, digits and _");
            else if (Anim.reserved(n)) say('packConstants', n, "'" + n + "' is a word of the language of scripts: they cannot name it", false);
            else if (macros.has(macro)) say('packConstants', n, 'the constant ' + n + ': its name in the header, ' + prefix + macro + ', is the constant ' + macros.get(macro) + "'s too");
            else if (header.has(macro)) say('packConstants', n, 'the constant ' + n + ': its name in the header, ' + prefix + macro + ', is ' + header.get(macro) + "'s");
            macros.set(macro, n);
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
            // a turn the packer takes: a multiple of 90 degrees
            for (const [what, list] of [['picture', sh.pictures], ['actor', sh.actors]])
                for (const x of list)
                    if (x.rotation !== undefined && !Scene.isTurn(x.rotation)) say('shows', n, 'show ' + n + ': ' + what + ' ' + (x.picture || x.name) + ': rotation ' + JSON.stringify(x.rotation) + ': 0, 90, 180 or 270 (degrees clockwise)');
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
        // the game's variables, as add_variable refuses them: a name and a 32-bit number, once (alike in capitals: one
        // name of the header), not a constant's, a number's of the game, a question's of a kind
        const N = t => Anim.nameOf(String(t));
        seen = new Map();
        for (const v of doc.variables || []) {
            const n = v.name;
            if (!this.isIdent(n) || !Number.isInteger(v.value) || v.value < -(2 ** 31) || v.value >= 2 ** 31) say('variables', n, 'variable ' + n + ': a name and a whole 32-bit number, not ' + JSON.stringify(v.value));
            else if (seen.has(N(n))) say('variables', n, 'variable ' + n + ': declared already (names alike in upper case are one name of the header)');
            seen.set(N(n), n);
            const constant = Object.keys(doc.constants || {}).find(c => N(c) === N(n));
            if (constant !== undefined) say('variables', n, 'variable ' + n + ': ' + constant + ' is a constant (add_constants): give the variable another name');
            const number = (doc.game || []).find(c => N(c.name) === N(n));
            if (number) say('variables', n, 'game ' + number.name + ': ' + n + ' is a variable of the game (add_variable): give it another name');
            for (const set of doc.sets)
                for (const q of set.animation && set.animation.questions || [])
                    if (N(q) === N(n)) say('variables', n, 'game ' + q + ': ' + n + ' is a variable of the game (game_var.' + n + '), not a question to it (the kind ' + set.name + ')');
            if (N(n) === 'COUNT') say('variables', n, "variable " + n + ": the header names it GAME_VAR_COUNT, which counts them: rename it");
        }
        if ((doc.variables || []).length > this.varsMax) say('variables', null, this.varsMax + ' variables at most');
        // the music: the synthesizer, the names (as scripts write them, once), their notes where the editor knows them
        if (doc.synth !== undefined && !this.synths.includes(doc.synth)) say('music', null, 'synth ' + JSON.stringify(doc.synth) + ': chip, nes or fm');
        seen = new Set();
        for (const n of doc.music || []) {
            if (n === 'stop' || n === 'volume' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) say('music', n, 'music ' + JSON.stringify(n) + ': a name as scripts write it (a letter or _, then letters, digits, _), not stop or volume');
            else if (seen.has(n)) say('music', n, 'music ' + n + ' twice');
            seen.add(n);
            // the notes are music/<name>.mml beside the document: the editor read the folder (or keeps their texts)
            if (doc.musicTexts && !(typeof doc.musicTexts[n] === 'string' && doc.musicTexts[n].trim()))
                say('music', n, 'music ' + n + ': no notes (music/' + n + '.mml beside the document): a name only, it plays nothing', false);
        }
        if (this.musics(doc).length > 255) say('music', null, this.musics(doc).length + " musics, 255 at most (255 is a script's music stop)");
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
        // the game's variables: made when the first is added (a document of an older engine has none)
        addVariable() {
            if (!this.sprites.variables) this.sprites.variables = [];
            this.sprites.variables.push({
                name: Game.freeName(this.sprites.variables, 'var'),
                value: 0
            });
        },
        // a variable renamed: the scripts that read and write it follow (game_var.<name>)
        renameVariable(v, event) {
            const name = event.target.value.trim();
            if (!name) {
                if (confirm(T('Remove variable ' + v.name + '? Scripts and dialogs that name it get errors', 'Удалить переменную ' + v.name + '? Скрипты и диалоги, которые её называют, получат ошибки'))) this.remove(this.sprites.variables, v);
                else event.target.value = v.name;
                return;
            }
            if (name === v.name) return;
            if (!Game.isIdent(name) || this.sprites.variables.some(x => x.name === name)) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или уже занято");
                event.target.value = v.name;
                return;
            }
            for (const set of this.sprites.sets)
                if (set.animation) Anim.renameGameVar(set.animation, v.name, name);
            v.name = name;
        },
        addMusic() {
            if (!this.sprites.music) this.sprites.music = [];
            const name = Game.freeName(this.sprites.music, 'theme');
            this.sprites.music.push(name);
            // its notes, a start: one channel of a scale
            if (!this.sprites.musicTexts) this.sprites.musicTexts = {};
            if (!(name in this.sprites.musicTexts)) this.sprites.musicTexts[name] = 'A t120 o4 l8 c d e f g a b > c4\n';
            this.edit.gameMusic = name;
        },
        // a music renamed: its notes, the scripts that play it and the scenes that start it follow
        renameMusic(name, event) {
            const to = event.target.value.trim();
            const list = this.sprites.music;
            const i = list.indexOf(name);
            if (to === name || i < 0) return;
            if (!to) {
                if (confirm(T('Remove music ' + name + '?', 'Удалить музыку ' + name + '?'))) {
                    list.splice(i, 1);
                    if (this.sprites.musicTexts) delete this.sprites.musicTexts[name];
                } else event.target.value = name;
                return;
            }
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(to) || to === 'stop' || to === 'volume' || list.includes(to)) {
                this.message = T("'" + to + "' is no name of a music (letters, digits, _; not stop or volume) or it is taken", "'" + to + "' — не имя музыки (буквы, цифры, _; не stop и не volume) или уже занято");
                event.target.value = name;
                return;
            }
            list[i] = to;
            const texts = this.sprites.musicTexts;
            if (texts && name in texts) {
                texts[to] = texts[name];
                delete texts[name];
            }
            for (const set of this.sprites.sets)
                if (set.animation) Anim.renameMusic(set.animation, name, to);
            for (const sc of this.sprites.scenes)
                if (sc.music === name) sc.music = to;
            if (this.edit.gameMusic === name) this.edit.gameMusic = to;
        },
        musicLines(name) {
            return this.musicText(name).replace(/\n$/, '').split('\n').length;
        },
        musicText(name) {
            return this.sprites.musicTexts && this.sprites.musicTexts[name] || '';
        },
        setMusicText(name, text) {
            if (!this.sprites.musicTexts) this.sprites.musicTexts = {};
            this.sprites.musicTexts[name] = text;
        },
        setSynth(value) {
            // fm is what the engine takes when the document says none: an older document stays without the field
            if (value === 'fm' && this.sprites.synth === undefined) return;
            this.sprites.synth = value;
        },
        // the turn of a show's picture or actor: degrees clockwise; 0 is not written
        turnOf(x) {
            return Scene.turnsOf(x.rotation) * 90;
        },
        setTurn(x, event) {
            const v = parseInt(event.target.value, 10);
            if (v) x.rotation = v;
            else delete x.rotation;
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

            <template v-if="part === 'variables'">
                <div class="view-toolbar"><button class="btn btn-sm btn-outline-primary" @click="addVariable" :title="T('A new variable of the game; the order is its number', 'Новая переменная игры; порядок — её номер')">{{T('+ variable', '+ переменная')}}</button>
                    <span class="help-text">{{T('add_variable(name, value): scripts read game_var.NAME and write it (set, add game_var.NAME); dialogs read it in conditions, edit it (control SLIDER game_var.NAME), show it ({game_var.NAME}); the header gives PREFIX_GAME_VAR_NAME', 'add_variable(имя, значение): скрипты читают game_var.ИМЯ и пишут его (set, add game_var.ИМЯ); диалоги читают в условиях, меняют (control SLIDER game_var.ИМЯ), показывают ({game_var.ИМЯ}); заголовок даёт PREFIX_GAME_VAR_ИМЯ')}}</span></div>
                <table class="table table-sm game-table"><thead><tr><th>N</th><th>{{T('name', 'имя')}}</th><th>{{T('value', 'значение')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="(v, i) in sprites.variables || []" :key="i">
                        <td>{{i}}</td>
                        <td><input :value="v.name" @change="renameVariable(v, $event)" :title="T('The name: letters, digits, _. A rename changes it in the scripts too. Erase it to remove the variable', 'Имя: буквы, цифры, _. Переименование меняет его и в скриптах. Сотрите — удалится')"></td>
                        <td><input class="num" :value="v.value" @change="setInt(v, 'value', $event, -(2 ** 31), 2 ** 31 - 1)" :title="T('The value it begins with: a whole number, 32 bits (the blob VARIABLES)', 'Значение в начале: целое число, 32 бита (блоб VARIABLES)')"></td>
                        <td><button @click="move(sprites.variables, v, -1)" :title="T('Earlier (a smaller number)', 'Раньше (номер меньше)')">↑</button><button @click="move(sprites.variables, v, 1)" :title="T('Later', 'Позже')">↓</button>
                            <button class="btn btn-sm btn-remove" @click="remove(sprites.variables, v)" :title="T('Remove: scripts and dialogs that name it get errors', 'Удалить: скрипты и диалоги, которые её называют, получат ошибки')">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!(sprites.variables || []).length" class="anim-empty">{{T('No variables: «+ variable».', 'Переменных нет: «+ переменная».')}}</div>
            </template>

            <template v-if="part === 'music'">
                <div class="view-toolbar">
                    <label :title="T('The synthesizer the musics play on, unless a song says its own (#synth): fm — after the OPL2 (the default), chip — square, triangle, noise, nes — after the 2A03. The firmware carries those dgx_ge_synths(...) names', 'Синтезатор, на котором играет музыка, если песня не называет свой (#synth): fm — по образцу OPL2 (по умолчанию), chip — меандр, треугольник, шум, nes — по образцу 2A03. Прошивка несёт те, что названы в dgx_ge_synths(...)')">synth
                        <select :value="sprites.synth === undefined ? 'fm' : sprites.synth" @change="setSynth($event.target.value)"><option v-for="n in Game.synths" :value="n">{{n}}</option></select></label>
                    <button class="btn btn-sm btn-outline-primary" @click="addMusic" :title="T('A new music with a few notes to begin with', 'Новая музыка с несколькими нотами для начала')">{{T('+ music', '+ музыка')}}</button>
                    <span class="help-text">{{T('add_music(name, mml): music NAME [500ms] in scripts, a scene’s music; the notes are music/NAME.mml beside the document (the folder of the project gets them)', 'add_music(имя, mml): music ИМЯ [500ms] в скриптах, музыка сцены; ноты — music/ИМЯ.mml рядом с документом (папка проекта получает их)')}}</span>
                </div>
                <table class="table table-sm game-table"><thead><tr><th>N</th><th>{{T('name', 'имя')}}</th><th>{{T('notes', 'ноты')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="(m, i) in sprites.music || []" :key="i" :class="{selected: m === edit.gameMusic}" @click="edit.gameMusic = m">
                        <td>{{i}}</td>
                        <td><input :value="m" @change="renameMusic(m, $event)" :title="T('The name of the music: PREFIX_MUSIC_NAME; scripts and scenes follow a rename. Erase it to remove the music', 'Имя музыки: PREFIX_MUSIC_ИМЯ; скрипты и сцены следуют за переименованием. Сотрите — удалится')"></td>
                        <td><span class="help-text">{{musicText(m) ? T(musicLines(m) + (musicLines(m) === 1 ? ' line' : ' lines'), 'строк: ' + musicLines(m)) : sprites.musicTexts ? T('none: a name only', 'нет: только имя') : T('in music/' + m + '.mml', 'в music/' + m + '.mml')}}</span></td>
                        <td><button @click.stop="move(sprites.music, m, -1)" :title="T('Earlier (a smaller number)', 'Раньше (номер меньше)')">↑</button><button @click.stop="move(sprites.music, m, 1)" :title="T('Later', 'Позже')">↓</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!(sprites.music || []).length" class="anim-empty">{{T('No music: «+ music».', 'Музыки нет: «+ музыка».')}}</div>
                <div v-if="(sprites.music || []).includes(edit.gameMusic)" class="game-music-text">
                    <div class="help-text">{{T('The notes of ' + edit.gameMusic + ' in MML (dgx_ge_music.py): channels A–H, instruments @n = square 25% | triangle | noise …, notes, lengths, ties, [ ]n repeats, $ the loop point; #synth, #set, #tail. Saved as music/' + edit.gameMusic + '.mml in the folder of the project; the packer checks them', 'Ноты ' + edit.gameMusic + ' на MML (dgx_ge_music.py): каналы A–H, инструменты @n = square 25% | triangle | noise …, ноты, длительности, лиги, повторы [ ]n, $ — точка возврата; #synth, #set, #tail. Сохраняются как music/' + edit.gameMusic + '.mml в папке проекта; проверяет их упаковщик')}}</div>
                    <textarea class="form-control dialog-text" rows="14" spellcheck="false" :value="musicText(edit.gameMusic)" @change="setMusicText(edit.gameMusic, $event.target.value)"></textarea>
                </div>
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
                    <span class="help-text">{{T('the number of a sound is its place in the list (from 0): the command sound N of scripts; its samples are sounds/NAME.wav beside the document (the packer takes them)', 'номер звука — его место в списке (с 0): команда sound N скриптов; его сэмплы — sounds/ИМЯ.wav рядом с документом (их берёт упаковщик)')}}</span></div>
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
                    <table class="table table-sm game-table"><thead><tr><th>{{T('picture', 'картинка')}}</th><th>x</th><th>y</th><th>{{T('layer', 'слой')}}</th><th>{{T('flip', 'отражение')}}</th><th :title="T('Turned clockwise about the base point, after the mirror', 'Повёрнута по часовой вокруг базовой точки, после отражения')">{{T('rotation', 'поворот')}}</th><th>{{T('color', 'цвет')}}</th><th></th></tr></thead><tbody>
                        <tr v-for="p in show.pictures" :key="show.pictures.indexOf(p)">
                            <td><input :value="p.picture" list="game-pictures" size="18" @change="p.picture = $event.target.value.trim()" :title="T('The name of the picture in the pack (KIND_FILE or the frame’s own name)', 'Имя картинки в пакете (ВИД_ФАЙЛ или своё имя кадра)')"></td>
                            <td><input class="num" :value="p.x" @change="setInt(p, 'x', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="p.y" @change="setInt(p, 'y', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="p.layer" @change="setInt(p, 'layer', $event, 0, 7)" :title="T('The layer of the show’s scene, 0…7', 'Слой сцены показа, 0…7')"></td>
                            <td><input type="checkbox" v-model="p.flip" :title="T('Mirrored', 'Отражена')"></td>
                            <td><select :value="turnOf(p)" @change="setTurn(p, $event)"><option v-for="d in [0, 90, 180, 270]" :value="d">{{d}}°</option></select></td>
                            <td><input class="num" :value="p.color" @change="setInt(p, 'color', $event, 0, 255)" :title="T('The color of a one-bit picture: the number of a color of its set', 'Цвет однобитной картинки: номер цвета её набора')"></td>
                            <td><button class="btn btn-sm btn-remove" @click="remove(show.pictures, p)">×</button></td>
                        </tr>
                    </tbody></table>
                    <h6 :title="T('The actors of the show: a role, a kind (an animation of the pack), the script it begins with, a place', 'Актёры показа: роль, вид (анимация пакета), скрипт, с которого он начинает, место')">{{T('Actors', 'Актёры')}} <button class="btn btn-sm btn-outline-secondary" @click="addShowActor">{{T('+ actor', '+ актёр')}}</button></h6>
                    <table class="table table-sm game-table"><thead><tr><th>{{T('role', 'роль')}}</th><th>{{T('kind', 'вид')}}</th><th>{{T('script', 'скрипт')}}</th><th>x</th><th>y</th><th>{{T('layer', 'слой')}}</th><th>{{T('flip', 'отражение')}}</th><th :title="T('Turned clockwise about the base point, after the mirror: the actor’s axes turn with it', 'Повёрнут по часовой вокруг базовой точки, после отражения: оси актёра поворачиваются с ним')">{{T('rotation', 'поворот')}}</th><th>{{T('color', 'цвет')}}</th><th></th></tr></thead><tbody>
                        <tr v-for="a in show.actors" :key="show.actors.indexOf(a)">
                            <td><input :value="a.name" size="8" @change="a.name = $event.target.value.trim()" :title="T('The role: cues call the actor by it; end is not allowed', 'Роль: так реплики называют актёра; end — нельзя')"></td>
                            <td><select v-model="a.kind" :title="T('A kind with an animation', 'Вид с анимацией')"><option v-for="k in kinds" :value="k.name">{{k.name}}</option></select></td>
                            <td><select v-model="a.script" :title="T('The script the actor begins with; empty — the first', 'Скрипт, с которого актёр начинает; пусто — первый')"><option value="">{{T('(first)', '(первый)')}}</option><option v-for="s in scriptsOf(a.kind)" :value="s">{{s}}</option></select></td>
                            <td><input class="num" :value="a.x" @change="setInt(a, 'x', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="a.y" @change="setInt(a, 'y', $event, -32768, 32767)"></td>
                            <td><input class="num" :value="a.layer" @change="setInt(a, 'layer', $event, 0, 7)"></td>
                            <td><input type="checkbox" v-model="a.flip"></td>
                            <td><select :value="turnOf(a)" @change="setTurn(a, $event)"><option v-for="d in [0, 90, 180, 270]" :value="d">{{d}}°</option></select></td>
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
