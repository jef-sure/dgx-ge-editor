// Animations of a set: scripts of frames and the rules of passing between them, as the language .anim of the engine
// says them (tools/dgx_ge_anim.py of the engine, DGX-GE). The editor keeps them as
// {events: [name], defines: [{name, value}], params: [{name, value}], groups: [{name, scripts: [name]}],
//  scripts: [{name, lines: [statement]}],
//  rules: [{event, source: script | group, to: script, when: 'now' | 'branch' | 'end'}]}.
// The rules are the source: they fill the matrix "script x event", a state machine of the actor, and nothing else.
// Their order means nothing, no rule is above another; two rules that give one cell different answers are a
// conflict, an error. There is no "every script": a group is a list of scripts. A statement is {op, ...}:
//   frame: {op, image: file of the set | number: the game draws it | name: a picture of the pack, ms, at?: {x, y}}
//     or {op, expr, ms}: the picture worked out at the step, an expression where pictures of the pack are names
//     (frame (DAGGERS_1 + amount - 1) 1000ms); amount: how many the actor is (a stack lying), count(KIND): how many
//     of a kind are in its pockets
//   keep: {op}: the world keeps the actor while it is in this script; draw: {op, point, kind}: one thing of a kind
//     out of the pockets into the hand at the point; stow: {op, point}: what is held there into the pockets;
//   goto: {op, target, cond?}: with cond, only where that expression is not 0
//   timer: {op, action: 'start' | 'stop' | 'hold' | 'go', name}: a timer of the game (the names of timer(NAME))
// The animation may have pockets (places for things) and stack (how many of its kind go into one place)
//   dx, dy, signal, sound: {op, value}; set, add: {op, param, value}; velocity, accel, path: {op, x, y};
//   masks: {op, indexes: []}
// A number of a statement, of a param or a define is a whole number, or the text of an expression of the language:
// numbers, + - * / ( ), min max abs sin cos sqrt exp, defines; params of the actor in velocity, accel, set, add and
// path, and vx, vy there: the velocity of the actor now, x forward; now, the moment of the step, seconds of the clock of
// the game; t, the seconds of the path, in path only
//   flip, branch, hold: {op}; goto: {op, target}; label: {op, name}; contact: {op, on: true | false, event?} | {op, mask, side, within, event?, off?, first?}: the event
//     is sent to the actor itself when it touches the terrain (on only)
//   hit: {op, mask, on: [mask], damage?, event?, recoil?}: the mask hits those masks of the one met, events are
//     sent to it (event) and to this actor (recoil); hits on lines one after another are one statement
//   carry: {op, point, image | number | name}: from now the actor holds that picture at that point of its frames
//     (none of the three: nothing)
//   shoot: {op, point, kind: number | name of a blob of the pack (a set of the file, or one added before it), x, y}: a shot of that kind (an animation
//     whose first script says what it is) flies from the point at that velocity (x forward, like release)
//   tell: {op, target: 'holder', event}: the event goes to the one holding this actor (a pot drunk), by the game
//   release: {op, point, x, y}: the actor lets go what it holds at that point, at that velocity (x forward, like velocity)
//   rotate: {op, value, to?: true}: turned by so many degrees clockwise (to: into that turn), to the nearest multiple of
//     90; an expression worked out at the step. Everything said in the actor's axes turns with it (x forward, y down)
//   music: {op, name: a music of the pack | 'stop', ms} | {op, volume: 0..100, ms}: the game plays a music (fading the
//     one playing out over ms), or sets its level by design (reached over ms)
//   set, add: {op, variable, value}: a variable of the game (the document's variables, game_var.<name>), not a param
// A frame's ms may be an expression of the actor too (frame P (speed)ms): worked out as the frame begins (FRAME_MS)
// A param is a number every actor keeps for itself (lives, what it is doing), with the value it starts with;
// scripts set it or add to it. The text is checked as the assembler checks it, so what the editor exports is assembled
const Anim = {
    whens: ['now', 'branch', 'end'],
    // the ranges of numbers of statements, as the assembler has them
    ops: {
        frame: {},
        dx: {
            low: -128,
            high: 127
        },
        dy: {
            low: -128,
            high: 127
        },
        flip: {},
        // a param holds 32 bits: a constant within 16 bits is kept in the step, one beyond, up to 2^24 (exact as a
        // float), as an expression
        set: {
            low: -(1 << 24),
            high: 1 << 24
        },
        add: {
            low: -(1 << 24),
            high: 1 << 24
        },
        velocity: {
            low: -32768,
            high: 32767
        },
        accel: {
            low: -32768,
            high: 32767
        },
        signal: {
            low: 0,
            high: 255
        },
        // go <exit>: a word of the rules of a map, not of the assembler: the graph of the packer (dgx_ge_graph.py) makes
        // it signal N, N the number of the exit's name (Maps.names)
        go: {},
        sound: {
            low: 0,
            high: 255
        },
        masks: {
            low: 0,
            high: 15
        },
        branch: {},
        hold: {},
        goto: {},
        label: {},
        path: {},
        contact: {},
        hit: {},
        carry: {},
        release: {},
        tell: {},
        press: {},
        clear: {},
        appear: {},
        vanish: {},
        sense: {},
        steer: {},
        shoot: {},
        keep: {},
        timer: {},
        draw: {},
        stow: {},
        rotate: {},
        music: {},
    },
    // bytes of a statement in the blob: the code is addressed by 16 bits
    size: {
        frame: 5,
        frameAt: 7,
        dx: 2,
        dy: 2,
        flip: 1,
        set: 4,
        add: 4,
        velocity: 5,
        accel: 5,
        signal: 2,
        go: 2,
        sound: 2,
        masks: 3,
        branch: 1,
        hold: 1,
        goto: 3,
        label: 0,
        contact: 3,
        hit: 7, // and 2 more for the first of hits that follow one another: they are one statement HITS
        carry: 4,
        release: 14, // with 0 0; its velocity is always written as expressions
        tell: 3,
        shoot: 16, // with 0 0; its velocity is always written as expressions
        keep: 1,
        timer: 3,
        draw: 4,
        stow: 2,
        rotate: 2, // ROTATE: a constant in quarter turns; ROTATE_X: 3 and the expression
        music: 4 // MUSIC, MUSIC_LEVEL: the music (255 stop) or the percent, the time u16
    },
    maxScripts: 255,
    maxParams: 255,

    empty() {
        return {
            events: [],
            defines: [],
            tables: [], // constant tables: {name, values: [int16]}, read in expressions as name[index]
            questions: [], // questions to the game: names, read in expressions as game.<name> (the game answers at the step)
            params: [],
            groups: [],
            scripts: [],
            rules: []
        };
    },

    // a name of the language: letters, digits, '_', as \w of Python (events, scripts, labels, groups)
    isName(s) {
        return typeof s === 'string' && /^[\p{L}\p{N}_]+$/u.test(s);
    },
    // a name an expression may name (a define, a param, a field of tiles): an identifier of ASCII
    isIdent(s) {
        return typeof s === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
    },

    // the name of a frame's picture in the pack: its own (packName of the frame, as names of the pack are made) or
    // <SET>_<FILE>; set: a set or the name of one (then no frame of it is looked at)
    imageName(set, image) {
        if (!set || typeof set === 'string') return this.packName(set || '', image);
        const f = set.frames && set.frames.find(f => f.image === image);
        return f && f.packName ? this.nameOf(f.packName) : this.packName(set.name, image);
    },
    // a name of the pack: letters and digits of ASCII kept, the rest '_', capitals (name_of of the packer)
    nameOf(text) {
        return text.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
    },
    // the name of a picture in the pack of the engine: <SET>_<FILE WITHOUT EXTENSION>, capitals,
    // everything but ASCII letters and digits is '_'
    packName(setName, image) {
        const stem = image.replace(/\.[^.]*$/, '');
        return (setName + '_' + stem).replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
    },

    // a number as int(text, 0) of Python reads it, null when it is not one
    number(text) {
        const t = String(text).trim().replace(/_/g, '');
        const m = /^([+-]?)(0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|0+|[1-9][0-9]*)$/.exec(t);
        if (!m) return null;
        let v;
        const d = m[2];
        if (/^0[xX]/.test(d)) v = parseInt(d.slice(2), 16);
        else if (/^0[oO]/.test(d)) v = parseInt(d.slice(2), 8);
        else if (/^0[bB]/.test(d)) v = parseInt(d.slice(2), 2);
        else v = parseInt(d, 10);
        return m[1] === '-' ? -v : v;
    },
    int(text, low, high) {
        const v = this.number(text);
        if (v === null) throw new Error('not a number: ' + text);
        if (v < low || v > high) throw new Error(v + ' is not within ' + low + '..' + high);
        return v;
    },

    // functions of expressions and how many arguments each takes
    compare: ['<', '<=', '>', '>=', '==', '!='],
    funcs: {
        min: 2,
        max: 2,
        abs: 1,
        sin: 1,
        cos: 1,
        sqrt: 1,
        exp: 1,
        smoothstep: 1, // 0 below 0, 1 above 1, x*x*(3-2*x) between
        // bits of whole numbers (int32, negatives in two's complement)
        xor: 2,
        bits: 1, // how many ones
        bit: 1, // 2^n, 0 outside 0..30
        field: 3, // field(x, first, count) = (x >> first) & (2^count - 1); its op is 'bitfield', the step 'field' is a word's field
        rnd: 1 // the game's dice, 0..n: never worked out at assembly
    },

    // commas outside parentheses split a text
    splitTop(text) {
        let parts = [],
            depth = 0,
            start = 0;
        for (let i = 0; i < text.length; ++i) {
            const c = text[i];
            if (c === '(') depth++;
            else if (c === ')') depth--;
            else if (c === ',' && !depth) {
                parts.push(text.slice(start, i));
                start = i + 1;
            }
        }
        parts.push(text.slice(start));
        return parts.map(p => p.trim());
    },

    // an expression of the language as a tree: ['num', v] | ['param', name] | ['t'] | ['op', op, [args]].
    // Numbers, + - * / ( ), min max abs sin cos sqrt exp, defines (they become numbers), params of the actor when
    // ctx.params has them and ctx.allowParams, t when ctx.allowT. Throws an Error as the assembler would refuse it
    parseExpr(text, ctx) {
        const tokens = String(text).match(/0[xX][0-9a-fA-F]+|\d+\.?\d*|\.\d+|[\p{L}_][\p{L}\p{N}_]*|<=|>=|==|!=|[-+*/%&|(),<>]|\S/gu) || [];
        let i = 0;
        const peek = () => tokens[i];
        const take = want => {
            const t = tokens[i];
            if (t === undefined || (want && t !== want)) throw new Error('expected ' + (want || 'more') + ' in the expression');
            i++;
            return t;
        };
        // from the weakest: c ? a : b (right to left), or, and, not, a comparison (they do not chain), & |, + -, * / %
        const choice = () => {
            let node = logic();
            if (peek() === '?') {
                take();
                const yes = choice();
                take(':');
                node = ['op', '?', [node, yes, choice()]];
            }
            return node;
        };
        const logic = () => {
            let node = both();
            while (peek() === 'or') {
                take();
                node = ['op', 'or', [node, both()]];
            }
            return node;
        };
        const both = () => {
            let node = negation();
            while (peek() === 'and') {
                take();
                node = ['op', 'and', [node, negation()]];
            }
            return node;
        };
        const negation = () => {
            if (peek() === 'not') {
                take();
                return ['op', 'not', [negation()]];
            }
            let node = bits();
            if (this.compare.includes(peek())) {
                node = ['op', take(), [node, bits()]];
                if (this.compare.includes(peek())) throw new Error('comparisons do not chain: use and');
            }
            return node;
        };
        // & and | of whole numbers, below + and -, above the comparisons: mod & 0x7F == 2 is (mod & 0x7F) == 2
        const bits = () => {
            let node = sum();
            while (peek() === '&' || peek() === '|') node = ['op', take(), [node, sum()]];
            return node;
        };
        const sum = () => {
            let node = product();
            while (peek() === '+' || peek() === '-') node = ['op', take(), [node, product()]];
            return node;
        };
        const product = () => {
            let node = unary();
            while (peek() === '*' || peek() === '/' || peek() === '%') node = ['op', take(), [node, unary()]];
            return node;
        };
        const unary = () => {
            if (peek() === '-') {
                take();
                return ['op', 'neg', [unary()]];
            }
            if (peek() === '+') {
                take();
                return unary();
            }
            return atom();
        };
        const atom = () => {
            const t = take();
            if (t === '(') {
                const node = choice();
                take(')');
                return node;
            }
            if (/^0[xX][0-9a-fA-F]+$/.test(t)) return ['num', parseInt(t, 16)];
            if (/^(\d+\.?\d*|\.\d+)$/.test(t)) return ['num', parseFloat(t)];
            const own = ctx.defines && t in ctx.defines || ctx.params && ctx.params.includes(t);
            if (t === 'count' && !own) {
                // count(KIND): things of a kind in the pockets of the actor; KIND a number or a name of the pack
                if (ctx.actor === false || !ctx.allowParams) throw new Error('count is of the pockets of an actor, there is none here');
                if (ctx.allowT) throw new Error('count is not for a path');
                take('(');
                const name = take();
                take(')');
                if (/^\d+$/.test(name)) return ['count', this.int(name, 0, 65534)];
                if (!this.isName(name)) throw new Error("no kind '" + name + "'");
                return ['count', name];
            }
            if (t === 'timer' && !own) {
                // timer(NAME): milliseconds from the start of a timer of the game, -1 when it is not going
                if (ctx.actor === false || !ctx.allowParams) throw new Error('timer is read by a script, there is none here');
                if (ctx.allowT) throw new Error('timer is not for a path: its formula gives the place by t alone');
                take('(');
                const name = take();
                take(')');
                if (!/^[A-Za-z_]\w*$/.test(name)) throw new Error('timer(<name>), not timer(' + name + ')');
                return ['timer', name];
            }
            if (t === 'axis' && !own && peek() === '(') {
                // axis(NAME): an axis of the player's pad at the step, -1..1 (sticks) or 0..1 (triggers); by a script of an
                // animation only: a tile or a dialog's condition would see it stale, a path gives the place by t alone
                if (ctx.actor === false || ctx.animation === false || !ctx.allowParams) throw new Error('axis is read by a script of an animation, there is none here');
                if (ctx.allowT) throw new Error('axis is not for a path: its formula gives the place by t alone');
                take('(');
                const name = take();
                take(')');
                if (!this.axes.includes(name)) throw new Error('axis(' + name + '): no such axis (' + this.axes.join(', ') + ')');
                return ['axis', this.axes.indexOf(name)];
            }
            if (t === 'amount' && !own) {
                if (ctx.actor === false || !ctx.allowParams) throw new Error('amount is how many an actor is, there is none here');
                if (ctx.allowT) throw new Error('amount is not for a path');
                return ['amount'];
            }
            // game.<name>: a question to the game, declared by a statement game; its answer at the moment of the step
            if (t === 'game' && peek() === '.') {
                take('.');
                const name = take();
                if (ctx.actor === false) throw new Error('game. is a question of a script, there is none here');
                if (!ctx.allowParams) throw new Error('game.' + name + ' is answered at the step, not for a constant');
                if (ctx.allowT) throw new Error('game.' + name + ' is not for a path');
                if (!this.isIdent(name)) throw new Error('game.<name>, not game.' + name);
                if (ctx.questions && !ctx.questions.includes(name)) throw new Error("no question '" + name + "': declare it first, game " + name);
                return ['game', name];
            }
            // game_var.<name>: a variable of the game (the document's variables), as the game's store has it at the step;
            // not of a tile (laid again only when its cell changes, it would be seen stale) nor of a path
            if (t === 'game_var' && peek() === '.') {
                take('.');
                const name = take();
                if (ctx.actor === false) throw new Error('game_var.' + name + ": the game's variables are read by scripts and dialogs, not here");
                if (!(ctx.gameVars || this.packVariables()).includes(name)) throw new Error('game_var.' + name + ': no such variable of the game (Pack.add_variable)');
                if (ctx.allowT) throw new Error('game_var. is not for a path: its formula gives the place by t alone');
                return ['game_var', name];
            }
            // its.<name>: the one a sense found — a param of the kind looked for, or vx, vy, image, script, flip of a
            // body, tile, mod, cell of a cell; only inside a sense
            if (t === 'its' && peek() === '.') {
                take('.');
                const name = take();
                if (!ctx.its) throw new Error('its. is the one a sense found: only in a sense');
                if (!this.isName(name)) throw new Error('its.<name>, not its.' + name);
                if (!ctx.its.includes(name) && !ctx.itsAny) throw new Error('its.' + name + ' is no param of the kind looked for (its. needs the kind named)');
                return ['its', name];
            }
            // a constant table of the animation: name[index], 0 outside it
            if (ctx.tables && t in ctx.tables && peek() === '[') {
                take('[');
                const index = choice();
                take(']');
                return ['table', t, index, ctx.tables[t]];
            }
            if (t in this.funcs) {
                take('(');
                let args = [choice()];
                while (peek() === ',') {
                    take();
                    args.push(choice());
                }
                take(')');
                if (args.length !== this.funcs[t]) throw new Error(t + ' takes ' + this.funcs[t]);
                return ['op', t === 'field' ? 'bitfield' : t, args];
            }
            // music: the music playing, its number (-1 none); rotation: the actor's turn, 0, 90, 180 or 270. Words only
            // where nothing of that name is defined
            const named = own || ctx.pictures && t in ctx.pictures;
            if (t === 'music' && !named) {
                if (ctx.allowT) throw new Error('music is not for a path: its formula gives the place by t alone');
                return ['music'];
            }
            if (t === 'rotation' && !named) {
                if (ctx.actor === false || !ctx.allowParams) throw new Error('rotation is the turn of an actor, there is none here');
                if (ctx.allowT) throw new Error('rotation is not for a path: its formula gives the place by t alone');
                return ['rotation'];
            }
            // a piece of tiles has no actor: its expressions know mod, variant and the fields only
            if ((t === 'vx' || t === 'vy' || t === 'now' || t === 'x' || t === 'y') && ctx.actor === false && !(ctx.params || []).includes(t))
                throw new Error(t + ' is of an actor, there is none here');
            if (t === 'vx' || t === 'vy') {
                if (!ctx.allowParams) throw new Error(t + ' is the velocity of the actor, not for a constant');
                // the formula of a path gives the velocity itself: reading it would tie the place to the rate of frames
                if (ctx.allowT) throw new Error(t + ' is not for a path: its formula gives the velocity');
                return [t];
            }
            // x, y: where the actor is now, points of the scene (x not forward, unlike vx)
            if ((t === 'x' || t === 'y') && !(ctx.params || []).includes(t)) {
                if (!ctx.allowParams) throw new Error(t + ' is where the actor is, not for a constant');
                if (ctx.allowT) throw new Error(t + ' is not for a path: its formula gives the place');
                return [t];
            }
            if (t === 'now') {
                if (!ctx.allowParams) throw new Error('now is the moment of the step, not for a constant');
                return ['now'];
            }
            if (t === 't') {
                if (!ctx.allowT) throw new Error('t is the time of a path, only there');
                return ['t'];
            }
            // in the expression of a frame the pictures of the set are names, over defines
            if (ctx.pictures && t in ctx.pictures) return ['pic', t];
            if (ctx.defines && t in ctx.defines) return ['num', ctx.defines[t]];
            if (ctx.params && ctx.params.includes(t)) {
                if (!ctx.allowParams) throw new Error("the param '" + t + "' cannot be here: only numbers and defines");
                return ['param', t];
            }
            // a name of a frame that is nothing else: a picture of the pack, which the editor may not know
            if (ctx.pictures && /^[\p{L}_]/u.test(t)) return ['pic', t];
            if (!ctx.params && /^[\p{L}_]/u.test(t)) return ['param', t]; // names not known yet: taken as params
            throw new Error("'" + t + "' is no number, define, param or function");
        };
        if (!tokens.length) throw new Error('an expression is missing');
        const tree = choice();
        if (i !== tokens.length) throw new Error("'" + tokens[i] + "' does not belong in '" + text + "'");
        return this.foldExpr(tree);
    },
    calc(op, a) {
        switch (op) {
            case '+':
                return a[0] + a[1];
            case '-':
                return a[0] - a[1];
            case '*':
                return a[0] * a[1];
            case '/':
                return a[1] ? a[0] / a[1] : 0;
            case 'neg':
                return -a[0];
            case 'min':
                return Math.min(a[0], a[1]);
            case 'max':
                return Math.max(a[0], a[1]);
            case 'abs':
                return Math.abs(a[0]);
            case 'sqrt':
                return a[0] > 0 ? Math.sqrt(a[0]) : 0;
            case 'smoothstep':
                return a[0] <= 0 ? 0 : a[0] >= 1 ? 1 : a[0] * a[0] * (3 - 2 * a[0]);
            case 'xor':
                return (Math.trunc(a[0]) ^ Math.trunc(a[1]));
            case 'bits': {
                let v = Math.trunc(a[0]) >>> 0,
                    n = 0;
                for (; v; v >>>= 1) n += v & 1;
                return n;
            }
            case 'bit': {
                const n = Math.trunc(a[0]);
                return n >= 0 && n <= 30 ? 2 ** n : 0;
            }
            case 'bitfield': {
                const v = Math.trunc(a[0]) >>> 0,
                    first = Math.trunc(a[1]),
                    count = Math.trunc(a[2]);
                if (first < 0 || first > 31 || count <= 0) return 0;
                const shifted = Math.floor(v / 2 ** first);
                return count >= 32 ? shifted : shifted % 2 ** count;
            }
            case '<':
                return +(a[0] < a[1]);
            case '<=':
                return +(a[0] <= a[1]);
            case '>':
                return +(a[0] > a[1]);
            case '>=':
                return +(a[0] >= a[1]);
            case '==':
                return +(a[0] === a[1]);
            case '!=':
                return +(a[0] !== a[1]);
            case 'and':
                return +(a[0] !== 0 && a[1] !== 0);
            case 'or':
                return +(a[0] !== 0 || a[1] !== 0);
            case 'not':
                return +(a[0] === 0);
            // on whole numbers, as the engine casts them (int32_t: truncated); its remainder takes the sign of a[0]
            case '%':
                return (a[1] | 0) ? (a[0] | 0) % (a[1] | 0) : 0;
            case '&':
                return (a[0] | 0) & (a[1] | 0);
            case '|':
                return (a[0] | 0) | (a[1] | 0);
            case '?':
                return a[0] !== 0 ? a[1] : a[2];
        }
        return Math[op](a[0]);
    },
    // parts of constants worked out
    foldExpr(node) {
        if (node[0] === 'table') {
            // a constant index: the value itself, as the assembler folds it
            const index = this.foldExpr(node[2]);
            if (index[0] === 'num') {
                const k = Math.trunc(index[1]);
                return ['num', k >= 0 && k < node[3].length ? node[3][k] : 0];
            }
            return ['table', node[1], index, node[3]];
        }
        if (node[0] !== 'op') return node;
        const args = node[2].map(a => this.foldExpr(a));
        if (args.every(a => a[0] === 'num') && node[1] !== 'rnd') return ['num', this.calc(node[1], args.map(a => a[1]))];
        // a constant first part of a lazy operator decides at assembly: 0 and x is 0, 1 or x is 1, 1 ? a : b is a
        if (args[0][0] === 'num') {
            const truth = b => b[0] === 'num' ? ['num', +(b[1] !== 0)] : ['op', '!=', [b, ['num', 0]]];
            if (node[1] === 'and') return args[0][1] === 0 ? ['num', 0] : truth(args[1]);
            if (node[1] === 'or') return args[0][1] !== 0 ? ['num', 1] : truth(args[1]);
            if (node[1] === '?') return args[0][1] !== 0 ? args[1] : args[2];
        }
        return ['op', node[1], args];
    },
    // the value of a tree for params {name: value}, the time t and the velocity {vx, vy} (x forward)
    evalExpr(node, params, t, velocity) {
        switch (node[0]) {
            case 'num':
                return node[1];
            case 'param':
                return params && params[node[1]] || 0;
            case 't':
                return t || 0;
            case 'vx':
            case 'vy':
            case 'now': // in the same object as the velocity: what the actor has at the moment of the step
            case 'x':
            case 'y': // where the actor is, whole points of the scene
                return velocity ? velocity[node[0]] || 0 : 0;
            case 'amount':
                return velocity && velocity.amount !== undefined ? velocity.amount : 1;
            case 'count':
                return velocity && velocity.count ? velocity.count(node[1]) : 0;
            case 'timer':
                return velocity && velocity.timer ? velocity.timer(node[1]) : -1;
            case 'axis':
                // no pad in the editor: 0, as the engine without input
                return velocity && velocity.axis ? velocity.axis(node[1]) : 0;
            case 'pic':
                return velocity && velocity.picture ? velocity.picture(node[1]) : 0;
            case 'table': {
                const k = Math.trunc(this.evalExpr(node[2], params, t, velocity));
                return k >= 0 && k < node[3].length ? node[3][k] : 0;
            }
            case 'its':
                // the one a sense found: in the player nobody is found
                return velocity && velocity.its ? velocity.its(node[1]) : 0;
            case 'game':
                // the game's answer; without one, 0 (as the runtime without a function)
                return velocity && velocity.game ? velocity.game(node[1]) : 0;
            case 'game_var':
                // the game's store of variables, as the player keeps it; none: 0 (the engine without a store)
                return velocity && velocity.gameVar ? velocity.gameVar(node[1]) : 0;
            case 'music':
                // the music playing, its number; none: -1
                return velocity && velocity.music ? velocity.music() : -1;
            case 'rotation':
                return velocity && velocity.rotation || 0;
            case 'op':
                if (node[1] === 'rnd') {
                    // the game's dice: the player's, as the engine casts them; elsewhere 0
                    const n = this.evalExpr(node[2][0], params, t, velocity);
                    return velocity && velocity.rnd && n >= 0 ? velocity.rnd(n) : 0;
                }
                // and, or and c ? a : b are lazy, as in C: the part not needed is not worked out (its dice not cast)
                if (node[1] === 'and') return this.evalExpr(node[2][0], params, t, velocity) === 0 ? 0 : +(this.evalExpr(node[2][1], params, t, velocity) !== 0);
                if (node[1] === 'or') return this.evalExpr(node[2][0], params, t, velocity) !== 0 ? 1 : +(this.evalExpr(node[2][1], params, t, velocity) !== 0);
                if (node[1] === '?') return this.evalExpr(node[2][this.evalExpr(node[2][0], params, t, velocity) !== 0 ? 1 : 2], params, t, velocity);
        }
        return this.calc(node[1], node[2].map(a => this.evalExpr(a, params, t, velocity)));
    },
    // a tree with its pictures as numbers (their own numbers are the pack's), to be worked out as the assembler does
    picturesAsNumbers(node) {
        if (node[0] === 'pic') return ['num', 0];
        if (node[0] === 'table') return ['table', node[1], this.picturesAsNumbers(node[2]), node[3]];
        return node[0] === 'op' ? ['op', node[1], node[2].map(a => this.picturesAsNumbers(a))] : node;
    },
    // a tree of numbers and pictures alone: the assembler works it out (a frame of it is a plain frame)
    constantTree(node) {
        if (node[0] === 'num' || node[0] === 'pic') return true;
        return node[0] === 'op' && node[2].every(a => this.constantTree(a));
    },
    // what the pack gives every text (dgx_ge_anim.py assemble(constants, masks)): the game's constants, numbers by name
    // (the file's field constants, Pack.add_constants), as if defined before the first line; the masks by their names
    // in the pack (as in meets), where a mask goes. The store says where they are (a function that gives the file):
    // read in a computed, they are its dependencies
    packSource: null,
    packFile() {
        try {
            return this.packSource && this.packSource() || null;
        } catch (e) {
            return null;
        }
    },
    // name -> value: the constants of the file that are names and 32-bit numbers (Game.check tells of the rest)
    packConstants() {
        const f = this.packFile();
        let out = {};
        for (const [n, v] of Object.entries(f && f.constants || {}))
            if (this.isIdent(n) && Number.isInteger(v) && v >= -(2 ** 31) && v < 2 ** 31) out[n] = v;
        return out;
    },
    // name -> index: the masks as the packer names them (name_of of the name, a nameless one MASK_<index>)
    packMasks() {
        const f = this.packFile();
        return f && Array.isArray(f.masks) ? Meets.names(f.masks) : {};
    },
    // the game's variables (the file's field variables, Pack.add_variable) by their numbers: game_var.<name> reads one,
    // set and add game_var.<name> write it
    packVariables() {
        const f = this.packFile();
        return (f && Array.isArray(f.variables) ? f.variables : []).filter(v => v && typeof v.name === 'string').map(v => v.name);
    },
    // name -> the value a variable begins with
    packVariableValues() {
        const f = this.packFile();
        let out = {};
        for (const v of f && Array.isArray(f.variables) ? f.variables : [])
            if (v && typeof v.name === 'string' && !(v.name in out)) out[v.name] = Number.isInteger(v.value) ? v.value : 0;
        return out;
    },
    // the musics of the pack by their numbers, as the packer gives them: those the scripts of the sets name first (music
    // <name>, the animations are made before the game's parts), then the rest of the file's field music
    packMusics() {
        const f = this.packFile();
        let out = [];
        for (const set of f && Array.isArray(f.sets) ? f.sets : [])
            for (const s of set.animation && set.animation.scripts || [])
                for (const l of s.lines)
                    if (l.op === 'music' && l.name !== undefined && l.name !== 'stop' && !out.includes(l.name)) out.push(l.name);
        for (const n of f && Array.isArray(f.music) ? f.music : [])
            if (typeof n === 'string' && !out.includes(n)) out.push(n);
        return out;
    },
    // the time of a frame without its unit, as the assembler reads it (without_ms): 83ms, (speed)ms, TICK ms; fall_ms is
    // a name, not fall_ and ms
    withoutMs(text) {
        text = String(text).trim();
        const m = /([A-Za-z0-9_]*)ms$/.exec(text);
        return m && (!m[1] || /^[0-9]/.test(m[1])) ? text.slice(0, -2).replace(/\s+$/, '') : text;
    },
    // degrees clockwise as quarter turns 0..3, as the engine takes them (quarters_of): to the nearest multiple of 90, a
    // half away from zero, round the circle; not a number 0
    quarters(degrees) {
        const q = this.halfAway(degrees / 90) % 4;
        return q !== q ? 0 : (q + 4) % 4;
    },
    // a mask where one goes (masks, hit, contact): its name in the pack stays a name, else a constant 0..15
    maskOperand(text, ctx) {
        text = String(text).trim();
        if (text in this.packMasks()) return text;
        return this.operand(text, ctx, 0, 15, 'const');
    },
    // the index of a mask operand: a name of the pack's masks, else a constant
    maskValue(v, defines) {
        if (typeof v === 'string') {
            const masks = this.packMasks();
            if (v.trim() in masks) return masks[v.trim()];
        }
        return this.constValue(v, defines);
    },
    // the error of a define, param, table or question named as a constant of the pack, as the assembler says it
    constantTaken(name) {
        const c = this.packConstants();
        return name in c ? name + ' is a constant of the pack (' + c[name] + '): not to be defined again' : null;
    },
    // names a define or a param cannot have
    reserved(name) {
        return name === 't' || name === 'vx' || name === 'vy' || name === 'x' || name === 'y' || name === 'now' || name === 'its' || name === 'game' || name === 'game_var' || name === 'and' || name === 'or' || name === 'not' || name in this.funcs;
    },
    // what its.<name> may be in a sense, beyond the params of the kind looked for: of a body (an actor) or a cell
    itsBody: ['vx', 'vy', 'image', 'script', 'flip', 'rotation'],
    itsCell: ['tile', 'mod', 'cell'],
    // the ways of steer: how many numbers before to/from/angle (speed, force[, radius or spread]), the word, how many after
    // axis(NAME): the axes of a pad in the order of DGX_GE_AXIS_* (dgx_ge_input.h), their numbers in the blob
    axes: ['lx', 'ly', 'rx', 'ry', 'lt', 'rt'],
    steerWays: {
        seek: [2, 'to', 2],
        flee: [2, 'from', 2],
        arrive: [3, 'to', 2],
        pursue: [2, 'to', 4],
        evade: [2, 'from', 4],
        wander: [3, 'angle', 1]
    },
    steerUsage: {
        seek: 'steer seek <speed>, <force> to <dx>, <dy>',
        flee: 'steer flee <speed>, <force> from <dx>, <dy>',
        arrive: 'steer arrive <speed>, <force>, <radius> to <dx>, <dy>',
        pursue: 'steer pursue <speed>, <force> to <dx>, <dy>, <vx>, <vy>',
        evade: 'steer evade <speed>, <force> from <dx>, <dy>, <vx>, <vy>',
        wander: 'steer wander <speed>, <force>, <spread> angle <param>'
    },
    // the sides a watched mask touches anything solid on (contact <mask> <side>), bits of the blob
    touchSides: {
        inside: 1,
        below: 2,
        above: 4,
        left: 8,
        right: 16,
        front: 32,
        back: 64,
        beside: 24, // left or right
        any: 31
    },
    // a whole number as the engine makes it (lroundf) and the assembler too: a half away from 0, -2.5 is -3
    halfAway(v) {
        return Math.sign(v) * Math.round(Math.abs(v));
    },
    whole(value, low, high) {
        const v = this.halfAway(value);
        if (!(v >= low && v <= high)) throw new Error(this.g(value) + ' is not within ' + low + '..' + high);
        return v;
    },
    // a number as Python's format :g writes it (six digits, 2e+07), as the assembler's messages have it
    g(v) {
        if (!isFinite(v)) return String(v);
        const [m, e] = v.toExponential(5).split('e');
        const x = +e;
        if (x < -4 || x >= 6) return m.replace(/\.?0+$/, '') + 'e' + (x < 0 ? '-' : '+') + String(Math.abs(x)).padStart(2, '0');
        return String(+v.toPrecision(6));
    },

    // an operand of a statement from its text: a whole number stays a number, an expression stays its text.
    // kind: 'const' (numbers and defines), 'param' (also params of the actor), 'path' (also t)
    operand(text, ctx, low, high, kind) {
        text = String(text).trim();
        if (/^-?\d+$/.test(text)) {
            const v = parseInt(text, 10);
            if (v < low || v > high) throw new Error(this.g(v) + ' is not within ' + low + '..' + high);
            return v;
        }
        const tree = this.parseExpr(text, Object.assign({}, ctx, {
            allowParams: kind !== 'const',
            allowT: kind === 'path'
        }));
        if (tree[0] === 'num' && kind !== 'path') this.whole(tree[1], low, high);
        else if (kind === 'const') throw new Error("'" + text + "' must be a constant");
        return text;
    },
    // the time of a frame: its text without the unit (withoutMs); a number 1..65535, or an expression — of constants, as
    // a number is kept (a plain frame), else of the actor, worked out as the frame begins (FRAME_MS)
    frameTime(text, ctx) {
        return this.operand(this.withoutMs(text), ctx, 1, 65535, 'param');
    },
    // is a frame's time worked out as the frame begins (an expression of the actor, not of constants)?
    timeWorked(ms, ctx) {
        if (typeof ms !== 'string') return false;
        try {
            return this.parseExpr(ms, Object.assign({}, ctx, {
                allowParams: true,
                allowT: false,
                pictures: undefined
            }))[0] !== 'num';
        } catch (e) {
            return false;
        }
    },
    // the value of an operand that holds only numbers and defines
    constValue(v, defines) {
        if (typeof v === 'number') return v;
        try {
            const tree = this.parseExpr(v, {
                defines: defines,
                params: [],
                allowParams: false,
                allowT: false
            });
            return tree[0] === 'num' ? this.halfAway(tree[1]) : 0;
        } catch (e) {
            return 0;
        }
    },
    // the values of the defines of an animation, in their order; a bad one is 0
    defineValues(a) {
        let values = this.packConstants();
        for (const d of a.defines || []) {
            try {
                const tree = this.parseExpr(String(d.value), {
                    defines: values,
                    params: [],
                    allowParams: false,
                    allowT: false
                });
                values[d.name] = tree[0] === 'num' ? tree[1] : 0;
            } catch (e) {
                values[d.name] = 0;
            }
        }
        return values;
    },
    // the constant tables of an animation by name
    tableValues(a) {
        let tables = {};
        for (const t of a.tables || []) tables[t.name] = t.values;
        return tables;
    },
    // what a statement may name: the defines with their values, the params, the tables
    contextOf(a) {
        return {
            defines: this.defineValues(a),
            params: (a.params || []).map(p => p.name),
            tables: this.tableValues(a),
            questions: (a.questions || []).slice(),
            gameVars: this.packVariables()
        };
    },

    // one statement of a script from its text, without comments; images: pack name -> file of the set,
    // ctx: {defines: {name: value}, params: [name]} it may name (null: any name is taken).
    // Throws an Error that says what is wrong
    parseStatement(line, images, ctx) {
        ctx = ctx || {};
        line = line.trim();
        const sp = line.search(/\s/);
        const word = sp < 0 ? line : line.slice(0, sp);
        const rest = sp < 0 ? '' : line.slice(sp).trim();
        const args = rest.replace(/,/g, ' ').split(/\s+/).filter(a => a);
        const op = this.ops[word];
        switch (word) {
            case 'frame': {
                if (rest.startsWith('(')) {
                    // frame (<expression>) <ms>: the picture worked out at the step
                    let depth = 0,
                        end = -1;
                    for (let k = 0; k < rest.length; ++k) {
                        depth += rest[k] === '(' ? 1 : rest[k] === ')' ? -1 : 0;
                        if (!depth) {
                            end = k;
                            break;
                        }
                    }
                    if (end < 0) throw new Error('frame (<expression>) <ms>: a parenthesis is not closed');
                    const expr = rest.slice(1, end).trim();
                    this.parseExpr(expr, Object.assign({}, ctx, {
                        allowParams: true,
                        allowT: false,
                        pictures: images || {}
                    }));
                    return {
                        op: 'frame',
                        expr: expr,
                        ms: this.frameTime(rest.slice(end + 1), ctx)
                    };
                }
                const m = /^([\p{L}\p{N}_]+)\s+(.+?)(?:\s+at\s+(.+))?$/u.exec(rest);
                if (!m) throw new Error('frame <picture> <ms>[ms] [at dx, dy]');
                let s = {
                    op: 'frame'
                };
                // none: nothing shown for the time (the engine's picture -1: the actor hidden)
                if (m[1] === 'none') s.none = true;
                else if (/^\d+$/.test(m[1])) s.number = this.int(m[1], 0, 65535);
                else if (images && images[m[1]] !== undefined) s.image = images[m[1]];
                else s.name = m[1];
                s.ms = this.frameTime(m[2], ctx);
                if (m[3] !== undefined) {
                    const at = this.splitTop(m[3]);
                    if (at.length !== 2) throw new Error('at <dx>, <dy>');
                    s.at = {
                        x: this.operand(at[0], ctx, -128, 127, 'const'),
                        y: this.operand(at[1], ctx, -128, 127, 'const')
                    };
                }
                return s;
            }
            case 'dx':
            case 'dy':
            case 'signal':
            case 'sound':
                return {
                    op: word,
                    value: this.operand(rest, ctx, op.low, op.high, 'const')
                };
            case 'go':
                if (!this.isIdent(rest)) throw new Error('go <exit>: a name of an exit of the graph');
                return {
                    op: 'go',
                    exit: rest
                };
            case 'set':
            case 'add': {
                if (rest.startsWith('game_var.')) {
                    // a variable of the game: always worked out as an expression, a constant within 2^24
                    const m = /^game_var\.([\p{L}\p{N}_]+)\s+(.+)$/u.exec(rest);
                    if (!m) throw new Error(word + ' game_var.<name> <value>');
                    if (!(ctx.gameVars || this.packVariables()).includes(m[1])) throw new Error(word + ' game_var.' + m[1] + ': no such variable of the game (Pack.add_variable)');
                    return {
                        op: word,
                        variable: m[1],
                        value: this.operand(m[2], ctx, op.low, op.high, 'param')
                    };
                }
                const m = /^([\p{L}\p{N}_]+)\s+(.+)$/u.exec(rest);
                if (!m) throw new Error(word + ' <param> <value>');
                if (ctx.params && !ctx.params.includes(m[1])) throw new Error("no param '" + m[1] + "' given before");
                return {
                    op: word,
                    param: m[1],
                    value: this.operand(m[2], ctx, op.low, op.high, 'param')
                };
            }
            case 'rotate': {
                // rotate <degrees> | rotate to <degrees>: a constant is kept in quarter turns, an expression worked out at the step
                const m = /^(to\s+)?([\s\S]+)$/.exec(rest);
                if (!rest || !m) throw new Error('rotate <degrees>, or rotate to <degrees>');
                let s = {
                    op: word,
                    value: this.operand(m[2], ctx, -Infinity, Infinity, 'param')
                };
                if (m[1]) s.to = true;
                return s;
            }
            case 'music': {
                // music <name> [<fade>] | music stop [<fade>] | music volume <percent>% [<time>]: times as 500ms or 2s
                const words = rest.split(/\s+/).filter(w => w);
                const ms = text => {
                    const m = /^(\d+)(ms|s)$/.exec(text);
                    if (!m || parseInt(m[1], 10) * (m[2] === 's' ? 1000 : 1) > 65535) throw new Error('a time of 0..65535 ms (500ms, 2s), not ' + text);
                    return parseInt(m[1], 10) * (m[2] === 's' ? 1000 : 1);
                };
                if (words[0] === 'volume') {
                    const m = words.length === 2 || words.length === 3 ? /^(\d+)%$/.exec(words[1]) : null;
                    if (!m || parseInt(m[1], 10) > 100) throw new Error('music volume <0..100>% [<time>]');
                    return {
                        op: word,
                        volume: parseInt(m[1], 10),
                        ms: words.length === 3 ? ms(words[2]) : 0
                    };
                }
                if (words.length !== 1 && words.length !== 2 || !/^[A-Za-z_][\p{L}\p{N}_]*$/u.test(words[0]))
                    throw new Error('music <name> [<fade>], music stop [<fade>], or music volume <percent>% [<time>]');
                return {
                    op: word,
                    name: words[0],
                    ms: words.length === 2 ? ms(words[1]) : 0
                };
            }
            case 'flip':
            case 'branch':
            case 'hold':
                if (rest) throw new Error(word + ' takes nothing');
                return {
                    op: word
                };
            case 'velocity':
            case 'accel': {
                // by commas when there are expressions, else by spaces
                const xy = rest.includes(',') ? this.splitTop(rest) : rest.split(/\s+/).filter(a => a);
                if (xy.length !== 2) throw new Error(word + ' <x> <y>, or <x>, <y> with expressions');
                return {
                    op: word,
                    x: this.operand(xy[0], ctx, op.low, op.high, 'param'),
                    y: this.operand(xy[1], ctx, op.low, op.high, 'param')
                };
            }
            case 'path': {
                const m = /^x\s*:\s*(.+)$/.exec(rest);
                const xy = m ? this.splitTop(m[1]) : [];
                if (xy.length !== 2 || !/^y\s*:/.test(xy[1])) throw new Error('path x: <expression of t>, y: <expression of t>');
                return {
                    op: word,
                    x: this.operand(xy[0], ctx, -Infinity, Infinity, 'path'),
                    y: this.operand(xy[1].replace(/^y\s*:\s*/, ''), ctx, -Infinity, Infinity, 'path')
                };
            }
            case 'masks':
                return {
                    op: word,
                    indexes: args.map(a => this.maskOperand(a, ctx)).filter((v, i, all) => all.indexOf(v) === i)
                };
            case 'hit': {
                // hit <mask> on <mask> [<mask>...] [damage n] [event e] [recoil e]; words by spaces
                const words = rest.split(/\s+/).filter(w => w);
                if (words.length < 3 || words[1] !== 'on') throw new Error('hit <mask> on <masks> [damage n] [event e] [recoil e]');
                let s = {
                    op: word,
                    mask: this.maskOperand(words[0], ctx),
                    on: []
                };
                let i = 2;
                while (i < words.length && !['damage', 'event', 'recoil'].includes(words[i])) s.on.push(this.maskOperand(words[i++], ctx));
                if (!s.on.length) throw new Error('hit ' + words[0] + ' on what?');
                for (; i < words.length; i += 2) {
                    if (i + 1 >= words.length) throw new Error(words[i] + ' of what?');
                    if (words[i] === 'damage') s.damage = this.operand(words[i + 1], ctx, -32768, 32767, 'const');
                    else if (words[i] === 'event' || words[i] === 'recoil') {
                        if (!this.isName(words[i + 1])) throw new Error('bad event name ' + words[i + 1]);
                        s[words[i]] = words[i + 1];
                    } else throw new Error("'" + words[i] + "' is no part of a hit");
                }
                return s;
            }
            case 'carry': {
                // carry <point> <picture>|none
                if (args.length !== 2) throw new Error('carry <point> <picture> (or none)');
                if (!this.isName(args[0])) throw new Error("no point '" + args[0] + "' on the pictures");
                let s = {
                    op: word,
                    point: args[0]
                };
                if (args[1] === 'none') return s;
                if (/^\d+$/.test(args[1])) s.number = this.int(args[1], 0, 65534);
                else if (images && images[args[1]] !== undefined) s.image = images[args[1]];
                else if (this.isName(args[1])) s.name = args[1];
                else throw new Error("no picture '" + args[1] + "'");
                return s;
            }
            case 'shoot': {
                // shoot <point> <kind> [<vx> <vy>]: the kind is a number or a name of a blob of the pack
                const m = /^(\w+)\s+(\w+)\s*(.*)$/u.exec(rest);
                if (!m) throw new Error('shoot <point> <kind> [<vx> <vy>], a point of the pictures');
                const tail = m[3].trim();
                const xy = !tail ? [0, 0] : tail.includes(',') ? this.splitTop(tail) : tail.split(/\s+/).filter(a => a);
                const kind = /^\d+$/.test(m[2]) ? this.int(m[2], 0, 65535) : m[2];
                if (xy.length !== 2) throw new Error('shoot <point> <kind> <vx> <vy>');
                return {
                    op: word,
                    point: m[1],
                    kind: kind,
                    x: this.operand(xy[0], ctx, -Infinity, Infinity, 'param'),
                    y: this.operand(xy[1], ctx, -Infinity, Infinity, 'param')
                };
            }
            case 'tell': {
                // tell cell <cell>, <event>[, <value>]: a cell of the map told an event, with a value for its own param
                // (0 none): the game's world does it (the rules of a map, mostly)
                if (args[0] === 'cell') {
                    const xs = this.splitTop(rest.slice(4).trim());
                    if (xs.length < 2 || xs.length > 3 || !this.isName(xs[1].trim())) throw new Error('tell cell <cell>, <event>[, <value>]');
                    return {
                        op: word,
                        target: 'cell',
                        cell: this.operand(xs[0], ctx, -Infinity, Infinity, 'param'),
                        event: xs[1].trim(),
                        value: xs.length === 3 ? this.operand(xs[2], ctx, -Infinity, Infinity, 'param') : 0
                    };
                }
                // tell holder <event>: the event is of the pack, it may be declared below
                if (args.length !== 2 || args[0] !== 'holder') throw new Error('tell holder <event>, or tell cell <cell>, <event>[, <value>]');
                if (!this.isName(args[1])) throw new Error("no event '" + args[1] + "'");
                return {
                    op: word,
                    target: 'holder',
                    event: args[1]
                };
            }
            case 'press':
            case 'clear':
                // a button of the map pressed as if trodden on; what lies in a cell gone: the game's world does it
                if (!rest) throw new Error(word + ' <cell>');
                return {
                    op: word,
                    cell: this.operand(rest, ctx, -Infinity, Infinity, 'param')
                };
            case 'appear': {
                // appear <kind>, <event>, <x>, <y>[, left] [with <param> = <expr>, ...]: an actor of a kind comes where
                // the player is, told an event, at x, y, facing left or not, its params given; where it lives is the game's
                const mw = /^([\s\S]*?)\s+with(?:\s+([\s\S]*))?$/.exec(rest);
                if (mw && !(mw[2] || '').trim()) throw new Error('appear ... with <param> = <expression>, ...');
                const xs = this.splitTop(mw ? mw[1] : rest).map(v => v.trim());
                const left = xs.length === 5 && xs[4] === 'left';
                if (xs.length < 4 || xs.length > 5 || (xs.length === 5 && !left) || !this.isName(xs[0]) && !/^\d+$/.test(xs[0]) || !this.isName(xs[1]))
                    throw new Error('appear <kind>, <event>, <x>, <y>[, left] [with <param> = <expression>, ...]');
                let s = {
                    op: word,
                    kind: /^\d+$/.test(xs[0]) ? this.int(xs[0], 0, 65535) : xs[0],
                    event: xs[1],
                    x: this.operand(xs[2], ctx, -Infinity, Infinity, 'param'),
                    y: this.operand(xs[3], ctx, -Infinity, Infinity, 'param'),
                    left: left
                };
                if (mw) {
                    s.with = this.splitTop(mw[2]).map(item => {
                        const eq = item.indexOf('=');
                        const name = eq < 0 ? '' : item.slice(0, eq).trim();
                        if (eq < 0 || !this.isIdent(name) || !item.slice(eq + 1).trim()) throw new Error('appear ... with <param> = <expression>, ...');
                        return {
                            param: name,
                            value: this.operand(item.slice(eq + 1), ctx, -Infinity, Infinity, 'param')
                        };
                    });
                    if (!s.with.length || s.with.length > 255) throw new Error('appear ... with <param> = <expression>, ...');
                }
                return s;
            }
            case 'sense': {
                // sense <kind|any|cell> within <radius> [seen] [where <condition>] into <d>[, <dx>[, <dy>]][, <param> = <expr>]...
                // the nearest one that makes where not 0: how far, where (x forward), and what it is, into params; seen: only
                // one the look reaches within the radius as the veils of the tiles let it (flag bit 2)
                const usage = 'sense <kind|any|cell> within <radius> [seen] [where <condition>] into <d>[, <dx>[, <dy>]][, <param> = <expression>]...';
                const m = /^(\w+)\s+within\s+([\s\S]+?)(\s+seen)?(?:\s+where\s+([\s\S]+?))?\s+into\s+([\s\S]+)$/.exec(rest);
                if (!m) throw new Error(usage);
                const target = /^\d+$/.test(m[1]) ? this.int(m[1], 0, 65534) : m[1];
                if (typeof target === 'string' && !this.isName(target)) throw new Error(usage);
                // what its. may name: of a cell, of a body; the params of the kind looked for are checked later (check)
                const itsCtx = Object.assign({}, ctx, {
                    its: target === 'cell' ? this.itsCell : this.itsBody,
                    itsAny: target !== 'cell' && target !== 'any'
                });
                let s = {
                    op: word,
                    target: target,
                    // a number, or an expression of the actor worked out at the step (flag 4: the radius 0, its bytes after where)
                    radius: this.operand(m[2], ctx, 0, 65535, 'param'),
                    into: [],
                    copies: []
                };
                if (typeof s.radius !== 'number') {
                    const tree = this.foldExpr(this.parseExpr(s.radius, Object.assign({}, ctx, {
                        allowParams: true,
                        allowT: false
                    })));
                    if (tree[0] === 'num') {
                        const v = this.halfAway(tree[1]);
                        if (v < 0 || v > 65535) throw new Error(v + ' is not within 0..65535');
                        s.radius = v;
                    }
                }
                if (m[3] !== undefined) s.seen = true;
                if (m[4] !== undefined) s.where = this.operand(m[4], itsCtx, -Infinity, Infinity, 'param');
                for (const item of this.splitTop(m[5])) {
                    const eq = item.indexOf('=');
                    const name = (eq < 0 ? item : item.slice(0, eq)).trim();
                    if (name !== '_' && (!this.isIdent(name) || ctx.params && !ctx.params.includes(name))) throw new Error("sense into '" + name + "': no such param");
                    if (eq >= 0) {
                        if (name === '_') throw new Error('sense: a copy goes into a param, not _');
                        s.copies.push({
                            param: name,
                            value: this.operand(item.slice(eq + 1), itsCtx, -Infinity, Infinity, 'param')
                        });
                    } else if (s.copies.length || s.into.length === 3) throw new Error('sense into: d, dx, dy first, then <param> = <expression>');
                    else s.into.push(name);
                }
                if (!s.into.length) throw new Error(usage);
                if (s.copies.length > 255) throw new Error('sense: too many copies');
                return s;
            }
            case 'steer': {
                // the velocity steered toward or away from a place (and its velocity), or wandering by an angle
                const way = rest.split(/\s+/)[0];
                const spec = this.steerWays[way];
                if (!spec) throw new Error('steer seek|flee|arrive|pursue|evade|wander ...');
                const usage = this.steerUsage[way];
                const tail = rest.slice(way.length).trim();
                const m = new RegExp('^([\\s\\S]+?)\\s+' + spec[1] + '\\s+([\\s\\S]+)$').exec(tail);
                if (!m) throw new Error(usage);
                const first = this.splitTop(m[1]).map(v => v.trim()),
                    second = this.splitTop(m[2]).map(v => v.trim());
                if (first.length !== spec[0] || second.length !== spec[2] || !first.every(v => v) || !second.every(v => v)) throw new Error(usage);
                let s = {
                    op: word,
                    way: way,
                    args: first.map(v => this.operand(v, ctx, -Infinity, Infinity, 'param'))
                };
                if (way === 'wander') {
                    if (!this.isIdent(second[0]) || ctx.params && !ctx.params.includes(second[0])) throw new Error("steer wander: angle <param>, no param '" + second[0] + "'");
                    s.angle = second[0];
                } else s.args.push(...second.map(v => this.operand(v, ctx, -Infinity, Infinity, 'param')));
                return s;
            }
            case 'vanish':
                if (rest) throw new Error('vanish, alone');
                return {
                    op: word
                };
            case 'release': {
                // release <point> [<vx> <vy>]: the velocity as that of velocity, always expressions; none: 0 0
                const words = rest ? [rest.split(/\s+/)[0], rest.slice(rest.split(/\s+/)[0].length).trim()] : [];
                if (!words.length || !this.isName(words[0])) throw new Error('release <point> [<vx> <vy>], a point of the pictures');
                const xy = !words[1] ? [0, 0] : words[1].includes(',') ? this.splitTop(words[1]) : words[1].split(/\s+/).filter(a => a);
                if (xy.length !== 2) throw new Error('release <point> <vx> <vy>, or <vx>, <vy> with expressions');
                return {
                    op: word,
                    point: words[0],
                    x: this.operand(xy[0], ctx, -Infinity, Infinity, 'param'),
                    y: this.operand(xy[1], ctx, -Infinity, Infinity, 'param')
                };
            }
            case 'contact': {
                const words = rest.split(/\s+/).filter(w => w);
                // contact <mask> <side> [within <points>] on <event> [off <event>] [first within <points>] | contact <mask>
                // off: a mask watched, whether it touches anything solid on that side; the events at the moment it touches
                // and lets go; first within m: begun with nothing within m points on that side (or at its first look with a
                // terrain), the off event comes at once (CONTACT_FIRST, 43: as CONTACT_MASK plus a byte)
                if (words.length && words[0] !== 'on' && words[0] !== 'off') {
                    const usage = 'contact <mask> <side> [within <points>] on <event> [off <event>] [first within <points>] | ... off <event> | contact <mask> off';
                    const mask = this.maskOperand(words[0], ctx);
                    if (words.length === 2 && words[1] === 'off') return {
                        op: word,
                        mask: mask,
                        side: 'none'
                    };
                    if (words.length < 4 || !(words[1] in this.touchSides)) throw new Error(usage);
                    let i = 2,
                        within = 1;
                    if (words[i] === 'within') {
                        if (i + 1 >= words.length) throw new Error(usage);
                        within = this.operand(words[i + 1], ctx, 0, 255, 'const');
                        i += 2;
                    }
                    // on <event>, off <event>, or both in this order; at least one
                    let s = {
                        op: word,
                        mask: mask,
                        side: words[1],
                        within: within
                    };
                    // first within <points> at the end: 1..255, with off only
                    let end = words.length;
                    if (end >= i + 3 && words[end - 3] === 'first' && words[end - 2] === 'within') {
                        s.first = this.operand(words[end - 1], ctx, 1, 255, 'const');
                        end -= 3;
                    }
                    for (const k of ['on', 'off']) {
                        if (words[i] !== k) continue;
                        if (i + 1 >= end || !this.isName(words[i + 1])) throw new Error(usage);
                        s[k === 'on' ? 'event' : 'off'] = words[i + 1];
                        i += 2;
                    }
                    if (i !== end || s.event === undefined && s.off === undefined) throw new Error(usage);
                    if (s.first !== undefined && s.off === undefined) throw new Error('contact: first within needs an off event: it is the one sent when the watch begins over nothing');
                    return s;
                }
                // contact on [<event>] | contact off: the origin as a point; the event may be declared below
                if (!words.length || words[0] !== 'on' && words[0] !== 'off' || words.length > 2 || words[0] === 'off' && words.length === 2)
                    throw new Error('contact on [<event>] | contact off, or contact <mask> <side> on <event>');
                let s = {
                    op: word,
                    on: words[0] === 'on'
                };
                if (words.length === 2) {
                    if (!this.isName(words[1])) throw new Error("no event '" + words[1] + "'");
                    s.event = words[1];
                }
                return s;
            }
            case 'goto': {
                if (/\sif\s/.test(rest)) {
                    // goto <label or script> if <expression>: only where it is not 0
                    const m = /^([\p{L}\p{N}_]+)\s+if\s+(.+)$/u.exec(rest);
                    if (!m) throw new Error('goto <label or script> if <expression>');
                    this.parseExpr(m[2], Object.assign({}, ctx, {
                        allowParams: true,
                        allowT: false
                    }));
                    return {
                        op: word,
                        target: m[1],
                        cond: m[2].trim()
                    };
                }
                if (!this.isName(rest)) throw new Error('goto <script or label>');
                return {
                    op: word,
                    target: rest
                };
            }
            case 'timer': {
                // timer start|stop|hold|go <name>: the timer of the game of that name
                const words = rest.split(/\s+/).filter(w => w);
                if (words.length !== 2 || !['start', 'stop', 'hold', 'go'].includes(words[0]) || !/^[A-Za-z_]\w*$/.test(words[1]))
                    throw new Error('timer start|stop|hold|go <name>');
                return {
                    op: word,
                    action: words[0],
                    name: words[1]
                };
            }
            case 'keep':
                if (rest) throw new Error('keep, alone');
                return {
                    op: word
                };
            case 'stow':
            case 'draw':
                // stow <point> | draw <point> <kind>: the kind a number or a name of the pack
                if (!args.length || !this.isName(args[0]) || args.length !== (word === 'stow' ? 1 : 2))
                    throw new Error('stow <point> | draw <point> <kind>, a point of the pictures');
                if (word === 'stow') return {
                    op: word,
                    point: args[0]
                };
                if (!/^\d+$/.test(args[1]) && !this.isName(args[1])) throw new Error("no kind '" + args[1] + "'");
                return {
                    op: word,
                    point: args[0],
                    kind: /^\d+$/.test(args[1]) ? this.int(args[1], 0, 65534) : args[1]
                };
            case 'label':
                if (!this.isName(rest)) throw new Error('label <name>');
                return {
                    op: word,
                    name: rest
                };
        }
        throw new Error("no such statement '" + word + "'");
    },

    // the text of a statement; pictures of the set get their names in the pack
    statementText(s, set) {
        switch (s.op) {
            case 'frame': {
                if (s.expr !== undefined) return 'frame (' + s.expr + ') ' + (typeof s.ms === 'number' ? s.ms + 'ms' : s.ms);
                const picture = s.none ? 'none' : s.image !== undefined ? this.imageName(set, s.image) : s.number !== undefined ? String(s.number) : s.name;
                // an expression of the time goes without ms: a name before it would be another name
                const ms = typeof s.ms === 'number' ? s.ms + 'ms' : s.ms;
                return 'frame ' + picture + ' ' + ms + (s.at ? ' at ' + s.at.x + ', ' + s.at.y : '');
            }
            case 'dx':
            case 'dy':
            case 'signal':
            case 'sound':
                return s.op + ' ' + s.value;
            case 'go':
                return 'go ' + s.exit;
            case 'set':
            case 'add':
                return s.op + ' ' + (s.variable !== undefined ? 'game_var.' + s.variable : s.param) + ' ' + s.value;
            case 'rotate':
                return 'rotate ' + (s.to ? 'to ' : '') + s.value;
            case 'music': {
                const time = s.ms ? ' ' + (s.ms % 1000 ? s.ms + 'ms' : s.ms / 1000 + 's') : '';
                return 'music ' + (s.volume !== undefined ? 'volume ' + s.volume + '%' : s.name) + time;
            }
            case 'velocity':
            case 'accel':
                return s.op + ' ' + s.x + (typeof s.x === 'number' && typeof s.y === 'number' ? ' ' : ', ') + s.y;
            case 'path':
                return 'path x: ' + s.x + ', y: ' + s.y;
            case 'masks':
                return ['masks', ...s.indexes].join(' ');
            case 'contact':
                if (s.mask !== undefined) {
                    if (s.side === 'none') return 'contact ' + s.mask + ' off';
                    return 'contact ' + s.mask + ' ' + s.side + (s.within !== 1 ? ' within ' + s.within : '') + (s.event !== undefined ? ' on ' + s.event : '') + (s.off !== undefined ? ' off ' + s.off : '') + (s.first !== undefined ? ' first within ' + s.first : '');
                }
                return 'contact ' + (s.on ? 'on' : 'off') + (s.on && s.event !== undefined ? ' ' + s.event : '');
            case 'carry':
                return 'carry ' + s.point + ' ' + (s.image !== undefined ? this.imageName(set, s.image) : s.number !== undefined ? s.number : s.name !== undefined ? s.name : 'none');
            case 'tell':
                if (s.target === 'cell') return 'tell cell ' + s.cell + ', ' + s.event + (s.value !== 0 ? ', ' + s.value : '');
                return 'tell ' + s.target + ' ' + s.event;
            case 'press':
            case 'clear':
                return s.op + ' ' + s.cell;
            case 'appear':
                return 'appear ' + s.kind + ', ' + s.event + ', ' + s.x + ', ' + s.y + (s.left ? ', left' : '') +
                    (s.with ? ' with ' + s.with.map(w => w.param + ' = ' + w.value).join(', ') : '');
            case 'vanish':
                return 'vanish';
            case 'sense':
                return 'sense ' + s.target + ' within ' + s.radius + (s.seen ? ' seen' : '') + (s.where !== undefined ? ' where ' + s.where : '') + ' into ' +
                    [...s.into, ...s.copies.map(c => c.param + ' = ' + c.value)].join(', ');
            case 'steer': {
                const spec = this.steerWays[s.way];
                const first = s.args.slice(0, spec[0]),
                    second = s.way === 'wander' ? [s.angle] : s.args.slice(spec[0]);
                return 'steer ' + s.way + ' ' + first.join(', ') + ' ' + spec[1] + ' ' + second.join(', ');
            }
            case 'shoot':
                if (s.x === 0 && s.y === 0) return 'shoot ' + s.point + ' ' + s.kind;
                return 'shoot ' + s.point + ' ' + s.kind + ' ' + s.x + (typeof s.x === 'number' && typeof s.y === 'number' ? ' ' : ', ') + s.y;
            case 'release':
                if (s.x === 0 && s.y === 0) return 'release ' + s.point;
                return 'release ' + s.point + ' ' + s.x + (typeof s.x === 'number' && typeof s.y === 'number' ? ' ' : ', ') + s.y;
            case 'hit':
                return 'hit ' + s.mask + ' on ' + s.on.join(' ') + (s.damage !== undefined ? ' damage ' + s.damage : '') +
                    (s.event !== undefined ? ' event ' + s.event : '') + (s.recoil !== undefined ? ' recoil ' + s.recoil : '');
            case 'goto':
                return 'goto ' + s.target + (s.cond !== undefined ? ' if ' + s.cond : '');
            case 'stow':
                return 'stow ' + s.point;
            case 'timer':
                return 'timer ' + s.action + ' ' + s.name;
            case 'draw':
                return 'draw ' + s.point + ' ' + s.kind;
            case 'label':
                return 'label ' + s.name;
        }
        return s.op;
    },

    // the expressions of a statement worked out on the board, with params or t
    expressionsOf(l) {
        const fields = l.op === 'set' || l.op === 'add' || l.op === 'rotate' ? [l.value] : l.op === 'velocity' || l.op === 'accel' || l.op === 'path' || l.op === 'release' || l.op === 'shoot' ? [l.x, l.y] :
            l.op === 'frame' ? [l.expr, l.ms] : l.op === 'goto' && l.cond !== undefined ? [l.cond] :
            l.op === 'tell' && l.target === 'cell' ? [l.cell, l.value] : l.op === 'press' || l.op === 'clear' ? [l.cell] :
            l.op === 'appear' ? [l.x, l.y, ...(l.with || []).map(w => w.value)] : l.op === 'steer' ? l.args : l.op === 'sense' ? [l.radius] : [];
        return fields.filter(v => typeof v === 'string');
    },
    // the bytes of an expression in the blob (without its length) and the stack it needs, as the assembler writes it
    exprCode(tree) {
        let bytes = 0,
            depth = 0,
            high = 0;
        const emit = node => {
            if (node[0] === 'num' || node[0] === 'param' || node[0] === 't' || node[0] === 'vx' || node[0] === 'vy' || node[0] === 'now' || node[0] === 'x' || node[0] === 'y' ||
                node[0] === 'amount' || node[0] === 'count' || node[0] === 'pic' || node[0] === 'timer' || node[0] === 'axis' || node[0] === 'music' || node[0] === 'rotation') {
                // a picture is its number, as a number is; axis: the step and the number of the axis
                bytes += node[0] === 'num' || node[0] === 'pic' ? 5 : node[0] === 'param' || node[0] === 'timer' || node[0] === 'axis' ? 2 : node[0] === 'count' ? 3 : 1;
                depth++;
            } else if (node[0] === 'its' || node[0] === 'game' || node[0] === 'game_var') {
                bytes += 2;
                depth++;
            } else if (node[0] === 'table') {
                // the index, then the read: op and the table's offset u16; the index is taken, the value put
                emit(node[2]);
                bytes += 3;
            } else {
                node[2].forEach(emit);
                // a lazy and, or: AND_THEN or OR_ELSE with a skip, then TRUTH; c ? a : b: IF_NOT with a skip, JUMP with a skip
                bytes += node[1] === 'and' || node[1] === 'or' ? 3 : node[1] === '?' ? 4 : 1;
                depth -= node[2].length - 1;
            }
            high = Math.max(high, depth);
        };
        emit(tree);
        return {
            bytes: bytes,
            depth: high
        };
    },
    // the bytes of a statement in the code: expressions that change with the actor are written as expressions
    statementBytes(l, ctx) {
        const tree = v => typeof v === 'number' ? ['num', v] : this.parseExpr(v, Object.assign({}, ctx, {
            allowParams: true,
            allowT: l.op === 'path'
        }));
        try {
            switch (l.op) {
                case 'frame': {
                    // pictures are numbers to the assembler: parts of them and numbers alone are worked out
                    const t = l.expr !== undefined ? this.foldExpr(this.picturesAsNumbers(this.parseExpr(l.expr, Object.assign({}, ctx, {
                        allowParams: true,
                        allowT: false,
                        pictures: {}
                    })))) : ['num', 0];
                    if (this.timeWorked(l.ms, ctx)) {
                        // FRAME_MS: op, dx, dy, the picture (a number: 5 bytes) and the time, each expression with its length
                        return 3 + 1 + (this.constantTree(t) ? 5 : this.exprCode(t).bytes) + 1 + this.exprCode(tree(l.ms)).bytes;
                    }
                    // of pictures and numbers alone: a plain frame; else FRAME_X, ms and the expression
                    if (l.expr !== undefined) return this.constantTree(t) ? 5 : 4 + this.exprCode(t).bytes;
                    return l.at ? 7 : 5;
                }
                case 'rotate': {
                    // a constant in quarter turns; ROTATE_X: op, to, the expression with its length
                    const t = tree(l.value);
                    return t[0] === 'num' ? 2 : 3 + this.exprCode(t).bytes;
                }
                case 'goto':
                    // GOTO_IF: op, script or label, its number, the expression
                    return l.cond !== undefined ? 5 + this.exprCode(tree(l.cond)).bytes : 3;
                case 'set':
                case 'add': {
                    // SET_VAR, ADD_VAR: op, the variable, the expression with its length, a constant too
                    if (l.variable !== undefined) return 3 + this.exprCode(tree(l.value)).bytes;
                    // a constant within 16 bits in the step, another as an expression
                    const t = tree(l.value);
                    const h = t[0] === 'num' ? this.halfAway(t[1]) : null;
                    return h !== null && h >= -32768 && h <= 32767 ? 4 : 3 + this.exprCode(t).bytes;
                }
                case 'velocity':
                case 'accel':
                case 'path': {
                    const tx = tree(l.x),
                        ty = tree(l.y);
                    // whole constants as int16; one with a fraction is kept exact as an expression (as the assembler does)
                    if (l.op !== 'path' && tx[0] === 'num' && ty[0] === 'num' && tx[1] === this.halfAway(tx[1]) && ty[1] === this.halfAway(ty[1])) return 5;
                    return 3 + this.exprCode(tx).bytes + this.exprCode(ty).bytes;
                }
                case 'tell':
                    // CELL: op, event, the cell and the value as expressions with their lengths
                    if (l.target === 'cell') return 2 + this.exprCode(tree(l.cell)).bytes + this.exprCode(tree(l.value)).bytes;
                    break;
                case 'press':
                case 'clear':
                    return 1 + this.exprCode(tree(l.cell)).bytes;
                case 'contact':
                    // CONTACT_MASK: op, mask, sides, reach, on, off; CONTACT_FIRST: the same and first
                    if (l.mask !== undefined) return 6 + (l.first !== undefined ? 1 : 0);
                    break;
                case 'appear':
                    // op, kind u16, event, left, and the two expressions with their lengths; with: a count and the pairs
                    return 5 + this.exprCode(tree(l.x)).bytes + this.exprCode(tree(l.y)).bytes +
                        (l.with ? 1 + l.with.reduce((n, w) => n + 1 + this.exprCode(tree(w.value)).bytes, 0) : 0);
                case 'vanish':
                    return 1;
                case 'sense': {
                    // op, flags, kind u16, radius u16, the where (a single byte when none), d dx dy, the count of copies, the copies
                    const its = Object.assign({}, ctx, {
                        allowParams: true,
                        its: l.target === 'cell' ? this.itsCell : this.itsBody,
                        itsAny: true
                    });
                    // each expression with its length byte; none where: a single 0
                    const code = v => 1 + (typeof v === 'number' ? this.exprCode(['num', v]).bytes : this.exprCode(this.parseExpr(v, its)).bytes);
                    return 6 + (l.where !== undefined ? code(l.where) : 1) + (typeof l.radius === 'string' ? 1 + this.exprCode(tree(l.radius)).bytes : 0) +
                        3 + 1 + l.copies.reduce((n, c) => n + 1 + code(c.value), 0);
                }
                case 'steer':
                    // op, way, the param of the angle, the count, the expressions
                    return 4 + l.args.reduce((n, v) => n + this.exprCode(tree(v)).bytes, 0);
                case 'release':
                    // [op][point] and two expressions, each with its length
                    return 4 + this.exprCode(tree(l.x)).bytes + this.exprCode(tree(l.y)).bytes;
                case 'shoot':
                    // [op][point][kind u16] and two expressions
                    return 6 + this.exprCode(tree(l.x)).bytes + this.exprCode(tree(l.y)).bytes;
            }
        } catch (e) {
            return 0;
        }
        return this.size[l.op] || 0;
    },
    // a name of a define or a param renamed in the texts of expressions
    renameInExpressions(a, oldName, newName) {
        const re = new RegExp('(^|[^\\p{L}\\p{N}_])' + oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'gu');
        const fix = v => typeof v === 'string' ? v.replace(re, (m, before) => before + newName) : v;
        for (const d of a.defines) d.value = fix(d.value);
        for (const p of a.params) p.value = fix(p.value);
        for (const sc of a.scripts) {
            for (const l of sc.lines) {
                // and the constants a define may give: masks of hit and contact, damage, the radius of sense, within, first
                for (const k of ['value', 'x', 'y', 'ms', 'expr', 'cond', 'where', 'cell', 'mask', 'damage', 'radius', 'within', 'first']) {
                    if (k in l) l[k] = fix(l[k]);
                }
                if (l.op === 'hit' && Array.isArray(l.on)) l.on = l.on.map(fix);
                for (const w of l.with || []) w.value = fix(w.value);
                for (const c of l.copies || []) c.value = fix(c.value);
                if (l.args) l.args = l.args.map(fix);
                if (l.at) {
                    l.at.x = fix(l.at.x);
                    l.at.y = fix(l.at.y);
                }
                if (l.indexes) l.indexes = l.indexes.map(fix);
            }
        }
    },
    // masks named in the scripts follow their new names (names: {old: new}, all at once), where a mask goes only
    renameMasks(a, names) {
        const fix = v => typeof v === 'string' && v.trim() in names ? names[v.trim()] : v;
        for (const sc of a.scripts) {
            for (const l of sc.lines) {
                if (l.op === 'masks') l.indexes = l.indexes.map(fix);
                if (l.op === 'hit') l.on = l.on.map(fix);
                if ((l.op === 'hit' || l.op === 'contact') && l.mask !== undefined) l.mask = fix(l.mask);
            }
        }
    },
    renameDefine(a, oldName, newName) {
        for (const d of a.defines)
            if (d.name === oldName) d.name = newName;
        this.renameInExpressions(a, oldName, newName);
    },
    renameTable(a, oldName, newName) {
        for (const t of a.tables || [])
            if (t.name === oldName) t.name = newName;
        this.renameInExpressions(a, oldName, newName);
    },
    // a variable of the game renamed in the scripts: game_var.<old> in expressions, set and add game_var.<old>
    renameGameVar(a, oldName, newName) {
        const re = new RegExp('\\bgame_var\\s*\\.\\s*' + oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'gu');
        const fix = v => typeof v === 'string' ? v.replace(re, 'game_var.' + newName) : v;
        for (const d of a.defines) d.value = fix(d.value);
        for (const sc of a.scripts) {
            for (const l of sc.lines) {
                if ((l.op === 'set' || l.op === 'add') && l.variable === oldName) l.variable = newName;
                for (const k of ['value', 'x', 'y', 'ms', 'expr', 'cond', 'where', 'cell', 'radius']) {
                    if (k in l) l[k] = fix(l[k]);
                }
                for (const w of l.with || []) w.value = fix(w.value);
                for (const c of l.copies || []) c.value = fix(c.value);
                if (l.args) l.args = l.args.map(fix);
            }
        }
    },
    // a music renamed in the scripts that play it
    renameMusic(a, oldName, newName) {
        for (const sc of a.scripts)
            for (const l of sc.lines)
                if (l.op === 'music' && l.name === oldName) l.name = newName;
    },

    ruleText(r) {
        return 'on ' + r.event + ': ' + r.source + ' -> ' + r.to + ' ' + r.when;
    },

    // the pack names of the frames of a set -> their files
    imagesOf(set) {
        let images = {};
        for (const f of set.frames) images[this.imageName(set, f.image)] = f.image;
        return images;
    },

    // reads a text .anim to an animation: {animation, notes, at} or {errors: ['line n: ...']}. Comments are kept with
    // what they stand by: the lines of comment above a statement (above), the comment at the end of its line (note);
    // those of event, game, pockets, stack in animation.heads, those after the last statement in animation.tail. at:
    // what each line of the text is (at[i] = {script, step} | {script} | {rule} | {group} | null), for an editor of the
    // text. A statement 'action N' of the language before params is read as 'set action N'
    parse(text, set) {
        const images = set ? this.imagesOf(set) : {};
        let a = this.empty();
        let errors = [];
        let names = new Set(); // scripts and labels
        let current = null;
        let actions = 0; // statements action of the old language
        let ctx = { // the defines, params, tables and questions given so far: a name is given before it is used
            defines: this.packConstants(), // the pack's constants first
            params: [],
            tables: {},
            questions: []
        };
        const ruleRe = /^([\p{L}\p{N}_]+)\s*:\s*([\p{L}\p{N}_]+)\s*->\s*([\p{L}\p{N}_]+)\s+(now|branch|end)$/u;
        let pending = []; // lines of comment, for the statement after them
        let at = [];
        // the comments of a line go with what it made
        const attach = (el, raw) => {
            if (pending.length) el.above = (el.above || []).concat(pending);
            pending = [];
            const hash = raw.indexOf('#');
            const note = hash < 0 ? '' : raw.slice(hash + 1).replace(/\s+$/, '');
            if (note.trim()) el.note = el.note ? el.note + ';' + note : note;
            return el;
        };
        const head = k => (a.heads || (a.heads = {}))[k] || (a.heads[k] = {});
        text.split(/\r?\n/).forEach((raw, i) => {
            const where = 'line ' + (i + 1);
            const hash = raw.indexOf('#');
            const line = (hash < 0 ? raw : raw.slice(0, hash)).trim();
            at.push(null);
            if (!line) {
                // a line of comment; the line the editor once wrote at the top is not one of the author's
                if (hash >= 0 && !this.exportedHeader.test(raw)) pending.push(raw.slice(hash + 1).replace(/\s+$/, ''));
                return;
            }
            const sp = line.search(/\s/);
            const word = sp < 0 ? line : line.slice(0, sp);
            const rest = sp < 0 ? '' : line.slice(sp).trim();
            try {
                if (word === 'event') {
                    for (const e of rest.split(',').map(x => x.trim())) {
                        if (!this.isName(e) || a.events.includes(e)) throw new Error("bad or repeated event '" + e + "'");
                        a.events.push(e);
                    }
                    attach(head('event'), raw);
                } else if (word === 'define') {
                    const m = /^([\p{L}\p{N}_]+)\s+(.+)$/u.exec(rest);
                    if (m && this.constantTaken(m[1])) throw new Error(this.constantTaken(m[1]));
                    if (!m || !this.isIdent(m[1]) || m[1] in ctx.defines || ctx.params.includes(m[1]) || m[1] in ctx.tables || this.reserved(m[1]))
                        throw new Error('define <name> <value>, a new name');
                    const tree = this.parseExpr(m[2], Object.assign({}, ctx, {
                        allowParams: false,
                        allowT: false
                    }));
                    if (tree[0] !== 'num') throw new Error("'" + m[2].trim() + "' must be a constant");
                    ctx.defines[m[1]] = tree[1];
                    a.defines.push(attach({
                        name: m[1],
                        value: /^-?\d+$/.test(m[2].trim()) ? parseInt(m[2], 10) : m[2].trim()
                    }, raw));
                } else if (word === 'game') {
                    // game <name> <name> ...: questions to the game, numbered in this order; more lines add more
                    const names = rest.split(/[\s,]+/).filter(n => n);
                    if (!names.length) throw new Error('game <name> <name> ...');
                    for (const n of names) {
                        if (!this.isIdent(n) || a.questions.includes(n) || n in ctx.defines || ctx.params.includes(n) || n in ctx.tables || this.reserved(n))
                            throw new Error("game: '" + n + "' is no name, or it is taken");
                        if (this.packVariables().includes(n)) throw new Error('game ' + n + ': ' + n + ' is a variable of the game (game_var.' + n + '), not a question to it');
                        if (a.questions.length === 255) throw new Error('255 questions at most');
                        a.questions.push(n);
                        ctx.questions.push(n);
                    }
                    attach(head('game'), raw);
                } else if (word === 'table') {
                    // table <name> <value> <value> ...: int16 constants, read as name[index]
                    const m = /^([\p{L}\p{N}_]+)\s+(.+)$/u.exec(rest);
                    if (!m || !this.isIdent(m[1]) || m[1] in ctx.tables || m[1] in ctx.defines || ctx.params.includes(m[1]) || this.reserved(m[1]))
                        throw new Error('table <name> <value> <value> ..., a new name');
                    // by commas when there are expressions, else by spaces
                    const parts = m[2].includes(',') ? this.splitTop(m[2]) : m[2].split(/\s+/).filter(v => v);
                    const values = parts.map(v => this.operand(v, ctx, -32768, 32767, 'const')).map(v => typeof v === 'number' ? v : this.halfAway(this.parseExpr(v, Object.assign({}, ctx, {
                        allowParams: false,
                        allowT: false
                    }))[1]));
                    const bytes = (a.tables || []).reduce((n, t) => n + 2 + 2 * t.values.length, 0);
                    if (values.length > 65535 || bytes + 2 + 2 * values.length > 65535) throw new Error('the tables are too large');
                    a.tables.push(attach({
                        name: m[1],
                        values: values
                    }, raw));
                    ctx.tables[m[1]] = values;
                } else if (word === 'param') {
                    const m = /^([\p{L}\p{N}_]+)\s+(.+)$/u.exec(rest);
                    if (!m || !this.isIdent(m[1]) || a.params.some(p => p.name === m[1]) || m[1] in ctx.defines || m[1] in ctx.tables || this.reserved(m[1])) throw new Error('param <name> <value>, a new name');
                    if (a.params.length === this.maxParams) throw new Error(this.maxParams + ' params at most');
                    a.params.push(attach({
                        name: m[1],
                        value: this.operand(m[2], ctx, -32768, 32767, 'const')
                    }, raw));
                    ctx.params.push(m[1]);
                } else if (word === 'pockets' || word === 'stack') {
                    // of the animation, before its scripts: places for things; how many of its kind go into one place
                    if (current) throw new Error(word + ' is of the animation, before its scripts');
                    a[word] = this.operand(rest, ctx, word === 'pockets' ? 0 : 1, 255, 'const');
                    attach(head(word), raw);
                } else if (word === 'group') {
                    const colon = rest.indexOf(':');
                    const name = (colon < 0 ? rest : rest.slice(0, colon)).trim();
                    const members = colon < 0 ? [] : rest.slice(colon + 1).split(',').map(m => m.trim()).filter(m => m);
                    const g = a.groups.find(g => g.name === name);
                    if (g) attach(g, raw).scripts = members;
                    else a.groups.push(attach({
                        name: name,
                        scripts: members
                    }, raw));
                    at[i] = {
                        group: name
                    };
                } else if (word === 'on') {
                    const m = ruleRe.exec(rest);
                    if (!m) throw new Error('on <event>: <script or group> -> <script> now|branch|end');
                    a.rules.push(attach({
                        event: m[1],
                        source: m[2],
                        to: m[3],
                        when: m[4]
                    }, raw));
                    at[i] = {
                        rule: a.rules.length - 1
                    };
                } else if (word === 'script' || word === 'label') {
                    if (!this.isName(rest) || names.has(rest)) throw new Error("bad or repeated name '" + rest + "'");
                    names.add(rest);
                    if (word === 'script') {
                        current = {
                            name: rest,
                            lines: []
                        };
                        // the editor's marks, in its comment: entry (the game starts it), through (goes on on purpose)
                        const comment = raw.indexOf('#') >= 0 ? raw.slice(raw.indexOf('#') + 1) : '';
                        if (/\bentry\b/.test(comment)) current.entry = true;
                        if (/\bthrough\b/.test(comment)) current.through = true;
                        a.scripts.push(attach(current, raw));
                        at[i] = {
                            script: rest
                        };
                    } else {
                        if (!current) throw new Error('a label outside a script');
                        current.lines.push(attach({
                            op: 'label',
                            name: rest
                        }, raw));
                        at[i] = {
                            script: current.name,
                            step: current.lines.length - 1
                        };
                    }
                } else {
                    if (!current) throw new Error("'" + word + "' outside a script");
                    if (word === 'action') {
                        if (!a.params.some(p => p.name === 'action')) {
                            a.params.unshift({
                                name: 'action',
                                value: 0
                            });
                            ctx.params.push('action');
                        }
                        current.lines.push(attach({
                            op: 'set',
                            param: 'action',
                            value: this.int(rest, 0, 255)
                        }, raw));
                        actions++;
                    } else current.lines.push(attach(this.parseStatement(line, images, ctx), raw));
                    at[i] = {
                        script: current.name,
                        step: current.lines.length - 1
                    };
                }
            } catch (e) {
                errors.push(where + ': ' + e.message);
            }
        });
        if (errors.length) return {
            errors: errors
        };
        if (pending.length) a.tail = pending;
        return {
            animation: a,
            at: at,
            notes: actions ? [actions + " statements 'action N' are read as 'set action N' of a param action"] : []
        };
    },
    // the line the editor once put at the top of a text it wrote: not the author's, it is not kept
    exportedHeader: /^\s*#\s*Animations of the set .*, exported by dgx-ge-sprite-editor\s*$/,

    // the text .anim of the animation of a set: its declarations, its scripts, groups and rules in this order, each with
    // the comments that stand by it (above it, at the end of its line)
    text(set) {
        const a = set.animation;
        let out = [];
        const blank = () => {
            if (out.length && out[out.length - 1] !== '') out.push('');
        };
        // a statement with its comments: those above it at its indent, its own at the end of its line
        const put = (el, indent, text, note) => {
            for (const c of el && el.above || []) out.push(indent + '#' + c);
            note = note !== undefined ? note : el && el.note;
            out.push(indent + text + (note ? '  #' + note : ''));
        };
        const heads = a.heads || {};
        if (a.events.length) put(heads.event, '', 'event ' + a.events.join(', '));
        blank();
        for (const d of a.defines) put(d, '', 'define ' + d.name + ' ' + d.value);
        blank();
        for (const t of a.tables || []) put(t, '', 'table ' + t.name + ' ' + t.values.join(' '));
        blank();
        if ((a.questions || []).length) put(heads.game, '', 'game ' + a.questions.join(' '));
        blank();
        for (const p of a.params) put(p, '', 'param ' + p.name + ' ' + p.value);
        blank();
        if (a.pockets !== undefined) put(heads.pockets, '', 'pockets ' + a.pockets);
        if (a.stack !== undefined) put(heads.stack, '', 'stack ' + a.stack);
        for (const s of a.scripts) {
            blank();
            put(s, '', 'script ' + s.name, this.scriptNote(s));
            for (const l of s.lines) {
                if (l.op === 'label') put(l, '', 'label ' + l.name);
                else put(l, '    ', this.statementText(l, set));
            }
        }
        // an empty group too: rules may name it (they do nothing then), and the assembler takes 'group name:'
        blank();
        for (const g of a.groups) put(g, '', ('group ' + g.name + ': ' + g.scripts.join(', ')).trim());
        blank();
        for (const r of a.rules) put(r, '', this.ruleText(r));
        for (const c of a.tail || []) out.push('#' + c);
        while (out.length && out[out.length - 1] === '') out.pop();
        return out.join('\n') + '\n';
    },
    // the comment of a script's line: the author's, with the editor's marks as the script has them now (entry: the
    // game starts it; through: it goes on into the next on purpose)
    scriptNote(s) {
        let note = s.note || '';
        for (const [mark, has, says] of [
                ['entry', s.entry, ' entry: the game starts it'],
                ['through', s.through, ' through: goes on into the next on purpose']
            ]) {
            const re = new RegExp('\\b' + mark + '\\b:?');
            if (has && !re.test(note)) note = note ? says + ';' + note : says;
            if (!has && re.test(note)) note = note.replace(new RegExp('\\s*\\b' + mark + '\\b:?'), '');
        }
        return note.trim() ? note : '';
    },

    // the scripts a rule is for: those of a group (a group takes the place of a script of its name), or a script;
    // null when the source is neither
    sourceRows(a, source) {
        const g = a.groups.find(g => g.name === source);
        if (g) return g.scripts;
        if (a.scripts.some(s => s.name === source)) return [source];
        return null;
    },

    // the matrix the rules fill: {script: {event: {to, when, rules: [index], conflict?: [{to, when, rules}]}}}.
    // A cell given otherwise by another rule has the other answers in conflict
    matrix(a) {
        const scripts = new Set(a.scripts.map(s => s.name));
        let m = {};
        a.rules.forEach((r, i) => {
            if (!a.events.includes(r.event) || !scripts.has(r.to)) return;
            for (const row of this.sourceRows(a, r.source) || []) {
                if (!scripts.has(row)) continue;
                const cells = m[row] || (m[row] = {});
                const c = cells[r.event];
                if (!c) {
                    cells[r.event] = {
                        to: r.to,
                        when: r.when,
                        rules: [i]
                    };
                } else if (c.to === r.to && c.when === r.when) {
                    if (!c.rules.includes(i)) c.rules.push(i);
                } else {
                    if (!c.conflict) c.conflict = [];
                    const other = c.conflict.find(x => x.to === r.to && x.when === r.when);
                    if (other) other.rules.push(i);
                    else c.conflict.push({
                        to: r.to,
                        when: r.when,
                        rules: [i]
                    });
                }
            }
        });
        return m;
    },

    // the matrix with one more rule, or a group with one more script: what it would give and what it would break
    matrixWith(a, change) {
        let b = {
            events: a.events,
            scripts: a.scripts,
            groups: a.groups.map(g => change.group === g.name ? {
                name: g.name,
                scripts: [...g.scripts, change.script]
            } : g),
            rules: change.rule ? [...a.rules, change.rule] : a.rules
        };
        return this.matrix(b);
    },

    // a script that comes to its last line goes on into the next one
    fallsThrough(script) {
        for (let i = script.lines.length - 1; i >= 0; --i) {
            const op = script.lines[i].op;
            if (op === 'label') continue;
            // a goto with a condition goes on when it is 0
            return !(op === 'goto' && script.lines[i].cond === undefined) && op !== 'hold';
        }
        return true;
    },

    // The answers of the game a kind would lose, as tools/dgx_ge_explain.py lost_answers finds them: [{script, signals,
    // onto}], in the order of the scripts. The game answers a signal from its say at once (dgx_ge_actor_event), and the
    // actor is then still in the script whose step signalled: one no rule names (by itself or in a group) drops the
    // answer. Told when, after a signal, it goes on into another script (goto, goto if); one that stays in itself
    // (hold, a goto of its own labels or of itself) is not, nor a kind of no rules. A goto to a label (of any script)
    // and a run past the end into the next script keep the script followed; what follows vanish is not followed
    lostAnswers(a) {
        if (!a.rules.length) return [];
        let flat = []; // the statements of all the scripts in order, each script begun by {op: 'script', name}
        for (const s of a.scripts) flat.push({
            op: 'script',
            name: s.name
        }, ...s.lines);
        let starts = new Map(),
            labels = new Map();
        flat.forEach((x, i) => {
            if (x.op === 'script') starts.set(x.name, i);
            else if (x.op === 'label') labels.set(x.name, i);
        });
        const groups = new Map(a.groups.map(g => [g.name, g.scripts]));
        const answering = new Set(a.rules.flatMap(r => groups.get(r.source) || [r.source]));
        let out = [];
        for (const [name, start] of starts) {
            if (answering.has(name)) continue;
            let signals = [],
                onto = [],
                seen = new Set(),
                todo = [
                    [start + 1, []]
                ];
            while (todo.length) {
                let [i, said] = todo.pop();
                while (i < flat.length && !seen.has(i + '\u0001' + said.join('\u0001'))) {
                    seen.add(i + '\u0001' + said.join('\u0001'));
                    const x = flat[i];
                    if (x.op === 'signal' && !said.includes(String(x.value))) said = [...said, String(x.value)];
                    if (x.op === 'hold' || x.op === 'vanish') break;
                    if (x.op === 'goto') {
                        const to = x.target,
                            cond = x.cond !== undefined;
                        if (labels.has(to) || to === name) {
                            const at = labels.has(to) ? labels.get(to) : start;
                            if (cond) todo.push([at + 1, said]);
                            else {
                                i = at + 1;
                                continue;
                            }
                        } else if (starts.has(to)) {
                            if (said.length) {
                                for (const s of said)
                                    if (!signals.includes(s)) signals.push(s);
                                if (!onto.includes(to)) onto.push(to);
                            }
                            if (!cond) break;
                        }
                    }
                    i++;
                }
            }
            if (signals.length) out.push({
                script: name,
                signals: signals,
                onto: onto
            });
        }
        return out;
    },

    // what the assembler would refuse (errors) and what is likely a mistake (warnings):
    // [{kind: 'script' | 'rule' | 'event' | 'group' | null, name, line, text}]
    check(set, allSets) {
        const a = set.animation;
        let errors = [];
        let warnings = [];
        const err = (kind, name, line, text) => errors.push({
            kind: kind,
            name: name,
            line: line,
            text: text
        });
        const warn = (kind, name, line, text) => warnings.push({
            kind: kind,
            name: name,
            line: line,
            text: text
        });
        if (!a.scripts.length) err(null, null, null, 'no script');
        if (a.scripts.length > this.maxScripts) err(null, null, null, a.scripts.length + ' scripts, ' + this.maxScripts + ' at most');
        // defines in their order: each may name those before it, and the pack's constants
        let ctx = {
            defines: this.packConstants(),
            params: [],
            tables: this.tableValues(a),
            questions: (a.questions || []).slice(),
            gameVars: this.packVariables()
        };
        const paramNames = new Set(a.params.map(p => p.name));
        // the questions to the game: names of their own, 255 at most
        let seenQ = new Set();
        for (const q of a.questions || []) {
            if (!this.isIdent(q) || this.reserved(q) || paramNames.has(q) || a.defines.some(d => d.name === q) || (a.tables || []).some(t => t.name === q)) err('game', q, null, "bad question name '" + q + "': letters, digits, _, not a define, a param, a table or a word of the language");
            if (this.constantTaken(q)) err('game', q, null, this.constantTaken(q));
            if (seenQ.has(q)) err('game', q, null, "the question '" + q + "' is given twice");
            // a variable of the game is no question to it (alike in capitals: one name of the header)
            const v = ctx.gameVars.find(n => this.nameOf(n) === this.nameOf(q));
            if (v !== undefined) err('game', q, null, 'game ' + q + ': ' + v + ' is a variable of the game (game_var.' + v + '), not a question to it');
            seenQ.add(q);
        }
        if ((a.questions || []).length > 255) err('game', null, null, '255 questions at most');
        // the tables: names of their own, int16 values, within 64 KB
        let tableNames = new Set(),
            tableBytes = 0;
        for (const t of a.tables || []) {
            if (!this.isIdent(t.name) || this.reserved(t.name) || paramNames.has(t.name) || a.defines.some(d => d.name === t.name)) err('table', t.name, null, "bad table name '" + t.name + "': letters, digits, _, not a define, a param or a word of the language");
            if (this.constantTaken(t.name)) err('table', t.name, null, this.constantTaken(t.name));
            if (tableNames.has(t.name)) err('table', t.name, null, "the table '" + t.name + "' is given twice");
            tableNames.add(t.name);
            if (!t.values.every(v => Number.isInteger(v) && v >= -32768 && v <= 32767)) err('table', t.name, null, 'table ' + t.name + ': whole numbers within 16 bits');
            tableBytes += 2 + 2 * t.values.length;
        }
        if (tableBytes > 65535) err('table', null, null, 'the tables are too large: ' + tableBytes + ' bytes, 65535 at most');
        for (const d of a.defines) {
            if (this.constantTaken(d.name)) err('define', d.name, null, this.constantTaken(d.name));
            else if (!this.isIdent(d.name) || d.name in ctx.defines || paramNames.has(d.name) || this.reserved(d.name))
                err('define', d.name, null, "the define '" + d.name + "' is no name, or the name is taken");
            try {
                const tree = this.parseExpr(String(d.value), Object.assign({}, ctx, {
                    allowParams: false,
                    allowT: false
                }));
                ctx.defines[d.name] = tree[1];
            } catch (e) {
                err('define', d.name, null, 'define ' + d.name + ': ' + e.message);
                ctx.defines[d.name] = 0;
            }
        }
        let seen = new Set();
        for (const p of a.params) {
            if (!this.isIdent(p.name) || this.reserved(p.name)) err('param', p.name, null, "bad param name '" + p.name + "': letters, digits, _ of ASCII, not a digit first");
            if (seen.has(p.name)) err('param', p.name, null, "the param '" + p.name + "' is given twice");
            if (this.constantTaken(p.name)) err('param', p.name, null, this.constantTaken(p.name));
            seen.add(p.name);
            try {
                this.operand(String(p.value), ctx, -32768, 32767, 'const');
            } catch (e) {
                err('param', p.name, null, 'param ' + p.name + ': ' + e.message);
            }
        }
        ctx.params = [...seen];
        // the range of a control (dgx_ge_talk_control_range): params 1, 2, 3 after the value are least, most, step in
        // that order, most > least, step > 0; otherwise the control has none and works by events only
        {
            const range = ['least', 'most', 'step'],
                at = range.map(n => a.params.findIndex(p => p.name === n));
            if (at.some(i => i >= 0)) {
                if (at.some((i, k) => i !== k + 1)) warn('param', null, null, 'least, most, step give a control a range as params 1, 2, 3 after the value, in that order: here ' + at.map((i, k) => range[k] + (i < 0 ? ' missing' : ' at ' + i)).join(', ') + ', the engine sees no range');
                else {
                    const v = n => this.constValue(a.params[at[range.indexOf(n)]].value, this.defineValues(a));
                    if (!(v('most') > v('least'))) warn('param', 'most', null, 'most ' + v('most') + ' is not above least ' + v('least') + ': the control has no range');
                    if (!(v('step') > 0)) warn('param', 'step', null, 'step ' + v('step') + ' is not above 0: the control has no range');
                }
            }
        }
        if (a.params.length > this.maxParams) err('param', null, null, a.params.length + ' params, ' + this.maxParams + ' at most');
        let names = {};
        for (const s of a.scripts) {
            if (!this.isName(s.name)) err('script', s.name, null, "bad script name '" + s.name + "'");
            if (names[s.name]) err('script', s.name, null, "the name '" + s.name + "' is given twice");
            names[s.name] = 'script';
            s.lines.forEach((l, i) => {
                if (l.op !== 'label') return;
                if (!this.isName(l.name)) err('script', s.name, i, "bad label name '" + l.name + "'");
                if (names[l.name]) err('script', s.name, i, "the name '" + l.name + "' is given twice");
                names[l.name] = 'label';
            });
        }
        // an empty script before another runs on into it; the last has nothing to run (labels make no code)
        const last = a.scripts[a.scripts.length - 1];
        if (last && !last.lines.some(l => l.op !== 'label')) err('script', last.name, null, 'script ' + last.name + ': no statements, and it is the last: end it with hold');
        let images = {};
        for (const f of set.frames) images[f.image] = true;
        // the names of points of all frames, as written and as the pack names them (capitals)
        let pointNames = new Set();
        for (const other of allSets || [set]) {
            for (const f of other.frames) {
                for (const n in f.points || {}) {
                    pointNames.add(n);
                    pointNames.add(this.packName('', n).slice(1));
                }
            }
        }
        // events are of the pack, one number a name in all its animations: an event a hit or a contact sends need not
        // be declared by this set (a hand's hit tells a pot 'taken', the pot declares it and has the rule)
        let packEvents = new Set();
        for (const other of allSets || [set]) {
            const oa = other.animation;
            if (!oa) continue;
            for (const e of oa.events) packEvents.add(e);
            for (const sc of oa.scripts)
                for (const l of sc.lines)
                    for (const k of ['event', 'recoil', 'off'])
                        if ((l.op === 'hit' && k !== 'off' || (l.op === 'contact' || l.op === 'tell' || l.op === 'appear') && k === 'event' || l.op === 'contact' && k === 'off') && l[k] !== undefined) packEvents.add(l[k]);
        }
        if (packEvents.size > 255) err(null, null, null, 'the sets have ' + packEvents.size + ' events, 255 at most: their numbers are of the pack');
        // self: the event goes to this actor (recoil, contact), only its own rules can take it
        const sent = (s, i, what, name, self) => {
            if (a.events.includes(name)) return;
            const alone = '(this .anim alone does not assemble, in the pack it does)';
            if (self) warn('script', s.name, i, what + ": the event '" + name + "' goes to this actor, but the set does not declare it: nothing takes it " + alone);
            else if (!(allSets || []).some(o => o !== set && o.animation && o.animation.events.includes(name)))
                warn('script', s.name, i, what + ": no set declares the event '" + name + "': it is an event of the pack nobody here reacts to " + alone);
        };
        // pictures of all sets of the file, by their names in the pack: a frame of another set is no stranger
        const docPictures = new Set((allSets || [set]).flatMap(o => o.frames.map(f => this.imageName(o, f.image))));
        let size = 0;
        let gotoTargets = new Set();
        a.scripts.forEach((s, si) => {
            if (size > 0xffff) err('script', s.name, null, 'the code is longer than 65535 bytes, the script starts beyond them');
            let run = 0; // hits that follow one another: one statement, 255 at most
            s.lines.forEach((l, i) => {
                size += this.statementBytes(l, ctx);
                if (l.op === 'go') {
                    // a word of the rules of a map only: the packer makes it a signal of the exit's name there
                    const doc = this.packFile();
                    const maps = doc && Array.isArray(doc.maps) ? doc.maps : [];
                    if (!maps.some(m => m.rules === set.name)) err('script', s.name, i, "go " + l.exit + ": go is a word of the rules of a map, and this kind is the rules of no map (Maps); elsewhere: signal N");
                    else if (typeof Maps !== 'undefined' && !Maps.names(doc).exits.includes(l.exit)) err('script', s.name, i, "go: no exit '" + l.exit + "' in the graph");
                }
                if (l.op === 'hit') {
                    if (!run) size += 2;
                    if (++run > 255) err('script', s.name, i, '255 hits at once at most');
                    for (const k of ['event', 'recoil']) {
                        if (l[k] !== undefined) sent(s, i, 'hit ' + k, l[k], k === 'recoil');
                    }
                } else run = 0;
                if (l.op === 'contact' && l.event !== undefined) sent(s, i, 'contact', l.event, true);
                if (l.op === 'contact' && l.off !== undefined) sent(s, i, 'contact off', l.off, true);
                if (l.op === 'tell') sent(s, i, l.target === 'cell' ? 'tell cell' : 'tell holder', l.event, false);
                if (l.op === 'appear') sent(s, i, 'appear', l.event, false);
                // a music the document has not is a name only: the pack numbers it, it plays nothing
                if (l.op === 'music' && l.name !== undefined && l.name !== 'stop') {
                    const doc = this.packFile();
                    if (doc && !(doc.music || []).includes(l.name)) warn('script', s.name, i, 'music ' + l.name + ': no music of that name in the document (Game → Music): a name only, it plays nothing');
                }
                if (l.op === 'goto') {
                    gotoTargets.add(l.target);
                    if (!names[l.target]) err('script', s.name, i, "goto: no script or label '" + l.target + "'");
                }
                if (l.op === 'frame' || l.op === 'carry') {
                    if (l.image !== undefined && !images[l.image]) err('script', s.name, i, "the set has no frame '" + l.image + "'");
                    if (l.name !== undefined && !docPictures.has(l.name)) warn('script', s.name, i, "the picture '" + l.name + "' is no frame of the sets here: the pack must have it");
                }
                if (l.op === 'sense' || l.op === 'steer' || l.op === 'appear' && l.with) {
                    // the params the statement writes or gives, and what its. may name of the kind looked for
                    const paramOf = n => a.params.some(p => p.name === n);
                    if (l.op === 'sense') {
                        for (const n of l.into)
                            if (n !== '_' && !paramOf(n)) err('script', s.name, i, "sense into '" + n + "': no such param");
                        for (const c of l.copies)
                            if (!paramOf(c.param)) err('script', s.name, i, "sense: '" + c.param + "' is no param");
                        // its.<name> of a named kind: its params, when the kind is known here
                        const kindSet = typeof l.target === 'string' && l.target !== 'any' && l.target !== 'cell' ?
                            (l.target === this.packName('', set.name).slice(1) ? set : (allSets || []).find(o => this.packName('', o.name).slice(1) === l.target)) : null;
                        const names = l.target === 'cell' ? this.itsCell : [...this.itsBody, ...(kindSet ? kindSet.animation.params.map(p => p.name) : [])];
                        if (l.target === 'cell' || l.target === 'any' || kindSet) {
                            const its = Object.assign({}, ctx, {
                                allowParams: true,
                                its: names
                            });
                            for (const v of [l.where, ...l.copies.map(c => c.value)]) {
                                if (typeof v !== 'string') continue;
                                try {
                                    this.parseExpr(v, its);
                                } catch (e) {
                                    err('script', s.name, i, 'sense: ' + e.message);
                                }
                            }
                        }
                    }
                    if (l.op === 'steer' && l.angle !== undefined && !paramOf(l.angle)) err('script', s.name, i, "steer wander: angle '" + l.angle + "' is no param");
                    if (l.op === 'appear' && l.with) {
                        const kindSet = typeof l.kind === 'string' ? (l.kind === this.packName('', set.name).slice(1) ? set : (allSets || []).find(o => this.packName('', o.name).slice(1) === l.kind)) : null;
                        if (kindSet)
                            for (const w of l.with)
                                if (!kindSet.animation.params.some(p => p.name === w.param)) err('script', s.name, i, 'appear ' + l.kind + " with: '" + w.param + "' is no param of it");
                        else if (typeof l.kind === 'number') warn('script', s.name, i, 'appear ' + l.kind + ' with: the params of a kind given by a number are not checked here');
                    }
                }
                if ((l.op === 'shoot' || l.op === 'draw' || l.op === 'appear' || l.op === 'sense' && typeof l.target === 'string' && l.target !== 'any' && l.target !== 'cell') && typeof (l.op === 'sense' ? l.target : l.kind) === 'string') {
                    const kindName = l.op === 'sense' ? l.target : l.kind;
                    // the packer makes the animations of all sets of the file together (add_anims): a kind
                    // may be this set or one below it; a name of no set here must be a blob the pack has before the file
                    const k = (allSets || []).findIndex(o => this.packName('', o.name).slice(1) === kindName);
                    const near = (allSets || []).find(o => this.packName('', o.name).slice(1) === kindName.toUpperCase());
                    if (k < 0 && near) warn('script', s.name, i, l.op + ": the blob of the set '" + near.name + "' is named " + this.packName('', near.name).slice(1) + ', not ' + kindName);
                    else if (k < 0) warn('script', s.name, i, l.op + ": no set is named '" + kindName + "': the pack must have that blob before the animations of this file");
                }
                // a row left empty is a frame of no picture on purpose; a number past the table is likely forgotten
                if (l.op === 'frame' && l.number !== undefined && set.frameTable && l.number >= set.frameTable.length)
                    warn('script', s.name, i, 'frame ' + l.number + ': past the table of frame numbers (Numbers): the player shows none');
                if ((l.op === 'carry' || l.op === 'release' || l.op === 'shoot' || l.op === 'draw' || l.op === 'stow') && !pointNames.has(l.point) && !pointNames.has(this.packName('', l.point).slice(1)))
                    warn('script', s.name, i, "no frame of the sets has the point '" + l.point + "': the pack must have it");
                // a statement put together by hand is checked as a text
                try {
                    if (l.op !== 'label') this.parseStatement(this.statementText(l, set), null, ctx);
                    // an expression worked out on the board: its bytes and its stack have limits
                    for (const v of this.expressionsOf(l)) {
                        const c = this.exprCode(this.parseExpr(v, Object.assign({}, ctx, {
                            allowParams: true,
                            allowT: l.op === 'path',
                            pictures: l.op === 'frame' && v === l.expr ? {} : undefined
                        })));
                        if (c.bytes > 255 || c.depth > 16) err('script', s.name, i, "the expression '" + v + "' is too large for the engine");
                    }
                } catch (e) {
                    err('script', s.name, i, e.message);
                }
            });
            // a script without a frame that hands on to another (goto a script, or on into the next) is a step of work
            // (a value changed); one that holds or loops in itself shows nothing
            const last = [...s.lines].reverse().find(l => l.op !== 'label');
            const handsOn = last && last.op === 'goto' && last.cond === undefined && a.scripts.some(x => x.name === last.target) ||
                this.fallsThrough(s) && si + 1 < a.scripts.length;
            if (!s.lines.some(l => l.op === 'frame') && !handsOn) warn('script', s.name, null, 'the script shows no frame');
            if (this.fallsThrough(s) && !s.through) {
                if (si + 1 < a.scripts.length) warn('script', s.name, null, "goes on into the next script '" + a.scripts[si + 1].name + "': end it with goto or hold, if it should not");
                else warn('script', s.name, null, 'the last script comes to its end: end it with goto or hold');
            }
        });
        let events = new Set();
        for (const e of a.events) {
            if (!this.isName(e)) err('event', e, null, "bad event name '" + e + "'");
            if (events.has(e)) err('event', e, null, "the event '" + e + "' is given twice");
            events.add(e);
        }
        for (const g of a.groups) {
            if (!this.isName(g.name)) err('group', g.name, null, "bad group name '" + g.name + "'");
            if (names[g.name]) warn('group', g.name, null, "the group '" + g.name + "' has the name of a script: rules from it take the group");
            for (const r of g.scripts) {
                if (!a.scripts.some(s => s.name === r)) err('group', g.name, null, "group '" + g.name + "' has '" + r + "', which is no script");
            }
        }
        for (const g of a.groups) {
            if (new Set(g.scripts).size !== g.scripts.length) err('group', g.name, null, "group '" + g.name + "' names a script twice");
            if (!g.scripts.length && a.rules.some(r => r.source === g.name)) warn('group', g.name, null, "group '" + g.name + "' has no scripts: the rules from it do nothing");
        }
        const matrix = this.matrix(a);
        let targets = new Set();
        a.rules.forEach((r, i) => {
            if (!a.events.includes(r.event)) err('rule', i, null, "no event '" + r.event + "'");
            if (!a.scripts.some(s => s.name === r.to)) err('rule', i, null, "no script '" + r.to + "'");
            if (this.sourceRows(a, r.source) === null) err('rule', i, null, "no script or group '" + r.source + "'");
            if (!this.whens.includes(r.when)) err('rule', i, null, "bad time '" + r.when + "'");
        });
        // two answers for one transition: both sides are told
        for (const s in matrix) {
            for (const e in matrix[s]) {
                const c = matrix[s][e];
                if (!c.conflict) continue;
                const sides = [c, ...c.conflict].map(x => x.to + ' ' + x.when + ' (' + x.rules.map(i => this.ruleText(a.rules[i])).join('; ') + ')');
                err('state', s, null, 'conflict on ' + e + ': ' + sides.join(' or '));
            }
        }
        for (const s in matrix) {
            for (const e in matrix[s]) targets.add(matrix[s][e].to);
        }
        // the first script is where the game usually starts an actor
        a.scripts.forEach((s, si) => {
            // entry: the game starts it itself; one the script before goes on into on purpose is reached so
            const reached = s.entry || si && this.fallsThrough(a.scripts[si - 1]) && a.scripts[si - 1].through;
            if (si && !reached && !targets.has(s.name) && !gotoTargets.has(s.name))
                warn('state', s.name, null, 'no rule and no goto leads to it' + (si && !this.fallsThrough(a.scripts[si - 1]) ? '' : ' (the script before goes on into its code)'));
            const row = matrix[s.name];
            if (s.lines.some(l => l.op === 'hold') && (!row || !Object.keys(row).length))
                warn('state', s.name, null, 'holds and no rule leads out of it');
        });
        for (const e of a.events) {
            if (!Object.values(matrix).some(row => row[e])) warn('event', e, null, 'the event does nothing anywhere');
        }
        // the game's answer to a signal lost: the script signals and goes on, answering no event itself (dgx_ge_explain.py)
        for (const l of this.lostAnswers(a))
            warn('state', l.script, null, 'gives signal ' + l.signals.join(', ') + ' and goes on to ' + l.onto.join(', ') + ', but answers no event itself: an event the game answers the signal with at once finds the actor still in ' +
                l.script + ' and is lost. If the game answers so, name ' + l.script + ' in the rules of that event (itself or a group it is in)');
        // pictures of different files must have different names in the pack
        let packNames = {};
        for (const other of allSets || [set]) {
            for (const f of other.frames) {
                const n = this.imageName(other, f.image);
                if (packNames[n] && packNames[n] !== other.name + '/' + f.image)
                    err(null, null, null, "pictures '" + packNames[n] + "' and '" + other.name + '/' + f.image + "' have the same name " + n + ' in the pack');
                packNames[n] = other.name + '/' + f.image;
            }
        }
        return {
            errors: errors,
            warnings: warnings
        };
    },

    // a file of JSON gives its animation: checked, unknown keys dropped. {animation} or {error}
    read(a) {
        if (a === undefined || a === null) return {
            animation: this.empty()
        };
        const bad = text => ({
            error: 'Bad animation: ' + text
        });
        if (typeof a !== 'object' || !Array.isArray(a.events) || !Array.isArray(a.scripts)) return bad('no events or scripts');
        let r = this.empty();
        for (const e of a.events) {
            if (typeof e !== 'string') return bad('an event is not a string');
            r.events.push(e);
        }
        const value = v => Number.isInteger(v) ? v : typeof v === 'string' && v.trim() ? v.trim() : null;
        // the comments that stand by an element of the text (Anim.parse): above it, at the end of its line
        const notes = (from, to) => {
            if (from && Array.isArray(from.above) && from.above.length) to.above = from.above.filter(c => typeof c === 'string');
            if (from && typeof from.note === 'string' && from.note.trim()) to.note = from.note;
            return to;
        };
        if (a.heads && typeof a.heads === 'object')
            for (const k of ['event', 'game', 'pockets', 'stack'])
                if (a.heads[k]) {
                    const h = notes(a.heads[k], {});
                    if (Object.keys(h).length) (r.heads || (r.heads = {}))[k] = h;
                }
        if (Array.isArray(a.tail) && a.tail.length) r.tail = a.tail.filter(c => typeof c === 'string');
        for (const d of a.defines || []) {
            if (!d || typeof d.name !== 'string' || value(d.value) === null) return bad('a define ' + JSON.stringify(d));
            r.defines.push(notes(d, {
                name: d.name,
                value: value(d.value)
            }));
        }
        for (const q of a.questions || []) {
            if (typeof q !== 'string') return bad('a question ' + JSON.stringify(q));
            r.questions.push(q);
        }
        for (const t of a.tables || []) {
            if (!t || typeof t.name !== 'string' || !Array.isArray(t.values) || !t.values.every(v => Number.isInteger(v))) return bad('a table ' + JSON.stringify(t));
            r.tables.push(notes(t, {
                name: t.name,
                values: t.values.slice()
            }));
        }
        for (const p of a.params || []) {
            if (!p || typeof p.name !== 'string' || value(p.value) === null) return bad('a param ' + JSON.stringify(p));
            r.params.push(notes(p, {
                name: p.name,
                value: value(p.value)
            }));
        }
        for (const k of ['pockets', 'stack']) {
            if (a[k] === undefined || a[k] === null) continue;
            if (value(a[k]) === null) return bad(k + ' ' + JSON.stringify(a[k]));
            r[k] = value(a[k]);
        }
        for (const g of a.groups || []) {
            if (!g || typeof g.name !== 'string' || !Array.isArray(g.scripts)) return bad('a group');
            r.groups.push(notes(g, {
                name: g.name,
                scripts: g.scripts.filter(s => typeof s === 'string')
            }));
        }
        for (const s of a.scripts) {
            if (!s || typeof s.name !== 'string' || !Array.isArray(s.lines)) return bad('a script');
            let script = notes(s, {
                name: s.name,
                lines: []
            });
            if (s.entry === true) script.entry = true;
            if (s.through === true) script.through = true;
            for (const l of s.lines) {
                // 'action N' of the language before params is 'set action N'
                if (l && l.op === 'action' && Number.isInteger(l.value)) {
                    if (!r.params.some(p => p.name === 'action')) r.params.unshift({
                        name: 'action',
                        value: 0
                    });
                    script.lines.push({
                        op: 'set',
                        param: 'action',
                        value: l.value
                    });
                    continue;
                }
                const line = this.readStatement(l);
                if (!line) return bad('a statement of script ' + s.name + ': ' + JSON.stringify(l));
                script.lines.push(notes(l, line));
            }
            r.scripts.push(script);
        }
        for (const x of a.rules || []) {
            if (!x || typeof x.event !== 'string' || typeof x.source !== 'string' || typeof x.to !== 'string' || !this.whens.includes(x.when))
                return bad('a rule ' + JSON.stringify(x));
            r.rules.push(notes(x, {
                event: x.event,
                source: x.source,
                to: x.to,
                when: x.when
            }));
        }
        return {
            animation: r
        };
    },
    readStatement(l) {
        if (!l || !(l.op in this.ops)) return null;
        // a number of a statement: a whole number or the text of an expression
        const isInt = v => Number.isInteger(v) || (typeof v === 'string' && v.trim() !== '');
        // a mask: 0..15, or a name of the pack or an expression
        const maskOf = v => Number.isInteger(v) ? v >= 0 && v <= 15 : isInt(v);
        switch (l.op) {
            case 'frame': {
                let s = {
                    op: 'frame'
                };
                if (typeof l.expr === 'string' && l.expr.trim()) {
                    if (!isInt(l.ms)) return null;
                    s.expr = l.expr.trim();
                    s.ms = l.ms;
                    return s;
                }
                if (l.none === true) s.none = true;
                else if (typeof l.image === 'string') s.image = l.image;
                else if (Number.isInteger(l.number)) s.number = l.number;
                else if (typeof l.name === 'string') s.name = l.name;
                else return null;
                if (!isInt(l.ms)) return null;
                s.ms = l.ms;
                if (l.at) {
                    if (!isInt(l.at.x) || !isInt(l.at.y)) return null;
                    s.at = {
                        x: l.at.x,
                        y: l.at.y
                    };
                }
                return s;
            }
            case 'dx':
            case 'dy':
            case 'signal':
            case 'sound':
                return isInt(l.value) ? {
                    op: l.op,
                    value: l.value
                } : null;
            case 'go':
                return typeof l.exit === 'string' && l.exit ? {
                    op: 'go',
                    exit: l.exit
                } : null;
            case 'set':
            case 'add':
                if (typeof l.variable === 'string') return isInt(l.value) ? {
                    op: l.op,
                    variable: l.variable,
                    value: l.value
                } : null;
                return typeof l.param === 'string' && isInt(l.value) ? {
                    op: l.op,
                    param: l.param,
                    value: l.value
                } : null;
            case 'velocity':
            case 'accel':
            case 'path':
                return isInt(l.x) && isInt(l.y) ? {
                    op: l.op,
                    x: l.x,
                    y: l.y
                } : null;
            case 'rotate': {
                if (!isInt(l.value)) return null;
                let s = {
                    op: l.op,
                    value: l.value
                };
                if (l.to === true) s.to = true;
                return s;
            }
            case 'music': {
                const ms = Number.isInteger(l.ms) && l.ms >= 0 && l.ms <= 65535 ? l.ms : 0;
                if (Number.isInteger(l.volume)) return l.volume >= 0 && l.volume <= 100 ? {
                    op: l.op,
                    volume: l.volume,
                    ms: ms
                } : null;
                return typeof l.name === 'string' && l.name ? {
                    op: l.op,
                    name: l.name,
                    ms: ms
                } : null;
            }
            case 'masks':
                return Array.isArray(l.indexes) && l.indexes.every(maskOf) ? {
                    op: l.op,
                    indexes: [...l.indexes]
                } : null;
            case 'goto': {
                if (typeof l.target !== 'string') return null;
                let s = {
                    op: l.op,
                    target: l.target
                };
                if (typeof l.cond === 'string' && l.cond.trim()) s.cond = l.cond.trim();
                return s;
            }
            case 'keep':
                return {
                    op: l.op
                };
            case 'timer':
                return ['start', 'stop', 'hold', 'go'].includes(l.action) && typeof l.name === 'string' ? {
                    op: l.op,
                    action: l.action,
                    name: l.name
                } : null;
            case 'stow':
                return typeof l.point === 'string' ? {
                    op: l.op,
                    point: l.point
                } : null;
            case 'draw':
                return typeof l.point === 'string' && (typeof l.kind === 'string' || Number.isInteger(l.kind)) ? {
                    op: l.op,
                    point: l.point,
                    kind: l.kind
                } : null;
            case 'label':
                return typeof l.name === 'string' ? {
                    op: l.op,
                    name: l.name
                } : null;
            case 'contact': {
                if (maskOf(l.mask)) {
                    if (l.side === 'none') return {
                        op: l.op,
                        mask: l.mask,
                        side: 'none'
                    };
                    if (!(l.side in this.touchSides) || typeof l.event !== 'string' && typeof l.off !== 'string') return null;
                    let s = {
                        op: l.op,
                        mask: l.mask,
                        side: l.side,
                        within: isInt(l.within) && l.within >= 0 && l.within <= 255 ? l.within : 1
                    };
                    if (typeof l.event === 'string') s.event = l.event;
                    if (typeof l.off === 'string') s.off = l.off;
                    if (typeof l.off === 'string' && isInt(l.first) && l.first >= 1 && l.first <= 255) s.first = l.first;
                    return s;
                }
                let s = {
                    op: l.op,
                    on: !!l.on
                };
                if (l.on && typeof l.event === 'string') s.event = l.event;
                return s;
            }
            case 'carry': {
                if (typeof l.point !== 'string') return null;
                let s = {
                    op: l.op,
                    point: l.point
                };
                if (typeof l.image === 'string') s.image = l.image;
                else if (Number.isInteger(l.number)) s.number = l.number;
                else if (typeof l.name === 'string') s.name = l.name;
                return s;
            }
            case 'shoot':
                return typeof l.point === 'string' && (typeof l.kind === 'string' || Number.isInteger(l.kind)) && isInt(l.x) && isInt(l.y) ? {
                    op: l.op,
                    point: l.point,
                    kind: l.kind,
                    x: l.x,
                    y: l.y
                } : null;
            case 'tell':
                if (l.target === 'cell') return typeof l.event === 'string' && (isInt(l.cell) || typeof l.cell === 'string') ? {
                    op: l.op,
                    target: 'cell',
                    cell: l.cell,
                    event: l.event,
                    value: isInt(l.value) || typeof l.value === 'string' ? l.value : 0
                } : null;
                return typeof l.event === 'string' ? {
                    op: l.op,
                    target: 'holder',
                    event: l.event
                } : null;
            case 'press':
            case 'clear':
                return isInt(l.cell) || typeof l.cell === 'string' ? {
                    op: l.op,
                    cell: l.cell
                } : null;
            case 'appear': {
                if (!((typeof l.kind === 'string' || Number.isInteger(l.kind)) && typeof l.event === 'string' && isInt(l.x) && isInt(l.y))) return null;
                let s = {
                    op: l.op,
                    kind: l.kind,
                    event: l.event,
                    x: l.x,
                    y: l.y,
                    left: !!l.left
                };
                if (Array.isArray(l.with) && l.with.length) {
                    if (!l.with.every(w => w && typeof w.param === 'string' && isInt(w.value))) return null;
                    s.with = l.with.map(w => ({
                        param: w.param,
                        value: w.value
                    }));
                }
                return s;
            }
            case 'sense': {
                const ok = (typeof l.target === 'string' || Number.isInteger(l.target)) && (Number.isInteger(l.radius) || typeof l.radius === 'string' && l.radius.trim()) && Array.isArray(l.into) && l.into.length >= 1 && l.into.length <= 3 &&
                    l.into.every(n => typeof n === 'string') && Array.isArray(l.copies) && l.copies.every(c => c && typeof c.param === 'string' && isInt(c.value));
                if (!ok) return null;
                let s = {
                    op: l.op,
                    target: l.target,
                    radius: l.radius,
                    into: l.into.slice(),
                    copies: l.copies.map(c => ({
                        param: c.param,
                        value: c.value
                    }))
                };
                if (isInt(l.where)) s.where = l.where;
                if (l.seen === true) s.seen = true;
                return s;
            }
            case 'steer': {
                const spec = this.steerWays[l.way];
                if (!spec || !Array.isArray(l.args) || !l.args.every(isInt)) return null;
                if (l.args.length !== spec[0] + (l.way === 'wander' ? 0 : spec[2])) return null;
                let s = {
                    op: l.op,
                    way: l.way,
                    args: l.args.slice()
                };
                if (l.way === 'wander') {
                    if (typeof l.angle !== 'string') return null;
                    s.angle = l.angle;
                }
                return s;
            }
            case 'vanish':
                return {
                    op: l.op
                };
            case 'release':
                return typeof l.point === 'string' && isInt(l.x) && isInt(l.y) ? {
                    op: l.op,
                    point: l.point,
                    x: l.x,
                    y: l.y
                } : null;
            case 'hit': {
                if (!maskOf(l.mask) || !Array.isArray(l.on) || !l.on.length || !l.on.every(maskOf)) return null;
                let s = {
                    op: l.op,
                    mask: l.mask,
                    on: [...l.on]
                };
                if (isInt(l.damage)) s.damage = l.damage;
                if (typeof l.event === 'string') s.event = l.event;
                if (typeof l.recoil === 'string') s.recoil = l.recoil;
                return s;
            }
        }
        return {
            op: l.op
        };
    },

    // steps of a script: the statements up to a frame, the frame with them. The statements after the last frame
    // are the tail, a step without a frame. [{start, end, frame: index or -1}], end is outside
    steps(script) {
        let steps = [];
        let start = 0;
        script.lines.forEach((l, i) => {
            if (l.op !== 'frame') return;
            steps.push({
                start: start,
                end: i + 1,
                frame: i
            });
            start = i + 1;
        });
        if (start < script.lines.length || !steps.length) steps.push({
            start: start,
            end: script.lines.length,
            frame: -1
        });
        return steps;
    },

    // a name not used by scripts, labels and groups yet
    freeName(a, base) {
        let used = new Set(a.groups.map(g => g.name));
        for (const s of a.scripts) {
            used.add(s.name);
            for (const l of s.lines)
                if (l.op === 'label') used.add(l.name);
        }
        if (!used.has(base)) return base;
        let n = 2;
        while (used.has(base + n)) ++n;
        return base + n;
    },

    // a script or a label renamed everywhere it is named
    rename(a, oldName, newName) {
        const isScript = a.scripts.some(s => s.name === oldName);
        for (const s of a.scripts) {
            if (s.name === oldName) s.name = newName;
            for (const l of s.lines) {
                if (l.op === 'label' && l.name === oldName) l.name = newName;
                if (l.op === 'goto' && l.target === oldName) l.target = newName;
            }
        }
        if (!isScript) return;
        for (const g of a.groups) g.scripts = g.scripts.map(r => r === oldName ? newName : r);
        for (const r of a.rules) {
            if (r.source === oldName) r.source = newName;
            if (r.to === oldName) r.to = newName;
        }
    },

    renameGroup(a, oldName, newName) {
        for (const g of a.groups) {
            if (g.name === oldName) g.name = newName;
        }
        for (const r of a.rules) {
            if (r.source === oldName) r.source = newName;
        }
    },

    // rules that name a script, a group or an event
    rulesNaming(a, name) {
        return a.rules.filter(r => r.source === name || r.to === name || r.event === name);
    },

    // the script is taken away with the rules from it and to it; gotos to it stay and are errors
    removeScript(a, name) {
        a.scripts = a.scripts.filter(s => s.name !== name);
        a.rules = a.rules.filter(r => r.source !== name && r.to !== name);
        for (const g of a.groups) g.scripts = g.scripts.filter(r => r !== name);
    },

    removeGroup(a, name) {
        a.groups = a.groups.filter(g => g.name !== name);
        a.rules = a.rules.filter(r => r.source !== name);
    },

    renameEvent(a, oldName, newName) {
        a.events = a.events.map(e => e === oldName ? newName : e);
        for (const sc of a.scripts) {
            for (const l of sc.lines) {
                if (l.op !== 'hit' && l.op !== 'contact' && l.op !== 'tell' && l.op !== 'appear') continue;
                if (l.event === oldName) l.event = newName;
                if (l.off === oldName) l.off = newName;
                if (l.recoil === oldName) l.recoil = newName;
            }
        }
        for (const r of a.rules) {
            if (r.event === oldName) r.event = newName;
        }
    },

    // a param renamed takes its statements with it
    renameParam(a, oldName, newName) {
        for (const p of a.params)
            if (p.name === oldName) p.name = newName;
        this.renameInExpressions(a, oldName, newName);
        for (const s of a.scripts) {
            for (const l of s.lines) {
                if ((l.op === 'set' || l.op === 'add') && l.param === oldName) l.param = newName;
                if (l.op === 'sense') {
                    l.into = l.into.map(n => n === oldName ? newName : n);
                    for (const c of l.copies)
                        if (c.param === oldName) c.param = newName;
                }
                if (l.op === 'steer' && l.angle === oldName) l.angle = newName;
            }
        }
    },

    // statements that set or add to a param
    paramUses(a, name) {
        let n = 0;
        for (const s of a.scripts) {
            for (const l of s.lines)
                if ((l.op === 'set' || l.op === 'add') && l.param === name) n++;
        }
        return n;
    },

    removeEvent(a, name) {
        a.events = a.events.filter(e => e !== name);
        a.rules = a.rules.filter(r => r.event !== name);
    },
};

