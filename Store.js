// what a saved file is: a converter reads these two keys to know whether it can convert the file.
// The version is increased when a file of the new format cannot be read as one of the old format
const SpriteFormat = {
    name: 'dgx-ge-sprites',
    version: 1
};
// masks take indexes from 0 up to this number less one. It is a setting of the editor, the format has no such limit
const MaskLimit = 16;
const MaskColors = [
    '#3070e0', '#e04040', '#30a030', '#e09020', '#a040c0', '#20a0a0', '#e050a0', '#808020',
    '#a05020', '#2040a0', '#60c060', '#c07070', '#5050ff', '#ff7000', '#008080', '#800080'
];
// the document is kept here between visits, pictures are not: they are loaded again.
// Only pictures the editor changed and the user did not load back from files are kept, as PNG in base64
const StorageKeys = {
    sprites: 'dgx-ge-sprites',
    edit: 'dgx-ge-sprites-edit',
    pictures: 'dgx-ge-sprites-pictures'
};
// The folder of the project opened by the browser's access to folders (openProjectFolder): the editor keeps it as it
// keeps the document, writing into it a moment after each change (saveProjectFolder), and remembers it over a reload
// (the browser asks again for the right to write). Its game (main/, tools/) and its builds are not the editor's.
const ProjectFolder = {
    data: 'game_data', // the folder of the data in the folder of a game: the editor's; the game's code lies beside it
    handle: null,
    json: '', // the name of its document
    written: new Map(), // path -> the text last written there or read from there: what is the same is not written again
    saved: '', // the document as it was last written (or opened): a change of the view alone writes nothing
    busy: null, // the save going on, a promise
    skipped(name) {
        return /^(build|build-.*|managed_components|components|main|tools|nvs|node_modules)$/.test(name) || name.startsWith('.');
    },
    // the folder of the data: the one chosen, or its game_data/ when it is the folder of a game (no document at its top)
    async dataOf(handle) {
        let json = false,
            data = null;
        for await (const [name, h] of handle.entries()) {
            if (h.kind === 'file' && /\.json$/i.test(name)) json = true;
            if (h.kind === 'directory' && name === this.data) data = h;
        }
        return !json && data ? data : handle;
    },
    // the handle kept by the browser over a reload (IndexedDB: a handle cannot be kept in localStorage)
    keep(handle, label) {
        return new Promise(resolve => {
            try {
                const r = indexedDB.open('dgx-ge-editor', 1);
                r.onupgradeneeded = () => r.result.createObjectStore('folders');
                r.onsuccess = () => {
                    const t = r.result.transaction('folders', 'readwrite');
                    if (handle) t.objectStore('folders').put({
                        handle: handle,
                        label: label || handle.name
                    }, 'project');
                    else t.objectStore('folders').delete('project');
                    t.oncomplete = t.onerror = () => resolve();
                };
                r.onerror = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    },
    kept() {
        return new Promise(resolve => {
            try {
                const r = indexedDB.open('dgx-ge-editor', 1);
                r.onupgradeneeded = () => r.result.createObjectStore('folders');
                r.onsuccess = () => {
                    const g = r.result.transaction('folders').objectStore('folders').get('project');
                    // {handle, label}; a handle alone of an earlier version
                    g.onsuccess = () => resolve(g.result && g.result.handle ? g.result : g.result ? {
                        handle: g.result,
                        label: g.result.name
                    } : null);
                    g.onerror = () => resolve(null);
                };
                r.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },
};
// steps back of pictures painted: {picture, indexes, palette}
const PictureUndo = [];
// steps back of the document: snapshots of it as text, taken when it stands still after a change; a step of a
// picture painted is a mark here, its pixels are in PictureUndo
const History = {
    undo: [], // [{kind: 'doc', text} | {kind: 'picture'}]
    redo: [], // [{kind: 'doc', text}]
    last: '', // the snapshot the document matched last
    limit: 40,
};

const Tools = {
    origin: {
        get name() {
            return T('Base point', 'Базовая точка');
        },
        key: 'o',
        get hint() {
            return T('Base point: a click on a cell puts it, the arrows move it', 'Базовая точка: щелчок по клетке ставит её, стрелки сдвигают');
        }
    },
    brush: {
        get name() {
            return T('Brush', 'Кисть');
        },
        key: 'b',
        get hint() {
            return T('Brush: paints the current mask (the right button erases)', 'Кисть: рисует текущую маску (правой кнопкой — стирает)');
        }
    },
    eraser: {
        get name() {
            return T('Eraser', 'Ластик');
        },
        key: 'e',
        get hint() {
            return T('Eraser: erases the current mask (the right button paints)', 'Ластик: стирает текущую маску (правой кнопкой — рисует)');
        }
    },
    rect: {
        get name() {
            return T('Rectangle', 'Прямоугольник');
        },
        key: 'r',
        get hint() {
            return T('Rectangle: fills a frame in the current mask (the right one erases)', 'Прямоугольник: закрашивает рамку в текущей маске (правой — стирает)');
        }
    },
    point: {
        get name() {
            return T('Points', 'Точки');
        },
        key: 'p',
        get hint() {
            return T('Points of attachment: choose and move', 'Точки привязки: выбрать и передвинуть');
        }
    },
    // the pixels of the picture itself, in a colour of its palette
    pencil: {
        get name() {
            return T('Pencil', 'Карандаш');
        },
        key: 'd',
        get hint() {
            return T('Pencil: draws pixels of the picture in the chosen colour of the palette (the right one: transparent)', 'Карандаш: рисует пиксели картинки выбранным цветом палитры (правой — прозрачным)');
        }
    },
    fill: {
        get name() {
            return T('Fill', 'Заливка');
        },
        key: 'f',
        get hint() {
            return T('Fill: an area of one colour of the picture, in the chosen colour (the right one: transparent)', 'Заливка: область одного цвета картинки — выбранным цветом (правой — прозрачным)');
        }
    },
    picker: {
        get name() {
            return T('Picker', 'Пипетка');
        },
        key: 'i',
        get hint() {
            return T('Picker: the colour of a pixel of the picture becomes the chosen one', 'Пипетка: цвет пикселя картинки становится выбранным');
        }
    },
    // a rectangle of the frame is selected, then its pixels of the picture and of the masks move
    move: {
        get name() {
            return T('Move', 'Сдвиг');
        },
        key: 'm',
        get hint() {
            return T('Move: select a part of the picture and move it along with the masks', 'Сдвиг: выделить часть картинки и сдвинуть её вместе с масками');
        }
    },
};

function newSet(name) {
    return {
        name: name,
        // index of the mask a frame without masks has: its opaque pixels. null: such a frame has no masks at all
        defaultMask: 1,
        canvas: {
            left: 0,
            top: 0,
            width: 0,
            height: 0
        },
        frames: [],
        // scripts of frames and the rules between them, see Anim.js
        animation: Anim.empty()
    };
}

function newSprites() {
    return {
        format: SpriteFormat.name,
        formatVersion: SpriteFormat.version,
        name: 'sprites',
        masks: [{
            index: 1,
            name: 'body',
            color: MaskColors[1]
        }],
        sets: [newSet('set')],
        // the levels, see Scene.js
        screen: {
            width: 320,
            height: 240
        },
        tilesets: [],
        scenes: [],
        // how dialogs look, see Styles.js
        styles: [],
        // dialogs as their texts, see Dialogs.js
        dialogs: [],
        // sets of colors without pictures: colors of tiles name them, a set of pictures is previewed in them
        palettes: [],
        // the game as a whole: constants, timers, sounds, shows, chases, crops, see Game.js
        game: [],
        // the game's names of numbers its scripts write (Pack.add_constants): name -> number, at packing only
        constants: {},
        timers: [],
        sounds: [],
        shows: [],
        chases: [],
        crops: [],
        // the graph of scenes: maps and the start, see Maps.js
        graph: Maps.newGraph(),
        maps: []
    };
}

function compareNames(a, b) {
    return a.localeCompare(b, undefined, {
        numeric: true
    });
}

// rectangle {left, top, right, bottom} (right and bottom are outside) a frame takes around its base point:
// the base point itself, the picture, the masks and the points
function frameExtent(frame) {
    let e = {
        left: 0,
        top: 0,
        right: 1,
        bottom: 1
    };
    let take = (x, y, w, h) => {
        e.left = Math.min(e.left, x);
        e.top = Math.min(e.top, y);
        e.right = Math.max(e.right, x + w);
        e.bottom = Math.max(e.bottom, y + h);
    };
    if (frame.width && frame.height) take(-frame.origin.x, -frame.origin.y, frame.width, frame.height);
    for (const k in frame.masks) {
        const m = frame.masks[k];
        if (m.width && m.height) take(m.x, m.y, m.width, m.height);
    }
    for (const n in frame.points) take(frame.points[n].x, frame.points[n].y, 1, 1);
    return e;
}

// the smallest canvas all frames of a set fit in, null when there are no frames
function setExtent(set) {
    let e = null;
    for (const frame of set.frames) {
        const f = frameExtent(frame);
        if (!e) e = f;
        else e = {
            left: Math.min(e.left, f.left),
            top: Math.min(e.top, f.top),
            right: Math.max(e.right, f.right),
            bottom: Math.max(e.bottom, f.bottom)
        };
    }
    return e;
}

// What the selected area took from its frame. It is kept while the area is selected, so pixels moved out of
// the picture or the canvas come back when the area returns. Not a part of the state:
// {picture, base, pixels, masks: {index: {base, bits}}, written: {index: mask}}.
// base is the picture and the masks without the pixels of the area, pixels and bits are the area itself
let Lifted = null;

// pixels of a rectangle from the base point
function rectPixels(left, top, width, height) {
    let pixels = [];
    for (let y = top; y < top + height; ++y) {
        for (let x = left; x < left + width; ++x) pixels.push({
            x: x,
            y: y
        });
    }
    return pixels;
}

// takes the pixels of the selection where it stands
function liftArea(frame, picture, s) {
    const w = s.width,
        h = s.height;
    let lifted = {
        picture: picture,
        base: null,
        pixels: null,
        masks: {},
        written: {}
    };
    if (picture) {
        lifted.base = picture.indexes.slice();
        lifted.pixels = new Uint8Array(w * h);
        for (let r = 0; r < h; ++r) {
            for (let c = 0; c < w; ++c) {
                const px = s.left + c + frame.origin.x;
                const py = s.top + r + frame.origin.y;
                if (px < 0 || py < 0 || px >= picture.width || py >= picture.height) continue;
                const i = py * picture.width + px;
                lifted.pixels[r * w + c] = lifted.base[i];
                lifted.base[i] = 0;
            }
        }
    }
    for (const k in frame.masks) {
        const g = Mask.decode(frame.masks[k]);
        const bits = new Uint8Array(w * h);
        for (let r = 0; r < h; ++r) {
            for (let c = 0; c < w; ++c) {
                const mc = s.left + c - g.x;
                const mr = s.top + r - g.y;
                if (mc >= 0 && mr >= 0 && mc < g.width && mr < g.height && g.bits[mr * g.width + mc]) bits[r * w + c] = 1;
            }
        }
        lifted.masks[k] = {
            base: Mask.paint(frame.masks[k], rectPixels(s.left, s.top, w, h), false),
            bits: bits
        };
    }
    return lifted;
}

// puts the taken pixels where the selection stands now: transparent pixels of the area leave what is under them,
// pixels out of the picture or of the canvas are cut
function placeArea(frame, s, lifted, canvas) {
    const w = s.width,
        h = s.height;
    const left = s.left + s.dx,
        top = s.top + s.dy;
    const picture = lifted.picture;
    if (picture) {
        const indexes = lifted.base.slice();
        for (let r = 0; r < h; ++r) {
            for (let c = 0; c < w; ++c) {
                const v = lifted.pixels[r * w + c];
                const px = left + c + frame.origin.x;
                const py = top + r + frame.origin.y;
                if (!v || px < 0 || py < 0 || px >= picture.width || py >= picture.height) continue;
                indexes[py * picture.width + px] = v;
            }
        }
        picture.indexes = indexes;
    }
    const inCanvas = p => p.x >= canvas.left && p.y >= canvas.top && p.x < canvas.left + canvas.width && p.y < canvas.top + canvas.height;
    for (const k in lifted.masks) {
        const m = lifted.masks[k];
        let pixels = [];
        for (let r = 0; r < h; ++r) {
            for (let c = 0; c < w; ++c) {
                if (m.bits[r * w + c]) pixels.push({
                    x: left + c,
                    y: top + r
                });
            }
        }
        frame.masks[k] = Mask.paint(m.base, pixels.filter(inCanvas), true);
        lifted.written[k] = frame.masks[k];
    }
}

// masks of the frame are those the selection wrote: nothing else changed them
function masksWritten(frame, written) {
    const keys = Object.keys(frame.masks);
    return keys.length === Object.keys(written).length && keys.every(k => frame.masks[k] === written[k]);
}

function isInt(v) {
    return Number.isInteger(v);
}

// checks a parsed file and fills keys a frame may go without, returns {sprites} or {error}
function readSprites(file) {
    if (!file || typeof file !== 'object') return {
        error: T('Not a JSON object', 'Не объект JSON')
    };
    if (file.format !== SpriteFormat.name) return {
        error: T('Not a file of this editor, its format is ', 'Не файл этого редактора, его формат — ') + file.format
    };
    if (!isInt(file.formatVersion) || file.formatVersion > SpriteFormat.version) return {
        error: T('The file is of format version ' + file.formatVersion + ', this editor knows versions up to ' + SpriteFormat.version,
            'Файл версии формата ' + file.formatVersion + ', а этот редактор знает версии до ' + SpriteFormat.version)
    };
    if (!Array.isArray(file.masks) || !Array.isArray(file.sets)) return {
        error: T('Bad file. Absent keys: ', 'Неверный файл. Нет ключей: ') + ['masks', 'sets'].filter(k => !Array.isArray(file[k])).join(', ')
    };
    let masks = [];
    for (const m of file.masks) {
        if (!m || !isInt(m.index) || m.index < 0 || m.index >= MaskLimit) return {
            error: 'Bad mask index ' + (m ? m.index : m) + ', indexes are from 0 to ' + (MaskLimit - 1)
        };
        if (masks.some(e => e.index === m.index)) return {
            error: 'Mask index ' + m.index + ' is given twice'
        };
        masks.push({
            index: m.index,
            name: typeof m.name === 'string' ? m.name : '',
            color: typeof m.color === 'string' ? m.color : MaskColors[m.index]
        });
    }
    if (file.meets !== undefined && file.meets !== null && typeof file.meets !== 'string') return {
        error: 'Bad meets: it is text, a pair of masks a line'
    };
    let sets = [];
    for (const s of file.sets) {
        if (!s || typeof s.name !== 'string' || !Array.isArray(s.frames)) return {
            error: 'Bad set ' + (s && s.name)
        };
        let set = newSet(s.name);
        // a file without the key gives no default mask
        set.defaultMask = isInt(s.defaultMask) && s.defaultMask >= 0 && s.defaultMask < MaskLimit ? s.defaultMask : null;
        if (s.canvas && ['left', 'top', 'width', 'height'].every(k => isInt(s.canvas[k])))
            set.canvas = {
                left: s.canvas.left,
                top: s.canvas.top,
                width: s.canvas.width,
                height: s.canvas.height
            };
        for (const f of s.frames) {
            if (!f || typeof f.image !== 'string' || !f.origin || !isInt(f.origin.x) || !isInt(f.origin.y)) return {
                error: 'Bad frame ' + (f && f.image) + ' of set ' + s.name
            };
            let frame = {
                image: f.image,
                // its own name in the pack, instead of <SET>_<FILE>
                ...(typeof f.packName === 'string' && f.packName.trim() ? {
                    packName: f.packName.trim()
                } : {}),
                width: isInt(f.width) ? f.width : 0,
                height: isInt(f.height) ? f.height : 0,
                origin: {
                    x: f.origin.x,
                    y: f.origin.y
                },
                masks: {},
                points: {}
            };
            for (const k in (f.masks || {})) {
                const m = f.masks[k];
                if (!m || !['x', 'y', 'width', 'height'].every(key => isInt(m[key])) || !Array.isArray(m.rows)) return {
                    error: 'Bad mask ' + k + ' of frame ' + f.image
                };
                frame.masks[k] = Mask.encode(Mask.decode(m));
            }
            for (const n in (f.points || {})) {
                const p = f.points[n];
                if (!p || !isInt(p.x) || !isInt(p.y)) return {
                    error: 'Bad point ' + n + ' of frame ' + f.image
                };
                frame.points[n] = {
                    x: p.x,
                    y: p.y,
                    // before the body of the owner (> 0) or behind it (< 0); a file without it has 1
                    z: isInt(p.z) && p.z ? p.z : 1
                };
            }
            set.frames.push(frame);
        }
        // the pictures look to the left: forward is to the left (the player shows them so)
        if (s.facesLeft === true) set.facesLeft = true;
        // a ready palette (nes, gameboy, pico8 or a palette of the document): the packer brings every color of the
        // pictures to its nearest (CIE76) and the set has those taken; kept as given, the checks say what is wrong
        if (s.palette !== undefined && s.palette !== null && s.palette !== '') set.palette = s.palette;
        // the game's frames by number (frame N): [{set, image, dx, dy} | null], the picture and how far it stands
        // forward and down; for the editor's player only, the game has its own table
        if (Array.isArray(s.frameTable)) set.frameTable = s.frameTable.map(e => e && typeof e.image === 'string' ? {
            set: typeof e.set === 'string' ? e.set : s.name,
            image: e.image,
            dx: isInt(e.dx) ? e.dx : 0,
            dy: isInt(e.dy) ? e.dy : 0
        } : null);
        const anim = Anim.read(s.animation);
        if (anim.error) return {
            error: anim.error + ' of set ' + s.name
        };
        set.animation = anim.animation;
        sets.push(set);
    }
    if (!sets.length) sets.push(newSet('set'));
    const scenes = Scene.read(file);
    if (scenes.error) return {
        error: scenes.error
    };
    let sprites = {
        format: SpriteFormat.name,
        // the editor saves a file in its own version of the format
        formatVersion: SpriteFormat.version,
        name: typeof file.name === 'string' && file.name ? file.name : 'sprites',
        masks: masks
    };
    // which masks meet, as text (Meets.js); without the key the engine defaults hold
    if (typeof file.meets === 'string') sprites.meets = file.meets;
    sprites.sets = sets;
    sprites.screen = scenes.screen;
    sprites.tilesets = scenes.tilesets;
    sprites.scenes = scenes.scenes;
    const styles = Styles.read(file);
    if (styles.error) return {
        error: styles.error
    };
    sprites.styles = styles.styles;
    // palettes: {name, colors: [[r, g, b]]}, the color n of a palette is colors[n - 1] (as a set of colors of the pack)
    if (file.palettes !== undefined && !Array.isArray(file.palettes)) return {
        error: 'Bad palettes: a list of {name, colors}'
    };
    sprites.palettes = (file.palettes || []).filter(p => p && typeof p.name === 'string' && Array.isArray(p.colors)).map(p => ({
        name: p.name,
        colors: p.colors.filter(c => Array.isArray(c) && c.length >= 3).map(c => c.slice(0, 3).map(v => Math.max(0, Math.min(255, v | 0))))
    }));
    // the dialogs as their texts, given out as dialogs/<name>.dlg (Dialogs.js)
    if (file.dialogs !== undefined && !Array.isArray(file.dialogs)) return {
        error: 'Bad dialogs: a list of {name, text}'
    };
    sprites.dialogs = (file.dialogs || []).filter(d => d && typeof d.name === 'string' && typeof d.text === 'string').map(d => ({
        name: d.name,
        text: d.text
    }));
    Object.assign(sprites, Game.read(file));
    Object.assign(sprites, Maps.read(file));
    return {
        sprites: sprites
    };
}

const useSpriteStore = Pinia.defineStore('sprites', {
    state() {
        return {
            sprites: newSprites(),
            edit: {
                setIndex: 0,
                frameIndex: 0,
                tool: 'brush',
                maskIndex: 1, // the mask brushes draw
                colorIndex: 1, // the colour of the palette the pencil and the fill draw
                pointName: '', // the point clicks move
                hiddenMasks: {}, // index: true
                zoom: 8, // screen pixels in a pixel of the frame
                onion: 1, // how many frames before or after the current one are shown under it
                onionPrev: false, // the frames before are shown, tinted red
                onionNext: false, // the frames after, tinted blue
                allFrames: false, // all frames of the set are shown under the current one
                showImage: true,
                showMasks: true,
                showPoints: true,
                helpClosed: {}, // explanations closed: topic -> true
                animFrom: 1, // frames the animation plays, numbers from 1; animTo 0 is the last frame
                animTo: 0,
                animFps: 12,
                animZoom: 3,
                animMirror: false,
                animMasks: false,
                page: 'frames', // or 'anim': the animations of the set
                dialogStyle: '', // the style chosen on the page of dialogs
                dialogName: '', // the dialog chosen there
                dialogLanguage: '', // the translation it is played in, '' the msgids
                dialogZoom: 2,
                animTab: 'scripts',
                animScript: '', // the script edited and played from
                animStep: 0,
                animRule: -1,
                animEvent: '',
                animGroup: '',
                graphMode: 'state', // or 'group'
                graphDepth: 1,
                graphGotos: true,
                graphGroups: true,
                playZoom: 3,
                playSpeed: 1,
                playOnion: 0,
                playFollow: true,
                playFaceLeft: false,
                playNumbers: false,
                playPockets: '', // what the player's actor has in its pockets: 'DAGGER 3, SWORD 1'
                previewPalette: {}, // set name -> the palette its pictures are shown in (a preview, not saved in them)
                playAmount: 1, // how many it is (a stack lying)
                playAnswers: '', // the game's answers to the questions of the animation: 'see 1, hear 0'
                playMasks: false,
                // the page of scenes
                sceneIndex: 0,
                sceneView: 'scene', // or 'map': the scenes and their exits
                sceneTool: 'select',
                sceneLayer: '', // the layer objects are put on
                sceneGrid: '', // the grid tiles are painted in
                sceneSel: null, // what is selected: {kind: 'scene' | 'layer' | 'object' | 'grid' | 'cell' | 'tileset' | 'tile' | 'exit' | 'link', ...}
                sceneZoom: 2,
                scenePanX: -16, // the point of the scene at the left upper corner of the view
                scenePanY: -16,
                sceneSnap: 1,
                sceneCamera: {
                    x: 0,
                    y: 0
                },
                sceneShowGrid: true,
                sceneShowZones: true,
                sceneShowScreen: true,
                sceneShowLinks: true,
                sceneCycles: false, // tiles that cycle go round
                sceneShowBodies: true, // the solid boxes of tiles (bodies)
                sceneBodiesMask: -1, // the bodies shown: -1 every one, else those that hold this mask (for)
                scenePick: null, // {set, image}: the picture the Picture tool puts
                sceneTileset: '',
                sceneTile: 1, // the tile the Tile tool paints, from 1
                sceneActorSet: '',
                // the workbench: one shell for everything, what the tree of the project selects
                treeOpen: {}, // nodes of the tree opened: key -> true
                treeFilter: '', // names the tree shows
                helpShown: true, // the pane of explanations on the right
                stripHeight: { // the strip under the view, pixels, by the mode
                    frames: 210,
                    anim: 280,
                    scenes: 150,
                    dialogs: 280
                },
                animView: 'scripts', // 'scripts' | 'transitions' | 'numbers'
                scriptsAs: 'text', // the scripts as their text .anim, or as 'steps' (cards of frames and statements)
                matrixHide: '', // a group whose transitions the matrix leaves out, to see the particular ones
                dialogPage: 'styles', // or 'dialogs': the texts of dialogs played in their styles
                dialogMode: 'say', // the preview of a style: a line said, or answers to choose from
                gamePart: 'constants', // the part of the game edited: constants | timers | sounds | shows | chases | crops
                gameShow: '', // the show edited
                gameMusic: '', // the music whose notes are edited
                mapName: '', // the map of the graph edited
            },
            undoCount: 0,
            redoCount: 0,
            playing: false, // the animation plays
            imagesVersion: 0,
            // {image, left, top, width, height, dx, dy}: the rectangle of the current frame the Move tool selected,
            // from the base point, and how far it moved
            selection: null,
            loadMessages: [],
            uploadErrorMessage: '',
            spritesSequence: 0,
            projectFolderName: '', // the folder of the project open for saving (ProjectFolder), '' none
            projectFolderKept: '', // the folder of the last visit, to be opened again with a click (the browser asks)
            folderState: '', // '' | 'saving' | 'saved' | 'error'
            folderStateText: '', // what was saved, or what went wrong
        };
    },
    getters: {
        currentSet(state) {
            return state.sprites.sets[state.edit.setIndex];
        },
        currentFrame(state) {
            const set = state.sprites.sets[state.edit.setIndex];
            return set ? set.frames[state.edit.frameIndex] : undefined;
        },
        maskDefinition(state) {
            return (index) => state.sprites.masks.find(m => m.index === index);
        },
        // frames of the current set the editor has no pictures for
        framesWithoutImages(state) {
            state.imagesVersion;
            const set = state.sprites.sets[state.edit.setIndex];
            if (!set) return [];
            return set.frames.filter(f => !FrameImages.get(set.name, f.image));
        },
        // frames of the current set whose pictures the editor changed and did not save
        framesWithChangedImages(state) {
            state.imagesVersion;
            const set = state.sprites.sets[state.edit.setIndex];
            if (!set) return [];
            return set.frames.filter(f => {
                const picture = FrameImages.get(set.name, f.image);
                return picture && picture.changed;
            });
        },
    },
    actions: {
        // pictures are added to the current set: a frame of the same file name gets the picture, other files make new frames
        async loadImages(files) {
            this.dropSelection();
            const set = this.currentSet;
            let messages = [];
            let added = [];
            for (const file of files) {
                let picture;
                try {
                    picture = await FrameImages.fromFile(file);
                } catch (e) {
                    messages.push(file.name + ': ' + e.message);
                    continue;
                }
                // a changed picture is not lost: the file takes its place only when it is the same, that is saved
                const old = FrameImages.get(set.name, file.name);
                if (old && old.changed && !FrameImages.same(old, picture)) {
                    messages.push(file.name + T(': the editor has a changed picture of this frame, the file differs from it. ' +
                        'The changed picture is kept: download its PNG',
                        ': в редакторе изменённая картинка этого кадра, файл от неё отличается. Изменённая картинка оставлена: скачайте её PNG'));
                    continue;
                }
                FrameImages.put(set.name, file.name, picture);
                let frame = set.frames.find(f => f.image === file.name);
                if (!frame) {
                    // the base point a converter takes for a frame without markup: the left lower pixel
                    frame = {
                        image: file.name,
                        width: picture.width,
                        height: picture.height,
                        origin: {
                            x: 0,
                            y: picture.height - 1
                        },
                        masks: {},
                        points: {}
                    };
                    set.frames.push(frame);
                    added.push(frame);
                } else if (frame.width !== picture.width || frame.height !== picture.height) {
                    if (frame.width || frame.height)
                        messages.push(file.name + T(': the picture is ' + picture.width + 'x' + picture.height + ', the markup was made for ' + frame.width + 'x' + frame.height,
                            ': картинка ' + picture.width + 'x' + picture.height + ', а разметка сделана для ' + frame.width + 'x' + frame.height));
                    frame.width = picture.width;
                    frame.height = picture.height;
                }
            }
            const current = this.currentFrame;
            set.frames.sort((a, b) => compareNames(a.image, b.image));
            const selected = current || added[0];
            this.edit.frameIndex = Math.max(0, set.frames.indexOf(selected));
            this.growCanvas();
            if (this.edit.previewPalette[set.name]) this.applyPreviewPalette(set.name);
            this.loadMessages = messages;
            this.imagesVersion++;
        },
        clearLoadMessages() {
            this.loadMessages = [];
        },
        // the canvas grows when frames do not fit in it, it never becomes smaller by itself
        growCanvas() {
            const set = this.currentSet;
            const e = setExtent(set);
            if (!e) return;
            const c = set.canvas;
            if (c.width && c.height) {
                e.left = Math.min(e.left, c.left);
                e.top = Math.min(e.top, c.top);
                e.right = Math.max(e.right, c.left + c.width);
                e.bottom = Math.max(e.bottom, c.top + c.height);
            }
            if (e.left !== c.left || e.top !== c.top || e.right - e.left !== c.width || e.bottom - e.top !== c.height) {
                set.canvas = {
                    left: e.left,
                    top: e.top,
                    width: e.right - e.left,
                    height: e.bottom - e.top
                };
            }
        },
        // the canvas becomes just as large as the frames need
        fitCanvas() {
            const set = this.currentSet;
            const e = setExtent(set);
            if (!e) return;
            set.canvas = {
                left: e.left,
                top: e.top,
                width: e.right - e.left,
                height: e.bottom - e.top
            };
        },
        // a canvas the frames do not fit in is made larger
        setCanvas(canvas) {
            const set = this.currentSet;
            set.canvas = {
                left: canvas.left | 0,
                top: canvas.top | 0,
                width: Math.max(0, canvas.width | 0),
                height: Math.max(0, canvas.height | 0)
            };
            this.growCanvas();
        },
        selectSet(index) {
            if (index < 0 || index >= this.sprites.sets.length) return;
            this.dropSelection();
            this.edit.setIndex = index;
            this.edit.frameIndex = 0;
        },
        addSet() {
            let n = this.sprites.sets.length + 1;
            while (this.sprites.sets.some(s => s.name === 'set' + n)) ++n;
            this.sprites.sets.push(newSet('set' + n));
            this.selectSet(this.sprites.sets.length - 1);
        },
        // the pictures of a set shown in a palette (a preview: their indexes in its colors), '' their own
        setPreviewPalette(setName, paletteName) {
            if (paletteName) this.edit.previewPalette[setName] = paletteName;
            else delete this.edit.previewPalette[setName];
            this.applyPreviewPalette(setName);
        },
        // '@pack': as the packer takes a set of a ready palette, every color of a picture its nearest of the palette (CIE76)
        applyPreviewPalette(setName) {
            const set = this.sprites.sets.find(s => s.name === setName);
            const p = this.sprites.palettes.find(x => x.name === this.edit.previewPalette[setName]);
            const ready = this.edit.previewPalette[setName] === '@pack' && set && typeof set.palette === 'string' ? Game.paletteColors(this.sprites, set.palette) : null;
            for (const f of set ? set.frames : []) {
                const picture = FrameImages.get(set.name, f.image);
                if (!picture) continue;
                picture.override = ready ? picture.palette.map((c, i) => i && c ? ready[Game.nearestColor(ready, c)] : c) : p ? [[0, 0, 0], ...p.colors] : null;
                FrameImages.render(picture);
            }
            this.imagesVersion++;
        },
        addPalette(colors, name) {
            let n = name || 'palette',
                k = 1;
            while (this.sprites.palettes.some(p => p.name === n) || this.sprites.sets.some(s => s.name === n)) n = (name || 'palette') + (++k);
            this.sprites.palettes.push({
                name: n,
                colors: colors && colors.length ? colors.map(c => c.slice(0, 3)) : [
                    [0, 0, 0],
                    [255, 255, 255]
                ]
            });
            return n;
        },
        removePalette(name) {
            const i = this.sprites.palettes.findIndex(p => p.name === name);
            if (i < 0) return;
            this.sprites.palettes.splice(i, 1);
            for (const s in this.edit.previewPalette)
                if (this.edit.previewPalette[s] === name) this.setPreviewPalette(s, '');
        },
        // a picture made by the editor put into a set (made when there is none: no masks), unless the set has that file
        addPicture(setName, file, picture) {
            let set = this.sprites.sets.find(s => s.name === setName);
            if (!set) {
                set = newSet(setName);
                set.defaultMask = null;
                this.sprites.sets.push(set);
            }
            if (set.frames.some(f => f.image === file)) return set;
            picture.canvas = document.createElement('canvas');
            picture.canvas.width = picture.width;
            picture.canvas.height = picture.height;
            FrameImages.render(picture);
            picture.changed = true;
            picture.paletteChanged = true;
            FrameImages.put(setName, file, picture);
            set.frames.push({
                image: file,
                width: picture.width,
                height: picture.height,
                origin: {
                    x: 0,
                    y: 0
                },
                masks: {},
                points: {}
            });
            set.frames.sort((a, b) => compareNames(a.image, b.image));
            this.imagesVersion++;
            return set;
        },
        // a new set of a control from its template (Controls.js): its frames, pictures not saved yet, and its animation
        addControl(kind) {
            const template = Controls.templates[kind];
            if (!template) return;
            let name = kind,
                n = 1;
            while (this.sprites.sets.some(s => s.name === name)) name = kind + (++n);
            let set = newSet(name);
            set.defaultMask = null; // a control meets nothing
            for (const [file, picture] of template.pictures()) {
                picture.canvas = document.createElement('canvas');
                picture.canvas.width = picture.width;
                picture.canvas.height = picture.height;
                FrameImages.render(picture);
                picture.changed = true;
                FrameImages.put(name, file, picture);
                set.frames.push({
                    image: file,
                    width: picture.width,
                    height: picture.height,
                    // a control is placed by its left upper pixel
                    origin: {
                        x: 0,
                        y: 0
                    },
                    masks: {},
                    points: {}
                });
            }
            set.frames.sort((a, b) => compareNames(a.image, b.image));
            const r = Anim.parse(template.text(Anim.packName(name, '').slice(0, -1)), set);
            if (r.animation) set.animation = r.animation;
            this.sprites.sets.push(set);
            this.selectSet(this.sprites.sets.length - 1);
            this.growCanvas();
            this.imagesVersion++;
            return r.errors;
        },
        removeSet() {
            if (this.sprites.sets.length < 2) return;
            const set = this.currentSet;
            for (const f of set.frames) FrameImages.remove(set.name, f.image);
            this.sprites.sets.splice(this.edit.setIndex, 1);
            this.selectSet(Math.min(this.edit.setIndex, this.sprites.sets.length - 1));
        },
        // names of sets are different, the editor finds pictures by them
        renameSet(name) {
            const set = this.currentSet;
            name = name.trim();
            if (!name || name === set.name || this.sprites.sets.some(s => s.name === name)) return false;
            FrameImages.renameSet(set.name, name);
            const old = set.name;
            // shots of its kind are named by the name of its blob, its pictures by theirs in the pack
            const oldKind = Anim.packName('', old).slice(1),
                newKind = Anim.packName('', name).slice(1);
            const oldPictures = set.frames.map(f => Anim.imageName(set, f.image));
            set.name = name;
            const pictures = new Map(oldPictures.map((n, i) => [n, Anim.imageName(set, set.frames[i].image)]).filter(([a, b]) => a !== b));
            const picture = n => pictures.get(n) || n;
            for (const s of this.sprites.sets)
                for (const sc of s.animation.scripts)
                    for (const l of sc.lines) {
                        if ((l.op === 'shoot' || l.op === 'draw' || l.op === 'appear') && l.kind === oldKind) l.kind = newKind;
                        // a picture of this set shown or carried by another one, by its name in the pack
                        if ((l.op === 'frame' || l.op === 'carry') && typeof l.name === 'string') l.name = picture(l.name);
                    }
            // what names it by its name: pictures and actors of scenes, pieces of tiles, crops, styles, shows, chases
            const ref = r => {
                if (r && r.set === old) r.set = name;
            };
            for (const sc of this.sprites.scenes || [])
                for (const o of Scene.objects(sc)) ref(o);
            for (const t of this.sprites.tilesets || [])
                for (const tile of t.tiles) {
                    if (tile.life === oldKind) tile.life = newKind;
                    for (const p of tile.pieces) {
                        ref(p);
                        for (const r of [...(p.by_mod || []), ...(p.pictures || []), ...(p.cycle || [])]) ref(r);
                        if (Array.isArray(p.color) && p.color[0] === old) p.color[0] = name;
                    }
                }
            for (const c of this.sprites.crops || []) ref(c);
            for (const st of this.sprites.styles || []) ref(st.picture);
            for (const sh of this.sprites.shows || []) {
                for (const p of sh.pictures) p.picture = picture(p.picture);
                for (const a of sh.actors)
                    if (a.kind === old) a.kind = name;
            }
            for (const c of this.sprites.chases || [])
                if (c.kind === old) c.kind = name;
            // dialogs name kinds and faces by their names in the pack: the words outside the quoted texts
            if (oldKind !== newKind || pictures.size) {
                const word = w => w === oldKind ? newKind : picture(w);
                for (const d of this.sprites.dialogs || [])
                    d.text = d.text.split(/("(?:[^"\\]|\\.)*")/).map((part, i) => i % 2 ? part : part.replace(/[A-Za-z_][A-Za-z0-9_]*/g, word)).join('');
            }
            if (old in this.edit.previewPalette) {
                this.edit.previewPalette[name] = this.edit.previewPalette[old];
                delete this.edit.previewPalette[old];
            }
            this.imagesVersion++;
            return true;
        },
        setDefaultMask(index) {
            this.currentSet.defaultMask = this.maskDefinition(index) ? index : null;
        },
        selectFrame(index) {
            const set = this.currentSet;
            if (!set || !set.frames.length) return;
            const i = Math.min(Math.max(index, 0), set.frames.length - 1);
            if (i !== this.edit.frameIndex) this.dropSelection();
            this.edit.frameIndex = i;
        },
        removeFrame() {
            const set = this.currentSet;
            const frame = this.currentFrame;
            if (!frame) return;
            this.dropSelection();
            FrameImages.remove(set.name, frame.image);
            set.frames.splice(this.edit.frameIndex, 1);
            this.selectFrame(this.edit.frameIndex);
        },
        // the base point is a pixel of the picture. Masks and points belong to the picture, they keep their places on it
        setOrigin(x, y) {
            const frame = this.currentFrame;
            if (!frame || !isInt(x) || !isInt(y)) return;
            const dx = x - frame.origin.x;
            const dy = y - frame.origin.y;
            if (!dx && !dy) return;
            this.dropSelection();
            frame.origin = {
                x: x,
                y: y
            };
            for (const k in frame.masks) frame.masks[k] = Mask.shift(frame.masks[k], -dx, -dy);
            for (const n in frame.points) {
                frame.points[n].x -= dx;
                frame.points[n].y -= dy;
            }
            this.growCanvas();
        },
        moveOrigin(dx, dy) {
            const frame = this.currentFrame;
            if (frame) this.setOrigin(frame.origin.x + dx, frame.origin.y + dy);
        },
        setTool(tool) {
            if (!(tool in Tools)) return;
            if (tool !== 'move') this.dropSelection();
            this.edit.tool = tool;
        },
        addMask() {
            let index = 0;
            while (index < MaskLimit && this.maskDefinition(index)) ++index;
            if (index >= MaskLimit) return;
            this.sprites.masks.push({
                index: index,
                name: 'mask' + index,
                color: MaskColors[index]
            });
            this.sprites.masks.sort((a, b) => a.index - b.index);
            this.edit.maskIndex = index;
        },
        // the masks change by change(), the text of meets follows them: map(index) is the new index, null if the mask is gone
        changeMasks(change, map) {
            const before = this.sprites.masks.map(m => ({
                ...m
            }));
            change();
            if (typeof this.sprites.meets === 'string') this.sprites.meets = Meets.remap(this.sprites.meets, before, this.sprites.masks, map);
            // and the scripts that name a mask by its name in the pack (masks BODY, hit TIP on BODY, contact FEET ...)
            let names = {};
            for (const b of before) {
                const i = map(b.index);
                const m = i === null ? null : this.sprites.masks.find(x => x.index === i);
                if (m && Meets.maskName(b) !== Meets.maskName(m)) names[Meets.maskName(b)] = Meets.maskName(m);
            }
            if (Object.keys(names).length)
                for (const set of this.sprites.sets)
                    if (set.animation) Anim.renameMasks(set.animation, names);
        },
        renameMask(index, name) {
            const m = this.maskDefinition(index);
            if (m) this.changeMasks(() => m.name = name, i => i);
        },
        // text of meets, null: the key goes away and the engine defaults hold
        setMeets(text) {
            if (text === null) delete this.sprites.meets;
            else this.sprites.meets = text;
        },
        toggleMeet(kind, a, b, on) {
            this.sprites.meets = Meets.toggle(this.sprites.meets, this.sprites.masks, kind, a, b, on);
        },
        // the mask is taken away from all frames of all sets and from meets
        removeMask(index) {
            const i = this.sprites.masks.findIndex(m => m.index === index);
            if (i < 0) return;
            this.changeMasks(() => this.sprites.masks.splice(i, 1), k => k === index ? null : k);
            for (const set of this.sprites.sets) {
                for (const frame of set.frames) delete frame.masks[index];
                if (set.defaultMask === index) set.defaultMask = null;
            }
            delete this.edit.hiddenMasks[index];
            if (this.edit.maskIndex === index) this.edit.maskIndex = this.sprites.masks.length ? this.sprites.masks[0].index : 0;
        },
        // masks of the old index in all frames get the new one
        changeMaskIndex(oldIndex, newIndex) {
            const m = this.maskDefinition(oldIndex);
            if (!m || !isInt(newIndex) || newIndex < 0 || newIndex >= MaskLimit || this.maskDefinition(newIndex)) return;
            this.changeMasks(() => {
                m.index = newIndex;
                this.sprites.masks.sort((a, b) => a.index - b.index);
            }, k => k === oldIndex ? newIndex : k);
            for (const set of this.sprites.sets) {
                if (set.defaultMask === oldIndex) set.defaultMask = newIndex;
                for (const frame of set.frames) {
                    if (!(oldIndex in frame.masks)) continue;
                    frame.masks[newIndex] = frame.masks[oldIndex];
                    delete frame.masks[oldIndex];
                }
            }
            if (this.edit.hiddenMasks[oldIndex]) {
                delete this.edit.hiddenMasks[oldIndex];
                this.edit.hiddenMasks[newIndex] = true;
            }
            if (this.edit.maskIndex === oldIndex) this.edit.maskIndex = newIndex;
        },
        selectMask(index) {
            if (this.maskDefinition(index)) this.edit.maskIndex = index;
        },
        toggleMaskShown(index) {
            if (this.edit.hiddenMasks[index]) delete this.edit.hiddenMasks[index];
            else this.edit.hiddenMasks[index] = true;
        },
        // sets or clears pixels [{x, y}, ...] of the current mask of the current frame, pixels outside the canvas are left
        paint(pixels, value) {
            const frame = this.currentFrame;
            const index = this.edit.maskIndex;
            if (!frame || !this.maskDefinition(index)) return;
            const c = this.currentSet.canvas;
            pixels = pixels.filter(p => p.x >= c.left && p.y >= c.top && p.x < c.left + c.width && p.y < c.top + c.height);
            if (!pixels.length || (!value && !(index in frame.masks))) return;
            frame.masks[index] = Mask.paint(frame.masks[index], pixels, value);
        },
        // the picture of the current frame, to change its pixels: its indexes before the first change are kept, a step
        // back is kept for undo
        pictureToChange() {
            const frame = this.currentFrame;
            const picture = frame && FrameImages.get(this.currentSet.name, frame.image);
            if (!picture) return null;
            if (!picture.changed && !picture.original) picture.original = picture.indexes.slice();
            return picture;
        },
        // the picture changed: drawn anew, saved again, compared with its file
        pictureChanged(picture) {
            picture.changed = picture.paletteChanged || !picture.original || !FrameImages.same(picture, {
                width: picture.width,
                height: picture.height,
                indexes: picture.original
            });
            picture.png = null;
            FrameImages.render(picture);
            this.imagesVersion++;
        },
        // a step back of the pixels of the current picture; withDoc: the change of the document that comes with it
        // (masks moved with the pixels) is the same step
        keepPictureStep(picture, withDoc) {
            PictureUndo.push({
                picture: picture,
                indexes: picture.indexes.slice(),
                palette: picture.palette.map(c => c.slice())
            });
            if (PictureUndo.length > 100) PictureUndo.shift();
            this.historyMarkPicture(withDoc);
        },
        undoPicture() {
            const step = PictureUndo.pop();
            if (!step) return false;
            // pixels taken by the selection were of the picture before: they would bring the step back
            this.dropSelection();
            step.picture.indexes = step.indexes;
            step.picture.palette = step.palette;
            this.pictureChanged(step.picture);
            return true;
        },
        // the palette is as deep as its colours need: 1, 2, 4 or 8 bits
        fitDepth(picture) {
            const need = picture.palette.length <= 2 ? 1 : picture.palette.length <= 4 ? 2 : picture.palette.length <= 16 ? 4 : 8;
            if (need > picture.bitDepth) picture.bitDepth = need;
        },
        // pixels {x, y} from the base point get the index of the palette (0: transparent); start: a new stroke
        paintPicture(pixels, index, start) {
            const frame = this.currentFrame;
            const picture = this.pictureToChange();
            if (!picture || index >= picture.palette.length && index) return;
            if (start) this.keepPictureStep(picture);
            for (const p of pixels) {
                const x = p.x + frame.origin.x,
                    y = p.y + frame.origin.y;
                if (x >= 0 && y >= 0 && x < picture.width && y < picture.height) picture.indexes[y * picture.width + x] = index;
            }
            this.pictureChanged(picture);
        },
        // the area of one index around a pixel gets another (its four sides)
        fillPicture(cell, index) {
            const frame = this.currentFrame;
            const picture = this.pictureToChange();
            if (!picture) return;
            const w = picture.width,
                h = picture.height;
            const x0 = cell.x + frame.origin.x,
                y0 = cell.y + frame.origin.y;
            if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return;
            const from = picture.indexes[y0 * w + x0];
            if (from === index) return;
            this.keepPictureStep(picture);
            let stack = [
                [x0, y0]
            ];
            while (stack.length) {
                const [x, y] = stack.pop();
                if (x < 0 || y < 0 || x >= w || y >= h || picture.indexes[y * w + x] !== from) continue;
                picture.indexes[y * w + x] = index;
                stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
            this.pictureChanged(picture);
        },
        pickColor(cell) {
            const frame = this.currentFrame;
            const picture = frame && FrameImages.get(this.currentSet.name, frame.image);
            if (!picture) return;
            const x = cell.x + frame.origin.x,
                y = cell.y + frame.origin.y;
            if (x >= 0 && y >= 0 && x < picture.width && y < picture.height) this.edit.colorIndex = picture.indexes[y * picture.width + x];
        },
        // a colour of the palette of the current picture; all: of every picture of the set that has that index
        setPaletteColor(index, rgb, all) {
            const frames = all ? this.currentSet.frames : [this.currentFrame];
            for (const f of frames) {
                const picture = f && FrameImages.get(this.currentSet.name, f.image);
                if (!picture || index >= picture.palette.length) continue;
                if (!picture.changed && !picture.original) picture.original = picture.indexes.slice();
                this.keepPictureStep(picture);
                picture.palette[index] = rgb;
                picture.paletteChanged = true;
                picture.chunks = picture.chunks ? Object.assign({}, picture.chunks, {
                    before: (picture.chunks.before || []).filter(c => c.type !== 'PLTE')
                }) : null;
                this.pictureChanged(picture);
            }
        },
        addPaletteColor(rgb) {
            const picture = this.pictureToChange();
            if (!picture || picture.palette.length >= 256) return;
            this.keepPictureStep(picture);
            picture.palette.push(rgb);
            picture.paletteChanged = true;
            picture.chunks = picture.chunks ? Object.assign({}, picture.chunks, {
                before: (picture.chunks.before || []).filter(c => c.type !== 'PLTE')
            }) : null;
            this.fitDepth(picture);
            this.edit.colorIndex = picture.palette.length - 1;
            this.pictureChanged(picture);
        },
        // a new frame of a picture of width x height, transparent, in the palette of the current one (or a plain one)
        newFrame(width, height) {
            const set = this.currentSet;
            const like = this.currentFrame && FrameImages.get(set.name, this.currentFrame.image);
            let n = set.frames.length + 1;
            while (set.frames.some(f => f.image === 'new' + n + '.png')) ++n;
            const file = 'new' + n + '.png';
            const picture = {
                width: width,
                height: height,
                bitDepth: like ? like.bitDepth : 4,
                palette: like ? like.palette.map(c => c.slice()) : [
                    [0, 0, 0],
                    [0, 0, 0],
                    [255, 255, 255],
                    [128, 128, 128]
                ],
                indexes: new Uint8Array(width * height),
                chunks: null,
                changed: true,
                paletteChanged: true
            };
            picture.canvas = document.createElement('canvas');
            picture.canvas.width = width;
            picture.canvas.height = height;
            FrameImages.render(picture);
            FrameImages.put(set.name, file, picture);
            set.frames.push({
                image: file,
                width: width,
                height: height,
                origin: {
                    x: 0,
                    y: height - 1
                },
                masks: {},
                points: {}
            });
            set.frames.sort((a, b) => compareNames(a.image, b.image));
            this.edit.frameIndex = set.frames.findIndex(f => f.image === file);
            this.growCanvas();
            this.imagesVersion++;
        },
        // the mask becomes the pixels of the picture, as the default mask is
        fillMask(index, frame) {
            frame = frame || this.currentFrame;
            if (!frame || !this.maskDefinition(index)) return false;
            const picture = FrameImages.get(this.currentSet.name, frame.image);
            if (!picture) return false;
            frame.masks[index] = Mask.fromPicture(picture, frame.origin);
            return true;
        },
        // frames of the current set without this mask get it from their pictures
        fillMaskInAllFrames(index) {
            for (const frame of this.currentSet.frames) {
                if (!(index in frame.masks)) this.fillMask(index, frame);
            }
        },
        // a drawn mask without pixels: the frame has the mask, it is empty
        clearMask(index) {
            const frame = this.currentFrame;
            if (frame && this.maskDefinition(index)) frame.masks[index] = Mask.empty();
        },
        // the frame has no such mask at all
        removeFrameMask(index) {
            const frame = this.currentFrame;
            if (frame) delete frame.masks[index];
        },
        togglePlaying() {
            this.playing = !this.playing;
        },
        // a rectangle of the current frame from the base point becomes the selection, nothing moves yet
        select(left, top, width, height) {
            const frame = this.currentFrame;
            this.dropSelection();
            if (!frame || !(width > 0) || !(height > 0)) return;
            this.selection = {
                image: frame.image,
                left: left,
                top: top,
                width: width,
                height: height,
                dx: 0,
                dy: 0
            };
        },
        // the moved pixels stay where they are
        dropSelection() {
            Lifted = null;
            this.selection = null;
        },
        // pixels of the picture and of all masks of the frame in the selection move with it.
        // A mask changed while the area is selected (Fill, Clear...) makes the area be taken again where it stands
        moveSelection(dx, dy) {
            const s = this.selection;
            const frame = this.currentFrame;
            if (!s || !frame || frame.image !== s.image) {
                this.dropSelection();
                return;
            }
            const picture = FrameImages.get(this.currentSet.name, frame.image) || null;
            // taken again when the masks or the pixels were changed by something else since it was placed
            if (!Lifted || Lifted.picture !== picture || !masksWritten(frame, Lifted.written) || picture && Lifted.placed !== picture.indexes) {
                s.left += s.dx;
                s.top += s.dy;
                s.dx = 0;
                s.dy = 0;
                if (picture && !picture.changed) picture.original = picture.indexes.slice();
                Lifted = liftArea(frame, picture, s);
            }
            if (picture) {
                // a step of undo for the pixels and the masks together, one for the moves made without a pause
                const top = History.undo[History.undo.length - 1];
                if (!(top && top.kind === 'picture' && top.merge && top.lifted === Lifted)) {
                    this.historyCapture();
                    this.keepPictureStep(picture, true);
                    History.undo[History.undo.length - 1].lifted = Lifted;
                }
            }
            s.dx += dx;
            s.dy += dy;
            placeArea(frame, s, Lifted, this.currentSet.canvas);
            // a picture moved back is the same as its file again; a palette changed stays changed
            if (picture) {
                Lifted.placed = picture.indexes;
                this.pictureChanged(picture);
            }
        },
        // a new point gets the name of the same point of the frame before when it has it, so frames have the same points
        addPoint(name, xy) {
            const frame = this.currentFrame;
            if (!frame) return;
            name = (name || '').trim();
            if (!name) {
                let n = 1;
                while (('point' + n) in frame.points) ++n;
                name = 'point' + n;
            }
            if (name in frame.points) {
                this.edit.pointName = name;
                return;
            }
            // the side of the body is as in the nearest frame that has the point
            const frames = this.currentSet.frames;
            const i = this.edit.frameIndex;
            const near = [...frames.slice(0, i).reverse(), ...frames.slice(i + 1)].find(f => name in f.points);
            frame.points[name] = {
                x: xy ? xy.x : 0,
                y: xy ? xy.y : 0,
                z: near ? near.points[name].z : 1
            };
            this.edit.pointName = name;
            this.growCanvas();
        },
        // before the body (1..7) or behind it (-1..-8), as the z of a child in the engine; 0 is none
        setPointZ(name, z) {
            const frame = this.currentFrame;
            if (frame && name in frame.points && Number.isInteger(z) && z && z >= -8 && z <= 7) frame.points[name].z = z;
        },
        renamePoint(oldName, newName) {
            const frame = this.currentFrame;
            newName = (newName || '').trim();
            if (!frame || !(oldName in frame.points) || !newName || newName in frame.points) return false;
            // the order of points stays
            let points = {};
            for (const n in frame.points) points[n === oldName ? newName : n] = frame.points[n];
            frame.points = points;
            if (this.edit.pointName === oldName) this.edit.pointName = newName;
            return true;
        },
        // coordinates from the base point, a point stays inside the canvas
        setPoint(name, x, y) {
            const frame = this.currentFrame;
            if (!frame || !(name in frame.points) || !isInt(x) || !isInt(y)) return;
            const c = this.currentSet.canvas;
            if (c.width && c.height) {
                x = Math.min(Math.max(x, c.left), c.left + c.width - 1);
                y = Math.min(Math.max(y, c.top), c.top + c.height - 1);
            }
            frame.points[name].x = x;
            frame.points[name].y = y;
        },
        movePoint(name, dx, dy) {
            const frame = this.currentFrame;
            if (frame && name in frame.points) this.setPoint(name, frame.points[name].x + dx, frame.points[name].y + dy);
        },
        removePoint(name) {
            const frame = this.currentFrame;
            if (!frame) return;
            delete frame.points[name];
            if (this.edit.pointName === name) this.edit.pointName = '';
        },
        selectPoint(name) {
            this.edit.pointName = name;
        },
        setName(name) {
            this.sprites.name = name;
        },
        setUploadErrorMessage(message) {
            this.uploadErrorMessage = message;
        },
        // the folder of the project is forgotten: what is opened next is not saved into it unasked
        forgetProjectFolder() {
            ProjectFolder.handle = null;
            ProjectFolder.json = '';
            ProjectFolder.written = new Map();
            ProjectFolder.saved = '';
            this.projectFolderName = '';
            this.projectFolderKept = '';
            this.folderState = '';
            ProjectFolder.keep(null);
        },
        // the folder of the last visit: offered to be opened again (the browser asks for the right first)
        async keptProjectFolder() {
            const kept = await ProjectFolder.kept();
            if (kept && !ProjectFolder.handle) this.projectFolderKept = kept.label;
        },
        async reopenProjectFolder() {
            const kept = await ProjectFolder.kept();
            if (!kept) return null;
            const handle = kept.handle;
            try {
                if ((await handle.requestPermission({
                        mode: 'readwrite'
                    })) !== 'granted') return null;
            } catch (e) {
                return null;
            }
            return this.openProjectFolder(handle, kept.label);
        },
        setSprites(sprites) {
            this.dropSelection();
            this.sprites = sprites;
            this.spritesSequence++;
            if (this.edit.setIndex >= sprites.sets.length) this.edit.setIndex = 0;
            this.selectFrame(this.edit.frameIndex);
            if (!this.maskDefinition(this.edit.maskIndex) && sprites.masks.length) this.edit.maskIndex = sprites.masks[0].index;
            this.imagesVersion++;
        },
        uploadSprites(text) {
            let file;
            try {
                file = JSON.parse(text);
            } catch (e) {
                this.setUploadErrorMessage(T('Not a JSON file: ', 'Не файл JSON: ') + e.message);
                return;
            }
            const r = readSprites(file);
            if (r.error) {
                this.setUploadErrorMessage(r.error);
                return;
            }
            this.setUploadErrorMessage('');
            this.forgetProjectFolder();
            this.setSprites(r.sprites);
        },
        // a folder of a project as the packer reads it: the markup (a .json at its top), the pictures of each set in a
        // folder of its name (or at the top, found by the frames' files), <set>.anim of each set, dialogs/*.dlg,
        // po/*.po, fonts *.c. A set of pictures the markup has not is made. Returns what was taken, in words
        async openFolder(files) {
            const parts = f => (f.webkitRelativePath || f.name).split('/');
            // the top is what all paths share
            const depth = f => parts(f).length - 1;
            let top = Math.min(...files.map(depth));
            let rel = f => parts(f).slice(top);
            // the folder of a game: its data are in game_data/
            if (!files.some(f => rel(f).length === 1 && /\.json$/i.test(f.name)) && files.some(f => rel(f)[0] === ProjectFolder.data)) {
                files = files.filter(f => rel(f)[0] === ProjectFolder.data);
                ++top;
            }
            // the game's code and its builds are not the editor's
            files = files.filter(f => !rel(f).slice(0, -1).some(d => ProjectFolder.skipped(d)));
            let said = [],
                errors = [];
            const json = files.find(f => rel(f).length === 1 && /\.json$/i.test(f.name));
            if (json) {
                this.uploadSprites(await json.text());
                if (this.uploadErrorMessage) return [json.name + ': ' + this.uploadErrorMessage];
                said.push(json.name);
            }
            // pictures by set
            let bySet = new Map();
            for (const f of files) {
                if (!/\.png$/i.test(f.name)) continue;
                const r = rel(f);
                let set = r.length >= 2 ? r[r.length - 2] : null;
                if (!set) {
                    const owner = this.sprites.sets.find(s => s.frames.some(fr => fr.image === f.name));
                    set = owner ? owner.name : this.currentSet.name;
                }
                if (set === 'po' || set === 'dialogs' || set === 'music' || set === 'sounds') continue;
                if (!bySet.has(set)) bySet.set(set, []);
                bySet.get(set).push(f);
            }
            for (const [name, list] of bySet) {
                let i = this.sprites.sets.findIndex(s => s.name === name);
                if (i < 0) {
                    let set = newSet(name);
                    set.defaultMask = null;
                    this.sprites.sets.push(set);
                    i = this.sprites.sets.length - 1;
                }
                this.selectSet(i);
                await this.loadImages(list);
                said.push(name + ': ' + list.length + ' PNG');
                errors.push(...this.loadMessages);
            }
            // animations of the sets
            for (const f of files) {
                const r = rel(f);
                if (r.length !== 1 || !/\.anim$/i.test(f.name)) continue;
                const set = this.sprites.sets.find(s => s.name === f.name.replace(/\.anim$/i, ''));
                if (!set) {
                    errors.push(f.name + T(': no set of that name', ': нет набора с таким именем'));
                    continue;
                }
                const a = Anim.parse(await f.text(), set);
                if (a.errors) errors.push(f.name + ': ' + a.errors[0]);
                else {
                    set.animation = a.animation;
                    said.push(f.name);
                }
            }
            // dialogs, translations, fonts
            for (const f of files) {
                const r = rel(f);
                if (r.length === 2 && r[0] === 'dialogs' && /\.dlg$/i.test(f.name)) {
                    const text = await f.text();
                    const m = /^\s*dialog\s+(\w+)/m.exec(text);
                    const name = m ? m[1] : f.name.replace(/\.dlg$/i, '');
                    const old = this.sprites.dialogs.find(d => d.name === name);
                    if (old) old.text = text;
                    else this.sprites.dialogs.push({
                        name: name,
                        text: text
                    });
                    said.push('dialogs/' + f.name);
                } else if (r.length === 2 && r[0] === 'music' && /\.mml$/i.test(f.name)) {
                    // the notes of a music: music/<name>.mml, as the packer takes them for the document's music
                    if (!this.sprites.musicTexts) this.sprites.musicTexts = {};
                    this.sprites.musicTexts[f.name.replace(/\.mml$/i, '')] = await f.text();
                    said.push('music/' + f.name);
                } else if (r.length === 2 && r[0] === 'po' && /\.po$/i.test(f.name)) {
                    Translations.add(f.name.replace(/\.po$/i, ''), await f.text());
                    said.push('po/' + f.name);
                } else if (/\.c$/i.test(f.name)) {
                    const src = await f.text();
                    try {
                        Fonts.add(Text.readFont(src));
                        said.push(f.name);
                    } catch (e) {
                        try {
                            Fonts.add(HwFont.read(src));
                            said.push(f.name);
                        } catch (x) {}
                    }
                }
            }
            // the notes of the musics are the folder's: one it has not for a music of the document is told (Game → Music)
            if ((this.sprites.music || []).length && !this.sprites.musicTexts) this.sprites.musicTexts = {};
            this.loadMessages = errors;
            return said;
        },
        // The folder of a project opened by the browser's access to it (Chrome, Edge): what the editor makes of it is
        // read (the document, the pictures of each kind, KIND.anim, dialogs/, po/, fonts *.c at the top), the rest of
        // it (the game's code, its builds) is not looked at; it stays open for saveProjectFolder. Returns what was
        // taken, in words, or null when nothing was chosen
        async openProjectFolder(chosen, label) {
            let handle = chosen;
            if (!handle) try {
                handle = await window.showDirectoryPicker({
                    id: 'dgx-ge-project',
                    mode: 'readwrite'
                });
            } catch (e) {
                return null;
            }
            const game = handle.name;
            handle = await ProjectFolder.dataOf(handle);
            label = label || (handle.name === game ? handle.name : game + '/' + handle.name);
            let files = [];
            const take = async (h, path) => {
                const file = await h.getFile();
                files.push({
                    name: file.name,
                    webkitRelativePath: path,
                    text: () => file.text(),
                    arrayBuffer: () => file.arrayBuffer()
                });
            };
            const top = handle.name;
            for await (const [name, h] of handle.entries()) {
                if (h.kind === 'file' && /\.(json|anim|c)$/i.test(name)) await take(h, top + '/' + name);
                else if (h.kind === 'directory' && !ProjectFolder.skipped(name)) {
                    const wanted = name === 'dialogs' ? /\.dlg$/i : name === 'po' ? /\.po$/i : name === 'music' ? /\.mml$/i : name === 'sounds' ? /^$/ : /\.png$/i;
                    for await (const [inner, f] of h.entries())
                        if (f.kind === 'file' && wanted.test(inner)) await take(f, top + '/' + name + '/' + inner);
                }
            }
            if (files.filter(f => /\.json$/i.test(f.name)).length > 1) {
                this.setUploadErrorMessage(T('The folder has more than one .json at its top: the packer of the engine wants one', 'В папке больше одного .json наверху: упаковщику движка нужен один'));
                return [];
            }
            FrameImages.removeChanged();
            const said = await this.openFolder(files);
            ProjectFolder.handle = handle;
            ProjectFolder.json = (files.find(f => /\.json$/i.test(f.name)) || {}).name || '';
            // as it is in the folder now: nothing is written until something changes
            ProjectFolder.saved = JSON.stringify(Maps.saved(this.sprites), null, '    ');
            ProjectFolder.written = new Map();
            for (const f of files)
                if (/\.(json|anim|dlg|mml)$/i.test(f.name)) ProjectFolder.written.set(f.webkitRelativePath.split('/').slice(1).join('/'), await f.text());
            this.projectFolderName = label;
            this.projectFolderKept = '';
            this.folderState = 'saved';
            this.folderStateText = T('opened from ', 'открыто из ') + label;
            ProjectFolder.keep(handle, label);
            return said;
        },
        // A moment after a change, the open folder is saved by itself (quiet: nothing is asked; a folder with another
        // document is not written into, that is said instead)
        autosaveProjectFolder() {
            if (!ProjectFolder.handle) return;
            const text = JSON.stringify(Maps.saved(this.sprites), null, '    ');
            if (text === ProjectFolder.saved && !FrameImages.changed().length) return;
            this.saveProjectFolder(true);
        },
        // The project written into its folder as the packer of the engine reads it: the document, the pictures of the
        // kinds (those the folder has not, and those changed here), KIND.anim of each kind with animations (an old one
        // of a kind that has none now is taken away), dialogs/NAME.dlg (those of dialogs no more taken away); a text the
        // same as last time is not written again (the build packs anew only what changed). The folder opened, else one
        // chosen now. Returns what was written, in words, or null when nothing was
        async saveProjectFolder(quiet) {
            while (ProjectFolder.busy) await ProjectFolder.busy;
            let done;
            ProjectFolder.busy = new Promise(resolve => done = resolve);
            try {
                return await this.writeProjectFolder(quiet);
            } catch (e) {
                this.folderState = 'error';
                this.folderStateText = T('not saved: ', 'не сохранено: ') + e.message;
                if (!quiet) throw e;
                return null;
            } finally {
                ProjectFolder.busy = null;
                done();
            }
        },
        async writeProjectFolder(quiet) {
            let handle = ProjectFolder.handle;
            if (!handle) {
                if (quiet) return null;
                let game;
                try {
                    game = await window.showDirectoryPicker({
                        id: 'dgx-ge-project',
                        mode: 'readwrite'
                    });
                    handle = await ProjectFolder.dataOf(game);
                } catch (e) {
                    return null;
                }
                ProjectFolder.handle = handle;
                ProjectFolder.json = '';
                ProjectFolder.written = new Map();
                this.projectFolderName = handle === game ? handle.name : game.name + '/' + handle.name;
                this.projectFolderKept = '';
                ProjectFolder.keep(handle, this.projectFolderName);
            }
            if ((await handle.queryPermission({
                    mode: 'readwrite'
                })) !== 'granted' && (quiet || (await handle.requestPermission({
                    mode: 'readwrite'
                })) !== 'granted')) {
                this.folderState = 'error';
                this.folderStateText = T('the browser does not let the editor write into ', 'браузер не даёт редактору писать в ') + this.projectFolderName;
                return null;
            }
            this.folderState = 'saving';
            const write = async (dir, name, data, path) => {
                if (typeof data === 'string' && ProjectFolder.written.get(path) === data) return false;
                const f = await dir.getFileHandle(name, {
                    create: true
                });
                const w = await f.createWritable();
                await w.write(data);
                await w.close();
                if (typeof data === 'string') ProjectFolder.written.set(path, data);
                return true;
            };
            const exists = async (dir, name) => {
                try {
                    await dir.getFileHandle(name);
                    return true;
                } catch (e) {
                    return false;
                }
            };
            const sprites = this.sprites;
            // the one document of the folder: the one opened from it, else one by the name of the project
            let json = ProjectFolder.json || sprites.name + '.json';
            let others = [];
            for await (const [name, h] of handle.entries())
                if (h.kind === 'file' && /\.json$/i.test(name) && name !== json) others.push(name);
            if (others.length) {
                const text = T('The folder ' + handle.name + ' has another document, ' + others.join(', ') + ': the packer of the engine wants one .json at the top',
                    'В папке ' + handle.name + ' уже есть другая разметка, ' + others.join(', ') + ': упаковщику движка нужен один .json наверху');
                if (quiet || !confirm(text + T('. Write ' + json + ' beside it all the same?', '. Всё равно записать ' + json + ' рядом?'))) {
                    this.folderState = 'error';
                    this.folderStateText = text;
                    return null;
                }
            }
            const doc = JSON.stringify(Maps.saved(sprites), null, '    ');
            let files = 0,
                gone = [];
            files += await write(handle, json, doc, json);
            ProjectFolder.json = json;
            ProjectFolder.saved = doc;
            for (const set of sprites.sets) {
                if (set.frames.length) {
                    const dir = await handle.getDirectoryHandle(set.name, {
                        create: true
                    });
                    for (const f of set.frames) {
                        const picture = FrameImages.get(set.name, f.image);
                        if (!picture || !picture.changed && await exists(dir, f.image)) continue;
                        await write(dir, f.image, await PngIndexed.encode(picture));
                        picture.changed = false;
                        ++files;
                    }
                }
                const anim = set.name + '.anim';
                if (set.animation && set.animation.scripts.length) files += await write(handle, anim, Anim.text(set), anim);
                else if (await exists(handle, anim)) {
                    await handle.removeEntry(anim);
                    ProjectFolder.written.delete(anim);
                    gone.push(anim);
                }
            }
            if (sprites.dialogs.length || await handle.getDirectoryHandle('dialogs').then(() => true, () => false)) {
                const dir = await handle.getDirectoryHandle('dialogs', {
                    create: true
                });
                const names = new Set(sprites.dialogs.map(d => Dialogs.fileName(d)));
                for (const d of sprites.dialogs) files += await write(dir, Dialogs.fileName(d), d.text, 'dialogs/' + Dialogs.fileName(d));
                for await (const [name, h] of dir.entries())
                    if (h.kind === 'file' && /\.dlg$/i.test(name) && !names.has(name)) {
                        await dir.removeEntry(name);
                        ProjectFolder.written.delete('dialogs/' + name);
                        gone.push('dialogs/' + name);
                    }
            }
            // the notes of the musics as music/<name>.mml (the packer reads them for the document's music); a file of a
            // music no more listed is left as it is (the packer does not read it)
            const texts = sprites.musicTexts || {};
            const notes = (sprites.music || []).filter(n => typeof texts[n] === 'string' && texts[n].trim());
            if (notes.length) {
                const dir = await handle.getDirectoryHandle('music', {
                    create: true
                });
                for (const n of notes) files += await write(dir, n + '.mml', texts[n], 'music/' + n + '.mml');
            }
            this.savePictures();
            const time = new Date().toLocaleTimeString();
            this.folderState = 'saved';
            this.folderStateText = T('saved into ' + this.projectFolderName + ' at ' + time, 'сохранено в ' + this.projectFolderName + ' в ' + time) +
                (files || gone.length ? ': ' + files + T(' files', ' файлов') + (gone.length ? T(', taken away: ', ', удалено: ') + gone.join(', ') : '') : T(': nothing changed', ': без изменений'));
            return [json, files + T(' files written', ' файлов записано')].concat(gone.length ? [T('taken away: ', 'удалено: ') + gone.join(', ')] : []);
        },
        // an example of ExampleData.js (examples/ of the editor), by its name: its document, pictures and animations
        async openExample(name) {
            const example = ExampleData.examples.find(e => e.name === name) || ExampleData.examples[0];
            const r = readSprites(JSON.parse(JSON.stringify(example.markup)));
            if (r.error) {
                this.setUploadErrorMessage(r.error);
                return;
            }
            FrameImages.removeChanged();
            this.forgetProjectFolder();
            this.setSprites(r.sprites);
            this.edit.setIndex = 0;
            this.edit.frameIndex = 0;
            this.edit.sceneIndex = 0;
            this.edit.page = 'frames';
            await this.examplePictures(example);
            const anim = r.sprites.sets.find(s => s.animation && s.animation.scripts.length);
            this.edit.animScript = anim ? anim.animation.scripts[0].name : '';
            this.edit.animStep = 0;
            this.imagesVersion++;
        },
        // the pictures of an example are in the editor, not in files: the frames of its kinds get them
        async examplePictures(example, missing) {
            for (const set of this.sprites.sets) {
                for (const f of set.frames) {
                    const data = example.pictures[set.name + '/' + f.image];
                    if (!data || missing && FrameImages.get(set.name, f.image)) continue;
                    try {
                        FrameImages.put(set.name, f.image, await FrameImages.fromBuffer(PngIndexed.fromBase64(data)));
                    } catch (e) {}
                }
            }
        },
        newDocument() {
            FrameImages.removeChanged();
            this.forgetProjectFolder();
            this.setSprites(newSprites());
            this.edit.setIndex = 0;
            this.edit.frameIndex = 0;
        },
        // the storage may be absent or full: then the editor works without it
        autosave() {
            try {
                localStorage.setItem(StorageKeys.sprites, JSON.stringify(this.sprites));
                localStorage.setItem(StorageKeys.edit, JSON.stringify(this.edit));
            } catch (e) {}
            this.savePictures();
        },
        // changed pictures are kept until files of the same pixels are loaded
        async savePictures() {
            let saved = {};
            for (const [key, picture] of FrameImages.changed()) {
                if (!picture.png) {
                    // the picture may move on while it is written
                    const indexes = picture.indexes;
                    const png = PngIndexed.toBase64(await PngIndexed.encode(picture));
                    if (picture.indexes === indexes) picture.png = png;
                    saved[key] = png;
                } else saved[key] = picture.png;
            }
            try {
                if (Object.keys(saved).length) localStorage.setItem(StorageKeys.pictures, JSON.stringify(saved));
                else localStorage.removeItem(StorageKeys.pictures);
            } catch (e) {}
        },
        async restorePictures() {
            let saved = {};
            try {
                saved = JSON.parse(localStorage.getItem(StorageKeys.pictures) || '{}');
            } catch (e) {}
            for (const key in saved) {
                try {
                    const picture = await FrameImages.fromBuffer(PngIndexed.fromBase64(saved[key]));
                    picture.changed = true;
                    picture.png = saved[key];
                    FrameImages.images.set(key, picture);
                } catch (e) {}
            }
            // a document of an example (by its name) gets the example's pictures back where it has none
            const example = ExampleData.examples.find(e => e.name === this.sprites.name);
            if (example) await this.examplePictures(example, true);
            this.imagesVersion++;
        },
        // --- undo and redo of the whole document, and steps of pictures painted between them ---
        // a snapshot is taken when the document changed and stands still (the shell calls it after a pause)
        historyCapture() {
            const now = JSON.stringify(this.sprites);
            const top = History.undo[History.undo.length - 1];
            const merging = top && top.kind === 'picture' && top.merge;
            if (merging) top.merge = false;
            if (now === History.last) return false;
            // the document changed with a step of a picture (masks moved with the pixels): one step back for both
            if (merging) {
                top.text = History.last;
                History.last = now;
                this.undoCount = History.undo.length;
                return true;
            }
            if (History.last) {
                History.undo.push({
                    kind: 'doc',
                    text: History.last
                });
                while (History.undo.length > History.limit) History.undo.shift();
                History.redo = [];
            }
            History.last = now;
            this.undoCount = History.undo.length;
            this.redoCount = History.redo.length;
            return true;
        },
        // a step of a picture painted is a mark among the steps of the document
        // withDoc: the change of the document taken next is a part of this step
        historyMarkPicture(withDoc) {
            History.undo.push({
                kind: 'picture',
                merge: !!withDoc
            });
            while (History.undo.length > History.limit) History.undo.shift();
            History.redo = [];
            this.undoCount = History.undo.length;
            this.redoCount = 0;
        },
        historyApply(text) {
            this.dropSelection();
            this.sprites = JSON.parse(text);
            History.last = text;
            this.spritesSequence++;
            if (this.edit.setIndex >= this.sprites.sets.length) this.edit.setIndex = Math.max(0, this.sprites.sets.length - 1);
            this.selectFrame(this.edit.frameIndex);
            if (this.edit.sceneIndex >= this.sprites.scenes.length) this.edit.sceneIndex = Math.max(0, this.sprites.scenes.length - 1);
            this.edit.sceneSel = null;
            // frames removed or sets renamed come back with their pictures
            FrameImages.sync(this.sprites);
            this.imagesVersion++;
        },
        undo() {
            this.historyCapture();
            const step = History.undo.pop();
            if (!step) return false;
            if (step.kind === 'picture') {
                this.undoPicture();
                // the masks that moved with the pixels go back with them
                if (step.text) this.historyApply(step.text);
            } else {
                History.redo.push({
                    kind: 'doc',
                    text: History.last
                });
                this.historyApply(step.text);
            }
            this.undoCount = History.undo.length;
            this.redoCount = History.redo.length;
            return true;
        },
        redo() {
            this.historyCapture();
            const step = History.redo.pop();
            if (!step) return false;
            History.undo.push({
                kind: 'doc',
                text: History.last
            });
            this.historyApply(step.text);
            this.undoCount = History.undo.length;
            this.redoCount = History.redo.length;
            return true;
        },

        // --- the workbench: what is selected and shown ---
        // a kind (set) chosen in the tree, and what of it: 'frames', 'anim', 'numbers'
        selectKind(index, what) {
            if (index !== this.edit.setIndex) this.selectSet(index);
            const set = this.currentSet;
            if (!set) return;
            if (!what) what = set.frames.length || !set.animation.scripts.length ? 'frames' : 'anim';
            if (what === 'numbers') {
                this.edit.page = 'anim';
                this.edit.animView = 'numbers';
            } else if (what === 'anim' || what === 'transitions') {
                this.edit.page = 'anim';
                this.edit.animView = what === 'anim' ? 'scripts' : 'transitions';
                if (!set.animation.scripts.some(s => s.name === this.edit.animScript)) {
                    this.edit.animScript = set.animation.scripts.length ? set.animation.scripts[0].name : '';
                    this.edit.animStep = 0;
                }
            } else this.edit.page = 'frames';
            this.edit.treeOpen['kind:' + set.name] = true;
        },
        // the former tabs of animations: scripts and the state are the view of scripts (the state is on the right),
        // the rules in their views are the transitions, the checks are the problems of the project
        openAnimTab(tab) {
            this.edit.page = 'anim';
            if (tab === 'scripts' || tab === 'state') this.edit.animView = 'scripts';
            else if (tab === 'numbers') this.edit.animView = 'numbers';
            else if (tab === 'checks') this.edit.page = 'problems';
            else {
                this.edit.animView = 'transitions';
                this.edit.animTab = tab;
            }
        },
        // where a problem or a link leads: {page, set, script, line, event, group, animView, animTab, scene, sel,
        // tileset, style, dialog, frame}
        open(w) {
            const e = this.edit;
            if (w.set !== undefined) {
                const i = this.sprites.sets.findIndex(s => s.name === w.set);
                if (i >= 0 && i !== e.setIndex) this.selectSet(i);
                if (i >= 0) e.treeOpen['kind:' + w.set] = true;
            }
            if (w.page) e.page = w.page;
            if (w.animView) e.animView = w.animView;
            if (w.animTab) e.animTab = w.animTab;
            if (w.script) {
                e.animScript = w.script;
                const script = this.currentSet && this.currentSet.animation.scripts.find(s => s.name === w.script);
                let k = 0;
                if (script && w.line !== undefined && w.line !== null) k = Anim.steps(script).findIndex(st => w.line >= st.start && w.line < st.end);
                e.animStep = Math.max(0, k);
            }
            if (w.event) e.animEvent = w.event;
            if (w.group) e.animGroup = w.group;
            if (w.frame !== undefined) this.selectFrame(w.frame);
            if (w.scene) {
                const i = this.sprites.scenes.findIndex(s => s.name === w.scene);
                if (i >= 0) {
                    e.sceneIndex = i;
                    e.sceneView = 'scene';
                    e.sceneSel = w.sel || {
                        kind: 'scene'
                    };
                }
            }
            if (w.tileset) {
                e.sceneTileset = w.tileset;
                e.sceneSel = w.sel || {
                    kind: 'tileset',
                    tileset: w.tileset
                };
            }
            if (w.style) {
                e.dialogStyle = w.style;
                e.dialogPage = 'styles';
            }
            if (w.dialog) {
                e.dialogName = w.dialog;
                e.dialogPage = 'dialogs';
            }
            if (w.gamePart) {
                e.page = 'game';
                e.gamePart = w.gamePart;
                if (w.show) e.gameShow = w.show;
            }
            if (w.map !== undefined) {
                e.page = 'maps';
                if (w.map) e.mapName = w.map;
            }
        },
        restore() {
            Fonts.restore();
            Translations.restore();
            try {
                const saved = localStorage.getItem(StorageKeys.sprites);
                if (saved) {
                    const r = readSprites(JSON.parse(saved));
                    if (r.sprites) this.sprites = r.sprites;
                }
                const edit = JSON.parse(localStorage.getItem(StorageKeys.edit) || '{}');
                for (const k in this.edit) {
                    if (k in edit && typeof edit[k] === typeof this.edit[k]) this.edit[k] = edit[k];
                }
            } catch (e) {}
            if (!this.currentSet) this.edit.setIndex = 0;
            this.selectFrame(this.edit.frameIndex);
            if (!(this.edit.tool in Tools)) this.edit.tool = 'brush';
            // onion 0 was «off» before previous and next had their own boxes
            if (!(this.edit.onion >= 1 && this.edit.onion <= 3)) this.edit.onion = 1;
            if (!(this.edit.playOnion >= -1 && this.edit.playOnion <= 3)) this.edit.playOnion = 0;
            // the pages and tabs of earlier versions
            const e = this.edit;
            if (!['frames', 'masks', 'palettes', 'anim', 'scenes', 'dialogs', 'game', 'maps', 'problems'].includes(e.page)) e.page = 'frames';
            if (!Game.parts.some(x => x[0] === e.gamePart)) e.gamePart = 'constants';
            if (!['scripts', 'transitions', 'numbers'].includes(e.animView)) e.animView = 'scripts';
            if (!['text', 'steps'].includes(e.scriptsAs)) e.scriptsAs = 'text';
            if (!['rules', 'byEvent', 'groups', 'graph', 'matrix'].includes(e.animTab)) e.animTab = 'rules';
            if (!['styles', 'dialogs'].includes(e.dialogPage)) e.dialogPage = 'styles';
            if (!['say', 'choose'].includes(e.dialogMode)) e.dialogMode = 'say';
            for (const k of ['frames', 'anim', 'scenes', 'dialogs'])
                if (!(e.stripHeight[k] >= 60)) e.stripHeight[k] = 200;
            History.last = JSON.stringify(this.sprites);
        },
    },
});
// the scripts read the pack's constants and the names of its masks from the file being edited (Anim.packConstants,
// Anim.packMasks): in a computed they are its dependencies
Anim.packSource = () => useSpriteStore().sprites;
