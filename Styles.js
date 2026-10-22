// Styles of dialogs: how a talk looks (the engine's include/dgx_ge_talk_view.h; the packer reads them from the key
// "styles" of the file). A dialog names its style (`style talk`); a style nobody made is the engine's default.
//   style: {name, frame: 'fill' | 'picture' | 'none', picture?: {set, image}, insets?: [l, t, r, b],
//           place: [x, y, w, h] (x, y below 0: from the right, the bottom; w, h 0 or below: the screen less so much),
//           padding: [l, t, r, b] (the field of text in the frame), font: a DGX font by its accessor name,
//           scale: [max, min], important, scrollMs, waitMs, borderWidth,
//           colors: {fill, border, text, bar, name: [r, g, b]}}
// Keys the editor does not know yet are kept as they are. Fonts are not in the file: they are loaded from their C
// sources (Text.readFont) and kept in the browser, as pictures are
const Styles = {
    frames: ['fill', 'picture', 'none'],
    colorKeys: ['fill', 'border', 'text', 'bar', 'name'],
    // the engine's default style (dgx_ge_style_default)
    defaults: {
        frame: 'fill',
        insets: [0, 0, 0, 0],
        place: [4, -4, -8, 44],
        padding: [6, 4, 6, 4],
        scale: [1, 1],
        important: false,
        scrollMs: 1200,
        waitMs: 0,
        borderWidth: 1,
        appear: 'now', // or 'letters': a letter every letterMs
        letterMs: 40,
        pen: 'hard', // or 'soft': a handwritten font is written in 15 shades between fill and text
        showName: false, // the name of the one speaking, a line over the text
        portrait: 'none', // or 'left', 'right': the face of the one speaking in the top corner of that side
        portraitWidth: 0, // the room kept for it
        align: 'left', // or 'middle', 'right': each line of the text (the name, the answers) in its field
        colors: {
            fill: [16, 16, 48],
            border: [200, 200, 220],
            text: [240, 240, 240],
            bar: [64, 64, 140],
            name: [255, 220, 120]
        }
    },

    newStyle(name) {
        let s = JSON.parse(JSON.stringify(this.defaults));
        delete s.insets;
        return Object.assign({
            name: name,
            font: ''
        }, s);
    },
    // a value of a style, the default when it has none
    get(style, key) {
        return style[key] !== undefined && style[key] !== null ? style[key] : this.defaults[key];
    },
    color(style, key) {
        return style.colors && Array.isArray(style.colors[key]) ? style.colors[key] : this.defaults.colors[key];
    },

    // the styles of a file: {styles} or {error}; what it does not know stays
    read(file) {
        if (file.styles === undefined || file.styles === null) return {
            styles: []
        };
        if (!Array.isArray(file.styles)) return {
            error: 'Bad styles: a list of styles'
        };
        let styles = [];
        for (const s of file.styles) {
            if (!s || typeof s !== 'object' || typeof s.name !== 'string') return {
                error: 'Bad style ' + JSON.stringify(s).slice(0, 80)
            };
            styles.push(JSON.parse(JSON.stringify(s)));
        }
        return {
            styles: styles
        };
    },

    // the frame on a screen of width x height, as the engine places it (take_style)
    box(style, width, height) {
        const [px, py, pw, ph] = this.get(style, 'place');
        const w = pw > 0 ? pw : width + pw,
            h = ph > 0 ? ph : height + ph;
        return {
            x: px >= 0 ? px : width + px - w,
            y: py >= 0 ? py : height + py - h,
            width: w,
            height: h
        };
    },
    // place [x, y, w, h] for a box, as the place had it: counted from the right (bottom) when it was, as wide as the
    // screen less so much when it was
    placeOf(style, box, width, height) {
        const [px, py, pw, ph] = this.get(style, 'place');
        const w = pw > 0 ? box.width : box.width - width,
            h = ph > 0 ? box.height : box.height - height;
        return [px >= 0 ? box.x : box.x + box.width - width, py >= 0 ? box.y : box.y + box.height - height, w, h];
    },
    // ready styles to start from: {name: [[what it is in English, in Russian], the style's fields]}; note has a frame of a picture (Styles.parchment)
    templates: {
        speech: [['A character’s speech: at the bottom of the screen, the name and the portrait on the left, letter by letter', 'Речь персонажа: внизу экрана, имя и портрет слева, по буквам'], {
            place: [8, -6, -16, 52],
            padding: [6, 4, 6, 4],
            scale: [1, 1],
            scrollMs: 1500,
            borderWidth: 1,
            showName: true,
            portrait: 'left',
            portraitWidth: 24,
            appear: 'letters',
            letterMs: 30,
            colors: {
                fill: [24, 16, 8],
                border: [200, 160, 80],
                text: [255, 240, 200],
                bar: [110, 60, 20],
                name: [255, 200, 60]
            }
        }],
        notice: [['A message of the game: at the top in the middle, goes away by itself after 2 s', 'Сообщение игры: вверху посередине, само уходит через 2 с'], {
            place: [60, 8, 200, 24],
            padding: [6, 4, 6, 4],
            scale: [1, 1],
            waitMs: 2000,
            borderWidth: 1,
            colors: {
                fill: [16, 24, 48],
                border: [120, 160, 255],
                text: [230, 240, 255],
                bar: [40, 60, 120],
                name: [255, 220, 120]
            }
        }],
        menu: [['A page of settings: in the middle, answers with controls', 'Страница настроек: посередине, ответы с контролами'], {
            place: [70, 40, 180, 90],
            padding: [10, 6, 10, 6],
            scale: [1, 1],
            borderWidth: 2,
            colors: {
                fill: [16, 16, 40],
                border: [200, 200, 255],
                text: [230, 230, 255],
                bar: [60, 60, 140],
                name: [255, 220, 120]
            }
        }],
        subtitle: [['Subtitles: at the bottom, no frame, lines in the middle, important (scrolling)', 'Субтитры: внизу, без рамки, строки посередине, важные (прокрутка)'], {
            frame: 'none',
            align: 'middle',
            place: [16, -6, -32, 30],
            padding: [0, 0, 0, 0],
            scale: [1, 1],
            important: true,
            scrollMs: 1500,
            colors: {
                fill: [0, 0, 0],
                border: [0, 0, 0],
                text: [255, 255, 255],
                bar: [80, 80, 80],
                name: [255, 220, 120]
            }
        }],
        note: [['A note: a scroll frame of a picture (nine pieces), dark text', 'Записка: свиток-рамка из картинки (девять кусков), тёмный текст'], {
            frame: 'picture',
            insets: [6, 6, 6, 6],
            place: [60, 20, 200, 60],
            padding: [10, 8, 10, 8],
            scale: [1, 1],
            important: true,
            colors: {
                fill: [232, 214, 170],
                border: [120, 80, 40],
                text: [60, 36, 16],
                bar: [200, 170, 120],
                name: [120, 60, 20]
            }
        }],
    },
    // the picture of the note's frame, 24 x 24: a sheet with a dark edge and a shade, its corners rounded
    parchment() {
        const pal = [
            [0, 0, 0],
            [120, 80, 40],
            [232, 214, 170],
            [205, 180, 130],
            [250, 238, 205]
        ];
        let px = new Uint8Array(24 * 24);
        for (let y = 0; y < 24; ++y)
            for (let x = 0; x < 24; ++x) {
                const corner = (x < 2 || x > 21) && (y < 2 || y > 21) && !((x === 1 || x === 22) && (y === 1 || y === 22));
                if (corner) continue;
                const edge = x === 0 || y === 0 || x === 23 || y === 23 || (x === 1 || x === 22) && (y === 1 || y === 22);
                px[y * 24 + x] = edge ? 1 : x <= 2 || y <= 2 ? 4 : x >= 21 || y >= 21 ? 3 : (x * 7 + y * 13) % 29 === 0 ? 3 : 2;
            }
        return {
            width: 24,
            height: 24,
            bitDepth: 4,
            palette: pal,
            indexes: px,
            chunks: null
        };
    },
    // the field of text in the frame, under the name when the style shows it: a line of the font at the least scale
    // (nameHeight; the name is at x, y - nameHeight), beside the portrait when it shows one (portrait: its room, the
    // top corner of its side inside the padding, as high as the padding leaves)
    field(style, box, font) {
        const [l, t, r, b] = this.get(style, 'padding');
        const scale = this.get(style, 'scale');
        const nh = this.get(style, 'showName') && font ? Text.lineHeight(font, scale[1] || 1) : 0;
        const side = this.get(style, 'portrait'),
            pw = this.get(style, 'portraitWidth');
        const room = side === 'left' || side === 'right' ? pw + l : 0;
        return {
            x: box.x + l + (side === 'left' ? room : 0),
            y: box.y + t + nh,
            width: box.width - l - r - room,
            height: box.height - t - b - nh,
            nameHeight: nh,
            portrait: room ? {
                x: side === 'left' ? box.x + l : box.x + box.width - r - pw,
                y: box.y + t,
                width: pw,
                height: box.height - t - b
            } : null,
            // where the pictures of controls end on the right: before a portrait there
            right: box.x + box.width - r - (side === 'right' ? room : 0)
        };
    },

    // what the packer would refuse (error) and likely mistakes: [{style, text, error}]
    check(doc, screen, fontOf) {
        let problems = [];
        const say = (style, text, error) => problems.push({
            style: style,
            text: text,
            error: error
        });
        const isInt = Number.isInteger;
        const ints = (v, n, low, high) => Array.isArray(v) && v.length === n && v.every(x => isInt(x) && x >= low && x <= high);
        let names = {};
        for (const s of doc.styles || []) {
            const n = s.name;
            if (!n) say(n, 'a style without a name', true);
            const constant = Anim.packName('', n).slice(1);
            if (constant in names) say(n, 'the same name in the header as the style ' + names[constant] + ': ' + constant, true);
            names[constant] = n;
            if (s.frame !== undefined && !this.frames.includes(s.frame)) say(n, "frame '" + s.frame + "': fill, picture or none", true);
            if (s.frame === 'picture') {
                const p = s.picture;
                if (!p || typeof p.set !== 'string' || typeof p.image !== 'string') say(n, 'a frame of a picture without its picture', true);
                else {
                    const set = (doc.sets || []).find(set => set.name === p.set);
                    const fr = set && set.frames.find(f => f.image === p.image);
                    const ins = s.insets || [0, 0, 0, 0];
                    if (!fr) say(n, 'no picture ' + p.set + '/' + p.image, true);
                    // the packer cuts it into nine pictures of a point at least
                    else if (ints(ins, 4, 0, 255) && (ins.some(v => v < 1) || fr.width - ins[0] - ins[2] < 1 || fr.height - ins[1] - ins[3] < 1))
                        say(n, 'insets ' + ins.join(', ') + ' do not cut ' + p.image + ' (' + fr.width + ' x ' + fr.height + ') into nine pictures of a point at least', true);
                }
                // its nine pictures are <STYLE>_FRAME_0..8 in the pack, beside the pictures of the sets
                const pictures = new Set((doc.sets || []).flatMap(set => set.frames.map(f => Anim.imageName(set, f.image))));
                for (let i = 0; i < 9; ++i)
                    if (pictures.has(constant + '_FRAME_' + i)) say(n, 'its frame is cut into ' + constant + '_FRAME_0..8, and a picture of a set has the name ' + constant + '_FRAME_' + i, true);
            }
            const checks = [
                ['insets', 4, 0, 255],
                ['place', 4, -32768, 32767],
                ['padding', 4, 0, 255],
                ['scale', 2, 0, 255]
            ];
            for (const [k, len, low, high] of checks)
                if (s[k] !== undefined && !ints(s[k], len, low, high)) say(n, k + ': ' + len + ' whole numbers ' + low + '..' + high, true);
            for (const [k, low, high] of [
                    ['scrollMs', 0, 65535],
                    ['waitMs', 0, 65535],
                    ['borderWidth', 0, 255]
                ])
                if (s[k] !== undefined && !(isInt(s[k]) && s[k] >= low && s[k] <= high)) say(n, k + ': a whole number ' + low + '..' + high, true);
            for (const k of this.colorKeys) {
                const c = s.colors && s.colors[k];
                if (c !== undefined && !ints(c, 3, 0, 255)) say(n, 'color ' + k + ': [r, g, b], 0..255 each', true);
            }
            if (s.font !== undefined && typeof s.font !== 'string') say(n, 'font: the name of a font', true);
            if (s.appear !== undefined && s.appear !== 'now' && s.appear !== 'letters') say(n, "appear '" + s.appear + "': now or letters", true);
            if (s.pen !== undefined && s.pen !== 'soft' && s.pen !== 'hard') say(n, "pen '" + s.pen + "': soft or hard", true);
            if (s.letterMs !== undefined && !(isInt(s.letterMs) && s.letterMs >= 0 && s.letterMs <= 255)) say(n, 'letterMs: a whole number 0..255', true);
            if (s.showName !== undefined && typeof s.showName !== 'boolean') say(n, 'showName: true or false', true);
            if (s.align !== undefined && !['left', 'middle', 'right'].includes(s.align)) say(n, "align '" + s.align + "': left, middle or right", true);
            if (s.portrait !== undefined && !['none', 'left', 'right'].includes(s.portrait)) say(n, "portrait '" + s.portrait + "': none, left or right", true);
            if (s.portraitWidth !== undefined && !(isInt(s.portraitWidth) && s.portraitWidth >= 0 && s.portraitWidth <= 255)) say(n, 'portraitWidth: a whole number 0..255', true);
            if ((s.portrait === 'left' || s.portrait === 'right') && !s.portraitWidth) say(n, 'a portrait with no room for it (portraitWidth 0)', false);
            if (s.appear === 'letters' && !this.get(s, 'letterMs')) say(n, 'letters every 0 ms: the line is there at once', false);
            if (!s.font) say(n, 'no font: the first font of the game', false);
            const scale = this.get(s, 'scale');
            if (ints(scale, 2, 0, 255) && scale[1] > scale[0]) say(n, 'scale: the least ' + scale[1] + ' is above the largest ' + scale[0] + ': the least is taken', false);
            if (screen && ints(this.get(s, 'place'), 4, -32768, 32767) && ints(this.get(s, 'padding'), 4, 0, 255)) {
                const b = this.box(s, screen.width, screen.height);
                const font = fontOf ? fontOf(s.font) : null;
                const f = this.field(s, b, font);
                if (f.width <= 0 || f.height <= 0) say(n, 'no room for text in the frame (' + f.width + 'x' + f.height + (f.nameHeight ? ', under a name ' + f.nameHeight + ' high' : '') +
                    (f.portrait ? ', beside a portrait ' + f.portrait.width + ' wide' : '') +
                    '): the engine shows no talk in it', true);
                if (this.get(s, 'showName') && !font) say(n, 'the name takes a line of the font: load the font to see whether the text has room', false);
                if (b.x < 0 || b.y < 0 || b.x + b.width > screen.width || b.y + b.height > screen.height)
                    say(n, 'the frame ' + b.width + 'x' + b.height + ' at ' + b.x + ', ' + b.y + ' goes beyond the screen ' + screen.width + 'x' + screen.height, false);
            }
        }
        return problems;
    },
};

// fonts loaded from their C sources, by name; kept in the browser, not in the file (as pictures)
const Fonts = {
    fonts: new Map(),
    storageKey: 'dgx-ge-sprite-editor-fonts',
    get(name) {
        return this.fonts.get(name);
    },
    names() {
        return [...this.fonts.keys()].sort();
    },
    add(font) {
        this.fonts.set(font.name, font);
        this.save();
    },
    remove(name) {
        this.fonts.delete(name);
        this.save();
    },
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify([...this.fonts.values()]));
        } catch (e) {}
    },
    restore() {
        try {
            for (const f of JSON.parse(localStorage.getItem(this.storageKey) || '[]')) this.fonts.set(f.name, f);
        } catch (e) {}
    },
};
