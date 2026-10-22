// The state machine of the actor: states are scripts, transitions are events. The rules fill the matrix
// "script x event"; their order means nothing, and two rules that answer one transition otherwise are a conflict.
// The views: a state and its exits (the main one, where transitions are edited), the graph, groups, an event,
// the list of rules, the whole matrix, the checks

// shared by the views: the animation of the current set, its matrix, links between the views
const AnimRulesBase = {
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
        matrix() {
            return Anim.matrix(this.animation);
        },
        scriptNames() {
            return this.animation.scripts.map(s => s.name);
        },
    },
    methods: {
        ruleText(i) {
            const r = this.animation.rules[i];
            return r ? Anim.ruleText(r) : '';
        },
        isGroup(name) {
            return this.animation.groups.some(g => g.name === name);
        },
        // a state opens with its steps in the middle and its transitions on the right
        openState(name) {
            this.edit.animScript = name;
            this.edit.animStep = 0;
            this.spritesStore.openAnimTab('state');
        },
        openGroup(name) {
            this.edit.animGroup = name;
            this.spritesStore.openAnimTab('groups');
        },
        openEvent(name) {
            this.edit.animEvent = name;
            this.spritesStore.openAnimTab('byEvent');
        },
        // the rule's source as a link: a group or the script itself
        openSource(name) {
            if (this.isGroup(name)) this.openGroup(name);
            else this.openState(name);
        },
        whenMark(when) {
            return when === 'now' ? '' : when === 'branch' ? ' ⑂' : ' ⏹';
        },
        groupsOf(script) {
            return this.animation.groups.filter(g => g.scripts.includes(script));
        },
        // what joining a group would give a script: new transitions and conflicts
        joinPreview(group, script) {
            const before = this.matrix[script] || {};
            const after = Anim.matrixWith(this.animation, {
                group: group,
                script: script
            })[script] || {};
            let gives = [],
                conflicts = [];
            for (const e in after) {
                const c = after[e];
                if (c.conflict && !(before[e] && before[e].conflict)) conflicts.push(e + ': ' + [c, ...c.conflict].map(x => x.to + ' ' + x.when).join(T(' or ', ' или ')));
                else if (!before[e]) gives.push(e + ' → ' + c.to + ' ' + c.when);
            }
            return {
                gives: gives,
                conflicts: conflicts
            };
        },
        removeRule(i) {
            this.animation.rules.splice(i, 1);
        },
    },
};

