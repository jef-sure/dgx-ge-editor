// The page of dialogs: styles of talk (how a line and the answers look) with a preview drawn as the engine draws it
// (src/dgx_ge_talk_view.c: the frame, its border, the field of text, the bar under the answer chosen; the text laid by
// Text.js as src/dgx_ge_text.c lays it), and the fonts the preview needs, loaded from their C sources
// what the dialogs mode shares between its parts: the fonts and translations loaded (no reactive state of their own),
// the words of the line of state, and the dialog played again
const DialogUi = Vue.reactive({
    fontsVersion: 0,
    poVersion: 0,
    restartVersion: 0, // the tree part asks the preview to play the dialog anew
    summary: '',
    hint: '',
});

// the lists of dialogs, styles, fonts and translations: in the tree of the project and in the preview
const DialogListsBase = {
    data() {
        return {
            ui: DialogUi,
            message: '',
        };
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        Styles() {
            return Styles;
        },
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        styles() {
            return this.sprites.styles;
        },
        style() {
            return this.styles.find(s => s.name === this.edit.dialogStyle) || null;
        },
        dialogs() {
            return this.sprites.dialogs;
        },
        dialog() {
            return this.dialogs.find(d => d.name === this.edit.dialogName) || null;
        },
        poNames() {
            DialogUi.poVersion;
            return [...Translations.keys()].sort();
        },
        fontNames() {
            DialogUi.fontsVersion;
            return Fonts.names();
        },
    },
    methods: {
        // the preview plays the dialog anew (the preview itself has the real one)
        restart() {
            DialogUi.restartVersion++;
        },
        addDialog() {
            const name = Scene.freeName(this.dialogs, 'talk');
            this.dialogs.push({
                name: name,
                text: 'dialog ' + name + '\nroles hero KID "Hero"\nstyle ' + (this.styles[0] ? this.styles[0].name : 'talk') +
                    '\nlabel start\n    say hero "Hello!"\n    choose hero\n        "Again." -> start\n        "Bye." -> bye\nlabel bye\n    end\n'
            });
            this.edit.dialogName = name;
            this.restart();
        },
        async importDialogs(event) {
            for (const file of event.target.files) {
                const text = await file.text();
                const m = /^\s*dialog\s+(\w+)/m.exec(text);
                const name = m ? m[1] : file.name.replace(/\.dlg$/, '');
                const old = this.dialogs.find(d => d.name === name);
                if (old) old.text = text;
                else this.dialogs.push({
                    name: name,
                    text: text
                });
                this.edit.dialogName = name;
            }
            event.target.value = '';
            this.restart();
        },
        exportDialog(d) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([d.text], {
                type: 'text/plain'
            }));
            a.download = Dialogs.fileName(d);
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },
        async loadPo(event) {
            for (const file of event.target.files) {
                Translations.add(file.name.replace(/\.po$/, ''), await file.text());
                this.edit.dialogLanguage = file.name.replace(/\.po$/, '');
            }
            event.target.value = '';
            DialogUi.poVersion++;
            this.restart();
        },
        // a style from a ready one: its fields, the first font loaded; the note's frame picture made when it is not there
        addStyleFrom(event) {
            const key = event.target.value;
            event.target.value = '';
            const t = Styles.templates[key];
            if (!t) return;
            const name = Scene.freeName(this.styles, key);
            let style = Object.assign({
                name: name,
                font: this.fontNames[0] || ''
            }, JSON.parse(JSON.stringify(t[1])));
            if (style.frame === 'picture') {
                this.spritesStore.addPicture('frames', 'parchment.png', Styles.parchment());
                style.picture = {
                    set: 'frames',
                    image: 'parchment.png'
                };
            }
            this.styles.push(style);
            this.edit.dialogStyle = name;
        },
        addStyle() {
            const name = Scene.freeName(this.styles, this.styles.length ? 'style' : 'talk');
            let style = Styles.newStyle(name);
            style.font = this.fontNames[0] || '';
            this.styles.push(style);
            this.edit.dialogStyle = name;
        },
        async loadFonts(event) {
            let loaded = [],
                failed = [];
            for (const file of event.target.files) {
                try {
                    // a bitmap font, or a handwritten one (its pen paths)
                    const src = await file.text();
                    let font;
                    try {
                        font = Text.readFont(src);
                    } catch (e) {
                        font = HwFont.read(src);
                    }
                    Fonts.add(font);
                    loaded.push(font.name + ' (' + (font.hw ? font.glyphList.length + T(' handwritten', ' рукописных') : Object.keys(font.glyphs).length) + T(' glyphs)', ' знаков)'));
                } catch (e) {
                    failed.push(file.name + ': ' + e.message);
                }
            }
            event.target.value = '';
            DialogUi.fontsVersion++;
            this.message = (loaded.length ? T('loaded ', 'загружены ') + loaded.join(', ') : '') + (failed.length ? T(' · not fonts of DGX: ', ' · не шрифты DGX: ') + failed.join('; ') : '');
            if (this.style && !this.style.font && loaded.length) this.style.font = this.fontNames[0];
        },
        removeFont(name) {
            Fonts.remove(name);
            DialogUi.fontsVersion++;
        },
    },
};

