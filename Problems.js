// All the problems of the document in one list, for the node Problems of the tree and the count at the top:
// the checks of the animations of every kind, of the scenes and tilesets, of the styles and the dialogs, the meets,
// and frames whose pictures are not loaded. Each has where it leads (what spritesStore.open takes)
const Problems = {
    // -> [{error, source, text, where}]; fontOf(name) -> the font for the checks of styles
    collect(sprites, fontOf) {
        let list = [];
        const say = (error, source, text, where) => list.push({
            error: error,
            source: source,
            text: text,
            where: where
        });
        for (const set of sprites.sets) {
            if (set.animation && set.animation.scripts.length) {
                const r = Anim.check(set, sprites.sets);
                for (const p of r.errors) say(true, set.name, p.text, this.whereOfAnim(set, p));
                for (const p of r.warnings) say(false, set.name, p.text, this.whereOfAnim(set, p));
            }
            for (const text of this.colors(set)) say(true, set.name, text, {
                page: 'frames',
                set: set.name
            });
            const palette = Game.paletteProblem(sprites, set);
            if (palette) say(true, set.name, palette, {
                page: 'frames',
                set: set.name
            });
            const missing = set.frames.filter(f => !FrameImages.get(set.name, f.image)).length;
            if (missing) say(false, set.name, missing + (missing === 1 ? ' frame has' : ' frames have') + ' no picture: load the PNG files of the kind', {
                page: 'frames',
                set: set.name
            });
        }
        for (const p of Scene.check(sprites)) {
            say(!!p.error, p.scene ? 'scene ' + p.scene : p.tileset ? 'tileset ' + p.tileset : 'scenes', p.text,
                p.scene ? {
                    page: 'scenes',
                    scene: p.scene
                } : p.tileset ? {
                    page: 'scenes',
                    tileset: p.tileset
                } : {
                    page: 'scenes'
                });
        }
        for (const p of Styles.check(sprites, sprites.screen, fontOf)) {
            say(!!p.error, 'style ' + p.style, p.text, {
                page: 'dialogs',
                style: p.style
            });
        }
        for (const d of sprites.dialogs || []) {
            const r = Dialogs.parse(d.text, sprites);
            for (const t of r.errors) say(true, 'dialog ' + d.name, t, {
                page: 'dialogs',
                dialog: d.name
            });
            for (const t of r.warnings) say(false, 'dialog ' + d.name, t, {
                page: 'dialogs',
                dialog: d.name
            });
            // a translation of a line of numbers shows the line's {names}, in any order; another the packer refuses
            if (r.dialog && typeof Translations !== 'undefined')
                for (const lang of Translations.keys()) {
                    const po = Translations.get(lang);
                    for (const s of r.dialog.code) {
                        if (s.op !== 'say' || !(s.params || s.param !== undefined)) continue;
                        const names = s.params || [s.param];
                        const t = po[r.dialog.name + '\u0004' + s.msgid];
                        for (const text of Array.isArray(t) ? t : t ? [t] : [])
                            for (const m of text.matchAll(/\{((?:game_var\.)?\w+)\}/g))
                                if (!names.includes(m[1])) say(true, 'dialog ' + d.name, lang + ".po: '" + text + "' shows {" + m[1] + '}, a number the line has not', {
                                    page: 'dialogs',
                                    dialog: d.name
                                });
                    }
                }
        }
        for (const p of Game.check(sprites)) {
            const part = Game.parts.find(x => x[0] === p.part);
            say(p.error, 'game: ' + (part ? part[1].toLowerCase() : p.part), p.text, {
                gamePart: p.part,
                show: p.part === 'shows' ? p.name : undefined
            });
        }
        for (const p of Maps.check(sprites)) {
            say(p.error, p.map ? 'map ' + p.map : 'graph', p.text, {
                map: p.map
            });
        }
        for (const p of this.header(sprites)) say(true, p.source, p.text, p.where);
        const meets = Meets.parse(sprites.meets, sprites.masks);
        for (const t of meets.errors) say(true, 'meets', t, {
            page: 'masks'
        });
        for (const t of meets.warnings) say(false, 'meets', t, {
            page: 'masks'
        });
        return list;
    },
    // the colors of a set as the packer takes them: a value has the color the palettes of the pictures that use it
    // give it, all alike; a value a picture uses beyond its palette has none (0 is transparent). A set of a ready
    // palette brings every color to the palette's nearest: its frames need not share their values
    colors(set) {
        let out = [],
            said = []; // value -> [color, file] of the first picture that uses it
        for (const f of set.frames) {
            const p = FrameImages.get(set.name, f.image);
            if (!p || !p.indexes) continue;
            let used = new Set(p.indexes);
            used.delete(0);
            for (const i of [...used].sort((a, b) => a - b)) {
                const c = p.palette[i];
                if (!c) {
                    out.push(f.image + ': value ' + i + ' has no color in its palette (of ' + p.palette.length + ')');
                    break;
                }
                if (set.palette !== undefined) continue;
                const color = '(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
                if (!said[i]) said[i] = [color, f.image];
                else if (said[i][0] !== color && !said[i][2]) {
                    out.push('value ' + i + ' is ' + said[i][0] + ' in ' + said[i][1] + ', ' + color + ' in ' + f.image + ': the frames of a set share their colors');
                    said[i][2] = true; // once a value
                }
            }
        }
        return out;
    },
    // names the header of the pack gives two things alike, as the packer refuses them: letters other than A-Z and 0-9
    // become _ and all is upper case, so 'Walk' and 'walk', 'stand-1' and 'stand_1', or two Cyrillic names of one
    // length are one #define; and a name that comes out COUNT where the header counts too. Sets, palettes, pictures,
    // blobs and styles are checked where they are made (Scene.check, Anim.check, Styles.check)
    header(sprites) {
        let out = [];
        // items: [name, where, what it is (the name itself if none)]: two things of one cleaned name are one #define;
        // counted: the header has <prefix>COUNT too; countOnly: the rest is checked where those are made
        const group = (prefix, items, source, counted, countOnly) => {
            let seen = new Map();
            for (const [name, where, id] of items) {
                if (typeof name !== 'string' || !name) continue;
                const n = Anim.nameOf(name),
                    thing = id === undefined ? name : id;
                if (counted && n === 'COUNT') out.push({
                    source: source,
                    text: "'" + name + "' is " + prefix + 'COUNT in the header, which counts them: rename it',
                    where: where
                });
                else if (countOnly) continue;
                else if (seen.has(n) && seen.get(n)[1] !== thing) out.push({
                    source: source,
                    text: "'" + seen.get(n)[0] + "' and '" + name + "' are one name in the header, " + prefix + n + ' (letters other than A-Z and 0-9 become _, all capitals): rename one',
                    where: where
                });
                else if (!seen.has(n)) seen.set(n, [name, thing]);
            }
        };
        const sets = sprites.sets || [];
        group('SET_', [...sets, ...(sprites.palettes || [])].map(s => [s.name, {
            page: 'frames',
            set: s.name
        }]), 'kinds', true, true);
        group('IMG_', [...sets.flatMap(s => s.frames.map(f => [Anim.imageName(s, f.image), {
            page: 'frames',
            set: s.name
        }])), ...(sprites.crops || []).map(c => [c.name, {
            gamePart: 'crops'
        }])], 'pictures', true, true);
        let events = [];
        for (const s of sets) {
            const a = s.animation;
            if (!a || !a.scripts.length) continue;
            const where = {
                page: 'anim',
                set: s.name
            };
            const k = Anim.nameOf(s.name) + '_';
            group(k + 'SCRIPT_', a.scripts.map(x => [x.name, Object.assign({
                animView: 'scripts',
                script: x.name
            }, where)]), s.name);
            group(k + 'PARAM_', a.params.map(p => [p.name, where]), s.name);
            group(k + 'GAME_', (a.questions || []).map(q => [q, where]), s.name);
            for (const e of a.events) events.push([e, where]);
        }
        group('EVENT_', events, 'events');
        group('MASK_', (sprites.masks || []).map(m => [m.name, {
            page: 'masks'
        }, m.index]), 'masks');
        group('POINT_', sets.flatMap(s => s.frames.flatMap(f => Object.keys(f.points || {}).map(p => [p, {
            page: 'frames',
            set: s.name
        }]))), 'points');
        group('SOUND_', (sprites.sounds || []).map(n => [n, {
            gamePart: 'sounds'
        }]), 'game: sounds', true);
        group('MUSIC_', Game.musics(sprites).map(n => [n, {
            gamePart: 'music'
        }]), 'game: music', true);
        group('TIMER_', (sprites.timers || []).map(t => [t.name, {
            gamePart: 'timers'
        }]), 'game: timers');
        group('GAME_', (sprites.game || []).map(c => [c.name, {
            gamePart: 'constants'
        }]), 'game: numbers');
        for (const t of sprites.tilesets || []) group(Anim.nameOf(t.name) + '_TILE_', t.tiles.map(x => [x.name, {
            page: 'scenes',
            tileset: t.name
        }]), 'tileset ' + t.name);
        if (sprites.graph && sprites.graph.name && (sprites.maps || []).length) {
            const g = Anim.nameOf(sprites.graph.name) + '_';
            const n = Maps.names(sprites);
            group(g + 'EXIT_', n.exits.map(e => [e, {
                map: ''
            }]), 'graph');
            group(g + 'ENTRY_', n.entries.map(e => [e, {
                map: ''
            }]), 'graph');
            group(g + 'MAP_', sprites.maps.map(m => [m.name, {
                map: m.name
            }]), 'graph');
        }
        return out;
    },
    // a problem of an animation leads to its script, rule, event or group
    whereOfAnim(set, p) {
        let w = {
            page: 'anim',
            set: set.name
        };
        if (p.kind === 'script' || p.kind === 'state') {
            w.animView = 'scripts';
            w.script = p.name;
            w.line = p.line;
        } else if (p.kind === 'rule') {
            w.animView = 'transitions';
            w.animTab = 'rules';
        } else if (p.kind === 'event') {
            w.animView = 'transitions';
            w.animTab = 'byEvent';
            w.event = p.name;
        } else if (p.kind === 'group') {
            w.animView = 'transitions';
            w.animTab = 'groups';
            w.group = p.name;
        }
        return w;
    },
    // the marks of the tree: errors and warnings by the name of a set, and by the script of a set
    counts(list) {
        let bySet = {},
            byScript = {},
            byScene = {},
            byStyle = {},
            byDialog = {},
            byGame = {},
            byMap = {};
        const add = (map, key, p) => {
            if (!map[key]) map[key] = {
                errors: 0,
                warnings: 0
            };
            if (p.error) map[key].errors++;
            else map[key].warnings++;
        };
        for (const p of list) {
            const w = p.where;
            if (w.set) {
                add(bySet, w.set, p);
                if (w.script) add(byScript, w.set + '/' + w.script, p);
            }
            if (w.scene) add(byScene, w.scene, p);
            if (w.style) add(byStyle, w.style, p);
            if (w.dialog) add(byDialog, w.dialog, p);
            if (w.gamePart) add(byGame, w.gamePart, p);
            if (w.map !== undefined) add(byMap, w.map, p);
        }
        return {
            bySet: bySet,
            byScript: byScript,
            byScene: byScene,
            byStyle: byStyle,
            byDialog: byDialog,
            byGame: byGame,
            byMap: byMap
        };
    },
    mark(c) {
        if (!c) return '';
        return c.errors ? '✖' : c.warnings ? '⚠' : '';
    },
};
