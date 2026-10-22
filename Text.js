// A field of text laid exactly as the engine lays it (src/dgx_ge_text.c of dgx-ge, mirrored by tools/dgx_ge_text.py):
// words into lines (a word wider than a line by characters, '\n' breaks), the largest whole scale of the font that
// fits but not below the least one; still too much: an important text scrolls, another is cut, its last line seen
// ending in "...". All in bytes of UTF-8, as the engine counts them. A font is as DGX's font2c/dgx_fonts.py json writes it:
// {yAdvance, yOffsetLowest, first_advance, glyphs: {codepoint: {w, h, xAdvance, xOffset, yOffset, rows: ['#..#']}}}
const Text = {
    lineBytes: 160,
    textLines: 32,
    ellipsis: [0x2e, 0x2e, 0x2e],

    bytes(text) {
        return new TextEncoder().encode(text);
    },
    // code points of bytes of UTF-8; a broken sequence is dropped, as Python's errors="ignore" drops it
    codePoints(data) {
        let out = [];
        for (let i = 0; i < data.length;) {
            const b = data[i];
            const n = b < 0x80 ? 1 : (b & 0xe0) === 0xc0 ? 2 : (b & 0xf0) === 0xe0 ? 3 : (b & 0xf8) === 0xf0 ? 4 : 0;
            let ok = n > 0 && i + n <= data.length;
            for (let k = 1; ok && k < n; ++k) ok = (data[i + k] & 0xc0) === 0x80;
            if (!ok) {
                ++i;
                continue;
            }
            let cp = n === 1 ? b : b & (0xff >> (n + 1));
            for (let k = 1; k < n; ++k) cp = cp << 6 | data[i + k] & 0x3f;
            out.push(cp);
            i += n;
        }
        return out;
    },
    // a line of a font at a scale, points: a handwritten font's scale is the height of its line
    lineHeight(font, scale) {
        return font.hw ? scale : font.yAdvance * scale;
    },
    // a handwritten font: a cell of its grid in points at a scale, the pen
    hwCell(font, scale) {
        return Math.fround(scale / font.yAdvance);
    },
    hwPen(scale) {
        return scale >= 24 ? 2 : 1;
    },
    // where a handwritten line begins so the leftmost of its pen is at 0, and how wide it is (hw_left of dgx_ge_text.c)
    hwLeft(text, font, scale) {
        const box = HwFont.textBox(font, text);
        if (!box) return [0, 0];
        const cell = this.hwCell(font, scale),
            from = Math.min(box[0], 0),
            pen = this.hwPen(scale);
        return [Math.ceil(Math.fround(-from * cell)) + (pen >> 1), Math.ceil(Math.fround((box[2] - from + 1) * cell)) + pen];
    },
    // how wide bytes are in a font at a scale (a missing glyph as wide as the first one)
    widthOf(data, font, scale) {
        if (font.hw) {
            const n = Math.min(data.length, this.lineBytes);
            return n ? this.hwLeft(String.fromCodePoint(...this.codePoints(data.subarray(0, n))), font, scale)[1] : 0;
        }
        let width = 0;
        for (const cp of this.codePoints(data.subarray(0, this.lineBytes))) {
            const g = font.glyphs[cp];
            width += g ? g.xAdvance : font.first_advance;
        }
        return width * scale;
    },
    nextChar(data, i) {
        ++i;
        while (i < data.length && (data[i] & 0xc0) === 0x80) ++i;
        return i;
    },
    // lines [start, end) of bytes as wide as width at a scale, at most textLines
    lay(data, font, scale, width) {
        let lines = [],
            i = 0;
        const n = data.length;
        while (i < n && lines.length < this.textLines) {
            const start = i;
            let end = i;
            for (;;) {
                let w = end;
                while (w < n && data[w] === 0x20) ++w;
                let e = w;
                while (e < n && data[e] !== 0x20 && data[e] !== 0x0a) ++e;
                if (e - start > this.lineBytes || this.widthOf(data.subarray(start, e), font, scale) > width) {
                    if (end === start) {
                        // a word wider than the line: by characters
                        let c = start;
                        while (c < e && this.widthOf(data.subarray(start, this.nextChar(data, c)), font, scale) <= width &&
                            this.nextChar(data, c) - start <= this.lineBytes) c = this.nextChar(data, c);
                        end = c > start ? c : this.nextChar(data, start);
                    }
                    break;
                }
                end = e;
                if (e >= n || data[e] === 0x0a) break;
            }
            lines.push([start, end]);
            i = end;
            while (i < n && data[i] === 0x20) ++i;
            if (i < n && data[i] === 0x0a) ++i;
        }
        return lines;
    },
    // {scale, lines: [text], shown, cut, scrolling, last: the last line seen as drawn, with "..." when cut}
    layout(text, font, width, height, scaleMax, scaleMin, important) {
        const data = this.bytes(text);
        width = (width + 7) & ~7; // a whole number of bytes, as the engine has it
        const lo = scaleMin || 1;
        const hi = scaleMax > lo ? scaleMax : lo;
        let scale = hi,
            lines = [],
            fits = 0;
        // the text after the last line laid, without the spaces and line breaks that end it (rest_of of the engine)
        const restOf = lines => {
            let i = lines.length ? lines[lines.length - 1][1] : data.length;
            while (i < data.length && (data[i] === 0x20 || data[i] === 0x0a)) ++i;
            return i;
        };
        while (scale >= lo) {
            lines = this.lay(data, font, scale, width);
            fits = Math.floor(height / this.lineHeight(font, scale));
            if (!lines.length || lines.length <= fits && restOf(lines) === data.length) break;
            --scale;
        }
        if (scale < lo) {
            scale = lo;
            lines = this.lay(data, font, scale, width);
            fits = Math.floor(height / this.lineHeight(font, scale));
        }
        let shown = Math.min(fits, lines.length);
        // as dgx_ge_textbox_set: spaces and line breaks after the last line laid are no text; a rest the box had no
        // lines for is cut whatever its importance; past the box, an important text scrolls, another is cut
        const unlaid = lines.length > 0 && restOf(lines) < data.length;
        const cut = unlaid || lines.length > fits && !important,
            scrolling = !cut && lines.length > fits;
        if (!shown && lines.length) shown = 1;
        const texts = lines.map(([a, b]) => data.slice(a, b).subarray(0, this.lineBytes));
        let last = shown ? texts[shown - 1] : new Uint8Array(0);
        if (cut && shown) {
            const s = last;
            let n = s.length;
            const withDots = k => {
                let out = new Uint8Array(k + 3);
                out.set(s.subarray(0, k));
                out.set(this.ellipsis, k);
                return out;
            };
            while (n > 0) {
                while (n > 0 && s[n - 1] === 0x20) --n; // no space before it
                if (this.widthOf(withDots(n), font, scale) <= width) break;
                // cut down to nothing: "..." alone
                if (!n) break;
                --n;
                while (n > 0 && (s[n] & 0xc0) === 0x80) --n;
            }
            last = withDots(n);
        }
        const decode = b => new TextDecoder().decode(b);
        return {
            scale: scale,
            lines: texts.map(decode),
            // which lines begin after a line break (the first too): the talk view's answers, a long one wrapped, by it
            begins: lines.map(([a]) => a === 0 || data[a - 1] === 0x0a),
            shown: shown,
            cut: cut,
            scrolling: scrolling,
            last: decode(last)
        };
    },
    // a handwritten font: each line written by the pen on a canvas of the box, as far as its letters have come; put(x, y,
    // ink) for each point, ink 1 (a hard pen: a point is written or not) or 1..15 of 15 (a soft pen: amounts of ink)
    drawHw(laid, font, width, height, put, first, letters, soft, align) {
        const f = Math.fround;
        const scr = Pen.screen(Math.max(1, width), Math.max(1, height), soft ? 8 : 1);
        const scale = laid.scale,
            cell = this.hwCell(font, scale);
        let texts = laid.lines.slice(first || 0, (first || 0) + laid.shown);
        if (laid.cut && texts.length) texts[texts.length - 1] = laid.last;
        if (letters !== undefined) letters -= this.letters(laid.lines.slice(0, first || 0));
        texts.forEach((t, k) => {
            if (letters !== undefined && letters <= 0) return;
            const all = [...t].length;
            const come = letters === undefined ? all : Math.min(letters, all);
            const x = this.alignFrom(t, font, scale, width, align) + this.hwLeft(t, font, scale)[0],
                y = k * scale + Math.round(f(-font.yOffsetLowest * cell));
            const pen = this.hwPen(scale) | (soft ? Pen.SOFT : 0);
            HwFont.draw(scr, font, t, x, y, cell, pen, soft ? 15 : 1, come >= all ? undefined : f(f(HwFont.effort(font, t, true) * come) / Math.max(1, all)));
            if (letters !== undefined) letters -= all;
        });
        for (let p = 0; p < scr.data.length; ++p)
            if (scr.data[p]) put(p % scr.width, Math.floor(p / scr.width), soft ? scr.data[p] / 15 : 1);
    },
    // a bitmap font of DGX from its C source (as font2c writes it, or one of DGX), as DGX's font2c/dgx_fonts.py (read_font) reads it
    readFont(src) {
        const noComments = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
        const int0 = t => /^0x/i.test(t) ? parseInt(t, 16) : parseInt(t, 10);
        let m = /bitmaps\[\]\s*=\s*\{([\s\S]*?)\};/.exec(src);
        if (!m) throw new Error('no bitmaps');
        const bitmaps = [...noComments(m[1]).matchAll(/0x([0-9A-Fa-f]+)/g)].map(x => parseInt(x[1], 16));
        m = /glyph_t\s+glyphs\[\]\s*=\s*\{([\s\S]*?)\};/.exec(src);
        if (!m) throw new Error('no glyphs');
        const glyphs = [...noComments(m[1]).matchAll(
                /\{\s*\{\s*(?:\.bitmap\s*=\s*)?bitmaps\s*\+\s*(\d+)\s*\}\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\}/g)]
            .map(x => x.slice(1, 7).map(Number));
        m = /glyph_array_t\s+glyph_ranges\[\]\s*=\s*\{([\s\S]*?)\};/.exec(src);
        if (!m) throw new Error('no glyph ranges');
        const ranges = [...m[1].matchAll(/\{\s*(0x[0-9A-Fa-f]+|\d+)\s*,\s*(0x[0-9A-Fa-f]+|\d+)\s*,\s*glyphs\s*\+\s*(\d+)\s*\}/g)]
            .map(x => [int0(x[1]), int0(x[2]), Number(x[3])]);
        let fields = {};
        for (const x of src.slice(src.lastIndexOf('dgx_font_t')).matchAll(/\.(\w+)\s*=\s*([-\w.]+)/g)) fields[x[1]] = x[2];
        const name = /dgx_font_t\s*\*\s*(\w+)\s*\(/.exec(src);
        if (!name || fields.yAdvance === undefined || fields.yOffsetLowest === undefined) throw new Error('no font of DGX');
        const fType = fields.f_type || 'DGX_FONT_BITMAP_LINES';
        const stream = fType === 'DGX_FONT_BITMAP_STREAM';
        let font = {
            name: name[1],
            f_type: fType,
            yAdvance: parseInt(fields.yAdvance, 10),
            yOffsetLowest: parseInt(fields.yOffsetLowest, 10),
            xWidest: Math.trunc(parseFloat(fields.xWidest || 0)),
            glyphs: {},
            first_advance: ranges.length ? glyphs[ranges[0][2]][3] : 0
        };
        for (const [first, number, k] of ranges) {
            for (let i = 0; i < number; ++i) {
                const [at, w, h, adv, xo, yo] = glyphs[k + i];
                let rows = [];
                for (let y = 0; y < h; ++y) {
                    let row = '';
                    for (let x = 0; x < w; ++x) {
                        const bit = stream ? y * w + x : y * 8 * Math.floor((w + 7) / 8) + x;
                        const byte = at + (bit >> 3) < bitmaps.length ? bitmaps[at + (bit >> 3)] : 0;
                        row += byte >> (7 - bit % 8) & 1 ? '#' : '.';
                    }
                    rows.push(row);
                }
                font.glyphs[first + i] = {
                    w: w,
                    h: h,
                    xAdvance: adv,
                    xOffset: xo,
                    yOffset: yo,
                    rows: rows
                };
            }
        }
        return font;
    },
    // where a line begins as the style aligns it ('left', 'middle', 'right'): the room of the box (bytes) by the whole
    // line (appearing, its letters stand where they will), as draw() of dgx_ge_text.c
    alignFrom(t, font, scale, width, align) {
        if (!align || align === 'left') return 0;
        const room = width - this.widthOf(this.bytes(t), font, scale);
        return room <= 0 ? 0 : align === 'middle' ? Math.floor(room / 2) : room;
    },
    // the letters of lines: their characters, as the engine counts them appearing (spaces at the breaks are no lines')
    letters(lines) {
        return lines.reduce((n, t) => n + [...t].length, 0);
    },
    // the points of the lines shown, as DGX draws glyphs: put(x, y) for each, a pixel of the font a scale x scale block;
    // first: the line the field starts at (a scrolling text); letters: how many have appeared (undefined: all), those of
    // the lines above the first among them; align: each line in the box ('left' none)
    draw(laid, font, width, height, put, first, letters, soft, align) {
        width = (width + 7) & ~7;
        if (font.hw) return this.drawHw(laid, font, width, height, put, first, letters, soft, align);
        const s = laid.scale,
            line = font.yAdvance * s,
            above = -font.yOffsetLowest * s;
        let texts = laid.lines.slice(first || 0, (first || 0) + laid.shown);
        if (laid.cut && texts.length) texts[texts.length - 1] = laid.last;
        const froms = texts.map(t => this.alignFrom(t, font, s, width, align));
        if (letters !== undefined) {
            letters -= this.letters(laid.lines.slice(0, first || 0));
            // as many letters of each line as have come, the ellipsis of a cut line among them
            let shown = [];
            for (const t of texts) {
                const chars = [...t];
                shown.push(chars.slice(0, Math.max(0, letters)).join(''));
                letters -= chars.length;
                if (letters <= 0) break;
            }
            texts = shown;
        }
        texts.forEach((t, k) => {
            let x = froms[k];
            const base = k * line + above;
            for (const ch of t) {
                const g = font.glyphs[ch.codePointAt(0)];
                if (!g) {
                    x += font.first_advance * s;
                    continue;
                }
                g.rows.forEach((row, gy) => {
                    for (let gx = 0; gx < row.length; ++gx) {
                        if (row[gx] !== '#') continue;
                        for (let dy = 0; dy < s; ++dy)
                            for (let dx = 0; dx < s; ++dx) {
                                const X = x + (g.xOffset + gx) * s + dx,
                                    Y = base + (g.yOffset + gy) * s + dy;
                                if (X >= 0 && X < width && Y >= 0 && Y < height) put(X, Y);
                            }
                    }
                });
                x += g.xAdvance * s;
            }
        });
    },
};