const DialogEdit = {
    mixins: [DialogListsBase],
    data() {
        return {
            // sample texts in the language of the editor when the preview starts
            sample: T('You found a sword. It is old, but sharp: you can fight the guards with it. Will you take it with you or leave it here?',
                'Вы нашли меч. Он старый, но острый: с ним можно драться со стражниками. Возьмёте его с собой или оставите здесь?'),
            answers: T('Take the sword\nLeave it\nAsk whose it is\nGo away', 'Взять меч\nОставить\nСпросить, чей он\nУйти'),
            controlMessage: '',
            speaker: T('Guard', 'Стражник'), // the name shown over the text when the style shows names
            face: null, // {set, image}: the portrait of the one speaking, when the style shows one
            pick: 0,
            important: false, // the line's own: important unless the style says so already
            timeMs: 0, // the time since the line began: an important line too long scrolls by it
            playing: false,
            runVersion: 0, // the dialog played changed (the runner is no reactive state)
        };
    },
    created() {
        this.runner = null; // the dialog played: no reactive state, runVersion counts its changes
        this.drag = null; // the frame dragged by the mouse
    },
    mounted() {
        this.draw();
        if (!this.edit.dialogName && this.dialogs.length) this.edit.dialogName = this.dialogs[0].name;
    },
    unmounted() {
        this.stop();
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        Styles() {
            return Styles;
        },
        edit() {
            return this.spritesStore.edit;
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        styles() {
            return this.sprites.styles;
        },
        style() {
            return this.styles.find(s => s.name === this.edit.dialogStyle) || null;
        },
        // the style the preview shows: the one chosen; a dialog played shows the style it names (one nobody made: the
        // engine's default)
        shownStyle() {
            this.runVersion;
            const r = this.edit.dialogPage === 'dialogs' ? this.runner : null;
            if (r && r.style) return this.styles.find(s => s.name === r.style) || Object.assign(Styles.newStyle(r.style), {
                font: ''
            });
            return this.style;
        },
        // what is shown: {mode: 'say' | 'choose' | 'end', text, important, answers: [{text, kind, value, field, fieldText}],
        // pick, name, face}
        view() {
            this.runVersion;
            if (this.edit.dialogPage !== 'dialogs') return {
                mode: this.edit.dialogMode,
                text: this.sample,
                important: this.important,
                answers: this.answerLines,
                pick: this.pick,
                name: this.speaker,
                face: this.face
            };
            const r = this.runner;
            const v = r && r.shown;
            if (!v || v.op === 'end') return {
                mode: 'end',
                text: '',
                answers: [],
                pick: 0,
                name: '',
                face: null
            };
            const role = r.d.roles.find(x => x.role === v.role);
            return {
                mode: v.op,
                text: v.text || '',
                important: !!v.important,
                answers: v.op === 'choose' ? v.answers.map(a => ({
                    text: a.text,
                    kind: a.answer.control,
                    value: a.value,
                    field: a.answer.field,
                    fieldText: a.answer.field ? r.fields[a.answer.field] || '' : undefined
                })) : [],
                pick: v.pick || 0,
                name: r.name(v.role) || '',
                face: role && role.face ? this.pictureRef(role.face) : null
            };
        },
        dialogs() {
            return this.sprites.dialogs;
        },
        dialog() {
            return this.dialogs.find(d => d.name === this.edit.dialogName) || null;
        },
        // the dialog chosen read, with the checks of the assembler
        parsed() {
            return this.dialog ? Dialogs.parse(this.dialog.text, this.sprites) : null;
        },
        poNames() {
            DialogUi.poVersion;
            return [...Translations.keys()].sort();
        },
        runState() {
            this.runVersion;
            const r = this.runner;
            if (!r) return null;
            return {
                log: r.log.slice(),
                params: JSON.parse(JSON.stringify(r.params)),
                pockets: JSON.parse(JSON.stringify(r.pockets)),
                line: r.shown && r.shown.line,
                pause: r.d.pause,
                timeout: r.shown && r.shown.op === 'choose' && r.d.code[r.pc] && r.d.code[r.pc].timeout ? r.d.code[r.pc].ms : 0
            };
        },
        screen() {
            return this.sprites.screen;
        },
        fontNames() {
            DialogUi.fontsVersion;
            return Fonts.names();
        },
        font() {
            DialogUi.fontsVersion;
            if (!this.shownStyle) return null;
            return Fonts.get(this.shownStyle.font) || (!this.shownStyle.font && this.fontNames.length ? Fonts.get(this.fontNames[0]) : null);
        },
        problems() {
            DialogUi.fontsVersion;
            return Styles.check(this.sprites, this.screen, name => Fonts.get(name) || (!name && this.fontNames.length ? Fonts.get(this.fontNames[0]) : null));
        },
        errors() {
            return this.problems.filter(p => p.error);
        },
        field() {
            if (!this.shownStyle) return null;
            return Styles.field(this.shownStyle, Styles.box(this.shownStyle, this.screen.width, this.screen.height), this.font);
        },
        // the line laid, as the engine lays it, and the answers
        laid() {
            const s = this.shownStyle,
                f = this.font;
            if (!s || !f) return null;
            const field = this.field;
            if (field.width <= 0 || field.height <= 0) return null;
            const [max, min] = Styles.get(s, 'scale');
            if (this.view.mode === 'say') return Text.layout(this.view.text, f, field.width, field.height, max, min, this.view.important || Styles.get(s, 'important'));
            // the answers: a list, never cut, at the least scale; an answer a line, a long one wrapped into more (its own
            // line breaks are spaces)
            const least = min || 1;
            return Text.layout(this.view.answers.map(a => a.text.replace(/\n/g, ' ')).join('\n'), f, field.width, field.height, least, least, true);
        },
        // the lines of the answers: the answer of each line, and each answer's first line and the line after its last
        answerRows() {
            const l = this.laid;
            let of = [],
                first = [],
                end = [];
            if (!l || this.view.mode !== 'choose') return {
                of: of,
                first: first,
                end: end
            };
            l.begins.forEach((b, i) => {
                if (b || !i) first.push(i);
                of.push(first.length - 1);
            });
            for (let a = 0; a < first.length; ++a) end.push(a + 1 < first.length ? first[a + 1] : l.lines.length);
            return {
                of: of,
                first: first,
                end: end
            };
        },
        // the answer that begins on a row of the lines seen, -1 when the row goes on with one above or is past them
        rowAnswer() {
            const l = this.laid,
                rows = this.answerRows;
            return row => {
                const i = this.top + row;
                return l && row >= 0 && i < l.lines.length && l.begins[i] ? rows.of[i] : -1;
            };
        },
        // the answers of the preview: 'text', 'text | KIND value' (a control of that kind showing that value) or
        // 'text | field TEXT' (a field of the game with that text)
        answerLines() {
            return this.answers.split('\n').filter(a => a.trim()).map(line => {
                const bar = line.indexOf('|');
                if (bar < 0) return {
                    text: line
                };
                const field = /^\s*field(?:\s+(.*))?$/.exec(line.slice(bar + 1));
                if (field) return {
                    text: line.slice(0, bar).trimEnd(),
                    field: 'field',
                    fieldText: (field[1] || '').trim()
                };
                const [kind, value] = line.slice(bar + 1).trim().split(/\s+/);
                return {
                    text: line.slice(0, bar).trimEnd(),
                    kind: kind,
                    value: parseInt(value, 10) || 0
                };
            });
        },
        // the numbers of the pictures as the packer gives them from this file
        pictureNames() {
            this.spritesStore.imagesVersion;
            return this.sprites.sets.flatMap(s => s.frames.map(f => Anim.imageName(s, f.image)));
        },
        facePicture() {
            this.spritesStore.imagesVersion;
            return this.view.face ? FrameImages.get(this.view.face.set, this.view.face.image) || null : null;
        },
        // the picture of a frame of nine pieces, when its insets cut it so
        framePicture() {
            this.spritesStore.imagesVersion;
            const s = this.shownStyle;
            if (!s || Styles.get(s, 'frame') !== 'picture' || !s.picture || !Array.isArray(s.insets)) return null;
            const pic = FrameImages.get(s.picture.set, s.picture.image);
            const [l, t, r, b] = s.insets;
            if (!pic || [l, t, r, b].some(v => v < 1) || pic.width - l - r < 1 || pic.height - t - b < 1) return null;
            return pic;
        },
        // the pictures of the controls of the answers, as their values are now: {picture, origin, key} by line
        controlPictures() {
            return this.view.answers.map(a => a.kind ? this.controlActor(a.kind, a.value) : null).map(r => r && r.picture ? r : null);
        },
        // a line appearing letter by letter: the letters of the lines shown first (the top one), then it is all there
        appearMs() {
            const s = this.shownStyle,
                l = this.laid;
            if (this.view.mode !== 'say' || !s || !l || Styles.get(s, 'appear') !== 'letters' || !Styles.get(s, 'letterMs')) return 0;
            return Text.letters(l.lines.slice(0, l.shown)) * Styles.get(s, 'letterMs');
        },
        letters() {
            if (!this.appearMs || this.timeMs >= this.appearMs) return undefined;
            return Math.floor(this.timeMs / Styles.get(this.shownStyle, 'letterMs'));
        },
        // the first line seen: a line scrolled by time once it has appeared; the answers follow the one chosen
        top() {
            const l = this.laid;
            if (!l || !l.scrolling) return 0;
            const last = l.lines.length - l.shown;
            if (this.view.mode === 'say') {
                const every = Styles.get(this.shownStyle, 'scrollMs');
                return every && this.letters === undefined ? Math.min(last, Math.floor((this.timeMs - this.appearMs) / every)) : 0;
            }
            // the lines seen follow the answer chosen down from the top until it is seen whole (from its first line when
            // it does not go in), as follow_pick of the engine
            const rows = this.answerRows,
                first = rows.first[this.view.pick] || 0,
                end = rows.end[this.view.pick] || 0;
            return Math.max(0, Math.min(last, end > l.shown ? Math.min(first, end - l.shown) : 0));
        },
        // the name, a line laid at the least scale, cut if long (as the engine lays it)
        nameLaid() {
            const s = this.shownStyle,
                f = this.font,
                fd = this.field;
            if (!s || !f || !fd || !fd.nameHeight || fd.width <= 0) return null;
            const least = Styles.get(s, 'scale')[1] || 1;
            return Text.layout(this.view.name, f, fd.width, fd.nameHeight, least, least, false);
        },
        hint() {
            if (this.edit.dialogPage !== 'dialogs' || !this.runner) return '';
            this.runVersion;
            return this.view.mode === 'end' ? T('the dialog is over', 'диалог окончен') : this.shownStyle ? T('style ', 'стиль ') + this.shownStyle.name : '';
        },
        summary() {
            const l = this.laid;
            if (!this.shownStyle) return '';
            if (!this.font) return this.fontNames.length ? T('no font ' + this.shownStyle.font + ': load it', 'нет шрифта ' + this.shownStyle.font + ': загрузите его') :
                T('load a font (Load font .c) to see the text', 'загрузите шрифт («Загрузить шрифт .c…»), чтобы видеть текст');
            if (!l) return T('no room for the text in the frame', 'в рамке нет места для текста');
            return T('scale ', 'масштаб ') + l.scale + ' · ' + l.lines.length + T(' lines, ', ' строк, ') + l.shown + T(' shown', ' видно') + (l.cut ? T(' · cut: ', ' · обрезано: ') + l.last : '') +
                (this.letters !== undefined ? T(' · appearing: ', ' · появляется: ') + this.letters + T(' of ', ' из ') + Text.letters(l.lines.slice(0, l.shown)) + T(' letters', ' букв') :
                    this.appearMs ? T(' · appeared at ', ' · появилась за ') + this.appearMs + ' ms' : '') +
                (l.scrolling ? T(' · scrolls, top ', ' · прокручивается, верх ') + this.top : '');
        },
        drawKey() {
            return JSON.stringify([this.shownStyle, this.font && this.font.name, this.view.mode, this.view.text, this.answers, this.view.pick, this.view.important,
                this.top, this.letters, this.view, this.runVersion, this.controlPictures.map(c => c && c.key), !!this.framePicture, this.view.face, !!this.facePicture, this.edit.dialogZoom, this.screen, this.spritesStore.imagesVersion
            ]);
        },
    },
    watch: {
        drawKey() {
            this.$nextTick(() => this.draw());
        },
        // the page chosen at the top: styles show the sample, dialogs play
        'edit.dialogPage'(p) {
            if (p === 'dialogs') this.restart();
            else this.stop();
        },
        'edit.dialogName'() {
            if (this.edit.dialogPage === 'dialogs') this.restart();
        },
        'ui.restartVersion'() {
            this.restart();
        },
        summary: {
            handler(t) {
                DialogUi.summary = t;
            },
            immediate: true
        },
        hint: {
            handler(t) {
                DialogUi.hint = t;
            },
            immediate: true
        },
    },
    methods: {
        // the set of a kind of control: by its name or by its name in the pack
        kindSet(kind) {
            return this.sprites.sets.find(s => s.name === kind || Anim.packName(s.name, '').slice(0, -1) === kind) || null;
        },
        // a control as a dialog has it: its animation started in script 0 with the value as its first param, run to its
        // frame; event: told it then at once, no time passing. {picture, origin, value, key} or null
        controlActor(kind, value, event) {
            const set = this.kindSet(kind);
            const a = set && set.animation;
            if (!a || !a.scripts.length || !a.params.length) return null;
            const copy = Object.assign({}, a, {
                params: a.params.map((p, i) => i ? p : Object.assign({}, p, {
                    value: value
                }))
            });
            const names = this.pictureNames;
            const runner = new AnimRunner(copy);
            runner.pictures = {
                number: n => Math.max(0, names.indexOf(n)),
                name: i => names[i]
            };
            runner.start(a.scripts[0].name);
            if (event) runner.event(event);
            const st = runner.state;
            const fr = st.frame;
            let found = null;
            if (fr && fr.image !== undefined) found = {
                set: set,
                frame: set.frames.find(f => f.image === fr.image)
            };
            else if (fr && fr.name !== undefined)
                for (const s of this.sprites.sets) {
                    const f = s.frames.find(f => Anim.imageName(s, f.image) === fr.name);
                    if (f) found = {
                        set: s,
                        frame: f
                    };
                }
            const ok = found && found.frame;
            return {
                picture: ok ? FrameImages.get(found.set.name, found.frame.image) : null,
                origin: ok ? found.frame.origin : null,
                value: st.params[a.params[0].name],
                key: ok ? found.set.name + '/' + found.frame.image : null
            };
        },
        // an event of the interface to the control of the answer chosen: its value as the control gives it back
        tellControl(event) {
            const a = this.answerLines[this.pick];
            if (!a || !a.kind) {
                this.controlMessage = T('the answer chosen has no control: ' + event + ' moves the choice in the game', 'у выбранного ответа нет контрола: ' + event + ' в игре двигает выбор');
                return;
            }
            const r = this.controlActor(a.kind, a.value, event);
            if (!r) {
                this.controlMessage = T('no animation of a control ' + a.kind + ' (a set with scripts and a param)', 'нет анимации контрола ' + a.kind + ' (набора со скриптами и параметром)');
                return;
            }
            this.controlMessage = a.kind + ': ' + event + T(' → value ', ' → значение ') + r.value;
            let lines = this.answers.split('\n').filter(l => l.trim());
            lines[this.pick] = a.text + ' | ' + a.kind + ' ' + r.value;
            this.answers = lines.join('\n');
        },
        // a picture of the pack by its name: {set, image}
        pictureRef(name) {
            for (const s of this.sprites.sets) {
                const f = s.frames.find(f => Anim.imageName(s, f.image) === name);
                if (f) return {
                    set: s.name,
                    image: f.image
                };
            }
            return null;
        },
        removeDialog() {
            if (!this.dialog || !confirm(T('Remove dialog ' + this.dialog.name + '?', 'Удалить диалог ' + this.dialog.name + '?'))) return;
            this.dialogs.splice(this.dialogs.indexOf(this.dialog), 1);
            this.edit.dialogName = this.dialogs.length ? this.dialogs[0].name : '';
            this.restart();
        },
        // the text edited: its name follows its first line 'dialog <name>'
        setDialogText(text) {
            this.dialog.text = text;
            const m = /^\s*dialog\s+(\w+)/m.exec(text);
            if (m && m[1] !== this.dialog.name && !this.dialogs.some(d => d !== this.dialog && d.name === m[1])) {
                this.dialog.name = m[1];
                this.edit.dialogName = m[1];
            }
        },
        // the dialog played anew from its first statement, in the language chosen
        restart() {
            this.stop();
            const p = this.parsed;
            this.runner = p && !p.errors.length ? new DialogRunner(p.dialog, this.sprites, Translations.get(this.edit.dialogLanguage) || null) : null;
            this.afterStep();
        },
        // a new line: it appears from its start (letters, then scroll)
        afterStep() {
            this.runVersion++;
            const r = this.runner;
            if (r && r.style && this.styles.some(s => s.name === r.style)) this.edit.dialogStyle = r.style;
            this.timeMs = 0;
            this.$nextTick(() => {
                if (this.view.mode === 'say') this.play();
            });
        },
        dialogNext() {
            if (!this.runner) return;
            // a line still appearing is shown whole first, as the engine does
            if (this.view.mode === 'say' && this.letters !== undefined) {
                this.stop();
                this.timeMs = this.appearMs;
                return;
            }
            // a field: activate edits it; here the text is asked for (Cancel: as it was), then on as the engine goes
            const v = this.runner.shown;
            const a = v && v.op === 'choose' && v.answers[v.pick];
            if (a && a.answer.field) {
                const text = prompt(T('Field ' + a.answer.field + ' (the game\'s text field): type its text', 'Поле ' + a.answer.field + ' (текстовое поле игры): введите его текст'), this.runner.fields[a.answer.field] || '');
                this.runner.fieldDone(text);
                this.afterStep();
                return;
            }
            this.runner.next();
            this.afterStep();
        },
        dialogMove(by) {
            if (!this.runner) return;
            this.runner.move(by);
            this.runVersion++;
        },
        dialogControl(event) {
            if (!this.runner) return;
            if (!this.runner.tellControl(event)) this.runner.move(event === 'more' ? 1 : -1);
            this.runVersion++;
        },
        dialogTimeout() {
            if (!this.runner) return;
            this.runner.timeout();
            this.afterStep();
        },
        // the mouse on the preview: the frame of the style moved, or its right / bottom edge pulled
        canvasPoint(event) {
            const r = this.$refs.canvas.getBoundingClientRect();
            const z = this.edit.dialogZoom;
            return {
                x: Math.floor((event.clientX - r.left) / z),
                y: Math.floor((event.clientY - r.top) / z)
            };
        },
        grabAt(p) {
            const s = this.shownStyle;
            if (!s || !this.styles.includes(s)) return null;
            const b = Styles.box(s, this.screen.width, this.screen.height);
            const inside = p.x >= b.x - 2 && p.y >= b.y - 2 && p.x <= b.x + b.width + 1 && p.y <= b.y + b.height + 1;
            if (!inside) return null;
            const right = Math.abs(p.x - (b.x + b.width - 1)) <= 2,
                bottom = Math.abs(p.y - (b.y + b.height - 1)) <= 2;
            return right && bottom ? 'corner' : right ? 'right' : bottom ? 'bottom' : 'move';
        },
        onCanvasDown(event) {
            const p = this.canvasPoint(event);
            const what = this.grabAt(p);
            if (!what) return;
            const s = this.shownStyle;
            this.drag = {
                what: what,
                from: p,
                box: Styles.box(s, this.screen.width, this.screen.height),
                style: s
            };
        },
        onCanvasMove(event) {
            const p = this.canvasPoint(event);
            if (!this.drag) {
                const what = this.grabAt(p);
                this.$refs.canvas.style.cursor = what === 'move' ? 'move' : what === 'right' ? 'ew-resize' : what === 'bottom' ? 'ns-resize' : what === 'corner' ? 'nwse-resize' : 'default';
                return;
            }
            const d = this.drag,
                dx = p.x - d.from.x,
                dy = p.y - d.from.y;
            let b = Object.assign({}, d.box);
            if (d.what === 'move') {
                b.x += dx;
                b.y += dy;
            }
            if (d.what === 'right' || d.what === 'corner') b.width = Math.max(1, b.width + dx);
            if (d.what === 'bottom' || d.what === 'corner') b.height = Math.max(1, b.height + dy);
            d.style.place = Styles.placeOf(d.style, b, this.screen.width, this.screen.height);
        },
        onCanvasUp() {
            this.drag = null;
        },
        removeStyle() {
            if (!this.style || !confirm(T('Remove style ' + this.style.name + '? Dialogs that name it get the default style', 'Удалить стиль ' + this.style.name + '? Диалоги, что его называют, получат стиль по умолчанию'))) return;
            this.styles.splice(this.styles.indexOf(this.style), 1);
            this.edit.dialogStyle = this.styles.length ? this.styles[0].name : '';
        },
        renameStyle(event) {
            const name = event.target.value.trim();
            if (!name || this.styles.some(s => s !== this.style && s.name === name)) {
                this.message = "'" + name + "': " + T('no name, or another style has it', 'нет имени, или оно у другого стиля');
                event.target.value = this.style.name;
                return;
            }
            this.style.name = name;
            this.edit.dialogStyle = name;
            this.message = '';
        },
        // an array of numbers from inputs: whole numbers within low..high, else it stays as it was
        setInts(key, i, event, low, high) {
            const v = parseInt(event.target.value, 10);
            if (!Number.isInteger(v) || v < low || v > high) {
                this.message = key + T(': a whole number ', ': целое число ') + low + '..' + high;
                event.target.value = Styles.get(this.style, key)[i];
                return;
            }
            const a = Styles.get(this.style, key).slice();
            a[i] = v;
            this.style[key] = a;
            this.message = '';
        },
        setInt(key, event, low, high) {
            const v = parseInt(event.target.value, 10);
            if (!Number.isInteger(v) || v < low || v > high) {
                this.message = key + T(': a whole number ', ': целое число ') + low + '..' + high;
                event.target.value = Styles.get(this.style, key);
                return;
            }
            this.style[key] = v;
            this.message = '';
        },
        hex(rgb) {
            return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
        },
        setColor(key, event) {
            const h = event.target.value;
            if (!this.style.colors) this.style.colors = {};
            this.style.colors[key] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
        },
        setFrame(event) {
            this.style.frame = event.target.value;
            if (this.style.frame === 'picture' && !this.style.picture) {
                const set = this.sprites.sets.find(s => s.frames.length);
                if (set) this.style.picture = {
                    set: set.name,
                    image: set.frames[0].image
                };
            }
            if (this.style.frame === 'picture') this.thirds();
        },
        // insets that cut the picture of the frame into thirds, when it has none that cut it
        thirds() {
            const p = this.style.picture;
            const set = p && this.sprites.sets.find(s => s.name === p.set);
            const f = set && set.frames.find(f => f.image === p.image);
            const ins = this.style.insets;
            if (!f || Array.isArray(ins) && ins.every(v => v >= 1) && f.width - ins[0] - ins[2] >= 1 && f.height - ins[1] - ins[3] >= 1) return;
            const x = Math.max(1, Math.floor(f.width / 3)),
                y = Math.max(1, Math.floor(f.height / 3));
            this.style.insets = [x, y, x, y];
        },
        setPortrait(side) {
            this.style.portrait = side;
            if (side !== 'none' && !this.style.portraitWidth) this.style.portraitWidth = 32;
        },
        setPictureSet(event) {
            const set = this.sprites.sets.find(s => s.name === event.target.value);
            this.style.picture = {
                set: set.name,
                image: set.frames.length ? set.frames[0].image : ''
            };
            this.thirds();
        },
        play() {
            if (this.playing) return this.stop();
            this.playing = true;
            this.timeMs = 0;
            const start = performance.now();
            const tick = () => {
                if (!this.playing) return;
                this.timeMs = Math.round(performance.now() - start);
                // over when it has appeared and scrolled to its end
                const l = this.laid;
                if (l && this.letters === undefined && (!l.scrolling || this.top >= l.lines.length - l.shown)) {
                    this.playing = false;
                    return;
                }
                this.raf = requestAnimationFrame(tick);
            };
            this.raf = requestAnimationFrame(tick);
        },
        stop() {
            this.playing = false;
            cancelAnimationFrame(this.raf);
        },
        draw() {
            const canvas = this.$refs.canvas;
            if (!canvas) return;
            const z = this.edit.dialogZoom,
                W = this.screen.width,
                H = this.screen.height;
            canvas.width = W * z;
            canvas.height = H * z;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            // the screen: a checkered background, what the scene would show
            for (let y = 0; y < H; y += 8)
                for (let x = 0; x < W; x += 8) {
                    ctx.fillStyle = (x + y) / 8 % 2 ? '#3a4048' : '#323840';
                    ctx.fillRect(x * z, y * z, 8 * z, 8 * z);
                }
            const s = this.shownStyle;
            if (!s || this.view.mode === 'end') return;
            const rgb = c => 'rgb(' + c.join(',') + ')';
            const fill = (x, y, w, h, c) => {
                if (w <= 0 || h <= 0) return;
                ctx.fillStyle = rgb(c);
                ctx.fillRect(x * z, y * z, w * z, h * z);
            };
            const b = Styles.box(s, W, H);
            const frame = Styles.get(s, 'frame');
            const bw = Styles.get(s, 'borderWidth');
            // a frame of a picture: the fill under it, its corners where they are, its edges and its middle laid again and
            // again between them, each from the left upper point of its place (pieces of a picture of two colours in the border's)
            const nine = frame === 'picture' ? this.framePicture : null;
            if (nine) {
                fill(b.x, b.y, b.width, b.height, Styles.color(s, 'fill'));
                const [l, t, r, bt] = s.insets;
                const one = nine.palette.length <= 2;
                const src = [[0, l, nine.width - r], [0, t, nine.height - bt]],
                    sw = [l, nine.width - l - r, r],
                    sh = [t, nine.height - t - bt, bt];
                const xs = [b.x, b.x + l, b.x + b.width - r],
                    ws = [l, b.width - l - r, r];
                const ys = [b.y, b.y + t, b.y + b.height - bt],
                    hs = [t, b.height - t - bt, bt];
                for (let i = 0; i < 9; ++i) {
                    const c = i % 3,
                        rw = Math.floor(i / 3);
                    for (let dy = 0; dy < hs[rw]; ++dy)
                        for (let dx = 0; dx < ws[c]; ++dx) {
                            // a corner as it is (clipped to its place), the rest repeated
                            const px = src[0][c] + dx % sw[c],
                                py = src[1][rw] + dy % sh[rw];
                            const v = nine.indexes[py * nine.width + px];
                            if (!v) continue;
                            ctx.fillStyle = one ? rgb(Styles.color(s, 'border')) : rgb(nine.palette[v] || [255, 0, 255]);
                            ctx.fillRect((xs[c] + dx) * z, (ys[rw] + dy) * z, z, z);
                        }
                }
            } else if (frame === 'fill' || frame === 'picture') {
                // the frame: its border, then its fill inside it (a frame of a picture without its picture: as this)
                if (bw) fill(b.x, b.y, b.width, b.height, Styles.color(s, 'border'));
                fill(b.x + bw, b.y + bw, b.width - 2 * bw, b.height - 2 * bw, Styles.color(s, 'fill'));
            }
            const f = Styles.field(s, b, this.font);
            const l = this.laid,
                font = this.font;
            // the portrait of the one speaking or choosing: its left upper point at the top corner of its room, cut to it
            // (its own colours; a picture of two colours in the text's)
            const face = f.portrait && this.facePicture;
            if (face) {
                const one = face.palette.length <= 2;
                const pr = f.portrait;
                for (let py = 0; py < face.height && py < pr.height; ++py)
                    for (let px = 0; px < face.width && px < pr.width; ++px) {
                        const v = face.indexes[py * face.width + px];
                        if (!v) continue;
                        ctx.fillStyle = one ? rgb(Styles.color(s, 'text')) : rgb(face.palette[v] || [255, 0, 255]);
                        ctx.fillRect((pr.x + px) * z, (pr.y + py) * z, z, z);
                    }
            }
            // the name of the one speaking or choosing, a line over the field
            const nl = this.nameLaid;
            if (nl && font) {
                ctx.fillStyle = rgb(Styles.color(s, 'name'));
                Text.draw(nl, font, f.width, f.nameHeight, (x, y) => ctx.fillRect((f.x + x) * z, (f.y - f.nameHeight + y) * z, z, z), 0, undefined, false, Styles.get(s, 'align'));
            }
            if (l && font) {
                // more answers than lines: a scroll bar at the right edge inside the frame, a column of its own
                // (dgx_ge_talk_view.c): 5 points wide, a point from the border; the bar under the
                // answer chosen ends a point before it, the controls and the fields 2 points before it
                const scrollW = 5,
                    scrollGap = 1,
                    scrollRoom = 2;
                const bbw = frame !== 'none' ? bw : 0;
                const scrolled = this.view.mode === 'choose' && l.lines.length > l.shown && l.shown > 0 && Text.lineHeight(font, l.scale) > 0;
                const barX = b.x + b.width - bbw - (scrollGap + scrollW);
                const right = scrolled && barX - scrollRoom < f.right ? barX - scrollRoom : f.right;
                // the track's colour (and a field's border): halfway between the fill and the border
                const track = Styles.color(s, 'fill').map((c, j) => Math.floor((c + Styles.color(s, 'border')[j]) / 2));
                if (this.view.mode === 'choose') {
                    // the bar under all the lines of the answer chosen that are seen, inside the frame
                    const lh = Text.lineHeight(font, l.scale),
                        rows = this.answerRows,
                        from = Math.max(0, (rows.first[this.view.pick] || 0) - this.top),
                        to = Math.min(l.shown, (rows.end[this.view.pick] || 0) - this.top);
                    if (to > from) fill(b.x + bbw, f.y + from * lh, (scrolled ? barX - scrollGap : b.x + b.width - bbw) - (b.x + bbw), (to - from) * lh, Styles.color(s, 'bar'));
                }
                // a soft pen of a handwritten font: 15 shades between the fill and the text, as the engine has them
                const soft = !!font.hw && Styles.get(s, 'pen') === 'soft';
                const fillC = Styles.color(s, 'fill'),
                    textC = Styles.color(s, 'text');
                const shade = ink => {
                    const k = Math.round(ink * 15) - 1;
                    return rgb(fillC.map((c, j) => Math.floor((c * (14 - k) + textC[j] * (k + 1)) / 15)));
                };
                ctx.fillStyle = rgb(textC);
                Text.draw(l, font, f.width, f.height, (x, y, ink) => {
                    if (soft) ctx.fillStyle = shade(ink);
                    ctx.fillRect((f.x + x) * z, (f.y + y) * z, z, z);
                }, this.top, this.view.mode === 'say' ? this.letters : undefined, soft, Styles.get(s, 'align'));
                // the scroll bar: its track, an arrow at each end in the text's colour (a triangle as wide as the bar, half as
                // high, its point out), the knob between them as much and as far as the lines seen
                if (scrolled) {
                    const lhs = Text.lineHeight(font, l.scale);
                    const h = l.shown * lhs,
                        ah = h > 3 * (scrollW + scrollGap) ? (scrollW + 1) >> 1 : 0,
                        th = h - 2 * (ah ? ah + scrollGap : 0);
                    const kh = Math.floor(th * l.shown / l.lines.length),
                        ky = Math.floor(th * this.top / l.lines.length) + (ah ? ah + scrollGap : 0);
                    fill(barX, f.y, scrollW, h, track);
                    for (let i = 0; i < 2 && ah; ++i)
                        for (let r = 0; r < ah; ++r) {
                            const span = scrollW & 1 ? 2 * r + 1 : 2 * r + 2,
                                x0 = (scrollW - span) >> 1,
                                y = i === 0 ? r : ah - 1 - r;
                            fill(barX + x0, (i ? f.y + h - ah : f.y) + y, Math.min(span, scrollW - x0), 1, Styles.color(s, 'text'));
                        }
                    fill(barX, f.y + ky, scrollW, kh > 1 ? kh : 1, Styles.color(s, 'text'));
                }
                if (this.view.mode === 'choose') {
                    // the controls: at the right end of their answers' first lines, in the middle of each (a picture of two
                    // colours in the text's)
                    const lh = Text.lineHeight(font, l.scale);
                    const pad = Styles.get(s, 'padding');
                    for (let row = 0; row < l.shown; ++row) {
                        const c = this.controlPictures[this.rowAnswer(row)];
                        if (!c) continue;
                        const img = c.picture,
                            o = c.origin;
                        // as the engine places it: x, y of its origin; its left upper pixel is that less the origin
                        const x = right - img.width + o.x,
                            y = f.y + row * lh + Math.trunc((lh - img.height) / 2) + o.y;
                        const one = img.palette.length <= 2;
                        for (let py = 0; py < img.height; ++py)
                            for (let px = 0; px < img.width; ++px) {
                                const v = img.indexes[py * img.width + px];
                                if (!v) continue;
                                ctx.fillStyle = one ? rgb(Styles.color(s, 'text')) : rgb(img.palette[v] || [255, 0, 255]);
                                ctx.fillRect((x - o.x + px) * z, (y - o.y + py) * z, z, z);
                            }
                    }
                    // the fields: the right half of the text's width, as tall as the line, its border the track's colour,
                    // inside the fill (over the bar too); the end of their text that goes in, 2 points from the left edge
                    const fw = ((f.width + 7) & ~7) >> 1,
                        tw = fw - 4;
                    for (let row = 0; row < l.shown && tw > 0; ++row) {
                        const a = this.view.answers[this.rowAnswer(row)];
                        if (!a || !a.field) continue;
                        const fx = right - fw,
                            fy = f.y + row * lh;
                        fill(fx, fy, fw, lh, track);
                        fill(fx + 1, fy + 1, fw - 2, lh - 2, Styles.color(s, 'fill'));
                        let chars = [...(a.fieldText || '')],
                            fl = Text.layout(chars.join(''), font, tw, lh, l.scale, l.scale, false);
                        while (fl.cut && chars.length) fl = Text.layout((chars = chars.slice(1)).join(''), font, tw, lh, l.scale, l.scale, false);
                        ctx.fillStyle = rgb(Styles.color(s, 'text'));
                        Text.draw(fl, font, tw, lh, (x, y) => ctx.fillRect((fx + 2 + x) * z, (fy + y) * z, z, z), 0, undefined, false, 'left');
                    }
                }
            }
            // the field of text, dashed: where the text may be (its width rounded up to bytes, as the engine has it)
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
            ctx.strokeRect(f.x * z + 0.5, f.y * z + 0.5, f.width * z - 1, f.height * z - 1);
            ctx.setLineDash([]);
        },
    },
    template: `
        <div class="dialog-edit" :class="{'dialog-page': edit.dialogPage === 'dialogs'}">
            <div class="scene-main"><canvas ref="canvas" class="dialog-canvas" @mousedown="onCanvasDown" @mousemove="onCanvasMove" @mouseup="onCanvasUp" @mouseleave="onCanvasUp"
                :title="T('Drag the style’s frame with the mouse, pull its right and bottom edges to stretch it: the place changes, counted from the same edge', 'Рамку стиля можно тащить мышью, а за правый и нижний край — растягивать: место (place) меняется, отсчёт от края сохраняется')"></canvas></div>
            <div class="scene-palette dialog-play" v-if="edit.dialogPage === 'dialogs'">
                <div class="strip-grip" @mousedown="$parent.startResize($event)" :title="T('Drag: the height of the bottom strip', 'Тяните: высота нижней полосы')"></div>
                <textarea v-if="dialog" :value="dialog.text" @input="setDialogText($event.target.value)" @change="restart" spellcheck="false" class="dialog-text"
                    :title="T('The dialog’s text. A line is a statement, # a comment; the answers of a choice two spaces right of choose. Checks on the left; ▶ plays it anew', 'Текст диалога. Строка — оператор, # — комментарий; ответы выбора — на два пробела правее choose. Проверки — слева; ▶ — проиграть заново')"></textarea>
                <div class="dialog-controls">
                    <button class="btn btn-sm btn-primary" @click="restart" :title="T('From the start, the first statement', 'Сначала, с первого оператора')">▶ {{T('start', 'сначала')}}</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="dialogNext" :disabled="!runner" :title="T('The player’s button: a line goes on (one appearing is shown whole first), a choice takes the answer (a control: activate)', 'Кнопка игрока: реплика — дальше (появляющаяся — сразу вся), выбор — выбрать ответ (контрол — activate)')">next</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="dialogMove(-1)" :disabled="view.mode !== 'choose'" :title="T('The answer above (prev)', 'Ответ выше (prev)')">▲</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="dialogMove(1)" :disabled="view.mode !== 'choose'" :title="T('The answer below (next)', 'Ответ ниже (next)')">▼</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="dialogControl('less')" :disabled="view.mode !== 'choose'" :title="T('less: to the control of the answer chosen', 'less: контролу выбранного ответа')">less</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="dialogControl('more')" :disabled="view.mode !== 'choose'" :title="T('more: to the control of the answer chosen', 'more: контролу выбранного ответа')">more</button>
                    <button v-if="runState && runState.timeout" class="btn btn-sm btn-outline-secondary" @click="dialogTimeout" :title="T('No answer in ' + runState.timeout + ' ms', 'Нет ответа за ' + runState.timeout + ' мс')">{{T('time out', 'время вышло')}}</button>
                    <div v-if="runState" class="dialog-state">
                        <div v-if="runState.pause" :title="T('pause in the dialog’s head: while it is open the game stands still (time, timers, traps and actors do not run); the talk’s own time runs (timed lines, letters, controls), and tell, give and conditions fall on the moment the world stands at', 'pause в заголовке диалога: пока он открыт, игра стоит — время, таймеры, ловушки и актёры не идут; у разговора время идёт (строки по времени, буквы, контролы), а tell, give и условия приходятся на мгновение, где мир стоит')">⏸ {{T('pauses the game', 'игра стоит')}}</div>
                        <div v-for="(ps, role) in runState.params" v-show="Object.keys(ps).length || Object.keys(runState.pockets[role] || {}).length">
                            <b>{{role}}</b> <span v-for="(v, k) in ps">{{k}} {{v}} · </span><span v-for="(v, k) in runState.pockets[role]">{{k}} ×{{v}} · </span></div>
                        <div class="anim-log">{{runState.log.join(' · ')}}</div>
                    </div>
                    <div v-else-if="parsed && parsed.errors.length" class="error-text">{{T('the dialog has errors: see the checks on the left', 'в диалоге ошибки: см. проверки слева')}}</div>
                </div>
            </div>
            <div class="scene-palette dialog-sample" v-else>
                <div class="strip-grip" @mousedown="$parent.startResize($event)" :title="T('Drag: the height of the bottom strip', 'Тяните: высота нижней полосы')"></div>
                <span v-if="style && Styles.get(style, 'portrait') !== 'none'" :title="T('The portrait of the one speaking, for the preview: a picture of a set (in a dialog, the role’s face: roles guard GUARD &quot;Guard&quot; face GUARD_FACE)', 'Портрет говорящего для показа: картинка набора (в диалоге — face у роли: roles guard GUARD &quot;Стражник&quot; face GUARD_FACE)')">face
                    <select :value="face ? face.set : ''" @change="face = $event.target.value ? {set: $event.target.value, image: (sprites.sets.find(s => s.name === $event.target.value).frames[0] || {}).image} : null">
                        <option value="">{{T('none', 'нет')}}</option><option v-for="s in sprites.sets.filter(s => s.frames.length)" :value="s.name">{{s.name}}</option></select>
                    <select v-if="face" v-model="face.image"><option v-for="f in sprites.sets.find(s => s.name === face.set).frames" :value="f.image">{{f.image}}</option></select></span>
                <label v-if="style && Styles.get(style, 'showName')" :title="T('The name of the one speaking (or choosing) for the preview: in a dialog it is the role’s name (roles guard GUARD &quot;Guard&quot;)', 'Имя говорящего (или выбирающего) для показа: в диалоге это имя роли (roles guard GUARD &quot;Стражник&quot;)')">{{T('name', 'имя')}} <input v-model="speaker" size="12"></label>
                <template v-if="edit.dialogMode === 'say'">
                    <textarea v-model="sample" rows="3" :title="T('A line for the preview: laid out as the engine does (word wrap, scale, scrolling or “...”)', 'Реплика для показа: её раскладывают, как движок (перенос по словам, масштаб, прокрутка или «...»)')"></textarea>
                    <label :title="T('An important line is shown whole (scrolling); an unimportant one is cut with an ellipsis. A style can make all lines important', 'Важная реплика показывается целиком (прокрутка); неважная обрезается многоточием. Стиль может делать важными все')"><input type="checkbox" v-model="important"> {{T('important', 'важная')}}</label>
                    <button class="btn btn-sm btn-outline-secondary" @click="play" :title="T('The line in time: letter by letter (when the style says so), then scrolling, a line every ' + (style ? Styles.get(style, 'scrollMs') : '') + ' ms', 'Реплика во времени: появление по буквам (если стиль так велит), затем прокрутка — строка каждые ' + (style ? Styles.get(style, 'scrollMs') : '') + ' мс')">{{playing ? '⏸' : '▶'}} {{T('play', 'пуск')}}</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="stop(); timeMs = appearMs" :disabled="!appearMs" :title="T('The button while the line appears: it is shown whole at once', 'Кнопка, пока реплика появляется: она показывается вся сразу')">{{T('all', 'вся')}}</button>
                    <label :title="T('Time since the line began, ms', 'Время от начала реплики, мс')">t <input class="num" type="number" min="0" step="100" v-model.number="timeMs"></label>
                </template>
                <template v-else>
                    <textarea v-model="answers" rows="3" :title="T('Answers, one a line: shown as a list at the style’s least scale, never cut. “text | KIND value”: with a control, “text | field TEXT”: with a field of the game (a frame on the right, the text in it)', 'Ответы, по одному в строке: они идут списком, при наименьшем масштабе стиля, не обрезаются. «текст | ВИД значение» — с контролом, «текст | field ТЕКСТ» — с полем игры (рамка справа, в ней текст)')"></textarea>
                    <label :title="T('The answer chosen: the bar colour under it; the list scrolls after it', 'Выбранный ответ: под ним полоса цвета bar; список прокручивается за ним')">{{T('chosen', 'выбран')}} <input class="num" type="number" min="0" :max="answerLines.length - 1" v-model.number="pick"></label>
                    <span :title="T('An answer with a control is a line “text | KIND value” (Sound | toggle 1): the control’s picture at the right of the line, by its value. The buttons send an event to the control of the answer chosen, as the engine does: the control anew in script 0 with the value, the event, the value at once', 'Ответ с контролом — строка «текст | ВИД значение» (Звук | toggle 1): картинка контрола справа на строке, по значению. Кнопки посылают событие контролу выбранного ответа, как движок: контрол заново в скрипте 0 со значением, событие, значение сразу')">
                        <button v-for="e in ['less', 'activate', 'more']" class="btn btn-sm btn-outline-secondary" @click="tellControl(e)">{{e}}</button></span>
                    <span class="help-text">{{controlMessage}}</span>
                </template>
            </div>
            <div class="scene-props">
                <template v-if="style">
                    <h6>{{T('Style', 'Стиль')}}</h6>
                    <label class="prop" :title="T('The style’s name: a dialog names it, style talk. In the pack’s header, the constant STYLE_NAME', 'Имя стиля: диалог называет его — style talk. В заголовке пакета — константа STYLE_ИМЯ')">name <input :value="style.name" @change="renameStyle"></label>
                    <div class="prop" :title="T('The frame: a fill with a border; a picture of nine pieces (the fill under it, the corners as they are, the edges and the middle repeated; a piece of a two-colour picture in the border colour); none', 'Рамка: заливка с каймой; картинка из девяти кусков (под ней заливка fill, углы как есть, края и середина повторяются; кусок двухцветной картинки — цветом border); нет')">frame
                        <select :value="Styles.get(style, 'frame')" @change="setFrame"><option v-for="f in Styles.frames" :value="f">{{f}}</option></select></div>
                    <template v-if="Styles.get(style, 'frame') === 'picture'">
                        <div class="prop" :title="T('The frame’s picture: set and frame', 'Картинка рамки: набор и кадр')">picture
                            <select :value="style.picture && style.picture.set" @change="setPictureSet"><option v-for="s in sprites.sets" :value="s.name">{{s.name}}</option></select>
                            <select v-if="style.picture" v-model="style.picture.image"><option v-for="f in (sprites.sets.find(s => s.name === style.picture.set) || {frames: []}).frames" :value="f.image">{{f.image}}</option></select></div>
                        <div class="prop" :title="T('The insets of the picture’s corners left, top, right, bottom (each 1 at least, and the middle a point at least): the packer cuts the picture into nine pictures STYLE_FRAME_0…8; the corners stay as they are, the edges and the middle are repeated', 'Отступы углов картинки слева, сверху, справа, снизу (каждый не меньше 1, и середина не меньше точки): упаковщик режет картинку на девять картинок СТИЛЬ_FRAME_0…8; углы остаются как есть, края и середина повторяются')">insets
                            <input v-for="(v, i) in Styles.get(style, 'insets')" class="num" :value="v" @change="setInts('insets', i, $event, 0, 255)"></div>
                    </template>
                    <div class="prop" :title="T('The frame’s place on the screen: x, y, width, height. x, y below zero: from the right, bottom edge; width, height 0 or less: the screen less so much', 'Место рамки на экране: x, y, ширина, высота. x, y меньше нуля — от правого, нижнего края; ширина, высота 0 и меньше — экран минус столько')">place
                        <input v-for="(v, i) in Styles.get(style, 'place')" class="num" :value="v" @change="setInts('place', i, $event, -32768, 32767)"></div>
                    <div class="prop" :title="T('The field of text inside the frame: padding left, top, right, bottom (the yellow dashes on the preview)', 'Поле текста внутри рамки: отступы слева, сверху, справа, снизу (жёлтый пунктир на показе)')">padding
                        <input v-for="(v, i) in Styles.get(style, 'padding')" class="num" :value="v" @change="setInts('padding', i, $event, 0, 255)"></div>
                    <div class="prop" :title="T('A DGX font by name (as the function in the font’s source: TerminusTTFMedium12). Empty: the game’s first font', 'Шрифт DGX по имени (как функция в исходнике шрифта: TerminusTTFMedium12). Пусто — первый шрифт игры')">font
                        <input v-model="style.font" list="dialog-fonts" size="16"><datalist id="dialog-fonts"><option v-for="n in fontNames" :value="n"></option></datalist></div>
                    <div class="prop" :title="T('The font’s scales: the greatest and the least. The greatest at which the text fits is taken, but not below the least; answers at the least', 'Масштабы шрифта: наибольший и наименьший. Берётся наибольший, при котором текст влезает, но не меньше наименьшего; ответы — при наименьшем')">scale
                        max <input class="num" :value="Styles.get(style, 'scale')[0]" @change="setInts('scale', 0, $event, 0, 255)">
                        min <input class="num" :value="Styles.get(style, 'scale')[1]" @change="setInts('scale', 1, $event, 0, 255)"></div>
                    <label class="prop" :title="T('Lines are important unless the dialog says otherwise: shown whole, scrolled; unimportant ones are cut with “...”', 'Реплики важные, если диалог не скажет иначе: показываются целиком, прокручиваются; неважные обрезаются «...»')"><input type="checkbox" :checked="Styles.get(style, 'important')" @change="style.important = $event.target.checked"> important</label>
                    <div class="prop" :title="T('An important line that does not fit moves a line every so many ms (0: by the button only)', 'Важная реплика, что не влезла, сдвигается на строку каждые столько мс (0 — только кнопкой)')">scrollMs
                        <input class="num" :value="Styles.get(style, 'scrollMs')" @change="setInt('scrollMs', $event, 0, 65535)"></div>
                    <div class="prop" :title="T('A line without its own time goes on after so many ms (0: waits for the button)', 'Реплика без своего времени идёт дальше через столько мс (0 — ждёт кнопку)')">waitMs
                        <input class="num" :value="Styles.get(style, 'waitMs')" @change="setInt('waitMs', $event, 0, 65535)"></div>
                    <div class="prop" :title="T('How a line appears: at once (now) or letter by letter (letters), a letter every letterMs ms; the button while it appears shows it whole. The line’s waiting time runs once it has appeared', 'Как появляется реплика: сразу (now) или по буквам (letters) — буква каждые letterMs мс; кнопка, пока появляется, показывает всю. Время ожидания реплики идёт, когда она появилась')">appear
                        <select :value="Styles.get(style, 'appear')" @change="style.appear = $event.target.value"><option value="now">now</option><option value="letters">letters</option></select>
                        <template v-if="Styles.get(style, 'appear') === 'letters'">letterMs <input class="num" :value="Styles.get(style, 'letterMs')" @change="setInt('letterMs', $event, 0, 255)"></template></div>
                    <div class="prop" :title="T('The portrait of the one speaking (the face of its role in the dialog): in the top corner of its side inside the padding, cut to portraitWidth and to the field’s height; the text and the name next to it', 'Портрет говорящего (face его роли в диалоге): в верхнем углу своей стороны внутри отступов, обрезан по ширине portraitWidth и по высоте поля; текст и имя — рядом с ним')">portrait
                        <select :value="Styles.get(style, 'portrait')" @change="setPortrait($event.target.value)"><option v-for="p in ['none', 'left', 'right']" :value="p">{{p}}</option></select>
                        <template v-if="Styles.get(style, 'portrait') !== 'none'">width <input class="num" :value="Styles.get(style, 'portraitWidth')" @change="setInt('portraitWidth', $event, 0, 255)"></template></div>
                    <div class="prop" :title="T('The pen of a handwritten font (DGX_FONT_HW): hard, a sharp line; soft, a soft one, 15 shades between the fill and text colours. Changes nothing for bitmap fonts', 'Перо рукописного шрифта (DGX_FONT_HW): hard — чёткая линия, soft — мягкая, 15 оттенков между цветами fill и text. У точечных шрифтов ничего не меняет')">pen
                        <select :value="Styles.get(style, 'pen')" @change="style.pen = $event.target.value"><option value="hard">hard</option><option value="soft">soft</option></select></div>
                    <div class="prop" :title="T('Each line of text in its field: left, middle (the rest halved, the odd point on the right), right. By the field’s width rounded up to 8 points, as in the engine; a line appearing has its letters where they will stand. The name and the answers too', 'Каждая строка текста в своём поле: left — слева, middle — посередине (остаток пополам, лишняя точка справа), right — справа. По ширине поля, округлённой вверх до 8 точек, как в движке; появляющаяся строка — буквы там, где будут стоять. Так же имя и ответы')">align
                        <select :value="Styles.get(style, 'align')" @change="style.align = $event.target.value"><option v-for="a in ['left', 'middle', 'right']" :value="a">{{a}}</option></select></div>
                    <label class="prop" :title="T('The name of the one speaking as a line over the text, in the name colour, at the least scale; the field of text gets lower by that line', 'Имя говорящего — строкой над текстом, цветом name, при наименьшем масштабе; поле текста становится ниже на эту строку')"><input type="checkbox" :checked="Styles.get(style, 'showName')" @change="style.showName = $event.target.checked"> showName</label>
                    <div class="prop" :title="T('The width of the frame’s border, points (0: no border)', 'Толщина каймы рамки, точек (0 — без каймы)')">borderWidth
                        <input class="num" :value="Styles.get(style, 'borderWidth')" @change="setInt('borderWidth', $event, 0, 255)"></div>
                    <h6 :title="T('The style’s colours, RGB: the game adds them to the frame’s colours when it loads', 'Цвета стиля, RGB: игра добавляет их к цветам кадра при загрузке')">{{T('Colors', 'Цвета')}}</h6>
                    <div v-for="k in Styles.colorKeys" class="prop" :title="T({fill: 'The frame’s fill', border: 'The frame’s border', text: 'The text', bar: 'The bar under the answer chosen', name: 'The name of the one speaking'}[k], {fill: 'Заливка рамки', border: 'Кайма рамки', text: 'Текст', bar: 'Полоса под выбранным ответом', name: 'Имя говорящего'}[k])">
                        <input type="color" :value="hex(Styles.color(style, k))" @input="setColor(k, $event)"> {{k}}</div>
                    <button class="btn btn-sm btn-remove mt-2" @click="removeStyle">{{T('Delete style', 'Удалить стиль')}}</button>
                </template>
                <div v-else class="help-text">{{T('Choose a style on the left or make one: Styles «+».', 'Выберите стиль слева или создайте: Стили «+».')}}</div>
                <div v-if="message" class="anim-message">{{message}} <button @click="message = ''">x</button></div>
                <HelpPane v-if="edit.helpShown" :topics="['dialogs']"></HelpPane>
            </div>
        </div>
    `
};

// the toolbar of the dialogs mode
const DialogToolbar = {
    mixins: [DialogListsBase],
    computed: {
        screen() {
            return this.sprites.screen;
        },
    },
    template: `
        <div class="mode-toolbar">
            <div class="btn-group btn-group-sm">
                <button class="btn" :class="edit.dialogPage === 'styles' ? 'btn-primary' : 'btn-outline-primary'" @click="edit.dialogPage = 'styles'" :title="T('Styles: how a line and the answers look, on a sample', 'Стили: как выглядят реплика и ответы, на примере')">{{T('Styles', 'Стили')}}</button>
                <button class="btn" :class="edit.dialogPage === 'dialogs' ? 'btn-primary' : 'btn-outline-primary'" @click="edit.dialogPage = 'dialogs'" :title="T('Dialogs: their texts, played in their styles', 'Диалоги: их тексты и проигрывание в их стилях')">{{T('Dialogs', 'Диалоги')}}</button>
            </div>
            <label :title="T('Zoom of the preview', 'Масштаб показа')">{{T('Zoom', 'Масштаб')}} <select v-model.number="edit.dialogZoom"><option v-for="z in [1, 2, 3, 4]" :value="z">{{z}}</option></select></label>
            <span class="help-text" :title="T('The game’s screen: the size set in Scenes', 'Экран игры — размер, что задан у сцен (Сцены)')">{{T('screen', 'экран')}} {{screen.width}}×{{screen.height}}</span>
            <div class="btn-group btn-group-sm" v-if="edit.dialogPage === 'styles'">
                <button class="btn" :class="edit.dialogMode === 'say' ? 'btn-secondary' : 'btn-outline-secondary'" @click="edit.dialogMode = 'say'" :title="T('Show a line', 'Показать реплику')">{{T('Line', 'Реплика')}}</button>
                <button class="btn" :class="edit.dialogMode === 'choose' ? 'btn-secondary' : 'btn-outline-secondary'" @click="edit.dialogMode = 'choose'" :title="T('Show a choice of answers', 'Показать выбор ответа')">{{T('Answers', 'Ответы')}}</button>
            </div>
            <template v-else>
                <label :title="T('The language played: the translation from a .po loaded (the pack gets the language it is built with)', 'Язык проигрывания: перевод из загруженного .po (в пакет идёт язык, с которым его собирают)')">{{T('language', 'язык')}}
                    <select v-model="edit.dialogLanguage" @change="restart"><option value="">msgid</option><option v-for="n in poNames" :value="n">{{n}}</option></select></label>
                <span class="help-text">{{ui.hint}}</span>
            </template>
        </div>
    `
};

// the lists in the tree of the project: dialogs, translations, styles, fonts
const DialogTreePart = {
    mixins: [DialogListsBase],
    props: ['filter', 'counts'],
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
        matches(name) {
            return !this.filter || name.toLowerCase().includes(this.filter);
        },
        openDialog(d) {
            this.edit.page = 'dialogs';
            this.edit.dialogPage = 'dialogs';
            this.edit.dialogName = d.name;
        },
        openStyle(st) {
            this.edit.page = 'dialogs';
            this.edit.dialogPage = 'styles';
            this.edit.dialogStyle = st.name;
        },
        mark(map, name) {
            return Problems.mark(map && map[name]);
        },
    },
    template: `
        <div class="dialog-tree-part">
            <div class="tree-head"><a href="#" @click.prevent="toggle('dialogs')">{{isOpen('dialogs') ? '▾' : '▸'}}</a>
                <b :title="T('Dialogs: texts in the engine’s dialog language (dialog, roles, game, style, pause, say, choose, tell, give, goto, end). In the JSON file, the field dialogs; for the packer they are saved as files dialogs/NAME.dlg', 'Диалоги: тексты на языке диалогов движка (dialog, roles, game, style, pause, say, choose, tell, give, goto, end). В файле разметки — поле dialogs; для упаковщика выгружаются файлами dialogs/ИМЯ.dlg')" @click="edit.page = 'dialogs'; edit.dialogPage = 'dialogs'">{{T('Dialogs', 'Диалоги')}}</b>
                <span class="help-text">{{dialogs.length}}</span>
                <button class="tree-add" @click="edit.page = 'dialogs'; edit.dialogPage = 'dialogs'; addDialog()" :title="T('A new dialog to start from', 'Новый диалог-заготовка')">+</button>
                <input type="file" multiple accept=".dlg" @change="edit.page = 'dialogs'; edit.dialogPage = 'dialogs'; importDialogs($event)" style="display: none" ref="dlg">
                <button class="tree-add" @click="$refs.dlg.click()" :title="T('Load .dlg files', 'Загрузить файлы .dlg')">{{T('Import…', 'Импорт…')}}</button></div>
            <template v-if="isOpen('dialogs')">
                <div v-for="d in dialogs" v-show="matches(d.name)" class="tree-item tree-leaf" :class="{selected: edit.page === 'dialogs' && edit.dialogPage === 'dialogs' && d === dialog}" @click="openDialog(d)">
                    <span class="tree-name">{{d.name}}</span> <span class="anim-mark" :class="{'error-text': mark(counts.byDialog, d.name) === '✖'}">{{mark(counts.byDialog, d.name)}}</span>
                    <button class="tree-add" @click.stop="exportDialog(d)" :title="T('Download dialogs/NAME.dlg: put it into the dialogs folder next to the JSON', 'Скачать dialogs/ИМЯ.dlg — положите в каталог dialogs рядом с JSON')">⭳</button></div>
                <div v-if="!dialogs.length" class="help-text tree-note">{{T('none: «+» or Import', 'нет — «+» или Импорт…')}}</div>
            </template>
            <div class="tree-head"><a href="#" @click.prevent="toggle('styles')">{{isOpen('styles') ? '▾' : '▸'}}</a>
                <b :title="T('Styles of dialogs: how a line and the answers look. A dialog names its style (style talk); a style that is not there is the engine’s default', 'Стили диалогов: как выглядят реплика и ответы. Диалог называет стиль (style talk); стиль, которого нет, — стиль движка по умолчанию')" @click="edit.page = 'dialogs'; edit.dialogPage = 'styles'">{{T('Styles', 'Стили')}}</b>
                <span class="help-text">{{styles.length}}</span>
                <button class="tree-add" @click="edit.page = 'dialogs'; edit.dialogPage = 'styles'; addStyle()" :title="T('A new style with the engine’s default values', 'Новый стиль со значениями движка по умолчанию')">+</button>
                <select class="style-template tree-select" value="" @change="edit.page = 'dialogs'; edit.dialogPage = 'styles'; addStyleFrom($event)" :title="T('A new style from a ready template', 'Новый стиль из готового шаблона')">
                    <option value="">{{T('+ template…', '+ шаблон…')}}</option><option v-for="(t, k) in Styles.templates" :value="k" :title="T(t[0][0], t[0][1])">{{k}} — {{T(t[0][0], t[0][1])}}</option></select></div>
            <template v-if="isOpen('styles')">
                <div v-for="st in styles" v-show="matches(st.name)" class="tree-item tree-leaf" :class="{selected: edit.page === 'dialogs' && edit.dialogPage === 'styles' && st === style}" @click="openStyle(st)">
                    <span class="tree-name">{{st.name}}</span> <span class="anim-mark" :class="{'error-text': mark(counts.byStyle, st.name) === '✖'}">{{mark(counts.byStyle, st.name)}}</span></div>
                <div v-if="!styles.length" class="help-text tree-note">{{T('none: dialogs get the engine’s default style', 'нет — у диалогов стиль движка по умолчанию')}}</div>
            </template>
            <div class="tree-head"><a href="#" @click.prevent="toggle('fonts')">{{isOpen('fonts') ? '▾' : '▸'}}</a>
                <b :title="T('DGX fonts for the preview: C sources (font2c or from DGX). Not in the JSON file; kept in the browser, like the pictures', 'Шрифты DGX для показа: исходник C (font2c или из DGX). В файл разметки не входят, хранятся в браузере, как картинки')">{{T('Fonts', 'Шрифты')}}</b>
                <span class="help-text">{{fontNames.length}}</span>
                <input type="file" multiple accept=".c" @change="loadFonts" style="display: none" ref="fonts">
                <button class="tree-add" @click="$refs.fonts.click()" :title="T('Load DGX fonts: the .c files font2c writes (TerminusTTFMedium12.c…), and handwritten ones (font0ss.c)', 'Загрузить шрифты DGX: файлы .c, что пишет font2c (TerminusTTFMedium12.c…), и рукописные (font0ss.c)')">{{T('Load font .c…', 'Загрузить шрифт .c…')}}</button></div>
            <template v-if="isOpen('fonts')">
                <div v-for="n in fontNames" v-show="matches(n)" class="tree-item tree-leaf"><span class="tree-name">{{n}}</span>
                    <button class="tree-add" @click="removeFont(n)" :title="T('Forget the font', 'Забыть шрифт')">×</button></div>
                <div v-if="!fontNames.length" class="help-text tree-note">{{T('none: without a font the text of dialogs is not seen', 'нет — без шрифта текст диалогов не виден')}}</div>
            </template>
            <div class="tree-head"><a href="#" @click.prevent="toggle('translations')">{{isOpen('translations') ? '▾' : '▸'}}</a>
                <b :title="T('Translations: gettext .po files (msgctxt is the dialog’s name). Not in the JSON file; kept in the browser; the packer takes po/LANGUAGE.po', 'Переводы: файлы gettext .po (msgctxt — имя диалога). В файл разметки не входят, хранятся в браузере; упаковщик берёт po/ЯЗЫК.po')">{{T('Translations', 'Переводы')}}</b>
                <span class="help-text">{{poNames.length}}</span>
                <input type="file" multiple accept=".po" @change="loadPo" style="display: none" ref="po">
                <button class="tree-add" @click="$refs.po.click()" :title="T('Load .po (ru.po…)', 'Загрузить .po (ru.po…)')">{{T('Load .po…', 'Загрузить .po…')}}</button></div>
            <template v-if="isOpen('translations')">
                <div v-for="n in poNames" class="tree-item tree-leaf"><span class="tree-name">{{n}}</span></div>
                <div v-if="!poNames.length" class="help-text tree-note">{{T('none', 'нет')}}</div>
            </template>
            <div v-if="message" class="help-text tree-note">{{message}} <button class="tree-add" @click="message = ''">x</button></div>
        </div>
    `
};

