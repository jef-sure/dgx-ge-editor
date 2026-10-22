// The graph of scenes, as tools/dgx_ge_graph.py of the engine builds it (Pack.add_graph, the blob DGSG): maps (clouds
// of scenes that share data: a level, a show), scenes of maps by their numbers, exits by sides and by names with
// transitions, entries with what the one coming is told, the start of the game, the rules of a map (an animation).
// In the JSON: the document has graph {name, start: {scene, entry}} and maps [{name, data, rules, exits}]; a scene
// has map, index, kind, onEnter; an exit of a scene has name and transition besides its edge or zone; an entry
// object has arrive and fires; a link has event and value (dgx_ge_links.h)
const Maps = {
    transitions: ['cut', 'fade', 'wipe', 'seamless'],
    sides: ['left', 'right', 'up', 'down'],
    kinds: ['room', 'show'],
    newGraph() {
        return {
            name: 'WORLD',
            start: {
                scene: '',
                entry: ''
            }
        };
    },
    newMap(name) {
        return {
            name: name,
            data: '',
            rules: '',
            number: 0,
            exits: []
        };
    },
    // the events the rules of a map hear when one leaves a scene by a side; a side with an event and no scene
    // beside is an edge out of the map
    newLeave() {
        return {
            left: '',
            right: '',
            up: '',
            down: ''
        };
    },
    readLeave(l) {
        let out = this.newLeave();
        if (l && typeof l === 'object')
            for (const side of this.sides)
                if (typeof l[side] === 'string') out[side] = l[side];
        return out;
    },
    newExit() {
        return {
            name: '',
            scene: '',
            entry: '',
            transition: 'cut'
        };
    },
    read(file) {
        const str = v => typeof v === 'string' ? v : '';
        let graph = this.newGraph();
        if (file.graph && typeof file.graph === 'object') {
            if (typeof file.graph.name === 'string' && file.graph.name) graph.name = file.graph.name;
            if (file.graph.start && typeof file.graph.start === 'object') graph.start = {
                scene: str(file.graph.start.scene),
                entry: str(file.graph.start.entry)
            };
        }
        let maps = [];
        for (const m of Array.isArray(file.maps) ? file.maps : []) {
            if (!m || typeof m.name !== 'string') continue;
            maps.push({
                name: m.name,
                data: str(m.data),
                rules: str(m.rules),
                number: Number.isInteger(m.number) && m.number >= 0 && m.number <= 65535 ? m.number : 0,
                exits: (Array.isArray(m.exits) ? m.exits : []).filter(e => e && typeof e.scene === 'string').map(e => ({
                    name: str(e.name),
                    scene: e.scene,
                    entry: str(e.entry),
                    transition: this.transitions.includes(e.transition) ? e.transition : 'cut'
                }))
            });
        }
        return {
            graph: graph,
            maps: maps
        };
    },
    // the link a source fires: {scene, object} or {scene, grid, col, row}, or null
    readFires(f) {
        if (!f || typeof f !== 'object' || typeof f.scene !== 'string') return null;
        if (typeof f.object === 'string') return {
            scene: f.scene,
            object: f.object
        };
        if (typeof f.grid === 'string' && Number.isInteger(f.col) && Number.isInteger(f.row)) return {
            scene: f.scene,
            grid: f.grid,
            col: f.col,
            row: f.row
        };
        return null;
    },
    fireText(f) {
        return f ? f.scene + ': ' + Scene.refText(f) : '';
    },
    scenesOf(doc, mapName) {
        return doc.scenes.filter(s => s.map === mapName);
    },
    mapOf(doc, scene) {
        return doc.maps.find(m => m.name === scene.map) || null;
    },
    // a named exit of a scene: by a name, not by a side
    isNamed(e) {
        return !e.edge && !!e.name;
    },
    // the sources of links in the scenes of a map: what an entry may fire, in the order the packer numbers the links
    sourcesOf(doc, mapName) {
        let list = [];
        let seen = new Set();
        for (const s of this.scenesOf(doc, mapName)) {
            for (const l of s.links) {
                const key = s.name + '|' + Scene.refText(l.from);
                if (seen.has(key)) continue;
                seen.add(key);
                list.push(Object.assign({
                    scene: s.name
                }, l.from));
            }
        }
        return list;
    },
    // a map as the packer lays its links (dgx_ge_layout.h, DGLK): its cells numbered through it (its scenes in the
    // order of the document, a scene's grids in order, a grid row by row: number = first + row * cols + col), its links
    // one list, by scene, in a scene by source in the order a source first comes, a source's links together.
    // {cells: [{scene, grid, first, count}], total, sources: [{scene, ref, first, count}], links, blob}
    layoutOf(doc, mapName) {
        let cells = [],
            sources = [],
            total = 0,
            links = 0;
        for (const s of this.scenesOf(doc, mapName)) {
            for (const g of s.grids) {
                cells.push({
                    scene: s.name,
                    grid: g.name,
                    first: total,
                    count: g.cols * g.rows
                });
                total += g.cols * g.rows;
            }
            let mine = [];
            for (const l of s.links) {
                let src = mine.find(x => Scene.refText(x.ref) === Scene.refText(l.from));
                if (!src) mine.push(src = {
                    scene: s.name,
                    ref: l.from,
                    count: 0
                });
                src.count++;
            }
            for (const src of mine) {
                src.first = links;
                links += src.count;
                sources.push(src);
            }
        }
        return {
            cells: cells,
            total: total,
            sources: sources,
            links: links,
            blob: Anim.nameOf(doc.graph.name + '_' + mapName + '_LINKS')
        };
    },
    sameRef(a, b) {
        return !!a && !!b && a.scene === b.scene && Scene.refText(a) === Scene.refText(b);
    },
    // the numbers of the names of exits and of entries, as the packer gives them: by their first use, going map by
    // map, in each the scenes in the order of the document: the entries of a scene, then its named exits; then the
    // exits of the map
    names(doc) {
        let exits = [],
            entries = [];
        const take = (list, name) => {
            if (name && !list.includes(name)) list.push(name);
        };
        for (const m of doc.maps) {
            const scenes = this.scenesOf(doc, m.name);
            for (const s of scenes) {
                for (const o of Scene.objects(s))
                    if (o.type === 'entry') take(entries, o.name);
                for (const e of s.exits)
                    if (this.isNamed(e)) {
                        take(exits, e.name);
                        take(entries, e.entry);
                    }
            }
            for (const e of m.exits) {
                take(exits, e.name);
                take(entries, e.entry);
            }
        }
        return {
            exits: exits,
            entries: entries
        };
    },
    entriesOf(scene) {
        return scene ? Scene.objects(scene).filter(o => o.type === 'entry').map(o => o.name) : [];
    },
    // what the packer would refuse (error) and what is likely a mistake: [{map, text, error}], map '' for the graph
    // the document as it goes into a file: without maps there is no graph (the editor keeps one to be filled), and
    // the packer makes a graph of any key graph it finds, wanting its start
    saved(doc) {
        if (doc.maps && doc.maps.length) return doc;
        let out = Object.assign({}, doc);
        delete out.graph;
        delete out.maps;
        return out;
    },
    check(doc) {
        let out = [];
        const say = (map, text, error) => out.push({
            map: map,
            text: text,
            error: error !== false
        });
        const events = new Set(Game.events(doc));
        const ident = n => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n);
        const sceneOf = n => doc.scenes.find(s => s.name === n);
        const shows = new Set((doc.shows || []).map(s => s.name));
        if (!doc.maps.length) return out;
        if (!ident(doc.graph.name)) say('', "the graph's name '" + doc.graph.name + "' is no name", true);
        let names = new Set();
        for (const m of doc.maps) {
            if (!ident(m.name)) say(m.name, "'" + m.name + "' is no name", true);
            else if (names.has(m.name)) say(m.name, 'the map ' + m.name + ' twice', true);
            names.add(m.name);
            if (m.rules) {
                const kind = doc.sets.find(s => s.name === m.rules);
                if (!kind || !kind.animation.scripts.length) say(m.name, 'map ' + m.name + ': no kind ' + m.rules + ' with an animation for its rules', true);
            }
            if (!Number.isInteger(m.number) || m.number < 0 || m.number > 65535) say(m.name, 'map ' + m.name + ': the number is 0…65535', true);
            const scenes = this.scenesOf(doc, m.name);
            if (!scenes.length) say(m.name, 'map ' + m.name + ': no scene is in it', false);
            const laid = this.layoutOf(doc, m.name);
            if (laid.total > 65535) say(m.name, 'map ' + m.name + ': ' + laid.total + ' cells, links name 65535 at most', true);
            let indexes = new Set();
            for (const s of scenes) {
                if (!Number.isInteger(s.index) || s.index < 0 || s.index > 255) say(m.name, 'scene ' + s.name + ': index 0…255', true);
                else if (indexes.has(s.index)) say(m.name, 'scene ' + s.name + ': the index ' + s.index + ' is taken in the map', true);
                indexes.add(s.index);
                if (s.kind === 'show' && m.data && !shows.has(m.data)) say(m.name, 'scene ' + s.name + ' is a show, but the data of its map (' + m.data + ') is no show of the game', false);
                if (s.onEnter && !events.has(s.onEnter)) say(m.name, 'scene ' + s.name + ': no kind has the event ' + s.onEnter, true);
                for (const side of this.sides)
                    if (s.leave && s.leave[side] && !events.has(s.leave[side])) say(m.name, 'scene ' + s.name + ', leave ' + side + ': no kind has the event ' + s.leave[side], true);
                let sides = new Set();
                s.exits.forEach((e, i) => {
                    if (e.edge) {
                        if (sides.has(e.edge)) say(m.name, 'scene ' + s.name + ': two exits by the side ' + e.edge, true);
                        sides.add(e.edge);
                        if (e.name) say(m.name, 'scene ' + s.name + ', exit ' + (i + 1) + ': an exit by a side has no name; drop the edge to make it a named exit', false);
                        if (e.entry) say(m.name, 'scene ' + s.name + ', exit ' + (i + 1) + ': an exit by a side comes in across the edge, its entry is not used', false);
                    } else {
                        if (!e.name) say(m.name, 'scene ' + s.name + ', exit ' + (i + 1) + ': an exit by a zone needs a name: the game takes it by the name', true);
                        else if (!ident(e.name)) say(m.name, 'scene ' + s.name + ", exit '" + e.name + "' is no name", true);
                        // a show plays from its start: it needs no entry
                        if (!e.entry && !(sceneOf(e.scene) && sceneOf(e.scene).kind === 'show')) say(m.name, 'scene ' + s.name + ', exit ' + (e.name || i + 1) + ': a named exit leads to an entry: choose one', true);
                    }
                    const to = sceneOf(e.scene);
                    if (to && !to.map) say(m.name, 'scene ' + s.name + ', exit ' + (e.name || e.edge || i + 1) + ': scene ' + to.name + ' is in no map', true);
                });
                for (const o of Scene.objects(s)) {
                    if (o.type !== 'entry') continue;
                    if (o.arrive && !events.has(o.arrive)) say(m.name, 'entry ' + o.name + ' of ' + s.name + ': no kind has the event ' + o.arrive, true);
                    if (o.fires) {
                        const src = this.layoutOf(doc, m.name).sources.find(x => this.sameRef(Object.assign({
                            scene: x.scene
                        }, x.ref), o.fires));
                        if (!src) say(m.name, 'entry ' + o.name + ' of ' + s.name + ': fires links of ' + this.fireText(o.fires) + ', which has no links in the map', true);
                        else if (src.first >= 255) say(m.name, 'entry ' + o.name + ' of ' + s.name + ': fires link ' + src.first + ', an entry fires one of the first 255 of the map', true);
                    }
                }
                s.links.forEach((l, i) => {
                    if (l.event && !events.has(l.event)) say(m.name, 'scene ' + s.name + ', link ' + (i + 1) + ': no kind has the event ' + l.event, true);
                    if (l.value !== null && l.value !== undefined && (!Number.isInteger(l.value) || l.value < -32767 || l.value > 32767)) say(m.name, 'scene ' + s.name + ', link ' + (i + 1) + ': the value is a number within 16 bits', true);
                    if (l.to.object !== undefined) say(m.name, 'scene ' + s.name + ', link ' + (i + 1) + ': its target is an object; a target is a cell (the engine tells links to the lives of cells, an actor of a scene not shown is not there)', true);
                });
            }
            m.exits.forEach((e, i) => {
                if (!ident(e.name)) say(m.name, 'map ' + m.name + ', exit ' + (i + 1) + ": '" + e.name + "' is no name", true);
                const to = sceneOf(e.scene);
                if (!to) say(m.name, 'map ' + m.name + ', exit ' + e.name + ": no scene '" + e.scene + "'", true);
                else {
                    if (!to.map) say(m.name, 'map ' + m.name + ', exit ' + e.name + ': scene ' + to.name + ' is in no map', true);
                    if (to.kind === 'show') {
                        // a show plays from its start: it needs no entry
                    } else if (!e.entry) say(m.name, 'map ' + m.name + ', exit ' + e.name + ': choose an entry of ' + to.name, true);
                    else if (!this.entriesOf(to).includes(e.entry)) say(m.name, 'map ' + m.name + ', exit ' + e.name + ': scene ' + to.name + " has no entry '" + e.entry + "'", true);
                }
            });
        }
        for (const s of doc.scenes)
            if (s.map && !names.has(s.map)) say('', 'scene ' + s.name + ": no map '" + s.map + "'", true);
            else if (!s.map) say('', 'scene ' + s.name + ' is in no map: the graph does not know it', false);
        const n = this.names(doc);
        if (n.exits.length > 255) say('', n.exits.length + ' names of exits, 255 at most', true);
        if (n.entries.length > 255) say('', n.entries.length + ' names of entries, 255 at most', true);
        const start = sceneOf(doc.graph.start.scene);
        if (!start) say('', 'the start: choose the scene the game begins in', true);
        else {
            if (!start.map) say('', 'the start: scene ' + start.name + ' is in no map', true);
            if (start.kind !== 'show' && !this.entriesOf(start).includes(doc.graph.start.entry)) say('', 'the start: scene ' + start.name + " has no entry '" + doc.graph.start.entry + "'", true);
        }
        return out;
    },
};