// a state and its exits: every event, where it leads and when, by the script itself or by a group.
// Events the state does not answer are in the same list, so a forgotten one is seen
const AnimState = {
    mixins: [AnimRulesBase],
    data() {
        return {
            joining: '',
        };
    },
    computed: {
        script: {
            get() {
                return this.edit.animScript;
            },
            set(s) {
                this.edit.animScript = s;
                this.edit.animStep = 0;
            },
        },
        row() {
            return this.matrix[this.script] || {};
        },
        answered() {
            return this.animation.events.filter(e => this.row[e]).length;
        },
        groups() {
            return this.groupsOf(this.script);
        },
        otherGroups() {
            return this.animation.groups.filter(g => !g.scripts.includes(this.script));
        },
        preview() {
            return this.joining ? this.joinPreview(this.joining, this.script) : null;
        },
        // where the state goes by itself: gotos to scripts, the code of the next one, hold
        ownWays() {
            const s = this.animation.scripts.find(s => s.name === this.script);
            if (!s) return [];
            let ways = [...new Set(s.lines.filter(l => l.op === 'goto' && this.scriptNames.includes(l.target)).map(l => l.target))].map(t => ({
                text: 'goto',
                to: t
            }));
            const i = this.animation.scripts.indexOf(s);
            if (Anim.fallsThrough(s) && i + 1 < this.animation.scripts.length) ways.push({
                text: T('runs into the code of', 'переходит в код'),
                to: this.animation.scripts[i + 1].name
            });
            if (s.lines.some(l => l.op === 'hold')) ways.push({
                text: 'hold',
                to: ''
            });
            return ways;
        },
        // transitions and gotos that lead here
        incoming() {
            let from = {};
            for (const s in this.matrix) {
                for (const e in this.matrix[s]) {
                    if (this.matrix[s][e].to === this.script) (from[s] = from[s] || []).push(e);
                }
            }
            return from;
        },
        gotosHere() {
            return this.animation.scripts.filter(s => s.lines.some(l => l.op === 'goto' && l.target === this.script)).map(s => s.name);
        },
    },
    methods: {
        cell(e) {
            return this.row[e];
        },
        // the rule a cell is edited by: the script's own one when it has it
        // the rule a change of the cell goes to: the state's own one, among the answers in conflict too
        ruleOf(c) {
            const all = [...c.rules, ...(c.conflict || []).flatMap(x => x.rules)];
            const own = all.find(i => this.animation.rules[i].source === this.script);
            return own !== undefined ? own : c.rules[0];
        },
        // how far a change of the rule goes
        reach(i) {
            const r = this.animation.rules[i];
            if (r.source === this.script) return T('this state', 'это состояние');
            const g = this.animation.groups.find(g => g.name === r.source);
            return T('group ' + r.source + ' (' + (g ? g.scripts.length : 0) + ' states)', 'группа ' + r.source + ' (состояний: ' + (g ? g.scripts.length : 0) + ')');
        },
        setTo(e, event) {
            const c = this.row[e];
            const to = event.target.value;
            if (!c) {
                if (to) this.animation.rules.push({
                    event: e,
                    source: this.script,
                    to: to,
                    when: 'now'
                });
                return;
            }
            const i = this.ruleOf(c);
            const r = this.animation.rules[i];
            if (r.source !== this.script && !confirm(T('The transition is given by group ' + r.source + ': change it for all its states?', 'Переход даёт группа ' + r.source + ': изменить его для всех её состояний?'))) {
                event.target.value = c.to;
                return;
            }
            r.to = to;
        },
        setWhen(e, event) {
            const c = this.row[e];
            const i = this.ruleOf(c);
            const r = this.animation.rules[i];
            if (r.source !== this.script && !confirm(T('The transition is given by group ' + r.source + ': change it for all its states?', 'Переход даёт группа ' + r.source + ': изменить его для всех её состояний?'))) {
                event.target.value = c.when;
                return;
            }
            r.when = event.target.value;
        },
        // the rules of the state itself go; a group's rule goes for all its states
        remove(e) {
            const c = this.row[e];
            const all = [...c.rules, ...(c.conflict || []).flatMap(x => x.rules)];
            const own = all.filter(i => this.animation.rules[i].source === this.script);
            const others = all.filter(i => this.animation.rules[i].source !== this.script);
            const by = others.map(i => this.animation.rules[i].source).join(', ');
            if (others.length && !confirm(T('The transition is given by ' + by + ': remove those rules for all their states?',
                    'Переход дают ' + by + ': удалить эти правила для всех их состояний?'))) return;
            for (const i of [...own, ...others].sort((x, y) => y - x)) this.animation.rules.splice(i, 1);
        },
        removeOne(i) {
            this.animation.rules.splice(i, 1);
        },
        join() {
            const g = this.animation.groups.find(g => g.name === this.joining);
            if (g && !g.scripts.includes(this.script)) g.scripts.push(this.script);
            this.joining = '';
        },
        leave(g) {
            g.scripts = g.scripts.filter(s => s !== this.script);
        },
    },
    template: `
        <div class="anim-state-view">
            <div class="view-toolbar">
                <label>{{T('State', 'Состояние')}} <select v-model="script"><option v-for="s in scriptNames" :value="s">{{s}}</option></select></label>
                <span class="help-text">{{T('answers ' + answered + ' of ' + animation.events.length + ' events', 'отвечает на ' + answered + ' из ' + animation.events.length + ' событий')}}</span>
                <a href="#" @click.prevent="spritesStore.openAnimTab('scripts')" :title="T('The steps of this script, in the middle', 'Шаги этого скрипта — в середине')">{{T('its steps', 'его шаги')}}</a>
                <a href="#" @click.prevent="spritesStore.openAnimTab('graph')" :title="T('The graph of transitions around this state', 'Граф переходов вокруг этого состояния')">{{T('in the graph', 'на графе')}}</a>
            </div>
            <div class="anim-state-groups">
                <b>{{T('Groups:', 'Группы:')}}</b>
                <span v-for="g in groups" class="anim-member"><a href="#" @click.prevent="openGroup(g.name)">{{g.name}}</a>
                    <button @click="leave(g)" :title="T('Out of the group', 'Выйти из группы')">×</button></span>
                <span v-if="!groups.length" class="help-text">{{T('none', 'нет')}}</span>
                <select v-model="joining" class="anim-add-wide" :title="T('Into a group: first see what it gives', 'В группу: сначала видно, что она даст')"><option value="">{{T('+ group', '+ группа')}}</option>
                    <option v-for="g in otherGroups" :value="g.name">{{g.name}}</option></select>
                <span v-if="preview" class="anim-preview-box">
                    {{T('Joining ' + joining + ' gives:', 'Вход в ' + joining + ' даст:')}} {{preview.gives.length ? preview.gives.join(', ') : T('nothing new', 'ничего нового')}}
                    <span v-if="preview.conflicts.length" class="error-text">; {{T('conflicts:', 'конфликты:')}} {{preview.conflicts.join(', ')}}</span>
                    <button class="btn btn-sm btn-outline-primary" @click="join">{{T('Join', 'Войти')}}</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="joining = ''">{{T('Cancel', 'Отмена')}}</button>
                </span>
            </div>
            <table class="table table-sm anim-view-table anim-exits">
                <thead><tr><th>{{T('event', 'событие')}}</th><th>{{T('to', 'куда')}}</th><th>{{T('when', 'когда')}}</th><th>{{T('given by', 'кем дан')}}</th><th></th></tr></thead>
                <tbody>
                    <tr v-for="e in animation.events" :key="e" :class="{'exit-none': !cell(e), 'exit-conflict': cell(e) && cell(e).conflict}">
                        <td><a href="#" @click.prevent="openEvent(e)">{{e}}</a></td>
                        <template v-if="cell(e)">
                            <td><select :value="cell(e).to" @change="setTo(e, $event)"><option v-for="s in scriptNames" :value="s">{{s}}</option></select></td>
                            <td><select :value="cell(e).when" @change="setWhen(e, $event)"><option v-for="w in ['now', 'branch', 'end']" :value="w">{{w}}</option></select></td>
                            <td>
                                <span v-for="i in cell(e).rules" class="anim-source">
                                    <a href="#" @click.prevent="openSource(animation.rules[i].source)">{{animation.rules[i].source === script ? T('itself', 'сам') : T('group ', 'группа ') + animation.rules[i].source}}</a>
                                </span>
                                <div v-for="x in cell(e).conflict || []" class="error-text">
                                    {{T('conflict:', 'конфликт:')}} → {{x.to}} {{x.when}} {{T('by', 'от')}}
                                    <span v-for="i in x.rules" class="anim-source"><a href="#" @click.prevent="openSource(animation.rules[i].source)">{{animation.rules[i].source === script ? T('itself', 'сам') : T('group ', 'группа ') + animation.rules[i].source}}</a>
                                        <button @click="removeOne(i)" :title="T('Remove ', 'Удалить ') + ruleText(i)">×</button></span>
                                </div>
                            </td>
                            <td><button class="btn btn-sm btn-remove" @click="remove(e)" :title="T('Remove: ', 'Удалить: ') + reach(ruleOf(cell(e)))">×</button></td>
                        </template>
                        <template v-else>
                            <td colspan="3">
                                <span class="exit-none-text">{{T('does nothing', 'ничего не делает')}}</span>
                                <select @change="setTo(e, $event)" class="anim-add-exit"><option value="">{{T('+ to…', '+ куда…')}}</option><option v-for="s in scriptNames" :value="s">{{s}}</option></select>
                            </td>
                            <td></td>
                        </template>
                    </tr>
                </tbody>
            </table>
            <div v-if="!animation.events.length" class="anim-empty">{{T('No events yet: add them in «Rules».', 'Событий пока нет: добавьте их в «Правилах».')}}</div>
            <div><b>{{T('By itself:', 'Сам:')}}</b>
                <span v-for="w in ownWays" class="anim-chip-link">{{w.text}} <a v-if="w.to" href="#" @click.prevent="openState(w.to)">{{w.to}}</a></span>
                <span v-if="!ownWays.length" class="help-text">{{T('nothing', 'ничего')}}</span>
            </div>
            <div><b>{{T('Comes here:', 'Сюда ведут:')}}</b>
                <span v-if="!Object.keys(incoming).length && !gotosHere.length" class="warning-text">{{T('from nowhere: no transition and no goto', 'ниоткуда: ни перехода, ни goto')}}</span>
                <span v-for="s in gotosHere" class="anim-chip-link">goto {{T('from', 'из')}} <a href="#" @click.prevent="openState(s)">{{s}}</a></span>
                <span v-for="(events, s) in incoming" class="anim-chip-link"><a href="#" @click.prevent="openState(s)">{{s}}</a> {{T('on', 'по')}} {{events.join(', ')}}</span>
            </div>
        </div>
    `
};

