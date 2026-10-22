// Dialogs of DGX-GE: who says what, the answers to choose from, what follows in the world. The text is the language of
// the engine's tools/dgx_ge_dialog.py (a statement a line, '#' a comment); the editor keeps each dialog as its text
// ({name, text} in the key "dialogs" of the file) and gives it out as dialogs/<name>.dlg, as the packer reads it.
// Here: reading it with the checks of the assembler (Dialogs.parse), translations of gettext .po (Dialogs.readPo), and
// a player that goes through a dialog as the engine does (DialogRunner)
const Dialogs = {
    talkNumbers: 4, // so many numbers a line shows at most (dgx_ge_dialog.h)
    uiEvents: ['activate', 'more', 'less'],

    // a string in double quotes at the start of text: [the string, the rest]
    string(text, where) {
        const m = /^\s*"((?:[^"\\]|\\.)*)"([\s\S]*)$/.exec(text);
        if (!m) throw new Error(where + ': a string in double quotes, please');
        return [m[1].replace(/\\(.)/g, '$1'), m[2]];
    },
    // a time: 3s, 500ms; 1..65535 ms
    ms(text, where) {
        const m = /^(\d+)(ms|s)$/.exec(text.trim());
        if (!m) throw new Error(where + ': a time, 3s or 500ms');
        const ms = parseInt(m[1], 10) * (m[2] === 's' ? 1000 : 1);
        if (ms < 1 || ms > 65535) throw new Error(where + ': a time of 1 ms .. 65 s');
        return ms;
    },

    // what a document offers a dialog: kinds (sets with animations, by their names in the pack) and their params,
    // pictures by their names in the pack
    contextOf(doc) {
        let kinds = {},
            pictures = new Set();
        for (const s of doc.sets || []) {
            for (const f of s.frames) pictures.add(Anim.imageName(s, f.image));
            if (s.animation && s.animation.scripts.length) kinds[Anim.nameOf(s.name)] = s;
        }
        return {
            kinds: kinds,
            pictures: pictures
        };
    },

    // a dialog from its text: {dialog: {name, roles: [{role, kind, shown, face}], game, pause, code: [statement], labels},
    // errors: [text], warnings: [text]}. A statement: {op, line, ...}: say {role, important, msgid, plural, ms},
    // choose {role, ms, timeout, answers: [{msgid, cond, control, param, to}]}, tell {role, event}, give {from, kind,
    // count, to}, goto {label}, style {name}, end. A kind or a picture the file has not is a warning: the pack may have it
    parse(text, doc) {
        text = text.normalize('NFC'); // as the packer reads a dialog: its msgids meet those of a .po in NFC
        const ctx = doc ? this.contextOf(doc) : {
            kinds: {},
            pictures: new Set()
        };
        let errors = [],
            warnings = [];
        let d = {
            name: null,
            roles: [],
            game: null,
            pause: false, // the game stands while it is open (DGX_GE_DIALOG_PAUSE)
            code: [],
            labels: {}
        };
        let choosing = null; // {statement, indent} while lines of a choose follow
        const paramsOf = kind => {
            const s = ctx.kinds[kind];
            return s ? s.animation.params.map(p => p.name) : null;
        };
        const kindOf = role => role === 'game' ? d.game : (d.roles.find(r => r.role === role) || {}).kind;
        const knownKind = (k, where) => {
            if (!(k in ctx.kinds)) warnings.push(where + ": no kind '" + k + "' in this file: the pack must have it");
        };
        const role = (r, where, game) => {
            if (r === 'game' && game !== false) return 'game';
            if (!d.roles.some(x => x.role === r)) throw new Error(where + ": no role '" + r + "'");
            return r;
        };
        const condition = (text, kind, where) => {
            const params = paramsOf(kind);
            try {
                Anim.parseExpr(text, {
                    defines: Anim.packConstants(), // the game's constants (the file's constants), as the assembler takes them
                    params: params || undefined,
                    allowParams: true,
                    allowT: false,
                    animation: false // a condition of a dialog, not a script: no axis
                });
            } catch (e) {
                throw new Error(where + ': ' + e.message);
            }
        };
        let fixups = [];
        text.split(/\r?\n/).forEach((raw, i) => {
            const where = 'line ' + (i + 1);
            try {
                // a comment: '#' outside a string
                let line = '',
                    quoted = false,
                    esc = false;
                for (const c of raw) {
                    if (c === '#' && !quoted) break;
                    line += c;
                    if (esc) esc = false;
                    else if (c === '\\') esc = true;
                    else if (c === '"') quoted = !quoted;
                }
                line = line.trimEnd();
                if (!line.trim()) return;
                const indent = line.length - line.replace(/^ +/, '').length;
                const body = line.trim();
                if (choosing && indent > choosing.indent && body.startsWith('"')) {
                    // an answer of the choose above: "msgid" [if expr] [control KIND param | field NAME] [-> label]; a field is
                    // the game's (Pack.add_field): the file has none, the packer refuses a name it was not given
                    const [msgid, rest] = this.string(body, where);
                    const m = /^\s*(?:if\s+(.+?))?\s*(?:control\s+(\w+)\s+(\w+)|field\s+(\w+))?\s*(?:->\s*(\w+))?\s*$/.exec(rest);
                    if (!m || !(m[2] || m[4] || m[5]))
                        throw new Error(where + ': "<msgid>" [if <expression>] [control <kind> <param> | field <name>] [-> <label>]: a control, a field or a label at least');
                    const kind = kindOf(choosing.statement.role);
                    let a = {
                        msgid: msgid,
                        line: i
                    };
                    if (m[2]) {
                        knownKind(m[2], where);
                        const own = paramsOf(kind);
                        if (own && !own.includes(m[3])) throw new Error(where + ": no param '" + m[3] + "' of " + (kind || 'the one choosing'));
                        a.control = m[2];
                        a.param = m[3];
                    }
                    if (m[4]) a.field = m[4];
                    if (m[1]) {
                        condition(m[1], kind, where);
                        a.cond = m[1];
                    }
                    if (m[5]) {
                        a.to = m[5];
                        fixups.push([m[5], where]);
                    }
                    if (choosing.statement.answers.length >= 255) throw new Error(where + ': 255 answers at most');
                    choosing.statement.answers.push(a);
                    return;
                }
                choosing = null;
                const sp = body.indexOf(' ');
                const word = sp < 0 ? body : body.slice(0, sp);
                const rest = sp < 0 ? '' : body.slice(sp + 1).trim();
                if (word === 'dialog') {
                    if (d.name !== null || !/^\w+$/.test(rest)) throw new Error(where + ': dialog <name>, once, first');
                    d.name = rest;
                    return;
                }
                if (d.name === null) throw new Error(where + ': dialog <name> first');
                if (word === 'roles') {
                    for (const part of (rest.match(/(?:[^,"]|"(?:[^"\\]|\\.)*")+/g) || []).map(p => p.trim())) {
                        const m = /^(\w+)\s+(\w+)(\s+"(?:[^"\\]|\\.)*")?(?:\s+face\s+(\w+))?$/.exec(part);
                        if (!m || d.roles.some(r => r.role === m[1]) || m[1] === 'game')
                            throw new Error(where + ': roles <role> <kind> ["<name>"] [face <picture>], ...: a new name, not game');
                        if (m[4] && !ctx.pictures.has(m[4])) warnings.push(where + ": no picture '" + m[4] + "' in this file for a face: the pack must have it");
                        knownKind(m[2], where);
                        let r = {
                            role: m[1],
                            kind: m[2]
                        };
                        if (m[3]) {
                            const [shown, tail] = this.string(m[3], where);
                            if (tail.trim()) throw new Error(where + ": '" + tail.trim() + "' after the name");
                            r.shown = shown;
                        }
                        if (m[4]) r.face = m[4];
                        d.roles.push(r);
                    }
                    if (d.roles.length > 8) throw new Error(where + ': 8 roles at most');
                } else if (word === 'game') {
                    if (!/^\w+$/.test(rest) || d.game !== null) throw new Error(where + ': game <kind>, once: a kind of the pack');
                    knownKind(rest, where);
                    d.game = rest;
                } else if (word === 'pause') {
                    if (rest || d.pause) throw new Error(where + ': pause, once, alone on its line');
                    d.pause = true;
                } else if (word === 'label') {
                    if (!/^\w+$/.test(rest) || rest in d.labels) throw new Error(where + ": bad or repeated label '" + rest + "'");
                    d.labels[rest] = d.code.length;
                } else if (word === 'style') {
                    if (!/^\w+$/.test(rest)) throw new Error(where + ': style <name>');
                    d.code.push({
                        op: 'style',
                        name: rest,
                        line: i
                    });
                } else if (word === 'say' || word === 'say!') {
                    const m = /^(\w+)\s+([\s\S]+)$/.exec(rest);
                    if (!m) throw new Error(where + ': say <role> "<msgid>"');
                    let [msgid, tail] = this.string(m[2], where);
                    let plural = undefined;
                    if (tail.trim().startsWith('"'))[plural, tail] = this.string(tail, where);
                    const ms = tail.trim() ? this.ms(tail, where) : 0;
                    const r = role(m[1], where);
                    // the numbers a line shows: {name} of params of the one saying it, in order; the form by the first
                    const order = [...msgid.matchAll(/\{(\w+)\}/g)].map(x => x[1]);
                    const shows = new Set([...(msgid + (plural || '')).matchAll(/\{(\w+)\}/g)].map(x => x[1]));
                    let s = {
                        op: 'say',
                        role: r,
                        important: word === 'say!',
                        msgid: msgid,
                        ms: ms,
                        line: i
                    };
                    if (plural !== undefined || shows.size) {
                        if (order.length > this.talkNumbers) throw new Error(where + ': a line shows ' + this.talkNumbers + ' numbers at most');
                        if (order.length > 1) {
                            if (plural !== undefined && [...plural.matchAll(/\{(\w+)\}/g)].map(x => x[1]).join(',') !== order.join(','))
                                throw new Error(where + ': the forms of a line show the same numbers in the same order');
                        } else if (shows.size !== 1) throw new Error(where + ': a line of a number shows one param of the one saying it: {name}');
                        const kind = kindOf(r);
                        const own = paramsOf(kind);
                        const names = order.length ? order : [...shows];
                        for (const shown of names)
                            if (own && !own.includes(shown)) throw new Error(where + ": no param '" + shown + "' of " + (kind || 'the one saying it'));
                        s.param = names[0];
                        s.params = names;
                        if (plural !== undefined) s.plural = plural;
                    }
                    d.code.push(s);
                } else if (word === 'choose') {
                    const m = /^(\w+)(?:\s+(\S+)\s*->\s*(\w+))?$/.exec(rest);
                    if (!m) throw new Error(where + ': choose <role> [<time> -> <label>]');
                    let s = {
                        op: 'choose',
                        role: role(m[1], where),
                        ms: m[2] ? this.ms(m[2], where) : 0,
                        answers: [],
                        line: i
                    };
                    if (m[3]) {
                        s.timeout = m[3];
                        fixups.push([m[3], where]);
                    }
                    d.code.push(s);
                    choosing = {
                        statement: s,
                        indent: indent
                    };
                } else if (word === 'tell') {
                    const m = /^(\w+)\s+(\w+)$/.exec(rest);
                    if (!m) throw new Error(where + ': tell <role> <event>');
                    d.code.push({
                        op: 'tell',
                        role: role(m[1], where, false),
                        event: m[2],
                        line: i
                    });
                } else if (word === 'give') {
                    const m = /^(\w+)\s+(\w+)\s+(\d+)\s+to\s+(\w+)$/.exec(rest);
                    if (!m) throw new Error(where + ': give <role> <kind> <count> to <role>');
                    knownKind(m[2], where);
                    const n = parseInt(m[3], 10);
                    if (n < 1 || n > 255) throw new Error(where + ': give 1..255');
                    d.code.push({
                        op: 'give',
                        from: role(m[1], where, false),
                        kind: m[2],
                        count: n,
                        to: role(m[4], where, false),
                        line: i
                    });
                } else if (word === 'goto') {
                    if (!/^\w+$/.test(rest)) throw new Error(where + ': goto <label>');
                    d.code.push({
                        op: 'goto',
                        label: rest,
                        line: i
                    });
                    fixups.push([rest, where]);
                } else if (word === 'end') {
                    d.code.push({
                        op: 'end',
                        line: i
                    });
                } else throw new Error(where + ": no such statement '" + word + "'");
            } catch (e) {
                errors.push(e.message);
            }
        });
        if (!errors.length && d.name === null) errors.push('no dialog');
        for (const [label, where] of fixups)
            if (!(label in d.labels)) errors.push(where + ": no label '" + label + "'");
        if (!errors.length && !d.code.length) errors.push('dialog ' + d.name + ': nothing in it');
        // a choose with no answers waits for nothing
        for (const s of d.code)
            if (s.op === 'choose' && !s.answers.length) warnings.push('line ' + (s.line + 1) + ': choose ' + s.role + ' has no answers below it (two spaces more)');
        return {
            dialog: d,
            errors: errors,
            warnings: warnings
        };
    },

    // a gettext .po: {(msgctxt + '\u0004' + msgid): msgstr | [forms]}, the header under ''; as read_po of the tools
    readPo(text) {
        // as the packer reads it: a BOM skipped, the text in NFC (a dialog's msgids are NFC too)
        text = text.replace(/^\uFEFF/, '').normalize('NFC');
        let entries = {},
            entry = {},
            field = null;
        const unq = s => s.trim().slice(1, -1).replace(/\\(.)/g, (m, c) => ({
            n: '\n',
            t: '\t'
        })[c] || c);
        const done = () => {
            if (!('msgid' in entry)) return;
            const key = (entry.msgctxt || '') + '\u0004' + entry.msgid;
            const forms = Object.keys(entry).filter(k => k.startsWith('msgstr[')).sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7))).map(k => entry[k]);
            if (forms.length && forms.some(v => v)) entries[key] = forms;
            else if (entry.msgstr && (entry.msgid || !('msgctxt' in entry))) entries[key] = entry.msgstr;
        };
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith('#')) {
                if (!line && Object.keys(entry).length) {
                    done();
                    entry = {};
                    field = null;
                }
                continue;
            }
            const m = /^(msgctxt|msgid_plural|msgid|msgstr\[\d+\]|msgstr)\s+(".*")$/.exec(line);
            if (m) {
                if (m[1] === 'msgctxt' || m[1] === 'msgid' && !('msgctxt' in entry) && Object.keys(entry).length) {
                    if (Object.keys(entry).length && ('msgstr' in entry || Object.keys(entry).some(k => k.startsWith('msgstr[')))) {
                        done();
                        entry = {};
                    }
                }
                field = m[1];
                entry[field] = unq(m[2]);
            } else if (line.startsWith('"') && field) entry[field] += unq(line);
        }
        done();
        return entries;
    },
    // the forms of a language: [how many, the rule as a tree of the editor's expressions, n its param]
    pluralRule(po) {
        const header = po && po['\u0004'] || '';
        const m = /Plural-Forms:\s*nplurals\s*=\s*(\d+)\s*;\s*plural\s*=\s*([^;\n]+)/.exec(header);
        let text = m ? m[2].trim() : 'n != 1';
        text = text.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ').replace(/!(?!=)/g, ' not ');
        return [m ? parseInt(m[1], 10) : 2, Anim.parseExpr(text, {
            defines: {},
            params: ['n'],
            allowParams: true,
            allowT: false
        })];
    },
    // a msgid in a context as the language has it (the msgid itself when not translated)
    translate(po, context, msgid) {
        const t = po && po[context + '\u0004' + msgid];
        return typeof t === 'string' && t ? t : msgid;
    },

    // the text of a dialog for its file dialogs/<name>.dlg: it is kept as written
    fileName(d) {
        return d.name.replace(/[^\p{L}\p{N}_.-]/gu, '_') + '.dlg';
    },
};

