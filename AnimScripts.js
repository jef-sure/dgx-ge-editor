// Scripts of the animation: the list of them and the steps of the chosen one. A step is the statements before
// a frame and the frame; the statements after the last frame are the tail. A statement is edited as its text
const AnimScripts = {
    data() {
        return {
            filter: '',
            message: '',
            newName: '',
        };
    },
    mounted() {
        AnimUi.scripts = this;
    },
    unmounted() {
        if (AnimUi.scripts === this) AnimUi.scripts = null;
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        set() {
            return this.spritesStore.currentSet;
        },
        animation() {
            return this.set.animation;
        },
        shownScripts() {
            const f = this.filter.trim().toLowerCase();
            return this.animation.scripts.filter(s => !f || s.name.toLowerCase().includes(f));
        },
        script() {
            return this.animation.scripts.find(s => s.name === this.edit.animScript);
        },
        steps() {
            return this.script ? Anim.steps(this.script) : [];
        },
        // problems of each script, for the marks of the list
        problems() {
            const c = Anim.check(this.set, this.spritesStore.sprites.sets);
            let p = {};
            for (const e of c.errors) {
                if (e.kind === 'script') (p[e.name] = p[e.name] || []).push({
                    error: true,
                    text: e.text,
                    line: e.line
                });
            }
            for (const w of c.warnings) {
                if (w.kind === 'script') (p[w.name] = p[w.name] || []).push({
                    error: false,
                    text: w.text,
                    line: w.line
                });
            }
            return p;
        },
        nextScript() {
            const i = this.animation.scripts.indexOf(this.script);
            return i >= 0 && i + 1 < this.animation.scripts.length ? this.animation.scripts[i + 1].name : '';
        },
        targets() {
            let t = this.animation.scripts.map(s => s.name);
            for (const s of this.animation.scripts) {
                for (const l of s.lines)
                    if (l.op === 'label') t.push(l.name);
            }
            return t;
        },
        addable() {
            return ['set', 'add', 'dx', 'dy', 'flip', 'rotate', 'velocity', 'accel', 'path', 'contact', 'hit', 'carry', 'release', 'shoot', 'draw', 'stow', 'keep', 'timer', 'tell', 'press', 'clear', 'appear', 'vanish', 'sense', 'steer', 'signal', 'sound', 'music', 'masks', 'branch', 'hold', 'goto', 'label'];
        },
    },
    methods: {
        selectScript(name) {
            this.edit.animScript = name;
            this.edit.animStep = 0;
        },
        // a new script after the chosen one, named so or 'script'
        addScript(wanted) {
            const name = Anim.freeName(this.animation, (typeof wanted === 'string' ? wanted : this.newName || '').trim() || 'script');
            if (!Anim.isName(name)) {
                this.message = T("A name is letters, digits and '_'", "Имя — буквы, цифры и '_'");
                return;
            }
            const at = this.script ? this.animation.scripts.indexOf(this.script) + 1 : this.animation.scripts.length;
            const image = this.set.frames.length ? this.set.frames[0].image : undefined;
            this.animation.scripts.splice(at, 0, {
                name: name,
                lines: [image !== undefined ? {
                    op: 'frame',
                    image: image,
                    ms: 100
                } : {
                    op: 'frame',
                    number: 0,
                    ms: 100
                }, {
                    op: 'hold'
                }]
            });
            this.newName = '';
            this.selectScript(name);
        },
        renameScript(event) {
            const name = event.target.value.trim();
            if (!this.script || name === this.script.name) return;
            if (!Anim.isName(name) || Anim.freeName(this.animation, name) !== name) {
                this.message = T("'" + name + "' is no name or it is taken", "'" + name + "' — не имя или уже занято");
                event.target.value = this.script.name;
                return;
            }
            Anim.rename(this.animation, this.script.name, name);
            this.edit.animScript = name;
        },
        removeScript() {
            const name = this.script.name;
            const rules = Anim.rulesNaming(this.animation, name).length;
            if (!confirm(T('Remove script ' + name + (rules ? ' and ' + rules + ' rules from it and to it' : '') + '? Gotos to it become errors',
                    'Удалить скрипт ' + name + (rules ? ' и правила из него и в него (' + rules + ')' : '') + '? goto в него станут ошибками'))) return;
            const i = this.animation.scripts.indexOf(this.script);
            Anim.removeScript(this.animation, name);
            const next = this.animation.scripts[Math.min(i, this.animation.scripts.length - 1)];
            this.selectScript(next ? next.name : '');
        },
        // the order of scripts matters: a script that ends goes on into the next one
        moveScript(d) {
            const list = this.animation.scripts;
            const i = list.indexOf(this.script);
            const j = i + d;
            if (i < 0 || j < 0 || j >= list.length) return;
            [list[i], list[j]] = [list[j], list[i]];
        },

        lineText(l) {
            return Anim.statementText(l, this.set);
        },
        // a statement edited as text; an empty text takes it away
        editLine(index, event) {
            const lines = this.script.lines;
            const old = lines[index];
            const text = event.target.value.trim();
            this.message = '';
            if (!text) {
                lines.splice(index, 1);
                return;
            }
            let s;
            try {
                s = Anim.parseStatement(text, Anim.imagesOf(this.set), Anim.contextOf(this.animation));
            } catch (e) {
                this.message = text + ': ' + e.message;
                event.target.value = this.lineText(old);
                return;
            }
            if (s.op === 'frame' && old.op !== 'frame' || s.op !== 'frame' && old.op === 'frame') {
                this.message = T('A frame is changed in its own fields, a step is added with “+ step”', 'Кадр меняется в своих полях, шаг добавляется кнопкой «+ шаг»');
                event.target.value = this.lineText(old);
                return;
            }
            // a label renamed takes its gotos with it
            if (old.op === 'label' && s.op === 'label' && old.name !== s.name) {
                if (Anim.freeName(this.animation, s.name) !== s.name) {
                    this.message = T("'" + s.name + "' is taken", "'" + s.name + "' уже занято");
                    event.target.value = this.lineText(old);
                    return;
                }
                Anim.rename(this.animation, old.name, s.name);
                return;
            }
            lines.splice(index, 1, s);
        },
        // a statement put before the frame of a step, or at the end of the tail
        addLine(step, event) {
            const op = event.target.value;
            event.target.value = '';
            if (!op) return;
            let s = {
                op: op
            };
            if (['dx', 'dy', 'signal', 'sound'].includes(op)) s.value = 0;
            if (op === 'set' || op === 'add') {
                if (!this.animation.params.length) {
                    this.message = T('Declare a param first: Params, at the top', 'Сначала объявите параметр: Параметры, вверху');
                    return;
                }
                s.param = this.animation.params[0].name;
                s.value = op === 'add' ? 1 : 0;
            }
            if (op === 'velocity' || op === 'accel') {
                s.x = 0;
                s.y = 0;
            }
            if (op === 'contact') s.on = true;
            if (op === 'rotate') s.value = 90;
            if (op === 'music') {
                // the first music of the document, else silence
                const music = this.spritesStore.sprites.music || [];
                s.name = music.length ? music[0] : 'stop';
                s.ms = 0;
            }
            if (op === 'tell') {
                s.target = 'holder';
                s.event = this.animation.events[0] || 'told';
            }
            if (op === 'timer') {
                s.action = 'start';
                s.name = 'clock';
            }
            if (op === 'draw' || op === 'shoot') {
                // the first other set: its animation is a kind of shot
                const other = this.spritesStore.sprites.sets.find(o => o !== this.set);
                s.kind = other ? Anim.packName('', other.name).slice(1) : 0;
            }
            if (op === 'release' || op === 'shoot') {
                s.x = 0;
                s.y = 0;
            }
            if (op === 'carry' || op === 'release' || op === 'shoot' || op === 'draw' || op === 'stow') {
                // a point the frames of the set have, hand if none
                const names = new Set();
                for (const f of this.set.frames)
                    for (const n in f.points || {}) names.add(n);
                s.point = names.size ? [...names][0] : 'hand';
            }
            // a mask by its name in the pack where it has one (masks BODY), else its index
            const all = this.spritesStore.sprites.masks;
            const maskWord = i => {
                const w = Meets.word(i, all);
                return /^[0-9]+$/.test(w) ? i : w;
            };
            if (op === 'hit') {
                const masks = all.map(m => m.index);
                s.mask = maskWord(masks.length ? masks[masks.length - 1] : 0);
                s.on = [maskWord(masks.length ? masks[0] : 0)];
            }
            if (op === 'path') {
                s.x = '40*t';
                s.y = '0';
            }
            if (op === 'press' || op === 'clear') s.cell = 0;
            if (op === 'appear' || op === 'sense' || op === 'steer') {
                // the statement as its text would give it: every field the text and the checks read is there
                const other = this.spritesStore.sprites.sets.find(o => o !== this.set);
                const kind = other ? Anim.packName('', other.name).slice(1) : 0;
                const event = this.animation.events[0] || 'appeared';
                const text = op === 'appear' ? 'appear ' + kind + ', ' + event + ', 0, 0' :
                    op === 'sense' ? 'sense any within 32 into ' + (this.animation.params.length ? this.animation.params[0].name : '_') :
                    'steer seek 1, 1 to 0, 0';
                try {
                    s = Anim.parseStatement(text, Anim.imagesOf(this.set), Anim.contextOf(this.animation));
                } catch (e) {
                    this.message = text + ': ' + e.message;
                    return;
                }
            }
            if (op === 'masks') s.indexes = all.map(m => maskWord(m.index));
            if (op === 'goto') s.target = this.nextScript || this.script.name;
            if (op === 'label') s.name = Anim.freeName(this.animation, this.script.name + '_label');
            const at = step.frame >= 0 ? step.frame : step.end;
            this.script.lines.splice(at, 0, s);
        },
        // the end of a script that goes on into the next one
        endWith(op) {
            this.script.lines.push(op === 'hold' ? {
                op: 'hold'
            } : {
                op: 'goto',
                target: this.script.name
            });
        },

        selectStep(k) {
            this.edit.animStep = k;
        },
        frameOf(step) {
            return step.frame >= 0 ? this.script.lines[step.frame] : null;
        },
        // the frame of the set a frame statement shows, for its small picture
        thumbFrame(l) {
            if (l.image !== undefined) return this.set.frames.find(f => f.image === l.image) || null;
            if (l.number !== undefined && this.edit.playNumbers) return this.set.frames[l.number - 1] || null;
            return null;
        },
        pictureKind(l) {
            return l.none ? 'none' : l.image !== undefined ? 'i:' + l.image : l.number !== undefined ? 'number' : 'name';
        },
        setPicture(l, event) {
            const v = event.target.value;
            delete l.image;
            delete l.number;
            delete l.name;
            delete l.none;
            if (v === 'none') l.none = true;
            else if (v.startsWith('i:')) l.image = v.slice(2);
            else if (v === 'number') l.number = 0;
            else l.name = 'PICTURE';
        },
        setNumber(l, key, event, low, high) {
            const v = Anim.number(event.target.value);
            if (v === null || v < low || v > high) {
                this.message = event.target.value + T(' is not within ', ' — не в пределах ') + low + '..' + high;
                event.target.value = key === 'ms' ? l.ms : l.number;
                return;
            }
            l[key] = v;
        },
        // the time of a frame: a number, an expression of numbers and defines, or of the actor (worked out as the
        // frame begins); its unit ms may be written or not
        setMs(l, event) {
            try {
                l.ms = Anim.frameTime(event.target.value, Anim.contextOf(this.animation));
                this.message = '';
            } catch (e) {
                this.message = event.target.value + ': ' + e.message;
                event.target.value = l.ms;
            }
        },
        setName(l, event) {
            const v = event.target.value.trim();
            if (Anim.isName(v) && !/^\d+$/.test(v)) l.name = v;
            else event.target.value = l.name;
        },
        // the picture moved from the actor; empty fields take the shift away
        setAt(l, key, event) {
            const text = event.target.value.trim();
            if (!text) {
                if (!l.at) return;
                const other = key === 'x' ? 'y' : 'x';
                if (!l.at[other]) delete l.at;
                else l.at[key] = 0;
                return;
            }
            let v;
            try {
                v = Anim.operand(text, Anim.contextOf(this.animation), -128, 127, 'const');
            } catch (e) {
                this.message = text + ': ' + e.message;
                event.target.value = l.at ? l.at[key] : '';
                return;
            }
            if (!l.at) l.at = {
                x: 0,
                y: 0
            };
            l.at[key] = v;
        },

        newFrame() {
            const cur = this.steps[this.edit.animStep];
            const f = cur && cur.frame >= 0 ? this.script.lines[cur.frame] : null;
            if (f) return JSON.parse(JSON.stringify(f));
            return this.set.frames.length ? {
                op: 'frame',
                image: this.set.frames[0].image,
                ms: 100
            } : {
                op: 'frame',
                number: 0,
                ms: 100
            };
        },
        // a new step after the chosen one, with its frame
        addStep() {
            const k = Math.min(this.edit.animStep, this.steps.length - 1);
            const step = this.steps[k];
            const at = step && step.frame >= 0 ? step.end : step ? step.start : 0;
            this.script.lines.splice(at, 0, this.newFrame());
            this.edit.animStep = step && step.frame >= 0 ? k + 1 : k;
        },
        copyStep(k) {
            const step = this.steps[k];
            // labels are names, a copy goes without them
            const copy = this.script.lines.slice(step.start, step.end).filter(l => l.op !== 'label').map(l => JSON.parse(JSON.stringify(l)));
            this.script.lines.splice(step.end, 0, ...copy);
            this.edit.animStep = k + 1;
        },
        removeStep(k) {
            const step = this.steps[k];
            const lines = this.script.lines.slice(step.start, step.end);
            if (lines.some(l => l.op === 'label') && !confirm(T('The step has a label, gotos to it become errors. Remove it?', 'У шага есть label, goto на неё станут ошибками. Удалить шаг?'))) return;
            this.script.lines.splice(step.start, step.end - step.start);
            this.edit.animStep = Math.max(0, Math.min(k, Anim.steps(this.script).length - 1));
        },
        // steps with frames change places; the tail stays the last
        moveStep(k, d) {
            const a = this.steps[k],
                b = this.steps[k + d];
            if (!a || !b || a.frame < 0 || b.frame < 0) return;
            const [first, second] = d < 0 ? [b, a] : [a, b];
            const lines = this.script.lines;
            const one = lines.slice(first.start, first.end);
            const two = lines.slice(second.start, second.end);
            lines.splice(first.start, second.end - first.start, ...two, ...one);
            this.edit.animStep = k + d;
        },
        stepProblems(step) {
            return (this.problems[this.script.name] || []).filter(p => p.line !== null && p.line >= step.start && p.line < step.end);
        },
        scriptProblems() {
            return (this.problems[this.script.name] || []).filter(p => p.line === null);
        },
        mark(name) {
            const p = this.problems[name];
            if (!p) return '';
            return p.some(x => x.error) ? '✖' : '⚠';
        },
        markTitle(name) {
            return (this.problems[name] || []).map(p => p.text).join('\n');
        },
    },
    template: `
        <div class="anim-scripts">
            <div class="anim-script" v-if="script">
                <div class="anim-script-head">
                    <input :value="script.name" @change="renameScript" size="16" class="anim-script-name" :title="T('The name; gotos and rules follow it', 'Имя; goto и правила следуют за ним')">
                    <button class="btn btn-sm btn-outline-secondary" @click="moveScript(-1)" :title="T('Earlier in the text', 'Раньше в тексте')">↑</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="moveScript(1)" :title="T('Later in the text', 'Позже в тексте')">↓</button>
                    <button class="btn btn-sm btn-remove" @click="removeScript" :title="T('Remove the script', 'Удалить скрипт')">x</button>
                    <button class="btn btn-sm btn-outline-primary" @click="addStep" :title="T('A step with a frame after the chosen step', 'Шаг с кадром после выбранного шага')">{{T('+ step', '+ шаг')}}</button>
                    <label :title="T('The game itself starts this script (from its code), not rules and goto: the warning «nothing leads to it» keeps quiet. In the .anim text, the comment entry', 'Этот скрипт запускает сама игра (из своего кода), а не правила и goto: предупреждение «никто не ведёт в него» молчит. В тексте .anim — комментарий entry')"><input type="checkbox" :checked="!!script.entry" @change="$event.target.checked ? script.entry = true : delete script.entry"> entry</label>
                    <label :title="T('The script goes on into the next one in the text on purpose (no goto or hold at the end): the warning keeps quiet. In the .anim text, the comment through', 'Скрипт нарочно переходит в следующий по тексту (без goto или hold в конце): предупреждение молчит. В тексте .anim — комментарий through')"><input type="checkbox" :checked="!!script.through" @change="$event.target.checked ? script.through = true : delete script.through"> through</label>
                </div>
                <div v-for="p in scriptProblems()" :class="p.error ? 'error-text' : 'warning-text'">{{p.error ? '✖' : '⚠'}} {{p.text}}
                    <template v-if="p.text.startsWith('goes on') || p.text.startsWith('the last script')">
                        <button class="btn btn-sm btn-outline-secondary" @click="endWith('hold')">+ hold</button>
                        <button class="btn btn-sm btn-outline-secondary" @click="endWith('goto')">+ goto</button>
                    </template>
                </div>
                <div v-if="message" class="error-text">{{message}} <button @click="message = ''">x</button></div>
                <datalist id="anim-targets"><option v-for="t in targets" :value="'goto ' + t"></option></datalist>
                <div class="anim-steps">
                    <div v-for="(step, k) in steps" :key="script.name + ':' + k + ':' + step.start" class="anim-step"
                        :class="{current: k === edit.animStep, tail: step.frame < 0}" @click="selectStep(k)">
                        <div class="anim-step-head">
                            <span>{{step.frame >= 0 ? k + 1 : T('end', 'конец')}}</span>
                            <span v-if="step.frame >= 0" class="anim-step-buttons">
                                <button @click.stop="moveStep(k, -1)" :title="T('Earlier', 'Раньше')">←</button>
                                <button @click.stop="moveStep(k, 1)" :title="T('Later', 'Позже')">→</button>
                                <button @click.stop="copyStep(k)" :title="T('A copy after it', 'Копия после него')">⧉</button>
                                <button @click.stop="removeStep(k)" :title="T('Remove the step', 'Удалить шаг')">×</button>
                            </span>
                        </div>
                        <div class="anim-lines">
                            <template v-for="i in (step.frame >= 0 ? step.frame : step.end) - step.start">
                                <input class="anim-line" :class="'op-' + script.lines[step.start + i - 1].op" :value="lineText(script.lines[step.start + i - 1])"
                                    :style="{width: 'calc(' + Math.max(4, lineText(script.lines[step.start + i - 1]).length + 1) + 'ch + 20px)'}" list="anim-targets"
                                    @change="editLine(step.start + i - 1, $event)" @click.stop
                                    :title="opHelp(script.lines[step.start + i - 1].op) + T('. Edit the text and press Enter; erase it and the statement is removed', '. Поправьте текст и нажмите Enter; сотрите — команда удалится')">
                            </template>
                            <select class="anim-add-cmd" @change="addLine(step, $event)" @click.stop :title="T('Add a statement before the frame of the step', 'Добавить команду перед кадром шага')">
                                <option value="">{{T('+ statement', '+ команда')}}</option>
                                <option v-for="op in addable" :value="op">{{op}} — {{opHelp(op)}}</option>
                            </select>
                        </div>
                        <div v-if="step.frame >= 0" class="anim-frame">
                            <div class="anim-thumb">
                                <FrameThumb v-if="thumbFrame(frameOf(step))" :set-name="set.name" :frame="thumbFrame(frameOf(step))" :scale="1"></FrameThumb>
                                <span v-else class="anim-nopic">{{frameOf(step).none ? 'none' : frameOf(step).number !== undefined ? '#' + frameOf(step).number : frameOf(step).name}}</span>
                            </div>
                            <select :value="pictureKind(frameOf(step))" @change="setPicture(frameOf(step), $event)" @click.stop class="anim-picture">
                                <option v-for="f in set.frames" :value="'i:' + f.image">{{f.image}}</option>
                                <option value="number">{{T('number…', 'номер…')}}</option>
                                <option value="name">{{T('pack name…', 'имя в пакете…')}}</option>
                                <option value="none" :title="T('Show nothing for this time: the actor is hidden (picture -1 in the engine)', 'Ничего не показывать это время: персонаж спрятан (картинка -1 в движке)')">none</option>
                            </select>
                            <input v-if="frameOf(step).number !== undefined" class="coord" :value="frameOf(step).number" @change="setNumber(frameOf(step), 'number', $event, 0, 65535)" @click.stop :title="T('The number the game draws by', 'Номер, по которому рисует игра')">
                            <input v-if="frameOf(step).name !== undefined" :value="frameOf(step).name" size="10" @change="setName(frameOf(step), $event)" @click.stop :title="T('A picture of the pack', 'Картинка пакета')">
                            <div class="anim-frame-field" :title="T('How many milliseconds to show the frame: a number or an expression of numbers and defines (for example, tick), or of params and what the actor is (speed, game_var.pace): then worked out as the frame begins, below 1 it is 1 ms, above 65535 it is 65535', 'Сколько миллисекунд показывать кадр: число или выражение из чисел и define (например, tick), или из параметров и того, что есть у персонажа (speed, game_var.pace): тогда считается в начале кадра, меньше 1 — 1 мс, больше 65535 — 65535')">
                                {{T('time', 'время')}} <input class="anim-expr" :value="frameOf(step).ms" @change="setMs(frameOf(step), $event)" @click.stop> ms
                            </div>
                            <div class="anim-frame-field" :title="T('The shift of the picture from the place of the actor, pixels (at in the .anim text): x forward, y down (up is below zero). Empty: no shift', 'Сдвиг картинки от места персонажа, пикселей (at в тексте .anim): x — вперёд, y — вниз (вверх — меньше нуля). Пусто — без сдвига')">
                                {{T('shift', 'сдвиг')}} x <input class="anim-expr anim-at" :value="frameOf(step).at ? frameOf(step).at.x : ''" placeholder="0" @change="setAt(frameOf(step), 'x', $event)" @click.stop>
                                y <input class="anim-expr anim-at" :value="frameOf(step).at ? frameOf(step).at.y : ''" placeholder="0" @change="setAt(frameOf(step), 'y', $event)" @click.stop>
                            </div>
                        </div>
                        <div v-for="p in stepProblems(step)" :class="p.error ? 'error-text' : 'warning-text'" class="anim-step-problem">{{p.error ? '✖' : '⚠'}} {{p.text}}</div>
                    </div>
                </div>
            </div>
            <div v-else class="anim-empty">{{T('No scripts yet: «+ script» at the top, or Import .anim.', 'Скриптов пока нет: «+ скрипт» сверху, или «Импорт .anim…».')}}</div>
        </div>
    `
};