// Plays an animation as dgx_ge_anim.c of the engine does: frames by real time, moves forward and down, turns,
// speeds and accelerations; gotos, holds; events by the matrix the rules make, now or waiting for a branch point
// or the end
class AnimRunner {
    constructor(animation) {
        this.a = animation;
        this.matrix = Anim.matrix(animation);
        this.defines = Anim.defineValues(animation);
        this.ctx = {
            defines: this.defines,
            params: (animation.params || []).map(p => p.name),
            tables: Anim.tableValues(animation),
            questions: (animation.questions || []).slice(),
            gameVars: Anim.packVariables(),
            allowParams: true
        };
        this.answers = {}; // the game's answers to its questions, as the player is told: name -> number
        this.musics = Anim.packMusics(); // the musics of the pack by their numbers: what music reads
        this.trees = new Map(); // the text of an expression -> its tree
        // all scripts as one code: a script that ends goes on into the code of the next one
        this.code = [];
        this.scriptStart = {};
        this.labelAt = {};
        this.lineOf = []; // [script index, line index] of the code at an index
        this.runStart = new Set(); // hits that begin a statement HITS: any other line before them ends a run, a label too
        animation.scripts.forEach((s, si) => {
            this.scriptStart[s.name] = this.code.length;
            let previous = null;
            s.lines.forEach((l, li) => {
                if (l.op === 'hit' && previous !== 'hit') this.runStart.add(this.code.length);
                previous = l.op;
                if (l.op === 'label') {
                    this.labelAt[l.name] = this.code.length;
                    return;
                }
                this.code.push(l);
                this.lineOf.push([si, li]);
            });
        });
    }