// Goes through a dialog as the engine does (dgx_ge_dialog.c): from its first statement; a line is shown until it is
// read on (next); a choose shows the answers whose conditions hold, of the params and pockets of the one choosing, and
// waits for one; a control of an answer is told activate, more and less and gives its value back; a field of an answer
// is edited on activate (fieldDone). Params start as the
// kinds' animations give them; pockets are counted by give. tell is only said
class DialogRunner {
    // dialog: of Dialogs.parse; doc: the file (kinds, controls); po: a translation or null
    constructor(dialog, doc, po) {
        this.d = dialog;
        this.doc = doc;
        this.po = po;
        this.ctx = Dialogs.contextOf(doc);
        this.log = [];
        this.params = {}; // role -> {param: value}
        this.known = {}; // role -> whether its kind is in the file (its params known); unknown params are 0 then
        this.pockets = {}; // role -> {kind: count}
        this.fields = {}; // the game's text fields the answers edit: name -> text (empty at first; the game keeps its own)
        for (const r of [...dialog.roles.map(r => r.role), 'game']) {
            const kind = r === 'game' ? dialog.game : dialog.roles.find(x => x.role === r).kind;
            const set = kind && this.ctx.kinds[kind];
            const a = set && set.animation;
            this.params[r] = a ? Object.fromEntries(a.params.map(p => [p.name, Anim.constValue(p.value, Anim.defineValues(a))])) : {};
            this.known[r] = !!a;
            this.pockets[r] = {};
        }
        this.style = null;
        this.pc = 0;
        this.shown = null; // {op: 'say', role, text, important, ms} | {op: 'choose', role, answers: [{answer, text, value?}], pick} | {op: 'end'}
        this.run();
    }
    say(text) {
        this.log.push(text);
        if (this.log.length > 12) this.log.shift();
    }
    // the value of an expression of a role's params and pockets
    value(text, role) {
        // a kind not in the file: its params are not known, any name is taken as one (as the parse took it), 0
        const tree = Anim.parseExpr(text, {
            defines: Anim.packConstants(),
            params: this.known[role] ? Object.keys(this.params[role] || {}) : undefined,
            allowParams: true,
            allowT: false,
            animation: false
        });
        return Anim.evalExpr(tree, this.params[role], 0, {
            count: kind => this.pockets[role][kind] || 0
        });
    }
    name(role) {
        const r = this.d.roles.find(x => x.role === role);
        return r && r.shown !== undefined ? Dialogs.translate(this.po, this.d.name, r.shown) : null;
    }
    // a line of numbers: the form the language gives it by the first, each {name} the number of that param: a
    // translation may put them in its own order (the packer stores them as {i}, the engine shows number i there); a
    // name the line has not (the packer refuses it) takes the next, as the engine does at a name
    lineText(s) {
        const numbers = (s.params || (s.param !== undefined ? [s.param] : [])).map(p => this.params[s.role][p] || 0);
        const n = numbers.length ? numbers[0] : 0;
        let text;
        if (s.plural !== undefined) {
            const t = this.po && this.po[this.d.name + '\u0004' + s.msgid];
            const [count, rule] = Dialogs.pluralRule(this.po);
            const forms = Array.isArray(t) && t.some(x => x) ? t : [s.msgid, ...Array(count - 1).fill(s.plural)];
            const k = Math.max(0, Math.min(forms.length - 1, Anim.evalExpr(rule, {
                n: n
            }, 0) | 0));
            text = forms[k];
        } else text = Dialogs.translate(this.po, this.d.name, s.msgid);
        if (!numbers.length) return text;
        const names = s.params || [s.param];
        let k = 0;
        return text.replace(/\{(\w*)\}/g, (m, name) => {
            const i = names.indexOf(name);
            return String(numbers[i >= 0 ? i : Math.min(k++, numbers.length - 1)]);
        });
    }
    // on until a line or a choice to show, or the end
    run() {
        for (let n = 0; n < 1000; ++n) {
            const s = this.d.code[this.pc];
            if (!s) {
                this.shown = {
                    op: 'end'
                };
                return;
            }
            switch (s.op) {
                case 'say':
                    this.shown = {
                        op: 'say',
                        role: s.role,
                        text: this.lineText(s),
                        important: s.important,
                        ms: s.ms,
                        line: s.line
                    };
                    return;
                case 'choose': {
                    const answers = s.answers.filter(a => !a.cond || this.value(a.cond, s.role) !== 0).map(a => ({
                        answer: a,
                        text: Dialogs.translate(this.po, this.d.name, a.msgid),
                        value: a.control ? this.params[s.role][a.param] || 0 : undefined
                    }));
                    this.shown = {
                        op: 'choose',
                        role: s.role,
                        answers: answers,
                        pick: 0,
                        ms: s.ms,
                        line: s.line
                    };
                    return;
                }
                case 'style':
                    this.style = s.name;
                    break;
                case 'tell':
                    this.say('tell ' + s.role + ' ' + s.event);
                    break;
                case 'give': {
                    const have = this.pockets[s.from][s.kind] || 0;
                    const n = Math.min(have, s.count);
                    this.pockets[s.from][s.kind] = have - n;
                    this.pockets[s.to][s.kind] = (this.pockets[s.to][s.kind] || 0) + n;
                    this.say('give ' + s.from + ' ' + s.kind + ' ' + n + ' of ' + s.count + ' to ' + s.to);
                    break;
                }
                case 'goto':
                    this.pc = this.d.labels[s.label];
                    continue;
                case 'end':
                    this.shown = {
                        op: 'end'
                    };
                    this.say('end');
                    return;
            }
            ++this.pc;
        }
        this.shown = {
            op: 'end'
        };
        this.say(T('1000 statements without a line: stopped', '1000 операторов без реплики: остановлено'));
    }
    // the button: a line is read on, an answer chosen (its control told activate, or on to its label)
    next() {
        const v = this.shown;
        if (!v || v.op === 'end') return;
        if (v.op === 'say') {
            ++this.pc;
            this.run();
            return;
        }
        const a = v.answers[v.pick];
        if (!a) return;
        if (a.answer.field) return; // a field: activate edits it (fieldDone when it is done)
        if (a.answer.control) this.tellControl('activate');
        if (a.answer.to) {
            this.say('→ ' + a.answer.to);
            this.pc = this.d.labels[a.answer.to];
            this.run();
        }
    }
    // the field of the answer chosen, being edited, done: its text typed (null: cancelled, as it was); on to the answer's
    // label either way, as dgx_ge_talk_field_done
    fieldDone(text) {
        const v = this.shown;
        const a = v && v.op === 'choose' && v.answers[v.pick];
        if (!a || !a.answer.field) return;
        if (text !== null && text !== (this.fields[a.answer.field] || '')) {
            this.fields[a.answer.field] = text;
            this.say('field ' + a.answer.field + ' = "' + text + '"');
        }
        if (a.answer.to) {
            this.say('→ ' + a.answer.to);
            this.pc = this.d.labels[a.answer.to];
            this.run();
        }
    }
    // the choice moves (next, prev) or the control of the answer chosen is told more, less
    move(by) {
        const v = this.shown;
        if (v && v.op === 'choose' && v.answers.length) v.pick = (v.pick + by + v.answers.length) % v.answers.length;
    }
    // no answer in time: on from the choose's label
    timeout() {
        const s = this.d.code[this.pc];
        if (s && s.op === 'choose' && s.timeout) {
            this.say(T('no answer in ' + s.ms + ' ms → ', 'нет ответа за ' + s.ms + ' ms → ') + s.timeout);
            this.pc = this.d.labels[s.timeout];
            this.run();
        }
    }
    // an event of the interface to the control of the answer chosen, as the engine tells it: the control's animation
    // started in script 0 with the value, told the event, its value read back at once
    tellControl(event) {
        const v = this.shown;
        const a = v && v.op === 'choose' && v.answers[v.pick];
        if (!a || !a.answer.control) return false;
        const set = this.ctx.kinds[a.answer.control];
        const anim = set && set.animation;
        if (!anim || !anim.params.length) return false;
        const copy = Object.assign({}, anim, {
            params: anim.params.map((p, i) => i ? p : Object.assign({}, p, {
                value: a.value
            }))
        });
        const runner = new AnimRunner(copy);
        runner.start(anim.scripts[0].name);
        runner.event(event);
        const value = runner.state.params[anim.params[0].name];
        if (value !== a.value) {
            this.params[v.role][a.answer.param] = value;
            this.say(a.answer.control + ' ' + event + ': ' + a.answer.param + ' = ' + value);
            // the answers again as the conditions say now, the one chosen stays chosen
            const keep = a.answer;
            const s = this.d.code[this.pc];
            const answers = s.answers.filter(x => !x.cond || this.value(x.cond, s.role) !== 0).map(x => ({
                answer: x,
                text: Dialogs.translate(this.po, this.d.name, x.msgid),
                value: x.control ? this.params[s.role][x.param] || 0 : undefined
            }));
            v.answers = answers;
            v.pick = Math.max(0, answers.findIndex(x => x.answer === keep));
        }
        return true;
    }
}

// translations loaded from .po files, by language; kept in the browser, not in the file (the packer reads po/<language>.po)
const Translations = {
    entries: new Map(),
    storageKey: 'dgx-ge-sprite-editor-po',
    get(language) {
        return language ? this.entries.get(language) : null;
    },
    keys() {
        return this.entries.keys();
    },
    add(language, text) {
        this.entries.set(language, Dialogs.readPo(text));
        this.save();
    },
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify([...this.entries]));
        } catch (e) {}
    },
    restore() {
        try {
            for (const [k, v] of JSON.parse(localStorage.getItem(this.storageKey) || '[]')) this.entries.set(k, v);
        } catch (e) {}
    },
};