// states and transitions as a graph: a state with its neighbours, or a group. Arrows of events are signed with
// the event and when; dashed arrows are the script's own gotos and runs into the next one.
// A drag from a node to another adds a transition
const AnimGraph = {
    mixins: [AnimRulesBase],
    data() {
        return {
            width: 900,
            dragFrom: null,
            dragAt: null,
            newEdge: null, // {from, to, event, when}
        };
    },
    computed: {
        mode: {
            get() {
                return this.edit.graphMode;
            },
            set(m) {
                this.edit.graphMode = m;
            },
        },
        center() {
            return this.mode === 'group' ? this.edit.animGroup : this.edit.animScript;
        },
        // all nodes and edges of the machine; group rules from a node of the group when groups are nodes
        whole() {
            const a = this.animation;
            let edges = {};
            const add = (from, to, label, kind) => {
                const k = from + '>' + to + '>' + kind;
                if (!edges[k]) edges[k] = {
                    from: from,
                    to: to,
                    kind: kind,
                    labels: []
                };
                if (label && !edges[k].labels.includes(label)) edges[k].labels.push(label);
            };
            const scripts = new Set(this.scriptNames);
            for (const r of a.rules) {
                if (!scripts.has(r.to) || !a.events.includes(r.event)) continue;
                const label = r.event + this.whenMark(r.when);
                if (this.isGroup(r.source) && this.edit.graphGroups) add('g:' + r.source, r.to, label, 'rule');
                else
                    for (const row of Anim.sourceRows(a, r.source) || []) add(row, r.to, label, 'rule');
            }
            if (this.edit.graphGotos) {
                a.scripts.forEach((s, i) => {
                    for (const l of s.lines)
                        if (l.op === 'goto' && scripts.has(l.target) && l.target !== s.name) add(s.name, l.target, '', 'own');
                    if (Anim.fallsThrough(s) && i + 1 < a.scripts.length) add(s.name, a.scripts[i + 1].name, T('next', 'дальше'), 'own');
                });
            }
            if (this.edit.graphGroups) {
                for (const g of a.groups)
                    for (const s of g.scripts) add(s, 'g:' + g.name, '', 'member');
            }
            return Object.values(edges);
        },
        // the nodes shown and the edges between them
        shown() {
            const edges = this.whole;
            let nodes = new Set();
            if (this.mode === 'group') {
                const g = this.animation.groups.find(g => g.name === this.center);
                if (g) {
                    for (const s of g.scripts) nodes.add(s);
                    if (this.edit.graphGroups) nodes.add('g:' + g.name);
                    // where the group and its states go
                    for (const e of edges) {
                        if (e.kind !== 'member' && nodes.has(e.from)) nodes.add(e.to);
                    }
                }
            } else if (this.center) {
                nodes.add(this.center);
                // the groups of the state are a part of it: their transitions are its exits
                for (const e of edges)
                    if (e.kind === 'member' && e.from === this.center) nodes.add(e.to);
                for (let d = 0; d < this.edit.graphDepth; ++d) {
                    const now = [...nodes];
                    for (const e of edges) {
                        // a big group is a neighbour by its membership, its states are not
                        if (e.kind === 'member') {
                            if (now.includes(e.from)) nodes.add(e.to);
                            continue;
                        }
                        if (now.includes(e.from)) nodes.add(e.to);
                        if (now.includes(e.to)) nodes.add(e.from);
                    }
                }
            }
            // a graph of more states is not read anyway
            let list = [...nodes];
            const hidden = Math.max(0, list.length - 60);
            if (list.length > 60) list = list.filter(n => n === this.center || n === 'g:' + this.center).concat(list.filter(n => n !== this.center && n !== 'g:' + this.center).slice(0, 59));
            nodes = new Set(list);
            return {
                hidden: hidden,
                nodes: list,
                edges: edges.filter(e => nodes.has(e.from) && nodes.has(e.to) && (e.kind !== 'member' || e.from === this.center || this.mode === 'group'))
            };
        },
        // the center in the middle; what it leads to (by itself or by its groups) on the right, what leads to it on
        // the left, groups on top. Sides are columns, two of them when there are many states
        sides() {
            const {
                nodes,
                edges
            } = this.shown;
            const middle = nodes.find(n => n === this.center || n === 'g:' + this.center);
            const mine = new Set([middle, ...edges.filter(e => e.kind === 'member' && e.from === middle).map(e => e.to)]);
            const out = new Set(edges.filter(e => mine.has(e.from) && e.kind !== 'member').map(e => e.to));
            const groups = nodes.filter(n => n !== middle && n.startsWith('g:'));
            return {
                middle: middle,
                groups: groups,
                right: nodes.filter(n => n !== middle && !groups.includes(n) && out.has(n)),
                left: nodes.filter(n => n !== middle && !groups.includes(n) && !out.has(n)),
            };
        },
        height() {
            const n = Math.max(this.sides.left.length, this.sides.right.length);
            return Math.max(420, Math.ceil(n / (n > 14 ? 2 : 1)) * 30 + 90);
        },
        layout() {
            const {
                middle,
                groups,
                left,
                right
            } = this.sides;
            const W = this.width,
                H = this.height;
            let pos = {};
            if (middle) pos[middle] = {
                x: W / 2,
                y: H / 2 + 20
            };
            groups.forEach((n, i) => pos[n] = {
                x: W * (i + 1) / (groups.length + 1),
                y: 22
            });
            const column = (list, xs) => {
                const cols = list.length > 14 ? 2 : 1;
                const rows = Math.ceil(list.length / cols);
                list.forEach((n, i) => {
                    const r = Math.floor(i / cols),
                        c = i % cols;
                    pos[n] = {
                        x: xs[cols === 1 ? 0 : c],
                        y: 60 + (r + 0.5) * (H - 70) / Math.max(rows, 1)
                    };
                });
            };
            column(right, [W - 70, W - 190]);
            column(left, [70, 190]);
            return pos;
        },
        lines() {
            const pos = this.layout;
            const pairs = new Set(this.shown.edges.map(e => e.from + '>' + e.to));
            return this.shown.edges.map(e => {
                const a = pos[e.from],
                    b = pos[e.to];
                if (!a || !b) return null;
                if (e.from === e.to) return null;
                // arrows both ways are bent apart
                const bend = pairs.has(e.to + '>' + e.from) ? 18 : 0;
                const dx = b.x - a.x,
                    dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len,
                    ny = dx / len;
                const mx = (a.x + b.x) / 2 + nx * bend,
                    my = (a.y + b.y) / 2 + ny * bend;
                // the arrow stops at the edge of the node
                const end = this.trim(b, mx, my);
                const start = this.trim(a, mx, my);
                const labels = e.labels.length > 3 ? e.labels.slice(0, 3).join(', ') + ' +' + (e.labels.length - 3) : e.labels.join(', ');
                return {
                    key: e.from + '>' + e.to + '>' + e.kind,
                    d: 'M' + start.x + ',' + start.y + ' Q' + mx + ',' + my + ' ' + end.x + ',' + end.y,
                    kind: e.kind,
                    label: labels,
                    title: e.labels.join(', '),
                    // the label near the end, so a fan of arrows from a group keeps them apart
                    lx: 0.09 * start.x + 0.42 * mx + 0.49 * end.x,
                    ly: 0.09 * start.y + 0.42 * my + 0.49 * end.y - 2,
                };
            }).filter(l => l);
        },
    },
    methods: {
        trim(p, tx, ty) {
            const dx = tx - p.x,
                dy = ty - p.y;
            const w = 48,
                h = 11;
            const k = Math.min(w / Math.abs(dx || 1e-6), h / Math.abs(dy || 1e-6), 1);
            return {
                x: p.x + dx * k,
                y: p.y + dy * k
            };
        },
        label(n) {
            return n.startsWith('g:') ? '[' + n.slice(2) + ']' : n;
        },
        open(n) {
            if (n.startsWith('g:')) {
                this.edit.animGroup = n.slice(2);
                if (this.mode === 'group') return;
                this.openGroup(n.slice(2));
            } else {
                this.edit.animScript = n;
                this.edit.animStep = 0;
            }
        },
        down(n) {
            this.dragFrom = n;
        },
        up(n) {
            if (this.dragFrom && this.dragFrom !== n && !n.startsWith('g:')) {
                this.newEdge = {
                    from: this.dragFrom.startsWith('g:') ? this.dragFrom.slice(2) : this.dragFrom,
                    to: n,
                    event: this.animation.events[0] || '',
                    when: 'now'
                };
            } else if (this.dragFrom === n) this.open(n);
            this.dragFrom = null;
            this.dragAt = null;
        },
        move(event) {
            if (!this.dragFrom) return;
            const r = this.$refs.svg.getBoundingClientRect();
            this.dragAt = {
                x: (event.clientX - r.left) * this.width / r.width,
                y: (event.clientY - r.top) * this.height / r.height
            };
        },
        addEdge() {
            const e = this.newEdge;
            if (e.event) this.animation.rules.push({
                event: e.event,
                source: e.from,
                to: e.to,
                when: e.when
            });
            this.newEdge = null;
        },
    },
    template: `
        <div class="anim-graph">
            <div class="view-toolbar">
                <label :title="T('The graph around one state', 'Граф вокруг одного состояния')"><input type="radio" value="state" v-model="mode"> {{T('State', 'Состояние')}}
                    <select v-model="edit.animScript" :disabled="mode !== 'state'"><option v-for="s in scriptNames" :value="s">{{s}}</option></select></label>
                <label :title="T('How many steps of neighbours around the state', 'Сколько шагов соседей вокруг состояния')">{{T('neighbours', 'соседи')}} <select v-model.number="edit.graphDepth" :disabled="mode !== 'state'"><option v-for="d in [1, 2]" :value="d">{{d}}</option></select></label>
                <label :title="T('The states of one group and where they go', 'Состояния одной группы и куда они ведут')"><input type="radio" value="group" v-model="mode"> {{T('Group', 'Группа')}}
                    <select v-model="edit.animGroup" :disabled="mode !== 'group'"><option v-for="g in animation.groups" :value="g.name">{{g.name}}</option></select></label>
                <label :title="T('A rule of a group is one arrow from the group', 'Правило группы — одна стрелка от группы')"><input type="checkbox" v-model="edit.graphGroups"> {{T('groups as nodes', 'группы узлами')}}</label>
                <label :title="T('Dashed arrows: the script’s own gotos and runs into the next one', 'Пунктирные стрелки: свои goto скрипта и переход в следующий по коду')"><input type="checkbox" v-model="edit.graphGotos"> gotos</label>
                <span class="help-text">{{T(shown.nodes.length + ' nodes', 'узлов: ' + shown.nodes.length)}}<span v-if="shown.hidden">{{T(', ' + shown.hidden + ' more not shown', ', ещё ' + shown.hidden + ' не показано')}}</span>. {{T('Right: where it leads, left: what leads to it.', 'Справа — куда ведёт, слева — что ведёт сюда.')}}
                    {{T('Click centers a state, double click opens it; a drag from one to another adds a transition', 'Щелчок ставит состояние в центр, двойной — открывает; протянуть от одного к другому — новый переход')}}</span>
            </div>
            <div v-if="newEdge" class="anim-preview-box">
                {{T('New transition', 'Новый переход')}} {{newEdge.from}} → {{newEdge.to}}: {{T('on', 'по')}}
                <select v-model="newEdge.event"><option v-for="e in animation.events" :value="e">{{e}}</option></select>
                <select v-model="newEdge.when"><option v-for="w in ['now', 'branch', 'end']" :value="w">{{w}}</option></select>
                <button class="btn btn-sm btn-outline-primary" @click="addEdge" :disabled="!newEdge.event">{{T('Add', 'Добавить')}}</button>
                <button class="btn btn-sm btn-outline-secondary" @click="newEdge = null">{{T('Cancel', 'Отмена')}}</button>
            </div>
            <svg ref="svg" :viewBox="'0 0 ' + width + ' ' + height" class="anim-graph-svg" @mousemove="move" @mouseup="dragFrom = null; dragAt = null">
                <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 z" fill="#4060a0"></path>
                    </marker>
                    <marker id="arrow-own" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 z" fill="#909090"></path>
                    </marker>
                </defs>
                <g v-for="l in lines" :key="l.key">
                    <path :d="l.d" fill="none" :class="'edge-' + l.kind" :marker-end="l.kind === 'member' ? '' : l.kind === 'own' ? 'url(#arrow-own)' : 'url(#arrow)'"><title>{{l.title}}</title></path>
                    <text v-if="l.label && l.kind !== 'member'" :x="l.lx" :y="l.ly" class="edge-label" :class="'edge-label-' + l.kind">{{l.label}}<title>{{l.title}}</title></text>
                </g>
                <line v-if="dragFrom && dragAt && layout[dragFrom]" :x1="layout[dragFrom].x" :y1="layout[dragFrom].y" :x2="dragAt.x" :y2="dragAt.y" class="edge-drag"></line>
                <g v-for="n in shown.nodes" :key="n" class="graph-node" :class="{group: n.startsWith('g:'), center: n === center || n === 'g:' + center}"
                    :transform="'translate(' + layout[n].x + ',' + layout[n].y + ')'" @mousedown.prevent="down(n)" @mouseup.stop="up(n)" @dblclick="n.startsWith('g:') ? openGroup(n.slice(2)) : openState(n)">
                    <rect x="-48" y="-11" width="96" height="22" :rx="n.startsWith('g:') ? 11 : 3"></rect>
                    <text y="4">{{label(n).length > 15 ? label(n).slice(0, 14) + '…' : label(n)}}<title>{{label(n)}}</title></text>
                </g>
            </svg>
        </div>
    `
};

