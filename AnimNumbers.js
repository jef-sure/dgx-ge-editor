// The game's frames by number (frame N in the scripts): a table of the set, for the player of the editor only. A row
// is the picture of a frame number (of any set) and how far it stands forward and down of the actor. A game that draws
// numbered frames itself (PoP: its frame table) keeps its own table; this one shows the scripts as it will
const AnimNumbers = {
    data() {
        return {
            importText: '',
            importOpen: false,
            message: '',
        };
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        set() {
            return this.spritesStore.currentSet;
        },
        sets() {
            return this.spritesStore.sprites.sets;
        },
        table() {
            return this.set.frameTable || [];
        },
        // the numbers the scripts show: those without a picture in the table are marked
        used() {
            let used = new Set();
            for (const s of this.set.animation.scripts)
                for (const l of s.lines)
                    if (l.op === 'frame' && l.number !== undefined) used.add(l.number);
            return used;
        },
        missing() {
            return [...this.used].filter(n => n >= this.table.length).sort((a, b) => a - b);
        },
    },
    methods: {
        frameOf(e) {
            const s = e && this.sets.find(s => s.name === e.set);
            return s ? s.frames.find(f => f.image === e.image) || null : null;
        },
        ensure() {
            if (!this.set.frameTable) this.set.frameTable = [];
            return this.set.frameTable;
        },
        // a row for the number, its picture the first frame of the set
        addRow() {
            const t = this.ensure();
            const n = t.length;
            t.push(this.set.frames.length ? {
                set: this.set.name,
                image: this.set.frames[Math.min(n, this.set.frames.length - 1)].image,
                dx: 0,
                dy: 0
            } : null);
        },
        setRow(n, key, value) {
            const t = this.ensure();
            if (!t[n]) t[n] = {
                set: this.set.name,
                image: this.set.frames.length ? this.set.frames[0].image : '',
                dx: 0,
                dy: 0
            };
            if (key === 'set') {
                const s = this.sets.find(s => s.name === value);
                t[n].set = value;
                t[n].image = s && s.frames.length ? s.frames[0].image : '';
            } else if (key === 'image') t[n].image = value;
            else {
                const v = parseInt(value, 10);
                t[n][key] = Number.isInteger(v) ? v : 0;
            }
        },
        clearRow(n) {
            this.table[n] = null;
        },
        // numbers 1.. are the frames of the set in their order (the old way), 0 none
        byOrder() {
            if (this.set.frameTable && this.set.frameTable.length && !confirm(T('Replace the table of ' + this.table.length + ' numbers?', 'Заменить таблицу из ' + this.table.length + ' номеров?'))) return;
            this.set.frameTable = [null, ...this.set.frames.map(f => ({
                set: this.set.name,
                image: f.image,
                dx: 0,
                dy: 0
            }))];
        },
        removeTable() {
            if (confirm(T('Remove the table of frame numbers of the set?', 'Убрать таблицу номеров кадров набора?'))) delete this.set.frameTable;
        },
        // lines 'N picture dx dy', the picture a file of the set, SET/file or a name of the pack; '#' a comment
        importRows() {
            const t = this.ensure();
            let errors = [],
                count = 0;
            this.importText.split('\n').forEach((raw, i) => {
                const line = raw.split('#')[0].trim();
                if (!line) return;
                const w = line.split(/[\s,]+/);
                const n = parseInt(w[0], 10);
                if (!Number.isInteger(n) || n < 0 || n > 65535 || w.length < 2) {
                    errors.push(T('line ', 'строка ') + (i + 1) + T(': N picture [dx dy]', ': N картинка [dx dy]'));
                    return;
                }
                let found = null;
                const slash = w[1].indexOf('/');
                if (slash > 0) {
                    const s = this.sets.find(s => s.name === w[1].slice(0, slash));
                    const f = s && s.frames.find(f => f.image === w[1].slice(slash + 1));
                    if (f) found = [s, f];
                } else {
                    for (const s of [this.set, ...this.sets]) {
                        const f = s.frames.find(f => f.image === w[1] || Anim.imageName(s, f.image) === Anim.nameOf(w[1]));
                        if (f) {
                            found = [s, f];
                            break;
                        }
                    }
                }
                if (!found) {
                    errors.push(T('line ', 'строка ') + (i + 1) + T(': no picture ', ': нет картинки ') + w[1]);
                    return;
                }
                while (t.length <= n) t.push(null);
                t[n] = {
                    set: found[0].name,
                    image: found[1].image,
                    dx: parseInt(w[2], 10) || 0,
                    dy: parseInt(w[3], 10) || 0
                };
                ++count;
            });
            this.message = T(count + ' numbers set', 'номеров задано: ' + count) + (errors.length ? '; ' + errors.slice(0, 5).join('; ') + (errors.length > 5 ? '…' : '') : '');
            if (!errors.length) this.importOpen = false;
        },
    },
    template: `
        <div class="anim-numbers">
            <div class="anim-numbers-head">
                <b :title="T('The table of frames by number: which picture shows «frame N» of the scripts and how far to shift it forward and down. Needed when the game’s frames are numbers (PoP: the game’s frame table). Only for the editor’s player: the game keeps its own table', 'Таблица кадров по номерам: какой картинкой показать «frame N» скриптов и насколько её сдвинуть вперёд и вниз. Нужна, когда кадры игры — номера (PoP: таблица кадров игры). Только для проигрывателя редактора: игра держит свою таблицу')">{{T('Frame numbers', 'Номера кадров')}}</b>
                <span class="help-text" v-if="set.frameTable">{{T(table.length + ' numbers · scripts show ' + used.size, 'номеров: ' + table.length + ' · скрипты показывают ' + used.size)}}</span>
                <span class="help-text" v-else>{{T('no table: numbers are shown by the order of the frames when «Numbers are frames» is checked', 'нет таблицы — номера показываются по порядку кадров, если отмечено «Номера — кадры»')}}</span>
                <button class="btn btn-sm btn-outline-secondary" @click="addRow" :title="T('The next number', 'Следующий номер')">{{T('+ number', '+ номер')}}</button>
                <button class="btn btn-sm btn-outline-secondary" @click="byOrder" :title="T('Number N: the frame N of the set in order (as «Numbers are frames»), 0: nothing', 'Номер N — кадр N набора по порядку (как «Номера — кадры»), 0 — ничего')">{{T('By order', 'По порядку')}}</button>
                <button class="btn btn-sm btn-outline-secondary" @click="importOpen = !importOpen" :title="T('Paste lines «N picture dx dy»', 'Вставить строки «N картинка dx dy»')">{{T('Import…', 'Импорт…')}}</button>
                <button v-if="set.frameTable" class="btn btn-sm btn-remove" @click="removeTable" :title="T('Remove the table', 'Убрать таблицу')">{{T('Remove', 'Удалить')}}</button>
            </div>
            <div v-if="importOpen" class="anim-numbers-import">
                <textarea v-model="importText" rows="6" placeholder="# N picture dx dy\n1 401.png 1 0\n2 KID/402.png 1 0\n150 GUARD_751 0 0"
                    :title="T('A line: «number picture dx dy»: the picture is a file of this set, SET/file or a name in the package; dx forward, dy down; #: a comment', 'Строка — «номер картинка dx dy»: картинка — файл этого набора, НАБОР/файл или имя в пакете; dx вперёд, dy вниз; # — комментарий')"></textarea>
                <button class="btn btn-sm btn-primary" @click="importRows">{{T('Set these numbers', 'Задать эти номера')}}</button>
            </div>
            <div v-if="message" class="anim-message">{{message}} <button @click="message = ''">x</button></div>
            <div v-if="missing.length" class="warning-text" :title="T('The scripts show these numbers, and the table does not reach them (an empty row is «no picture» on purpose)', 'Эти номера показывают скрипты, а таблица до них не доходит (пустая строка — «без картинки» нарочно)')">{{T('past the table:', 'за таблицей:')}} {{missing.length}}: {{missing.slice(0, 30).join(', ')}}{{missing.length > 30 ? '…' : ''}}</div>
            <table v-if="set.frameTable" class="table table-sm anim-numbers-table">
                <thead><tr><th>N</th><th>{{T('set', 'набор')}}</th><th>{{T('picture', 'картинка')}}</th><th></th><th :title="T('Forward, the way it looks', 'Вперёд, по взгляду')">dx</th><th :title="T('Down', 'Вниз')">dy</th><th></th></tr></thead><tbody>
                <tr v-for="(e, n) in table" :class="{'anim-number-used': used.has(n)}" :title="used.has(n) ? T('The scripts show this number', 'Этот номер показывают скрипты') : ''">
                    <td>{{n}}</td>
                    <td><select :value="e ? e.set : ''" @change="setRow(n, 'set', $event.target.value)"><option value="" disabled>—</option><option v-for="s in sets" :value="s.name">{{s.name}}</option></select></td>
                    <td><select v-if="e" :value="e.image" @change="setRow(n, 'image', $event.target.value)"><option v-for="f in (sets.find(s => s.name === e.set) || {frames: []}).frames" :value="f.image">{{f.image}}</option></select></td>
                    <td><FrameThumb v-if="frameOf(e)" :set-name="e.set" :frame="frameOf(e)" :scale="1"></FrameThumb></td>
                    <td><input class="num" :value="e ? e.dx : ''" @change="setRow(n, 'dx', $event.target.value)"></td>
                    <td><input class="num" :value="e ? e.dy : ''" @change="setRow(n, 'dy', $event.target.value)"></td>
                    <td><button v-if="e" class="btn btn-sm btn-remove" @click="clearRow(n)" :title="T('The number without a picture', 'Номер без картинки')">×</button></td>
                </tr>
            </tbody></table>
        </div>
    `
};