const DialogStatus = {
    mixins: [DialogListsBase],
    computed: {
        prompt() {
            if (this.edit.dialogPage === 'dialogs') {
                if (!this.dialog) return T('No dialogs: in the tree, at Dialogs press «+» or Import…', 'Диалогов нет: в дереве у Диалогов нажмите «+» или Импорт…');
                return T('Dialogs: edit the text below; ▶ start plays it anew, next is the player’s button, ▲ ▼ choose an answer, less / more go to its control.',
                    'Диалоги: правьте текст внизу; ▶ сначала проигрывает заново, next — кнопка игрока, ▲ ▼ — выбор ответа, less / more — контролу.');
            }
            if (!this.style) return T('No styles: in the tree, at Styles press «+» or choose a template.', 'Стилей нет: в дереве у Стилей нажмите «+» или выберите шаблон.');
            return T('Styles: the style’s fields on the right; drag the frame on the preview with the mouse, pull its right and bottom edges to stretch it. A sample line or answers below.',
                'Стили: поля стиля справа; рамку на показе можно тащить мышью, за правый и нижний край — растягивать. Пример реплики или ответов — внизу.');
        },
    },
    template: `
        <div class="bench-status-row">
            <span class="status-prompt">{{prompt}}</span>
            <span class="status-where">{{ui.summary}}</span>
            <span class="status-extra">{{edit.dialogPage === 'dialogs' ? T('dialog: ', 'диалог: ') + (dialog ? dialog.name : '—') : T('style: ', 'стиль: ') + (style ? style.name : '—')}}</span>
        </div>
    `
};