// groups: marks of states, plain lists of scripts. A rule of a group gives a transition to each of its states
const AnimGroups = {
    mixins: [AnimRulesBase],
    data() {
        return {
            newGroup: '',
            message: '',
            joining: {}, // group -> script that may join
        };
    },
    created() {
        // drafts of new rules of groups, {event, to, when}; not reactive, the selects keep what is chosen
        this.drafts = {};
    },
    mounted() {
        const el = this.$el.querySelector && this.$el.querySelector('.group-current');
        if (el) el.scrollIntoView({
            block: 'nearest'
        });
    },
    computed: {
        // a draft for each group, kept between renders
        draftOf() {
            for (const g of this.animation.groups) this.ruleDraft(g);
            return this.drafts;
        },
    },
    methods: {
        addGroup() {
            const name = this.newGroup.trim();
            if (!Anim.isName(name) || this.animation.groups.some(g => g.name === name)) {
                this.message = T("'" + name + "' is no name or there is such a group", "'" + name + "' — не имя или такая группа уже есть");
                return;
            }
            this.animation.groups.push({
                name: name,
                scripts: []
            });
            this.newGroup = '';
            this.message = '';
            this.edit.animGroup = name;
        },
        renameGroup(g, event) {
            const name = event.target.value.trim();
            if (name === g.name) return;
            if (!Anim.isName(name) || this.animation.groups.some(x => x.name === name)) {
                this.message = T("'" + name + "' is no name or there is such a group", "'" + name + "' — не имя или такая группа уже есть");
                event.target.value = g.name;
                return;
            }
            if (this.edit.animGroup === g.name) this.edit.animGroup = name;
            Anim.renameGroup(this.animation, g.name, name);
        },
        removeGroup(g) {
            const n = this.animation.rules.filter(r => r.source === g.name).length;
            if (confirm(T('Remove group ' + g.name + (n ? ' and its ' + n + ' rules' : '') + '?', 'Удалить группу ' + g.name + (n ? ' и её правила (' + n + ')' : '') + '?'))) Anim.removeGroup(this.animation, g.name);
        },
        join(g) {
            const s = this.joining[g.name];
            if (s && !g.scripts.includes(s)) g.scripts.push(s);
            this.joining[g.name] = '';
        },
        rulesOf(g) {
            return this.animation.rules.map((r, i) => i).filter(i => this.animation.rules[i].source === g.name);
        },
        ruleDraft(g) {
            if (!this.drafts[g.name]) this.drafts[g.name] = {
                event: this.animation.events[0] || '',
                to: this.scriptNames[0] || '',
                when: 'now'
            };
            return this.drafts[g.name];
        },
        addRule(g) {
            const d = this.ruleDraft(g);
            if (!d.event || !d.to) return;
            this.animation.rules.push({
                event: d.event,
                source: g.name,
                to: d.to,
                when: d.when
            });
        },
        twice(g) {
            return g.scripts.filter((s, i) => g.scripts.indexOf(s) !== i);
        },
    },
    template: `
        <div class="anim-groups">
            <div class="help-text">{{T('A group is a mark of states: «in the air», «on the ground», «dead». It is a plain list of scripts; a rule of the group gives the transition to each of them. A script may be in several groups.', 'Группа — отметка состояний: «в воздухе», «на земле», «мёртв». Это просто список скриптов; правило группы даёт переход каждому из них. Скрипт может быть в нескольких группах.')}}</div>
            <div v-if="message" class="error-text">{{message}} <button @click="message = ''">x</button></div>
            <div v-for="g in animation.groups" :key="g.name" class="anim-group" :class="{'group-current': g.name === edit.animGroup}" @click="edit.animGroup = g.name">
                <div class="anim-group-head">
                    <input :value="g.name" @change="renameGroup(g, $event)" size="12" class="anim-script-name" :title="T('The name of the group; its rules follow it', 'Имя группы; её правила следуют за ним')">
                    <span class="help-text">{{T(g.scripts.length + ' states', 'состояний: ' + g.scripts.length)}}</span>
                    <a href="#" @click.prevent="edit.animGroup = g.name; edit.graphMode = 'group'; spritesStore.openAnimTab('graph')" :title="T('The group on the graph', 'Группа на графе')">{{T('in the graph', 'на графе')}}</a>
                    <button class="btn btn-sm btn-remove" @click="removeGroup(g)" :title="T('Remove the group', 'Удалить группу')">x</button>
                </div>
                <div v-if="twice(g).length" class="error-text">{{T('named twice:', 'названы дважды:')}} {{twice(g).join(', ')}}</div>
                <div class="anim-members">
                    <span v-for="(s, k) in g.scripts" class="anim-member">
                        <a href="#" @click.prevent="openState(s)" :class="{'error-text': !scriptNames.includes(s)}">{{s}}</a>
                        <button @click="g.scripts.splice(k, 1)" :title="T('Out of the group', 'Выйти из группы')">×</button>
                    </span>
                    <select :value="joining[g.name] || ''" @change="joining[g.name] = $event.target.value" class="anim-add-wide" :title="T('Into the group: first see what it gives', 'В группу: сначала видно, что она даст')">
                        <option value="">{{T('+ state', '+ состояние')}}</option>
                        <option v-for="s in scriptNames.filter(s => !g.scripts.includes(s))" :value="s">{{s}}</option>
                    </select>
                </div>
                <div v-if="joining[g.name]" class="anim-preview-box">
                    {{joining[g.name]}} {{T('gets:', 'получит:')}} {{joinPreview(g.name, joining[g.name]).gives.join(', ') || T('nothing new', 'ничего нового')}}
                    <span v-if="joinPreview(g.name, joining[g.name]).conflicts.length" class="error-text">; {{T('conflicts:', 'конфликты:')}} {{joinPreview(g.name, joining[g.name]).conflicts.join(', ')}}</span>
                    <button class="btn btn-sm btn-outline-primary" @click="join(g)">{{T('Join', 'Войти')}}</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="joining[g.name] = ''">{{T('Cancel', 'Отмена')}}</button>
                </div>
                <table class="anim-view-table anim-group-rules"><tbody>
                    <tr v-for="i in rulesOf(g)">
                        <td>{{T('on', 'по')}} <select v-model="animation.rules[i].event"><option v-for="e in animation.events" :value="e">{{e}}</option></select></td>
                        <td>→ <select v-model="animation.rules[i].to"><option v-for="s in scriptNames" :value="s">{{s}}</option></select></td>
                        <td><select v-model="animation.rules[i].when"><option v-for="w in ['now', 'branch', 'end']" :value="w">{{w}}</option></select></td>
                        <td><button class="btn btn-sm btn-remove" @click="removeRule(i)" :title="T('Remove the rule', 'Удалить правило')">×</button></td>
                    </tr>
                    <tr>
                        <td>{{T('on', 'по')}} <select v-model="draftOf[g.name].event"><option v-for="e in animation.events" :value="e">{{e}}</option></select></td>
                        <td>→ <select v-model="draftOf[g.name].to"><option v-for="s in scriptNames" :value="s">{{s}}</option></select></td>
                        <td><select v-model="draftOf[g.name].when"><option v-for="w in ['now', 'branch', 'end']" :value="w">{{w}}</option></select></td>
                        <td><button class="btn btn-sm btn-outline-secondary" @click="addRule(g)" :title="T('A rule of the group: the transition for all its states', 'Правило группы: переход для всех её состояний')">{{T('+ rule', '+ правило')}}</button></td>
                    </tr>
                </tbody></table>
            </div>
            <div>
                <input v-model="newGroup" :placeholder="T('new group', 'новая группа')" size="12" @keyup.enter="addGroup">
                <button class="btn btn-sm btn-outline-secondary" @click="addGroup">{{T('+ group', '+ группа')}}</button>
            </div>
        </div>
    `
};