    // the actor at the start of a script: on the floor at x 0, not turned
    start(scriptName, at) {
        this.state = {
            script: null, // the row of the matrix: the script the actor is in
            pc: 0,
            x: 0, // pixels
            y: 0,
            flip: false,
            turn: 0, // quarter turns clockwise, after the mirror (rotate): the actor's orientation is AnimRunner.orient
            vx: 0, // pixels a second, as they are on the screen: already turned
            vy: 0,
            ax: 0,
            ay: 0,
            rest: [0, 0, 0, 0], // what the motion has beyond 1/256: of x, y in 1/2000000, of vx, vy in 1/1000 (rest_* of the engine)
            time: 0, // ms since the start
            due: 0, // ms the next step is made at
            frame: null, // the frame statement shown
            frameLine: null, // [script index, line index] of it
            holding: false,
            pending: null, // {to, when, event} a transition waits for its place
            params: Object.fromEntries((this.a.params || []).map(p => [p.name, Anim.constValue(p.value, this.defines)])), // as they start
            path: null, // {x, y: trees, orient, start, x0, y0}: the place by a formula of t, in the axes it began in
            contact: false, // it looks for touches of the terrain
            contactEvent: null, // the event a touch sends to the actor itself
            hits: [], // the hits of the masks now: they hold until the next ones, masks or another script
            carried: [], // [{point, picture: the carry statement}]: what the actor holds, 2 points at most
            released: null, // {point, picture, vx, vy}: what it let go last (release), vx as on the screen
            shot: null, // {point, kind, vx, vy}: the last shot (shoot), vx as on the screen
            kept: false, // keep: the world keeps the actor while it is in this script
            dice: 1, // the game's dice, its seed
            pockets: [], // the carry statements of what was stowed (stow), as the player knows them
            counts: Object.assign({}, this.startCounts || {}), // things in the pockets by kind: count(KIND), draw and stow take them
            masks: null,
            vars: Anim.packVariableValues(), // the game's store of its variables (game_var.<name>), as they begin
            music: -1, // the number of the music playing (music), -1 none
            musicLevel: 100, // its level by design, percent (music volume)
            log: [],
        };
        if (!(scriptName in this.scriptStart)) {
            this.state.holding = true;
            return this.state;
        }
        this.enter(scriptName);
        this.advance(0);
        return this.state;
    }

