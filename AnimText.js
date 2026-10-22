// The scripts of a kind as their text, the engine's language .anim, in an editor of text (CodeMirror): the words of the
// language, names, numbers and comments in their colours; errors and warnings at their lines; the names of the kind and
// the pack offered as one types (Ctrl+Space). What is typed is read (Anim.parse) a moment after: read whole, it is the
// animation of the kind (and the other views, the player, the file show it); not, the animation stays as it was and the
// lines at fault are marked. The line of the cursor is the script and step the player stands on; a script chosen
// elsewhere (the tree, Problems) is found in the text. Comments are the animation's own: they stay where they are.

// the colours of the language: words of the header, statements, the words inside them, names in capitals (pictures,
// constants), numbers and times, comments
CodeMirror.defineSimpleMode('dgx-anim', {
    start: [{
        regex: /#.*/,
        token: 'comment'
    }, {
        regex: /^(\s*)(script|label|event|param|define|table|game|group|on|pockets|stack)\b/,
        token: [null, 'keyword'],
        sol: true
    }, {
        regex: /^(\s*)(frame|dx|dy|flip|velocity|accel|signal|sound|masks|carry|contact|tell|press|clear|appear|vanish|goto|shoot|draw|stow|keep|timer|release|hit|branch|hold|set|add|path|sense|steer|action)\b/,
        token: [null, 'builtin'],
        sol: true
    }, {
        regex: /\b(if|on|off|now|branch|end|within|first|damage|event|recoil|with|and|or|not|at|none|holder|cell|start|stop|go|left|seen|into|where|to|from|angle|x|y|t)\b/,
        token: 'atom'
    }, {
        regex: /\b\d+(\.\d+)?(ms|s)?\b/,
        token: 'number'
    }, {
        regex: /\b[A-Z][A-Z0-9_]*\b/,
        token: 'variable-2'
    }, {
        regex: /->|[-+*/%<>=!&|?:]+/,
        token: 'operator'
    }],
    meta: {
        lineComment: '#'
    }
});

