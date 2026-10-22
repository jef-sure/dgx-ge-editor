// The editor without a browser, for the makers of the examples: reads a document as the editor opens it, the
// animations of its kinds from their .anim texts as the editor imports them, and says the problems of the whole
// project as the node Problems would (pictures are not looked at: the browser test does that).
// node examples/editor_check.js < {doc, anims: {kind: text}} > {doc, problems: [{error, source, text}]}
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const context = {
    console,
    Vue: {
        reactive: o => o,
        markRaw: o => o
    },
    Pinia: {
        defineStore: () => () => null,
        mapStores: () => ({}),
        mapState: () => ({}),
        mapActions: () => ({}),
        storeToRefs: () => ({})
    },
    localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    },
    navigator: {
        language: 'en'
    },
    document: {
        documentElement: {}
    },
    TextEncoder,
    TextDecoder
};
vm.createContext(context);
for (const file of ['I18n.js', 'PngIndexed.js', 'FrameImages.js', 'Mask.js', 'Meets.js', 'Anim.js', 'Controls.js', 'Pen.js', 'HwFont.js',
        'Text.js', 'Styles.js', 'Dialogs.js', 'Scene.js', 'Store.js', 'Game.js', 'Maps.js', 'Problems.js'
    ])
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, {
        filename: file
    });

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = vm.runInContext(`(input => {
    let doc = input.doc;
    Anim.packSource = () => doc;
    FrameImages.get = () => ({});
    const r = readSprites(JSON.parse(JSON.stringify(doc)));
    if (r.error) return {error: r.error};
    const sprites = r.sprites;
    // the frames of a kind in the order the editor keeps them when it loads their pictures
    for (const set of sprites.sets) set.frames.sort((a, b) => compareNames(a.image, b.image));
    Anim.packSource = () => sprites;
    let errors = [];
    for (const [kind, text] of Object.entries(input.anims || {})) {
        const set = sprites.sets.find(s => s.name === kind);
        if (!set) {
            errors.push(kind + '.anim: no kind of that name');
            continue;
        }
        const a = Anim.parse(text, set);
        if (a.errors) errors.push(...a.errors.map(e => kind + '.anim: ' + e));
        else set.animation = a.animation;
    }
    if (errors.length) return {error: errors.join('\\n')};
    const problems = Problems.collect(sprites, () => null).filter(p => !/no picture: load the PNG/.test(p.text));
    // the texts the editor exports for the kinds, to be assembled against the originals
    let exported = {};
    for (const set of sprites.sets) if (set.animation && set.animation.scripts.length) exported[set.name] = Anim.text(set);
    return {doc: Maps.saved(sprites), problems: problems.map(p => ({error: p.error, source: p.source, text: p.text})), exported};
})`, context)(input);
process.stdout.write(JSON.stringify(out));