// an event and every state: where it leads, by the targets
const AnimByEvent = {
    mixins: [AnimRulesBase],
    computed: {
        event: {
            get() {
                return this.edit.animEvent || this.animation.events[0] || '';
            },
            set(e) {
                this.edit.animEvent = e;
            },
        },
        // [{to, when, scripts, sources}]
        ways() {
            let ways = {};
            for (const s of this.scriptNames) {
                const c = this.matrix[s] && this.matrix[s][this.event];
                if (!c) continue;
                const key = c.to + ' ' + c.when;
                if (!ways[key]) ways[key] = {
                    to: c.to,
                    when: c.when,
                    scripts: [],
                    sources: new Set()
                };
                ways[key].scripts.push(s);
                for (const i of c.rules) ways[key].sources.add(this.animation.rules[i].source);
            }
            return Object.values(ways);
        },
        silent() {
            return this.scriptNames.filter(s => !(this.matrix[s] && this.matrix[s][this.event]));
        },
    },
    template: `
        <div class="anim-by-event">
            <label>{{T('Event', 'Событие')}} <select v-model="event"><option v-for="e in animation.events" :value="e">{{e}}</option></select></label>
            <div v-for="w in ways" class="anim-way">
                <div>→ <a href="#" @click.prevent="openState(w.to)"><b>{{w.to}}</b></a> {{w.when}} · {{T('from ' + w.scripts.length + ' states', 'из состояний: ' + w.scripts.length)}}
                    · {{T('given by', 'дают')}} <a v-for="s in [...w.sources]" href="#" @click.prevent="openSource(s)" class="anim-chip-link">{{isGroup(s) ? T('group ', 'группа ') + s : s}}</a></div>
                <div class="anim-members"><a v-for="s in w.scripts" href="#" @click.prevent="openState(s)" class="anim-chip-link">{{s}}</a></div>
            </div>
            <div v-if="!ways.length" class="anim-empty">{{T('The event does nothing anywhere.', 'Событие нигде ничего не делает.')}}</div>
            <div v-if="silent.length && ways.length" class="anim-way"><b>{{T('Does nothing in ' + silent.length + ' states:', 'Ничего не делает в состояниях (' + silent.length + '):')}}</b>
                <div class="anim-members"><a v-for="s in silent" href="#" @click.prevent="openState(s)" class="anim-chip-link">{{s}}</a></div>
            </div>
        </div>
    `
};

