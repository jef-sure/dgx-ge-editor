// Which masks meet: the text "meets" of the file, a pair a line, '#' to the end of a line is a comment
// (see sprite-format-ru.md, «Какие маски встречаются»). It is read as add_meets of the packer reads it.
// The editor keeps the text as it is, comments too: the grids read it and change it a line at a time.
// No text (the key absent): the engine defaults, own nothing, foreign every pair
const Meets = {
    kinds: ['own', 'foreign'],
    // a name of the pack: letters and digits kept, the rest '_', upper case (name_of of the packer)
    nameOf(text) {
        return text.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
    },
    // the name of a mask in the header of the pack and in the text
    maskName(m) {
        return this.nameOf(m.name || 'MASK_' + m.index);
    },
    // name -> index, as the packer finds them: of two masks of one name the later one
    names(masks) {
        let names = {};
        for (const m of masks) names[this.maskName(m)] = m.index;
        return names;
    },
    // the index a word of a line names, undefined if none
    resolve(word, names) {
        const index = /^[0-9]+$/.test(word) ? parseInt(word, 10) : names[this.nameOf(word)];
        return index !== undefined && index >= 0 && index <= 15 ? index : undefined;
    },
    // the word the editor writes for a mask: its name, or its index when the name does not name it
    word(index, masks) {
        const m = masks.find(m => m.index === index);
        if (!m) return String(index);
        const n = this.maskName(m);
        return !/^[0-9]+$/.test(n) && this.names(masks)[n] === index ? n : String(index);
    },
    lines(text) {
        return text.split(/\r\n|\r|\n/);
    },
    // a line: null if it is empty or a comment, else {kind, words, error}
    parseLine(raw, number, names) {
        const words = raw.split('#')[0].trim().split(/\s+/).filter(w => w);
        if (!words.length) return null;
        if (words.length !== 3 || !this.kinds.includes(words[0])) return {
            error: "meets, line " + number + ": 'own|foreign <mask> <mask>', not '" + raw.trim() + "'"
        };
        let pair = [];
        for (const w of words.slice(1)) {
            const index = this.resolve(w, names);
            if (index === undefined) return {
                error: 'meets, line ' + number + ': no mask ' + w
            };
            pair.push(index);
        }
        return {
            kind: words[0],
            words: words,
            a: pair[0],
            b: pair[1]
        };
    },
    // {own, foreign, errors, warnings}: own and foreign are 16 rows of 16 bits, as in the pack.
    // No text: the engine defaults
    parse(text, masks) {
        let rows = {
            own: new Array(16).fill(0),
            foreign: new Array(16).fill(text == null ? 0xffff : 0)
        };
        let errors = [],
            warnings = [];
        if (text == null) return {
            ...rows,
            errors,
            warnings
        };
        const names = this.names(masks);
        const declared = new Set(masks.map(m => m.index));
        this.lines(text).forEach((raw, i) => {
            const l = this.parseLine(raw, i + 1, names);
            if (!l) return;
            if (l.error) {
                errors.push(l.error);
                return;
            }
            const row = rows[l.kind];
            if (row[l.a] >> l.b & 1) {
                errors.push('meets, line ' + (i + 1) + ': ' + l.words.join(' ') + ' given twice');
                return;
            }
            row[l.a] |= 1 << l.b;
            row[l.b] |= 1 << l.a;
            for (const index of [l.a, l.b])
                if (!declared.has(index)) warnings.push('meets, line ' + (i + 1) + ': mask ' + index + ' is not in the table of masks');
        });
        let seen = {};
        for (const m of masks) {
            const n = this.maskName(m);
            // two masks of one name the header refuses (Problems.header)
            if (/^[0-9]+$/.test(n)) warnings.push('mask ' + m.index + ' is named ' + n + ': in the text that is mask ' + n);
            seen[n] = m.index;
        }
        return {
            ...rows,
            errors,
            warnings
        };
    },
    meet(parsed, kind, a, b) {
        return !!(parsed[kind][a] >> b & 1);
    },
    // the engine defaults as text over the masks of the table: foreign every pair
    defaultText(masks) {
        let text = '';
        masks.forEach((m, i) => {
            for (const n of masks.slice(i)) text += 'foreign ' + this.word(m.index, masks) + ' ' + this.word(n.index, masks) + '\n';
        });
        return text;
    },
    // the text with the pair of the kind turned on (a line at the end) or off (its lines taken away)
    toggle(text, masks, kind, a, b, on) {
        if (text == null) text = this.defaultText(masks);
        const names = this.names(masks);
        const kept = this.lines(text).filter((raw, i) => {
            const l = this.parseLine(raw, i + 1, names);
            return !l || l.error || l.kind !== kind || !(l.a === a && l.b === b || l.a === b && l.b === a);
        });
        text = kept.join('\n');
        if (!on) return text;
        if (text && !text.endsWith('\n')) text += '\n';
        return text + kind + ' ' + this.word(a, masks) + ' ' + this.word(b, masks) + '\n';
    },
    // the text after the masks change from before to after: map(index) is the new index of a mask, null if it is gone.
    // Words that would name another mask are written anew, lines of a mask gone are taken away, the rest is kept
    remap(text, before, after, map) {
        if (text == null) return text;
        const old = this.names(before);
        const names = this.names(after);
        let out = [];
        this.lines(text).forEach((raw, i) => {
            const l = this.parseLine(raw, i + 1, old);
            if (!l || l.error) {
                out.push(raw);
                return;
            }
            const to = [map(l.a), map(l.b)];
            if (to.includes(null)) return;
            const words = [l.words[1], l.words[2]].map((w, k) => this.resolve(w, names) === to[k] ? w : this.word(to[k], after));
            if (words[0] === l.words[1] && words[1] === l.words[2]) {
                out.push(raw);
                return;
            }
            const hash = raw.indexOf('#');
            out.push(l.kind + ' ' + words.join(' ') + (hash >= 0 ? '    ' + raw.slice(hash) : ''));
        });
        return out.join('\n');
    },
};