    copy() {
        return JSON.parse(JSON.stringify(this.state));
    }
    restore(state) {
        this.state = JSON.parse(JSON.stringify(state));
    }

    say(text) {
        const log = this.state.log;
        log.push(text);
        if (log.length > 10) log.shift();
    }

    enter(scriptName) {
        const st = this.state;
        st.script = scriptName;
        st.pc = this.scriptStart[scriptName];
        st.pending = null;
        st.holding = false;
        // a script that is not there (a name mistyped, a script deleted while playing): the actor stands where it is
        if (st.pc === undefined) {
            st.pc = this.code.length;
            st.holding = true;
            this.say('no script ' + scriptName + ': stopped');
        }
        st.hits = []; // another script: the hits of the one before are over
        st.kept = false; // keep holds while the actor is in the script that says it
    }

    // has a transition waited for this place? Then the actor is in its script now
    takePending(atEnd) {
        const p = this.state.pending;
        if (!p || (!atEnd && p.when !== 'branch')) return false;
        this.say('→ ' + p.to + ' (' + p.event + ', ' + p.when + ')');
        this.enter(p.to);
        return true;
    }

    // the tree of an operand; t only in a path, vx and vy only out of it
    tree(v, path, pictures) {
        if (typeof v === 'number') return ['num', v];
        const key = (path ? 'path ' : pictures ? 'frame ' : '') + v;
        let t = this.trees.get(key);
        if (!t) {
            try {
                t = Anim.parseExpr(v, Object.assign({}, this.ctx, {
                    allowT: !!path,
                    pictures: pictures ? {} : undefined
                }));
            } catch (e) {
                t = ['num', 0];
            }
            this.trees.set(key, t);
        }
        return t;
    }
    // the orientation of an actor (dgx_ge_orient): mirrored (bit 0), then turned clockwise by quarters (bits 1-2), the
    // eight of DGX
    static orient(flip, turn) {
        return (flip ? 1 : 0) | (turn & 3) << 1;
    }
    // a vector of its axes (x forward, y down) in the scene, as dgx_ge_orient_apply: [x, y]
    static apply(o, x, y) {
        const a = 0x5A >> (o & 7) & 1 ? -x : x,
            b = 0x3C >> (o & 7) & 1 ? -y : y;
        return o & 2 ? [b, a] : [a, b];
    }
    // the orientation that undoes it: a mirror is its own, a quarter turn the other way
    static inverse(o) {
        o &= 7;
        return o === 2 ? 6 : o === 6 ? 2 : o;
    }
    // the velocity of the actor now, x forward as the scripts write it (of its axes, as it faces now)
    velocity() {
        const st = this.state;
        const [vx, vy] = AnimRunner.apply(AnimRunner.inverse(AnimRunner.orient(st.flip, st.turn)), st.vx, st.vy);
        return {
            vx: vx,
            vy: vy,
            rotation: (st.turn & 3) * 90,
            music: () => st.music,
            gameVar: name => st.vars && st.vars[name] || 0,
            x: Math.trunc(st.x), // where the actor is, whole points of the scene (the engine: x >> 8), x as on the screen
            y: Math.trunc(st.y),
            // the clock of the game is the clock of the player here; whole seconds exact, as the engine has now
            now: Math.fround(Math.fround(Math.floor(st.time / 1000)) + Math.fround(Math.fround(st.time % 1000) / 1000)),
            amount: this.amount !== undefined ? this.amount : 1, // how many the actor is (a stack lying), as the player is told
            count: kind => st.counts[String(kind)] || 0,
            game: name => this.answers[name] || 0, // the game's answer: what the player was told, else 0
            // the game's dice as the engine casts them: dice = dice * 214013 + 2531011, (dice >> 16) % (n + 1)
            rnd: n => {
                st.dice = (Math.imul(st.dice >>> 0, 214013) + 2531011) >>> 0;
                return (st.dice >>> 16) % ((n >>> 0) + 1);
            },
            picture: name => this.pictures ? this.pictures.number(name) : 0
        };
    }
    // the value of an operand now, with the params and the velocity of the actor
    value(v, t) {
        return Anim.evalExpr(this.tree(v), this.state.params, t, this.velocity());
    }
    // where a path puts the actor at a moment and how fast it goes there, as the engine works it out
    pathAt(ms) {
        const st = this.state,
            p = st.path;
        const t = (ms - p.start) / 1000,
            h = 0.001;
        const v = this.velocity();
        const fx = Anim.evalExpr(p.x, st.params, t, v),
            fy = Anim.evalExpr(p.y, st.params, t, v);
        // of the axes it faced when it began
        const [dx, dy] = AnimRunner.apply(p.orient, fx, fy);
        const [wx, wy] = AnimRunner.apply(p.orient, (Anim.evalExpr(p.x, st.params, t + h, v) - fx) / h, (Anim.evalExpr(p.y, st.params, t + h, v) - fy) / h);
        st.x = p.x0 + dx;
        st.y = p.y0 + dy;
        st.vx = AnimRunner.fine(wx);
        st.vy = AnimRunner.fine(wy);
    }
    // the motion up to a moment, as the engine counts it (dgx_ge_anim.c move_to): the place and the velocity in
    // whole 1/256 of a point, what a call moves beyond them kept (rest), so it adds up the same however time is cut
    moveTo(ms) {
        const st = this.state;
        const dt = ms - st.time;
        if (dt <= 0) return;
        if (st.path) {
            this.pathAt(ms);
            st.rest = [0, 0, 0, 0]; // the formula gives it whole
            st.time = ms;
            return;
        }
        const r = st.rest;
        [st.x, r[0], st.vx, r[2]] = AnimRunner.axisOn(st.x, r[0], st.vx, r[2], st.ax, dt);
        [st.y, r[1], st.vy, r[3]] = AnimRunner.axisOn(st.y, r[1], st.vy, r[3], st.ay, dt);
        st.time = ms;
    }
    // one axis of a uniform acceleration over dt ms, exactly as axis_on of dgx_ge_anim.c: the place p and its rest
    // rp (1/2000000 of 1/256), the velocity v and its rest rv (1/1000); in points -> [p, rp, v, rv]
    static axisOn(p, rp, v, rv, a, dt) {
        const B = BigInt;
        const units = Math.round(p * 256),
            speed = Math.round(v * 256),
            acc = Math.round(a * 256);
        if (!acc) rv = 0;
        if (!acc && !speed) return [p, 0, v, rv];
        // n / d to the nearest, a half up (d > 0, even)
        const nearest = (n, d) => {
            const m = n + d / 2n;
            return m / d - (m % d < 0n ? 1n : 0n);
        };
        const way = B(rp) + (B(speed) * 1000n + B(rv)) * B(dt) * 2n + B(acc) * B(dt) * B(dt),
            q = nearest(way, 2000000n);
        let out = [(units + Number(q)) / 256, Number(way - q * 2000000n), v, rv];
        if (acc) {
            const gain = B(rv) + B(acc) * B(dt),
                w = nearest(gain, 1000n);
            out[2] = (speed + Number(w)) / 256;
            out[3] = Number(gain - w * 1000n);
        }
        return out;
    }
    // the time of a frame as the engine takes it as the frame begins: below 1 (not a number too) 1 ms, above 65535 65535
    static frameMs(t) {
        return t >= 65535 ? 65535 : t >= 1 ? Anim.halfAway(t) : 1;
    }
    // a value as a param holds it (param_of, dgx_ge_param of the engine): rounded, within 32 bits, not a number 0
    static paramOf(v) {
        return v !== v ? 0 : v >= 2147483648 ? 2147483647 : v <= -2147483648 ? -2147483648 : Anim.halfAway(v);
    }
    // a velocity or an acceleration as the engine keeps it: whole 1/256 of a point (lroundf)
    static fine(v) {
        return Anim.halfAway(v * 256) / 256;
    }
    // the velocity steered as dgx_ge_anim.c steer() does: the wanted velocity by the way, the change clipped to the
    // force, the result clipped to the speed; of the actor's axes (o, its orientation), x forward
    steer(l, o) {
        const st = this.state;
        const v = l.args.map(a => this.value(a, 0));
        const speed = v[0] > 0 ? v[0] : 0,
            force = v[1] > 0 ? v[1] : 0;
        let [vx, vy] = AnimRunner.apply(AnimRunner.inverse(o), st.vx, st.vy),
            wx = 0,
            wy = 0;
        if (l.way === 'wander') {
            // the angle moves by a cast of the dice within the spread, both ways
            let deg = (st.params[l.angle] || 0) % 360; // reduced first, as the engine does
            const spread = v[2] > 0 ? Anim.halfAway(v[2]) : 0;
            const dice = this.velocity().rnd;
            if (spread && dice) deg += dice(2 * spread) - spread;
            deg = ((deg + 180) % 360 + 360) % 360 - 180;
            if (l.angle in st.params && st.params[l.angle] !== deg) this.say(l.angle + ' = ' + deg);
            st.params[l.angle] = deg;
            const rad = deg * Math.PI / 180;
            wx = Math.cos(rad) * speed;
            wy = Math.sin(rad) * speed;
        } else {
            const arrive = l.way === 'arrive',
                ahead = l.way === 'pursue' || l.way === 'evade';
            let tx = v[arrive ? 3 : 2],
                ty = v[arrive ? 4 : 3];
            if (ahead) {
                // where it will be by the time it is reached: as far ahead as the way is long
                const t = speed > 0 ? Math.hypot(tx, ty) / speed : 0;
                tx += v[4] * t;
                ty += v[5] * t;
            }
            const d = Math.hypot(tx, ty);
            if (d > 0) {
                const s = arrive && d < v[2] ? speed * d / v[2] : speed;
                const k = (l.way === 'flee' || l.way === 'evade' ? -s : s) / d;
                wx = tx * k;
                wy = ty * k;
            }
        }
        const noLonger = (x, y, limit) => {
            const len = Math.hypot(x, y);
            return len > limit && len > 0 ? [x * limit / len, y * limit / len] : [x, y];
        };
        let [sx, sy] = noLonger(wx - vx, wy - vy, force);
        [vx, vy] = noLonger(vx + sx, vy + sy, speed);
        [st.vx, st.vy] = AnimRunner.apply(o, AnimRunner.fine(vx), AnimRunner.fine(vy));
        st.ax = st.ay = 0;
        st.path = null;
        this.say('steer ' + l.way + ' → v ' + st.vx.toFixed(1) + ', ' + st.vy.toFixed(1));
    }