// all rules as they are in the file, by events; their order means nothing
const AnimRules = {
    mixins: [AnimRulesBase],
    data() {
        return {
            filterEvent: '',
            filterSource: '',
            newEvent: '',
            message: '',
        };
    },
    computed: {
        shown() {
            const a = this.animation;
            return a.rules.map((r, i) => i).filter(i => {
                const r = a.rules[i];
                return (!this.filterEvent || r.event === this.filterEvent) && (!this.filterSource || r.source === this.filterSource || r.to === this.filterSource);
            }).sort((x, y) => a.events.indexOf(a.rules[x].event) - a.events.indexOf(a.rules[y].event) || x - y);
        },
        // rules in a conflict
        conflicted() {
            let set = new Set();
            for (const s in this.matrix) {
                for (const e in this.matrix[s]) {
                    const c = this.matrix[s][e];
                    if (c.conflict) [c, ...c.conflict].forEach(x => x.rules.forEach(i => set.add(i)));
                }
            }
            return set;
        },
        sources() {
            return [...this.animation.groups.map(g => g.name), ...this.scriptNames];
        },
    },
    methods: {
        addRule() {
            const a = this.animation;
            a.rules.push({
                event: this.filterEvent || a.events[0] || '',
                source: this.filterSource || this.edit.animScript || (a.scripts[0] ? a.scripts[0].name : ''),
                to: this.edit.animScript || (a.scripts[0] ? a.scripts[0].name : ''),
                when: 'now'
            });
        },
        addEvent() {
            const name = this.newEvent.trim();
            if (!Anim.isName(name) || this.animation.events.includes(name)) {
                this.message = T("'" + name + "' is no name or there is such an event", "'" + name + "' — не имя или такое событие уже есть");
                return;
            }
            this.animation.events.push(name);
            this.newEvent = '';
            this.message = '';
        },
        // an event renamed takes its rules with it; an empty name takes it away
        renameEvent(e, event) {
            const name = event.target.value.trim();
            if (name === e) return;
            if (!name) {
                const n = this.animation.rules.filter(r => r.event === e).length;
                if (confirm(T('Remove event ' + e + (n ? ' and its ' + n + ' rules' : '') + '?', 'Удалить событие ' + e + (n ? ' и его правила (' + n + ')' : '') + '?'))) Anim.removeEvent(this.animation, e);
                else event.target.value = e;
                return;
            }
            if (!Anim.isName(name) || this.animation.events.includes(name)) {
                this.message = T("'" + name + "' is no name or there is such an event", "'" + name + "' — не имя или такое событие уже есть");
                event.target.value = e;
                return;
            }
            Anim.renameEvent(this.animation, e, name);
        },
        moveEvent(e, d) {
            const list = this.animation.events;
            const i = list.indexOf(e);
            const j = i + d;
            if (j < 0 || j >= list.length) return;
            [list[i], list[j]] = [list[j], list[i]];
        },
    },
    template: `
        <div class="anim-rules">
            <div class="anim-events-edit">
                <b :title="T('Their order is the order of columns of the matrix in the blob', 'Их порядок — порядок столбцов матрицы в блобе')">{{T('Events', 'События')}}</b>
                <span v-for="e in animation.events" :key="e" class="anim-event-chip">
                    <input :value="e" :size="Math.max(4, e.length)" @change="renameEvent(e, $event)" :title="T('Rename; empty removes it with its rules', 'Переименовать; пусто — удалить вместе с его правилами')">
                    <button @click="moveEvent(e, -1)" :title="T('Earlier', 'Раньше')">‹</button><button @click="moveEvent(e, 1)" :title="T('Later', 'Позже')">›</button>
                </span>
                <input v-model="newEvent" :placeholder="T('new event', 'новое событие')" size="10" @keyup.enter="addEvent">
                <button class="btn btn-sm btn-outline-secondary" @click="addEvent">{{T('+ event', '+ событие')}}</button>
            </div>
            <div v-if="message" class="error-text">{{message}} <button @click="message = ''">x</button></div>
            <div class="view-toolbar">
                <button class="btn btn-sm btn-outline-primary" @click="addRule" :title="T('A new rule, with the event and the state of the filters', 'Новое правило — с событием и состоянием из фильтров')">{{T('+ rule', '+ правило')}}</button>
                <label>{{T('Event', 'Событие')}} <select v-model="filterEvent"><option value="">{{T('all', 'все')}}</option><option v-for="e in animation.events" :value="e">{{e}}</option></select></label>
                <label>{{T('From or to', 'Откуда или куда')}} <select v-model="filterSource"><option value="">{{T('all', 'все')}}</option><option v-for="s in sources" :value="s">{{s}}</option></select></label>
                <span class="help-text">{{T('A rule fills cells, nothing more: the order means nothing, two answers for one cell are a conflict.', 'Правило заполняет клетки, не больше: порядок ничего не значит, два ответа для одной клетки — конфликт.')}}</span>
            </div>
            <table class="table table-sm anim-rule-table">
                <thead><tr><th>{{T('event', 'событие')}}</th><th>{{T('from: state or group', 'откуда: состояние или группа')}}</th><th></th><th>{{T('to', 'куда')}}</th><th>{{T('when', 'когда')}}</th><th></th></tr></thead>
                <tbody>
                    <tr v-for="i in shown" :key="i" :class="{'rule-conflict': conflicted.has(i)}">
                        <td><select v-model="animation.rules[i].event"><option v-for="e in animation.events" :value="e">{{e}}</option></select></td>
                        <td><select v-model="animation.rules[i].source">
                            <optgroup :label="T('groups', 'группы')"><option v-for="g in animation.groups" :value="g.name">{{g.name}}</option></optgroup>
                            <optgroup :label="T('states', 'состояния')"><option v-for="s in scriptNames" :value="s">{{s}}</option></optgroup>
                        </select> <a href="#" @click.prevent="openSource(animation.rules[i].source)" :title="T('Open', 'Открыть')">↗</a></td>
                        <td>→</td>
                        <td><select v-model="animation.rules[i].to"><option v-for="s in scriptNames" :value="s">{{s}}</option></select></td>
                        <td><select v-model="animation.rules[i].when"><option v-for="w in ['now', 'branch', 'end']" :value="w">{{w}}</option></select></td>
                        <td><span v-if="conflicted.has(i)" class="error-text" :title="T('Another rule answers a cell of it otherwise: see Checks', 'Другое правило отвечает на его клетку иначе: см. Проверки')">{{T('conflict', 'конфликт')}}</span>
                            <button class="btn btn-sm btn-remove" @click="removeRule(i)" :title="T('Remove the rule', 'Удалить правило')">×</button></td>
                    </tr>
                </tbody>
            </table>
            <div v-if="!animation.rules.length" class="anim-empty">{{T('No rules: events do nothing.', 'Правил нет: события ничего не делают.')}}</div>
        </div>
    `
};