// the editor of the graph in the middle: the graph and its start, the map chosen, its scenes and exits, the numbers
// of the names
const MapsMain = {
    data() {
        return {
            Maps: Maps,
            Scene: Scene,
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
        map() {
            return this.sprites.maps.find(m => m.name === this.edit.mapName) || this.sprites.maps[0] || null;
        },
        scenes() {
            return this.map ? Maps.scenesOf(this.sprites, this.map.name) : [];
        },
        freeScenes() {
            return this.sprites.scenes.filter(s => !s.map);
        },
        kinds() {
            return Game.kinds(this.sprites);
        },
        events() {
            return Game.events(this.sprites);
        },
        shows() {
            return (this.sprites.shows || []).map(s => s.name);
        },
        names() {
            return Maps.names(this.sprites);
        },
        // the cells and the links of the map chosen, as the packer numbers them
        laid() {
            return this.map ? Maps.layoutOf(this.sprites, this.map.name) : null;
        },
        inMaps() {
            return this.sprites.scenes.filter(s => s.map);
        },
        startEntries() {
            return Maps.entriesOf(this.sprites.scenes.find(s => s.name === this.sprites.graph.start.scene));
        },
        problems() {
            const name = this.map ? this.map.name : '';
            return Maps.check(this.sprites).filter(p => p.map === name || p.map === '');
        },
    },
    methods: {
        entriesOf(name) {
            return Maps.entriesOf(this.sprites.scenes.find(s => s.name === name));
        },
        sidesOf(s) {
            return s.exits.filter(e => e.edge).map(e => e.edge + ' → ' + e.scene).join(', ');
        },
        leaveOf(s) {
            return Maps.sides.filter(side => s.leave && s.leave[side]).map(side => side + ': ' + s.leave[side]).join(', ');
        },
        namedOf(s) {
            return s.exits.filter(e => Maps.isNamed(e)).map(e => e.name + ' → ' + e.scene + '/' + e.entry).join(', ');
        },
        addMap() {
            const m = Maps.newMap(Scene.freeName(this.sprites.maps, 'map'));
            this.sprites.maps.push(m);
            this.edit.mapName = m.name;
        },
        renameMap(event) {
            const name = event.target.value.trim();
            if (!name || this.sprites.maps.some(m => m !== this.map && m.name === name)) {
                event.target.value = this.map.name;
                return;
            }
            for (const s of this.sprites.scenes)
                if (s.map === this.map.name) s.map = name;
            this.map.name = name;
            this.edit.mapName = name;
        },
        removeMap() {
            if (!confirm(T('Remove map ' + this.map.name + '? Its scenes stay, out of any map', 'Удалить карту ' + this.map.name + '? Её сцены останутся, вне карт'))) return;
            for (const s of this.scenes) s.map = '';
            this.sprites.maps.splice(this.sprites.maps.indexOf(this.map), 1);
            this.edit.mapName = this.sprites.maps.length ? this.sprites.maps[0].name : '';
        },
        addScene(event) {
            const s = this.sprites.scenes.find(x => x.name === event.target.value);
            event.target.value = '';
            if (!s) return;
            s.map = this.map.name;
            const used = new Set(this.scenes.map(x => x.index));
            let i = 0;
            while (used.has(i)) ++i;
            s.index = i;
        },
        setInt(obj, key, event, low, high) {
            const v = parseInt(event.target.value, 10);
            if (Number.isInteger(v) && v >= low && v <= high) obj[key] = v;
            else event.target.value = obj[key];
        },
        openScene(s) {
            this.spritesStore.open({
                page: 'scenes',
                scene: s.name
            });
        },
        addExit() {
            const e = Maps.newExit();
            e.scene = this.scenes[0] ? this.scenes[0].name : (this.sprites.scenes[0] ? this.sprites.scenes[0].name : '');
            e.name = this.map.exits.length ? 'exit' + (this.map.exits.length + 1) : 'start';
            this.map.exits.push(e);
        },
    },
    template: `
        <div class="maps-main">
            <h6 :title="T('The graph of scenes: one for the game; its name is the prefix of the constants of the header (WORLD_EXIT_start, WORLD_ENTRY_start, WORLD_MAP_level1)', 'Граф сцен: один на игру; его имя — префикс констант заголовка (WORLD_EXIT_start, WORLD_ENTRY_start, WORLD_MAP_level1)')">{{T('Graph', 'Граф')}}
                <input :value="sprites.graph.name" size="10" @change="sprites.graph.name = $event.target.value.trim()" :title="T('The name of the graph: a blob of the pack and the prefix of the constants', 'Имя графа — блоб пакета и префикс констант')">
                <span :title="T('Where the game begins: a scene and its entry', 'Где игра начинается: сцена и её вход')">{{T('start', 'начало')}}</span>
                <select v-model="sprites.graph.start.scene" :title="T('The scene the game begins in (of the maps)', 'Сцена, в которой игра начинается (из карт)')"><option value="">—</option><option v-for="s in inMaps" :value="s.name">{{s.name}}</option></select>
                <select v-model="sprites.graph.start.entry" :title="T('An entry of this scene', 'Вход этой сцены')"><option value="">—</option><option v-for="e in startEntries" :value="e">{{e}}</option></select>
            </h6>
            <div class="view-toolbar">
                <label>{{T('Map', 'Карта')}} <select v-model="edit.mapName" :title="T('A map: a cloud of scenes with common data — a level or a show', 'Карта: облако сцен с общими данными — уровень или показ')"><option v-for="m in sprites.maps" :value="m.name">{{m.name}}</option></select></label>
                <button class="btn btn-sm btn-outline-primary" @click="addMap" :title="T('A new map', 'Новая карта')">{{T('+ map', '+ карта')}}</button>
                <template v-if="map">
                    <input :value="map.name" size="10" @change="renameMap" :title="T('The name of the map: the constant WORLD_MAP_NAME; the scenes of the map follow it', 'Имя карты: константа WORLD_MAP_ИМЯ; сцены карты следуют за ним')">
                    <button class="btn btn-sm btn-remove" @click="removeMap">{{T('× map', '× карта')}}</button>
                </template>
            </div>
            <template v-if="map">
                <div class="prop" :title="T('The data of the map: the name of a blob of the pack — a level (LEVEL_1, the game puts it) or a show of Game → Shows; empty — none', 'Данные карты: имя блоба пакета — уровень (LEVEL_1, его кладёт игра) или показ из «Игра → Показы»; пусто — нет')">{{T('data', 'данные')}}
                    <input :value="map.data" list="maps-shows" size="16" @change="map.data = $event.target.value.trim()"></div>
                <div class="prop" :title="T('The rules of the map: a kind (an animation) whose actor lives while the game is on the map; its events are the events of the map (death, end), the script tells which exit of the map to take: go <exit> (the packer makes it signal N, N the number of the name of the exit, the table below)', 'Правила карты: вид (анимация), чей актёр живёт, пока игра на карте; его события — события карты (death, end), скрипт говорит, какой выход карты взять: go <выход> (упаковщик делает из него signal N, где N — номер имени выхода, таблица ниже)')">{{T('rules', 'правила')}}
                    <select v-model="map.rules"><option value="">{{T('none', 'нет')}}</option><option v-for="k in kinds" :value="k.name">{{k.name}}</option></select></div>
                <div class="prop" :title="T('The number the game calls the map by (level 13 shown as 12); 0 — none', 'Номер, которым игра называет карту (уровень 13 показан как 12); 0 — никакого')">{{T('number', 'номер')}}
                    <input class="num" :value="map.number" @change="setInt(map, 'number', $event, 0, 65535)"></div>

                <h6 :title="T('The scenes of the map: the number in the map (a constant of the game), the kind (a room or a show), an event to the rules of the map on entering', 'Сцены карты: номер в карте (константа игры), вид (комната или показ), событие правилам карты при входе')">{{T('Scenes of', 'Сцены карты')}} {{map.name}}
                    <select value="" @change="addScene" :title="T('Add a scene to the map (the scenes out of maps)', 'Добавить сцену в карту (сцены вне карт)')"><option value="">{{T('+ scene…', '+ сцена…')}}</option><option v-for="s in freeScenes" :value="s.name">{{s.name}}</option></select></h6>
                <table class="table table-sm game-table"><thead><tr><th>{{T('scene', 'сцена')}}</th><th :title="T('The number of the scene in the map, 0…255', 'Номер сцены в карте, 0…255')">{{T('index', 'номер')}}</th><th :title="T('room — a room of the map’s data; show — a show (the data of the map is a show)', 'room — комната карты данных; show — показ (данные карты — показ)')">{{T('kind', 'вид')}}</th><th :title="T('An event to the rules of the map on entering the scene (a checkpoint)', 'Событие правилам карты при входе в сцену (checkpoint)')">{{T('on enter', 'при входе')}}</th><th :title="T('Exits by sides: exits of the scene with edge', 'Выходы по сторонам: exits сцены с edge')">{{T('sides', 'стороны')}}</th><th :title="T('Events to the rules of the map on leaving the scene by a side (leave in the properties of the scene); a side with an event and no scene beside is an exit off the map', 'События правилам карты при уходе со сцены по стороне (leave в свойствах сцены); сторона с событием без сцены рядом — выход с карты')">{{T('leave', 'уход')}}</th><th :title="T('Exits by name: exits of the scene with name', 'Выходы по имени: exits сцены с name')">{{T('named exits', 'выходы по имени')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="s in scenes" :key="s.name">
                        <td><a href="#" @click.prevent="openScene(s)">{{s.name}}</a></td>
                        <td><input class="num" :value="s.index" @change="setInt(s, 'index', $event, 0, 255)"></td>
                        <td><select v-model="s.kind"><option v-for="k in Maps.kinds" :value="k">{{k}}</option></select></td>
                        <td><input :value="s.onEnter" size="8" list="maps-events" @change="s.onEnter = $event.target.value.trim()"></td>
                        <td class="help-text">{{sidesOf(s) || '—'}}</td>
                        <td class="help-text">{{leaveOf(s) || '—'}}</td>
                        <td class="help-text">{{namedOf(s) || '—'}}</td>
                        <td><button class="btn btn-sm btn-remove" @click="s.map = ''" :title="T('Take the scene out of the map (the scene stays)', 'Убрать сцену из карты (сцена остаётся)')">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!scenes.length" class="anim-empty">{{T('No scenes in the map: «+ scene…».', 'В карте нет сцен: «+ сцена…».')}}</div>

                <h6 :title="T('Exits of the whole map: the rules of the map take them (signal N) — the end of a level, a death, time is up', 'Выходы всей карты: их берут правила карты (signal N) — конец уровня, смерть, время вышло')">{{T('Exits of the map', 'Выходы карты')}}
                    <button class="btn btn-sm btn-outline-secondary" @click="addExit">{{T('+ exit', '+ выход')}}</button></h6>
                <table class="table table-sm game-table"><thead><tr><th>{{T('name', 'имя')}}</th><th>{{T('to scene', 'в сцену')}}</th><th>{{T('entry', 'вход')}}</th><th :title="T('The transition: cut — at once, fade — darkening, wipe — a curtain from left to right, seamless — at once and going on as it was: the game does not set up the one coming anew', 'Переход: cut — сразу, fade — затемнение, wipe — шторкой слева направо, seamless — сразу и как шёл: игра не заводит пришедшего заново')">{{T('transition', 'переход')}}</th><th></th></tr></thead><tbody>
                    <tr v-for="e in map.exits" :key="map.exits.indexOf(e)">
                        <td><input :value="e.name" size="8" @change="e.name = $event.target.value.trim()" :title="T('The name of the exit: the constant WORLD_EXIT_NAME, its number is in the table below', 'Имя выхода: константа WORLD_EXIT_ИМЯ, его номер — в таблице ниже')"></td>
                        <td><select v-model="e.scene"><option v-for="s in sprites.scenes" :value="s.name">{{s.name}}</option></select></td>
                        <td><select v-model="e.entry"><option value="">—</option><option v-for="n in entriesOf(e.scene)" :value="n">{{n}}</option></select></td>
                        <td><select v-model="e.transition"><option v-for="t in Maps.transitions" :value="t">{{t}}</option></select></td>
                        <td><button class="btn btn-sm btn-remove" @click="map.exits.splice(map.exits.indexOf(e), 1)">×</button></td>
                    </tr>
                </tbody></table>
                <div v-if="!map.exits.length" class="anim-empty">{{T('No exits of the map.', 'У карты нет выходов.')}}</div>
            </template>
            <div v-else class="anim-empty">{{T('No maps: «+ map», then put scenes in it. Exits by sides and by names, entries and links are of the scenes (Scenes).', 'Карт нет: «+ карта», потом положите в неё сцены. Выходы по сторонам и по имени, входы и связи — у самих сцен (Сцены).')}}</div>

            <h6 :title="T('The numbers of the names of exits and entries, as the packer gives them (by the first use: maps in order, in a map scenes in order, of a scene the entries, then the named exits, then the exits of the map). In the rules of a map go NAME is signal NUMBER', 'Номера имён выходов и входов, как их даёт упаковщик (по первому появлению: карты по порядку, в карте сцены по порядку, у сцены входы, потом именованные выходы, потом выходы карты). В правилах карты go ИМЯ — это signal НОМЕР')">{{T('Names', 'Имена')}}
            </h6>
            <div class="help-text">{{T('exits:', 'выходы:')}} <span v-for="(n, i) in names.exits" class="maps-name">{{n}} = {{i}}</span><span v-if="!names.exits.length">—</span></div>
            <div class="help-text">{{T('entries:', 'входы:')}} <span v-for="(n, i) in names.entries" class="maps-name">{{n}} = {{i}}</span><span v-if="!names.entries.length">—</span></div>
            <template v-if="laid">
                <div class="help-text" :title="T('The numbers of the cells of the map, as the packer gives them: the scenes of the map in order, the grids of a scene in order, a grid row by row — number = first + row × cols + col (dgx_ge_layout_cell_at). Links name cells by them', 'Номера клеток карты, как их даёт упаковщик: сцены карты по порядку, сетки сцены по порядку, сетка по строкам — номер = first + row × cols + col (dgx_ge_layout_cell_at). Ими связи называют клетки')">{{T('cells of', 'клетки карты')}} {{map.name}}: <span v-for="c in laid.cells" class="maps-name">{{c.scene}}.{{c.grid}} {{c.first}}…{{c.first + c.count - 1}}</span><span v-if="!laid.cells.length">—</span></div>
                <div class="help-text" :title="T('The links of the map, the blob ' + laid.blob + ': by scenes, in a scene by sources in the order they first come, the links of a source together. The number is that of the first link of the source (fires of an entry and dgx_ge_layout_links_of take it), in brackets how many there are', 'Связи карты — блоб ' + laid.blob + ': по сценам, в сцене по источникам в порядке первого появления, связи источника подряд. Число — номер первой связи источника (его берут fires входа и dgx_ge_layout_links_of), в скобках — сколько их')">{{T('links', 'связи')}} {{laid.blob}}: <span v-for="x in laid.sources" class="maps-name">{{x.scene}}: {{Scene.refText(x.ref)}} = {{x.first}} ({{x.count}})</span><span v-if="!laid.sources.length">—</span></div>
            </template>
            <datalist id="maps-events"><option v-for="e in events" :value="e"></option></datalist>
            <datalist id="maps-shows"><option v-for="s in shows" :value="s"></option></datalist>
            <div v-if="problems.length" class="game-problems">
                <div v-for="p in problems" :class="p.error ? 'error-text' : 'warning-text'">{{p.error ? '✖' : '⚠'}} {{p.text}}</div>
            </div>
        </div>
    `
};

const MapsStatus = {
    template: `
        <div class="bench-status-row">
            <span class="status-prompt">{{T('Maps: a map is a cloud of scenes with common data (a level, a show); exits by sides and by names, entries and links are of the scenes themselves (Scenes); here are the numbers of scenes in a map, the exits of the whole map, the rules and the start of the game.', 'Карты: карта — облако сцен с общими данными (уровень, показ); выходы по сторонам и по имени, входы и связи — у самих сцен (Сцены), здесь — номера сцен в карте, выходы всей карты, правила и начало игры.')}}</span>
        </div>
    `
};