const AnimText = {
    mixins: [AnimBase],
    data() {
        return {
            errors: [], // the text is not read: ['line n: ...']
            fault: '', // the first error, for the line above the editor
        };
    },
    computed: {
        // the animation as text, as the file has it
        modelText() {
            return this.set ? Anim.text(this.set) : '';
        },
        // what the checks say of the animation, by line of the text (when it is read)
        checks() {
            return this.set ? Anim.check(this.set, this.spritesStore.sprites.sets) : {
                errors: [],
                warnings: []
            };
        },
    },
    mounted() {
        this.cm = CodeMirror(this.$refs.box, {
            value: this.modelText,
            mode: 'dgx-anim',
            lineNumbers: true,
            gutters: ['anim-marks', 'CodeMirror-linenumbers'],
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            styleActiveLine: true,
            extraKeys: {
                'Ctrl-Space': cm => this.hint(cm),
                Tab: cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('    '),
                'Shift-Tab': cm => cm.indentSelection('subtract'),
                'Ctrl-/': cm => cm.toggleComment ? cm.toggleComment() : null,
            },
        });
        this.shown = this.modelText; // the text of the model the editor was given last, or made itself
        this.setName = this.set ? this.set.name : '';
        this.cm.on('changes', () => {
            clearTimeout(this.readTimer);
            this.readTimer = setTimeout(() => this.read(), 300);
        });
        this.cm.on('cursorActivity', () => this.follow());
        this.cm.on('blur', () => this.tidy());
        this.cm.on('inputRead', (cm, change) => {
            if (/^[\w.]$/.test(change.text[0]) && cm.getTokenAt(cm.getCursor()).string.length >= 2) this.hint(cm, true);
        });
        this.read(true);
        this.$nextTick(() => {
            this.cm.refresh();
            this.goToScript(this.edit.animScript);
        });
        AnimUi.text = this;
    },
    unmounted() {
        clearTimeout(this.readTimer);
        if (AnimUi.text === this) AnimUi.text = null;
    },
    watch: {
        // the animation changed elsewhere (another view, undo, an import, another kind): the text is made anew from it
        modelText(text) {
            const other = !this.set || this.set.name !== this.setName;
            if (!other && text === this.shown) return;
            this.setName = this.set ? this.set.name : '';
            this.shown = text;
            const line = this.cm.getCursor().line;
            this.cm.setValue(text);
            this.cm.clearHistory();
            if (!other) this.cm.setCursor(Math.min(line, this.cm.lineCount() - 1), 0);
            this.read(true);
            if (other) this.goToScript(this.edit.animScript);
        },
        // a script chosen elsewhere: its line
        'edit.animScript'(name) {
            if (!this.following) this.goToScript(name);
        },
        checks() {
            this.mark();
        },
    },
    methods: {
        // the text read: the animation of the kind when it is whole, the lines at fault marked when not
        read(quiet) {
            if (!this.set) return;
            const r = Anim.parse(this.cm.getValue(), this.set);
            if (r.errors) {
                this.errors = r.errors;
                this.fault = r.errors[0];
                this.mark();
                return;
            }
            this.errors = [];
            this.fault = '';
            this.at = r.at;
            const text = Anim.text(Object.assign({}, this.set, {
                animation: r.animation
            }));
            if (!quiet && text !== this.modelText) {
                this.shown = text;
                this.set.animation = r.animation;
                // the script and step chosen stay, if they are still there
                if (!r.animation.scripts.some(s => s.name === this.edit.animScript)) this.edit.animScript = r.animation.scripts.length ? r.animation.scripts[0].name : '';
            }
            this.mark();
        },
        // what the editor shows is what the file has: the text laid as the file lays it, once one leaves it
        tidy() {
            if (this.errors.length || this.cm.getValue() === this.modelText) return;
            this.read();
            if (this.errors.length) return;
            const line = this.cm.getCursor().line;
            this.shown = this.modelText;
            this.cm.setValue(this.modelText);
            this.cm.setCursor(Math.min(line, this.cm.lineCount() - 1), 0);
            this.read(true);
        },
        // errors of reading at their lines; else the checks of the animation (the assembler's refusals, likely mistakes)
        mark() {
            if (!this.cm) return;
            this.cm.operation(() => {
                this.cm.clearGutter('anim-marks');
                for (const l of this.marked || []) this.cm.removeLineClass(l, 'background');
                this.marked = [];
                const put = (line, error, text) => {
                    if (line < 0 || line >= this.cm.lineCount()) return;
                    const el = document.createElement('span');
                    el.className = error ? 'anim-text-mark error-text' : 'anim-text-mark warning-text';
                    el.textContent = error ? '✖' : '⚠';
                    el.title = text;
                    this.cm.setGutterMarker(line, 'anim-marks', el);
                    this.marked.push(this.cm.addLineClass(line, 'background', error ? 'anim-line-error' : 'anim-line-warning'));
                };
                if (this.errors.length) {
                    for (const e of this.errors) {
                        const m = /^line (\d+): (.*)$/.exec(e);
                        if (m) put(+m[1] - 1, true, m[2]);
                    }
                    return;
                }
                const lineOf = p => {
                    if (!this.at) return -1;
                    if (p.kind === 'script' || p.kind === 'state') {
                        if (p.line !== undefined && p.line !== null) {
                            const i = this.at.findIndex(x => x && x.script === p.name && x.step === p.line);
                            if (i >= 0) return i;
                        }
                        return this.at.findIndex(x => x && x.script === p.name && x.step === undefined);
                    }
                    if (p.kind === 'group') return this.at.findIndex(x => x && x.group === p.name);
                    if (p.kind === 'rule' && Number.isInteger(p.line)) return this.at.findIndex(x => x && x.rule === p.line);
                    return -1;
                };
                for (const p of this.checks.errors) put(lineOf(p), true, p.text);
                for (const p of this.checks.warnings) put(lineOf(p), false, p.text);
            });
        },
        // the line of the cursor: its script and step, for the player
        follow() {
            if (!this.at || this.errors.length) return;
            const line = this.cm.getCursor().line;
            let x = this.at[line];
            // a comment or a blank line belongs to the statement below it, within its script
            for (let i = line; !x && i < this.at.length; ++i) x = this.at[i];
            if (!x || x.script === undefined) return;
            const script = this.animation.scripts.find(s => s.name === x.script);
            if (!script) return;
            this.following = true;
            this.edit.animScript = x.script;
            if (x.step !== undefined) {
                const steps = Anim.steps(script);
                const i = steps.findIndex(s => x.step >= s.start && x.step < s.end);
                if (i >= 0) this.edit.animStep = i;
            } else this.edit.animStep = 0;
            this.$nextTick(() => this.following = false);
        },
        goToScript(name) {
            if (!this.cm || !this.at || !name) return;
            const line = this.at.findIndex(x => x && x.script === name && x.step === undefined);
            if (line < 0 || this.cm.getCursor().line === line) return;
            this.cm.setCursor(line, 0);
            // the script at the top of the view, a line of what is above it seen
            this.cm.scrollTo(null, Math.max(0, this.cm.heightAtLine(line, 'local') - this.cm.defaultTextHeight() * 1.5));
        },
        // a script at the end of the text, its cursor on its first statement
        addScript(name) {
            const a = this.animation;
            const n = name && Anim.isName(name) ? name : Anim.freeName(a, 'script');
            const pic = this.set.frames.length ? Anim.imageName(this.set, this.set.frames[0].image) : 'none';
            const text = this.cm.getValue().replace(/\s*$/, '') + '\n\nscript ' + n + '\n    frame ' + pic + ' 100ms\n    hold\n';
            this.cm.setValue(text);
            const line = this.cm.lineCount() - 3;
            this.cm.setCursor(line, 10);
            this.cm.focus();
            this.read();
        },
        // the names one may write here: the words of the language, the kind's events, params, defines, tables,
        // scripts and labels, its pictures, the pack's constants and masks
        names() {
            const a = this.animation;
            let out = new Set(['script', 'label', 'event', 'param', 'define', 'table', 'game', 'group', 'on', 'pockets', 'stack',
                'frame', 'dx', 'dy', 'flip', 'velocity', 'accel', 'signal', 'sound', 'masks', 'carry', 'contact', 'tell', 'press',
                'clear', 'appear', 'vanish', 'goto', 'shoot', 'draw', 'stow', 'keep', 'timer', 'release', 'hit', 'branch', 'hold',
                'set', 'add', 'path', 'sense', 'steer', 'now', 'end', 'none', 'within', 'damage', 'recoil', 'with'
            ]);
            for (const e of a.events) out.add(e);
            for (const p of a.params) out.add(p.name);
            for (const d of a.defines) out.add(d.name);
            for (const t of a.tables || []) out.add(t.name);
            for (const g of a.groups) out.add(g.name);
            for (const s of a.scripts) {
                out.add(s.name);
                for (const l of s.lines)
                    if (l.op === 'label') out.add(l.name);
            }
            for (const f of this.set.frames) out.add(Anim.imageName(this.set, f.image));
            for (const n of Object.keys(Anim.packConstants())) out.add(n);
            for (const m of this.spritesStore.sprites.masks || []) out.add(Anim.nameOf(m.name || 'MASK_' + m.index));
            for (const s of this.spritesStore.sprites.sets)
                if (s.animation && s.animation.scripts.length && s !== this.set) out.add(Anim.nameOf(s.name));
            return [...out];
        },
        hint(cm, quiet) {
            if (!CodeMirror.showHint) return;
            cm.showHint({
                completeSingle: !quiet,
                hint: () => {
                    const cur = cm.getCursor();
                    const token = cm.getTokenAt(cur);
                    const word = /^[\w]*$/.test(token.string) ? token.string : '';
                    const from = CodeMirror.Pos(cur.line, word ? token.start : cur.ch);
                    const low = word.toLowerCase();
                    const list = this.names().filter(n => n !== word && n.toLowerCase().startsWith(low)).sort((x, y) => x.length - y.length || x.localeCompare(y));
                    return list.length ? {
                        list: list.slice(0, 40),
                        from: from,
                        to: cur
                    } : null;
                }
            });
        },
    },
    template: `
        <div class="anim-text">
            <div class="anim-text-state">
                <span v-if="errors.length" class="error-text">✖ {{T('not read, the animation stays as it was', 'не прочитан, анимация осталась прежней')}}: {{fault}}<span v-if="errors.length > 1"> {{T('and ' + (errors.length - 1) + ' more', 'и ещё ' + (errors.length - 1))}}</span></span>
                <span v-else class="help-text">{{T('Read: the animation is this text. Ctrl+Space: names; # a comment stays with its line; the cursor is where the player stands', 'Прочитан: анимация — этот текст. Ctrl+Space — имена; # комментарий остаётся при своей строке; курсор — там, где стоит проигрыватель')}}</span>
            </div>
            <div class="anim-text-box" ref="box"></div>
        </div>
    `
};