// the whole matrix for a look: rows and columns filtered, empty cells and conflicts seen, a click opens the state
const AnimMatrix = {
    mixins: [AnimRulesBase],
    data() {
        return {
            group: '',
            rowFilter: '',
            columnFilter: '',
        };
    },
    computed: {
        // the group whose cells are left out, so the particular transitions are seen
        hidden() {
            return this.animation.groups.some(g => g.name === this.edit.matrixHide) ? this.edit.matrixHide : '';
        },
        rows() {
            const g = this.animation.groups.find(g => g.name === this.group);
            const f = this.rowFilter.trim().toLowerCase();
            return this.scriptNames.filter(s => (!g || g.scripts.includes(s)) && (!f || s.toLowerCase().includes(f)));
        },
        columns() {
            const f = this.columnFilter.trim().toLowerCase();
            return this.animation.events.filter(e => !f || e.toLowerCase().includes(f));
        },
    },
    methods: {
        cell(s, e) {
            return this.matrix[s] && this.matrix[s][e];
        },
        // a cell given by the hidden group alone is shown as nothing
        shown(s, e) {
            const c = this.cell(s, e);
            if (!c || !this.hidden) return c;
            const all = [c, ...(c.conflict || [])].every(x => x.rules.every(i => this.animation.rules[i].source === this.hidden));
            return all ? null : c;
        },
        title(s, e) {
            const c = this.cell(s, e);
            if (!c) return s + T(' does nothing on ', ' ничего не делает по ') + e;
            return [c, ...(c.conflict || [])].map(x => x.to + ' ' + x.when + T(' by ', ' от ') + x.rules.map(i => this.animation.rules[i].source).join(', ')).join(T('\nor ', '\nили '));
        },
    },
    template: `
        <div class="anim-matrix">
            <div class="view-toolbar">
                <label :title="T('Only the states of this group', 'Только состояния этой группы')">{{T('Group', 'Группа')}} <select v-model="group"><option value="">{{T('all states', 'все состояния')}}</option><option v-for="g in animation.groups" :value="g.name">{{g.name}}</option></select></label>
                <input v-model="rowFilter" :placeholder="T('states', 'состояния')" size="10" :title="T('Rows: states whose name has this', 'Строки: состояния, в имени которых это есть')">
                <input v-model="columnFilter" :placeholder="T('events', 'события')" size="10" :title="T('Columns: events whose name has this', 'Столбцы: события, в имени которых это есть')">
                <label :title="T('Do not show the transitions given by this one group alone (for example, any for all states): the particular ones stay seen', 'Не показывать переходы, которые дала одна эта группа (например, any у всех состояний): останутся видны особые')">{{T('Hide group', 'Скрыть группу')}}
                    <select v-model="edit.matrixHide"><option value="">{{T('none', 'нет')}}</option><option v-for="g in animation.groups" :value="g.name">{{g.name}}</option></select></label>
                <span class="help-text">{{rows.length}} × {{columns.length}}; {{T('⑂ at a branch point, ⏹ at the end; red: a conflict', '⑂ — в точке branch, ⏹ — в конце; красное — конфликт')}}<span v-if="hidden">; {{T('· may be the hidden group’s', '· может быть переходом скрытой группы')}}</span></span>
            </div>
            <div class="anim-matrix-scroll">
                <table class="anim-matrix-table">
                    <thead><tr><th></th><th v-for="e in columns"><a href="#" @click.prevent="openEvent(e)">{{e}}</a></th></tr></thead>
                    <tbody>
                        <tr v-for="s in rows">
                            <th><a href="#" @click.prevent="openState(s)">{{s}}</a></th>
                            <td v-for="e in columns" :class="{filled: shown(s, e), conflict: shown(s, e) && shown(s, e).conflict, hidden: cell(s, e) && !shown(s, e)}" :title="title(s, e)"
                                @click="openState(s)">{{shown(s, e) ? shown(s, e).to + whenMark(shown(s, e).when) : '·'}}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `
};