    // the steps up to the next frame; false when the actor holds
    step() {
        const st = this.state;
        for (let n = 0; n < 256; ++n) {
            if (st.pc >= this.code.length) break;
            const l = this.code[st.pc];
            // its axes as it faces now, after a flip or a turn in this very step too
            const o = AnimRunner.orient(st.flip, st.turn);
            switch (l.op) {
                case 'frame':
                    // a picture worked out now: its number, by the pictures the player knows (this.pictures)
                    if (l.expr !== undefined) {
                        const n = Anim.halfAway(Anim.evalExpr(this.tree(l.expr, false, true), st.params, 0, this.velocity()));
                        const name = this.pictures && this.pictures.name(n);
                        st.frame = name !== undefined && name !== null ? {
                            op: 'frame',
                            name: name,
                            ms: l.ms
                        } : {
                            op: 'frame',
                            number: n,
                            ms: l.ms
                        };
                    } else st.frame = l;
                    st.frameLine = this.lineOf[st.pc];
                    st.due += AnimRunner.frameMs(typeof l.ms === 'number' ? l.ms : Anim.evalExpr(this.tree(l.ms), st.params, 0, this.velocity()));
                    st.pc++;
                    return true;
                case 'dx':
                case 'dy': {
                    // of its axes: forward, down, as it faces
                    const v = Anim.constValue(l.value, this.defines);
                    const [dx, dy] = AnimRunner.apply(o, l.op === 'dx' ? v : 0, l.op === 'dy' ? v : 0);
                    st.x += dx;
                    st.y += dy;
                    if (st.path) {
                        // a path goes on from the new place
                        st.path.x0 += dx;
                        st.path.y0 += dy;
                    }
                    break;
                }
                case 'flip':
                    st.flip = !st.flip;
                    break;
                case 'rotate': {
                    // turned by so many quarters, or into so many (to), the degrees worked out now
                    const q = Anim.quarters(Anim.evalExpr(this.tree(l.value), st.params, 0, this.velocity()));
                    st.turn = ((l.to ? 0 : st.turn) + q) & 3;
                    this.say('rotation ' + st.turn * 90);
                    break;
                }
                case 'music':
                    // the game plays it; here the number playing is kept for music in expressions, and said
                    if (l.volume !== undefined) st.musicLevel = l.volume;
                    else st.music = l.name === 'stop' ? -1 : this.musics.indexOf(l.name);
                    this.say(Anim.statementText(l));
                    break;
                case 'set':
                case 'add': {
                    if (l.variable !== undefined) {
                        // a variable of the game, in the player's store: within 32 bits; told when it changes
                        const was = st.vars[l.variable] || 0;
                        const v = AnimRunner.paramOf(Anim.evalExpr(this.tree(l.value), st.params, 0, this.velocity()));
                        const now = Math.max(-2147483648, Math.min(2147483647, v + (l.op === 'add' ? was : 0)));
                        if (now !== was) this.say('game_var.' + l.variable + ' = ' + now);
                        st.vars[l.variable] = now;
                        break;
                    }
                    // rounded half away from 0, by the assembler for a constant and by the board for an expression
                    // (param_of: within 32 bits, not a number 0); the value stops at the ends of 32 bits, as in the engine
                    const tree = this.tree(l.value);
                    const e = Anim.evalExpr(tree, st.params, 0, this.velocity());
                    const whole = AnimRunner.paramOf(e);
                    const v = AnimRunner.paramOf(whole + (l.op === 'add' ? st.params[l.param] || 0 : 0));
                    // the game is told when the value changes
                    if (v !== st.params[l.param]) this.say(l.param + ' = ' + v);
                    st.params[l.param] = v;
                    break;
                }
                case 'velocity':
                case 'accel': {
                    const [x, y] = AnimRunner.apply(o, this.value(l.x, 0), this.value(l.y, 0));
                    // out of a path: on as it went
                    if (st.path) {
                        st.ax = st.ay = 0;
                        st.path = null;
                    }
                    if (l.op === 'velocity') {
                        st.vx = AnimRunner.fine(x);
                        st.vy = AnimRunner.fine(y);
                    } else {
                        st.ax = AnimRunner.fine(x);
                        st.ay = AnimRunner.fine(y);
                    }
                    break;
                }
                case 'path':
                    st.path = {
                        x: this.tree(l.x, true),
                        y: this.tree(l.y, true),
                        orient: o,
                        start: st.time,
                        x0: st.x,
                        y0: st.y
                    };
                    st.ax = st.ay = 0;
                    break;
                case 'branch':
                    st.pc++;
                    this.takePending(false);
                    continue;
                case 'goto':
                    if (l.cond !== undefined && !Anim.evalExpr(this.tree(l.cond), st.params, 0, this.velocity())) break;
                    if (this.takePending(true)) continue;
                    if (l.target in this.scriptStart) {
                        this.say('goto ' + l.target);
                        this.enter(l.target);
                    } else if (l.target in this.labelAt) st.pc = this.labelAt[l.target];
                    else {
                        // the checks name it an error; the player stops on it instead of losing its place
                        st.holding = true;
                        this.say('goto ' + l.target + ': no such script or label, stopped');
                        return false;
                    }
                    continue;
                case 'hold':
                    if (this.takePending(true)) continue;
                    st.holding = true;
                    this.say('hold');
                    return false;
                case 'signal':
                case 'sound':
                    this.say(l.op + ' ' + Anim.constValue(l.value, this.defines));
                    break;
                case 'go':
                    this.say('go ' + l.exit + ': the game leaves the map by this exit');
                    break;
                case 'masks':
                    st.masks = l.indexes.map(v => Anim.maskValue(v, this.defines));
                    st.hits = []; // masks end the hits
                    break;
                case 'hit':
                    if (this.runStart.has(st.pc)) st.hits = [];
                    st.hits.push({
                        mask: Anim.maskValue(l.mask, this.defines),
                        on: l.on.map(v => Anim.maskValue(v, this.defines)),
                        damage: l.damage !== undefined ? Anim.constValue(l.damage, this.defines) : 0,
                        event: l.event,
                        recoil: l.recoil
                    });
                    break;
                case 'carry': {
                    // until the next carry of the point; a third point while two are held is not kept
                    const k = st.carried.findIndex(c => c.point === l.point);
                    const none = l.image === undefined && l.number === undefined && l.name === undefined;
                    if (none) {
                        if (k >= 0) st.carried.splice(k, 1);
                    } else if (k >= 0) st.carried[k] = {
                        // a picture of its own now: a kind drawn into the point before is not held any more
                        point: l.point,
                        picture: l
                    };
                    else if (st.carried.length < 2) st.carried.push({
                        point: l.point,
                        picture: l
                    });
                    break;
                }
                case 'shoot': {
                    // the game fires it; here it is only said, its velocity turned as the actor is
                    const [vx, vy] = AnimRunner.apply(o, this.value(l.x, 0), this.value(l.y, 0));
                    st.shot = {
                        point: l.point,
                        kind: l.kind,
                        vx: vx,
                        vy: vy
                    };
                    this.say('shoot ' + l.point + ' ' + l.kind + ' at ' + Math.round(st.shot.vx) + ', ' + Math.round(st.shot.vy));
                    break;
                }
                case 'keep':
                    st.kept = true;
                    break;
                case 'timer':
                    // the timers are the game's: it is told, the player only says so
                    this.say('timer ' + l.action + ' ' + l.name);
                    break;
                case 'stow': {
                    // what is held at the point goes into the pockets (a thing of a kind counts again); nothing held: nothing
                    const k = st.carried.findIndex(c => c.point === l.point);
                    if (k < 0) break;
                    const held = st.carried.splice(k, 1)[0];
                    if (held.kind !== undefined) st.counts[held.kind] = (st.counts[held.kind] || 0) + 1;
                    else st.pockets.push(held.picture);
                    this.say('stow ' + l.point + (held.kind !== undefined ? ' ' + held.kind : ''));
                    break;
                }
                case 'draw': {
                    // one thing of the kind out of the pockets into the hand: shown by the first frame of its script 0
                    const kind = String(l.kind);
                    if (!(st.counts[kind] > 0)) {
                        this.say('draw ' + l.point + ' ' + kind + ': none in the pockets');
                        break;
                    }
                    --st.counts[kind];
                    const picture = this.kindPicture ? this.kindPicture(kind) : null;
                    const k = st.carried.findIndex(c => c.point === l.point);
                    if (k >= 0) st.carried.splice(k, 1);
                    if (st.carried.length < 2) st.carried.push({
                        point: l.point,
                        picture: Object.assign({
                            op: 'carry',
                            point: l.point
                        }, picture || {
                            number: 0
                        }),
                        kind: kind
                    });
                    this.say('draw ' + l.point + ' ' + kind);
                    break;
                }
                case 'tell':
                    // the game sends it on to the holder, or to the cell of the map; here there is neither: only said
                    if (l.target === 'cell') this.say('tell cell ' + Anim.halfAway(this.value(l.cell, 0)) + ' ' + l.event + ' ' + Anim.halfAway(this.value(l.value, 0)));
                    else this.say('tell holder ' + l.event);
                    break;
                case 'press':
                case 'clear':
                    // the world of the map, the game's to do: only said here
                    this.say(l.op + ' ' + Anim.halfAway(this.value(l.cell, 0)));
                    break;
                case 'appear':
                    // a newcomer of a kind: the game makes it live; here it is only said
                    this.say('appear ' + l.kind + ' ' + l.event + ' at ' + Anim.halfAway(this.value(l.x, 0)) + ', ' + Anim.halfAway(this.value(l.y, 0)) + (l.left ? ' left' : '') +
                        (l.with ? ' with ' + l.with.map(w => w.param + ' = ' + Anim.halfAway(this.value(w.value, 0))).join(', ') : ''));
                    break;
                case 'sense': {
                    // nobody is around in the player: the distance is -1, the place 0, the copies are not made
                    const outs = [-1, 0, 0];
                    l.into.forEach((n, k) => {
                        if (n === '_' || !(n in st.params)) return;
                        if (st.params[n] !== outs[k]) this.say(n + ' = ' + outs[k]);
                        st.params[n] = outs[k];
                    });
                    this.say('sense ' + l.target + (l.seen ? ' seen' : '') + ': nobody here');
                    break;
                }
                case 'steer':
                    this.steer(l, o);
                    break;
                case 'vanish':
                    this.say('vanish');
                    break;
                case 'release': {
                    // the slot of the point is freed; the game is told only when something was held, and makes of it
                    // what it is: here it is only said, its velocity turned as the actor is
                    const k = st.carried.findIndex(c => c.point === l.point);
                    if (k < 0) break;
                    const held = st.carried.splice(k, 1)[0];
                    const [vx, vy] = AnimRunner.apply(o, this.value(l.x, 0), this.value(l.y, 0));
                    st.released = {
                        point: l.point,
                        picture: held.picture,
                        vx: vx,
                        vy: vy
                    };
                    const what = held.picture.image !== undefined ? held.picture.image : held.picture.number !== undefined ? held.picture.number : held.picture.name;
                    this.say('release ' + l.point + ' ' + what + ' at ' + Math.round(vx) + ', ' + Math.round(vy));
                    break;
                }
                case 'contact':
                    // the terrain is the game's: here it is only shown; a watched mask is said and remembered
                    if (l.mask !== undefined) {
                        const mask = Anim.maskValue(l.mask, this.defines);
                        st.watched = (st.watched || []).filter(w => w.mask !== mask);
                        if (l.side !== 'none') st.watched.push({
                            mask: mask,
                            side: l.side,
                            event: l.event,
                            off: l.off,
                            first: l.first // begun over nothing within this many points, the off event at once (the game's terrain)
                        });
                        this.say(Anim.statementText(l));
                        break;
                    }
                    st.contact = l.on;
                    st.contactEvent = l.on && l.event !== undefined ? l.event : null;
                    this.say(Anim.statementText(l));
                    break;
            }
            st.pc++;
        }
        // a script that runs past the code or never shows a frame stops where it is
        st.holding = true;
        this.say(st.pc >= this.code.length ? 'the code ends' : '256 steps without a frame');
        // as in the engine, a transition waiting for an end or a branch point is not taken here
        if (st.pending) this.say('→ ' + st.pending.to + ' (' + st.pending.event + ', ' + st.pending.when + ') waits in vain: the actor stopped');
        return false;
    }