// what the assembler would refuse, and what is likely a mistake
const AnimChecks = {
    mixins: [AnimRulesBase],
    computed: {
        result() {
            return Anim.check(this.set, this.spritesStore.sprites.sets);
        },
    },
    methods: {
        open(p) {
            if (p.kind === 'script') {
                this.edit.animScript = p.name;
                if (p.line !== null) {
                    const script = this.animation.scripts.find(s => s.name === p.name);
                    const k = script ? Anim.steps(script).findIndex(st => p.line >= st.start && p.line < st.end) : 0;
                    this.edit.animStep = Math.max(0, k);
                } else this.edit.animStep = 0;
                this.spritesStore.openAnimTab('scripts');
            } else if (p.kind === 'state') this.openState(p.name);
            else if (p.kind === 'rule') {
                this.spritesStore.openAnimTab('rules');
            } else if (p.kind === 'event') this.openEvent(p.name);
            else if (p.kind === 'group') this.openGroup(p.name);
            // params are at the top of the page
        },
        // the marks of many scripts at once: those the warnings name
        markAll(mark) {
            const what = mark === 'entry' ? /^no rule and no goto leads to it/ : /^goes on into the next script/;
            const names = new Set(this.result.warnings.filter(p => what.test(p.text)).map(p => p.name));
            for (const s of this.animation.scripts)
                if (names.has(s.name)) s[mark] = true;
        },
        where(p) {
            if (p.kind === 'rule') return this.ruleText(p.name);
            if (p.kind) return p.kind + ' ' + p.name;
            return '';
        },
    },
    template: `
        <div class="anim-checks">
            <div v-if="!result.errors.length && !result.warnings.length" class="anim-empty">{{T('Nothing found.', 'Ничего не найдено.')}}</div>
            <div v-if="result.errors.length"><b>{{T('Errors: the assembler would refuse the file', 'Ошибки: ассемблер не примет файл')}} ({{result.errors.length}})</b></div>
            <div v-for="p in result.errors" class="error-text anim-check"><a href="#" @click.prevent="open(p)">{{where(p)}}</a> {{p.text}}</div>
            <div v-if="result.warnings.length" class="anim-checks-title"><b>{{T('Warnings', 'Предупреждения')}} ({{result.warnings.length}})</b>
                <button v-if="result.warnings.some(p => /^no rule and no goto leads to it/.test(p.text))" class="btn btn-sm btn-outline-secondary" @click="markAll('entry')"
                    :title="T('Mark all the scripts nothing leads to as started by the game (entry): when the game’s code really starts them', 'Отметить все скрипты, в которые никто не ведёт, как запускаемые игрой (entry) — когда их и правда запускает код игры')">{{T('mark unreached as entry', 'отметить недостижимые как entry')}}</button>
                <button v-if="result.warnings.some(p => /^goes on into the next script/.test(p.text))" class="btn btn-sm btn-outline-secondary" @click="markAll('through')"
                    :title="T('Mark all the scripts that go on into the next one as on purpose (through)', 'Отметить все скрипты, что переходят в следующий, как нарочно (through)')">{{T('mark falling ones as through', 'отметить переходящие как through')}}</button></div>
            <div v-for="p in result.warnings" class="warning-text anim-check"><a href="#" @click.prevent="open(p)">{{where(p)}}</a> {{p.text}}</div>
        </div>
    `
};