    // the time comes to a moment: the frames due are made
    advance(ms) {
        const st = this.state;
        const now = st.time + ms;
        // every frame due is lived through, however long the time (the engine loses no time); a frame lasts 1 ms at least
        while (!st.holding && now >= st.due) {
            this.moveTo(st.due);
            if (!this.step()) break;
        }
        this.moveTo(now);
    }

    // straight to the next frame
    stepFrame() {
        const st = this.state;
        if (st.holding) return;
        this.advance(Math.max(0, st.due - st.time));
    }

    // an event as dgx_ge_actor_event(): now, or at once for an actor that holds; otherwise it waits for its place
    event(name) {
        const st = this.state;
        const c = st.script && this.matrix[st.script] && this.matrix[st.script][name];
        if (!c) {
            this.say(name + ': nothing in ' + st.script);
            return false;
        }
        if (c.conflict) this.say(name + ': a conflict, the first answer is taken');
        if (c.when === 'now' || st.holding) {
            this.say('→ ' + c.to + ' (' + name + ', ' + (c.when === 'now' ? 'now' : 'held') + ')');
            this.enter(c.to);
            st.due = st.time;
            this.advance(0);
            return true;
        }
        st.pending = {
            to: c.to,
            when: c.when,
            event: name
        };
        this.say(name + ': waits for ' + (c.when === 'branch' ? 'a branch point' : 'the end') + ' → ' + c.to);
        return true;
    }
}
