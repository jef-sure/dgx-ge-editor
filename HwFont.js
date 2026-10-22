// Handwritten fonts of DGX (DGX_FONT_HW, dgx_hw_font.h): symbols drawn with the pen along Bezier curves, letters joined.
// Read from their C sources (as font2c writes them from the hw-fonts editor), laid and written as DGX does it
// (src/hw_font.c): the line a symbol at a time (dgx_hw_line_place), the box of a text (dgx_hw_text_box), the strokes the
// pen makes, the joints between letters (dgx_hw_writer_next), the effort of writing (dgx_hw_text_effort). The strokes
// are drawn by Pen (bezier.c repeated), point for point what DGX draws. Editing such a font is the hw-fonts editor's
const HwFont = {
    NONE: -32768,
    types: {
        DGX_HW_DOT: 1,
        DGX_HW_LINE: 2,
        DGX_HW_CURVE3P: 3,
        DGX_HW_CURVE: 4
    },

    // the font of a C source: {name, hw: {...}, yAdvance, yOffsetLowest, ranges: [[first, number, glyph]], glyphs: [...]}
    read(src) {
        const noComments = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
        const block = re => {
            const m = re.exec(src);
            if (!m) throw new Error('no handwritten font of DGX');
            return noComments(m[1]);
        };
        const int0 = t => /^0x/i.test(t) ? parseInt(t, 16) : parseInt(t, 10);
        const elements = [...block(/dgx_hw_element_t\s+elements\[\]\s*=\s*\{([\s\S]*?)\};/).matchAll(
            /\{\s*(DGX_HW_\w+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*\{((?:\s*\{\s*\d+\s*,\s*\d+\s*\}\s*,?)+)\}\s*\}/g)].map(m => ({
            type: this.types[m[1]],
            pieces: +m[2],
            length: +m[3],
            pixels: +m[4],
            points: [...m[5].matchAll(/\{\s*(\d+)\s*,\s*(\d+)\s*\}/g)].map(p => [+p[1], +p[2]])
        }));
        const keys = ['begin_connection', 'main_segments', 'end_connection', 'post_segments', 'width', 'top', 'bottom', 'left', 'right',
            'line_left', 'line_right', 'line_width', 'up_left', 'up_right', 'advance', 'space_before', 'space_after'
        ];
        const symbols = [...block(/dgx_hw_symbol_t\s+symbols\[\]\s*=\s*\{([\s\S]*?)\};/).matchAll(/\{([^{}]*)\}/g)].map(m => {
            const v = m[1].split(',').map(x => x.trim()).filter(x => x).map(x => x === 'DGX_HW_NONE' ? this.NONE : parseInt(x, 10));
            return Object.fromEntries(keys.map((k, i) => [k, v[i]]));
        });
        const glyphs = [...block(/glyph_t\s+glyphs\[\]\s*=\s*\{([\s\S]*?)\};/).matchAll(
            /\{\s*\{\s*\.elements\s*=\s*elements\s*\+\s*(\d+)\s*,\s*\.hw\s*=\s*symbols\s*\+\s*(\d+)\s*\}\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\}/g)].map(m => {
            const s = symbols[+m[2]];
            const n = s.begin_connection + s.main_segments + s.end_connection + s.post_segments;
            return {
                elements: elements.slice(+m[1], +m[1] + n),
                hw: s,
                width: +m[3],
                height: +m[4],
                xAdvance: +m[5],
                xOffset: +m[6],
                yOffset: +m[7]
            };
        });
        const ranges = [...block(/glyph_array_t\s+glyph_ranges\[\]\s*=\s*\{([\s\S]*?)\};/).matchAll(/\{\s*(0x[0-9A-Fa-f]+|\d+)\s*,\s*(0x[0-9A-Fa-f]+|\d+)\s*,\s*glyphs\s*\+\s*(\d+)\s*\}/g)]
            .map(m => [int0(m[1]), int0(m[2]), +m[3]]);
        let hw = {};
        for (const m of block(/dgx_hw_font_t\s+hw\s*=\s*\{([\s\S]*?)\};/).matchAll(/\.(\w+)\s*=\s*("[^"]*"|-?\d+)/g)) hw[m[1]] = m[2].startsWith('"') ? m[2].slice(1, -1) : +m[2];
        const fields = {};
        for (const m of src.slice(src.lastIndexOf('dgx_font_t')).matchAll(/\.(\w+)\s*=\s*([-\w.&]+)/g)) fields[m[1]] = m[2];
        const name = /dgx_font_t\s*\*\s*(\w+)\s*\(/.exec(src);
        if (!name || fields.f_type !== 'DGX_FONT_HW') throw new Error('no handwritten font of DGX');
        return {
            name: name[1],
            f_type: 'DGX_FONT_HW',
            yAdvance: parseInt(fields.yAdvance, 10),
            yOffsetLowest: parseInt(fields.yOffsetLowest, 10),
            hw: hw,
            ranges: ranges,
            glyphList: glyphs,
            glyphs: {} // for the bitmap code: none
        };
    },
    glyph(font, cp) {
        for (const [first, number, at] of font.ranges)
            if (cp >= first && cp < first + number) return font.glyphList[at + cp - first];
        return null;
    },

    lineBegin(font) {
        return {
            font: font,
            pen: 0,
            up: 0,
            hasUp: false,
            first: true
        };
    },
    // a symbol placed in the line: [the glyph or null, its shift]
    linePlace(line, cp) {
        const hw = line.font.hw;
        const g = this.glyph(line.font, cp);
        const first = line.first;
        line.first = false;
        if (!g) {
            // a space has its own width, a symbol which is not in the font takes the whole active area
            line.pen += cp === 32 ? hw.space_width : hw.symbol_size_x;
            line.hasUp = false;
            return [null, 0];
        }
        const s = g.hw;
        let left = first ? line.pen : line.pen + g.xOffset;
        if (s.up_left !== this.NONE) {
            // two tall symbols are also kept apart by their parts above the lowercase band
            const upLeft = left + s.up_left - s.left;
            if (line.hasUp && upLeft < line.up + s.space_before) left += line.up + s.space_before - upLeft;
            const up = left + s.up_right - s.left + 1 + s.space_after;
            if (!line.hasUp) line.up = 0;
            if (up > line.up) line.up = up;
            line.hasUp = true;
        }
        const shift = left - s.left - hw.symbol_offset_x;
        line.pen = left - g.xOffset + g.xAdvance;
        return [g, shift];
    },
    // the box of a text in cells: [left, top, right, bottom] or null
    textBox(font, text) {
        let line = this.lineBegin(font),
            lineY = 0,
            box = null;
        for (const ch of text) {
            const cp = ch.codePointAt(0);
            if (cp === 10) {
                line = this.lineBegin(font);
                lineY += font.hw.symbol_size_y;
                continue;
            }
            const [g, shift] = this.linePlace(line, cp);
            if (!g) continue;
            const gl = shift + font.hw.symbol_offset_x + g.hw.left,
                gt = lineY + g.hw.top;
            const gr = shift + font.hw.symbol_offset_x + g.hw.right,
                gb = lineY + g.hw.bottom;
            if (!box) box = [gl, gt, gr, gb];
            else box = [Math.min(box[0], gl), Math.min(box[1], gt), Math.max(box[2], gr), Math.max(box[3], gb)];
        }
        return box;
    },

    // any element as a cubic curve drawing the same
    cubic(type, x, y) {
        if (type === 3) {
            x[3] = x[2], y[3] = y[2];
            x[2] = x[3] + (x[1] - x[3]) * 2 / 3, y[2] = y[3] + (y[1] - y[3]) * 2 / 3;
            x[1] = x[0] + (x[1] - x[0]) * 2 / 3, y[1] = y[0] + (y[1] - y[0]) * 2 / 3;
        } else if (type === 2) {
            x[3] = x[1], y[3] = y[1];
            x[1] = x[0] + (x[3] - x[0]) / 3, y[1] = y[0] + (y[3] - y[0]) / 3;
            x[2] = x[0] + (x[3] - x[0]) * 2 / 3, y[2] = y[0] + (y[3] - y[0]) * 2 / 3;
        } else if (type === 1) {
            x[1] = x[2] = x[3] = x[0], y[1] = y[2] = y[3] = y[0];
        }
    },
    // one curve joining two symbols (the least squares of dgx_hw_joint): a the last element of the end connection of the
    // first, b the first of the begin connection of the second, both cubic, in the text
    joint(ax, ay, bx, by) {
        const f = Math.fround;
        const qx = [ax[0], ax[1], (ax[2] + bx[1]) / 2, bx[2], bx[3]];
        const qy = [ay[0], ay[1], (ay[2] + by[1]) / 2, by[2], by[3]];
        const ux = ax[1] - ax[0],
            uy = ay[1] - ay[0];
        const vx = bx[2] - bx[3],
            vy = by[2] - by[3];
        let suu = 0,
            suv = 0,
            svv = 0,
            sur = 0,
            svr = 0;
        for (let i = 1; i < 8; ++i) {
            const t = i / 8,
                m = 1 - t;
            const b1 = 3 * m * m * t,
                b2 = 3 * m * t * t;
            const k = [m * m * m * m, 4 * m * m * m * t, 6 * m * m * t * t, 4 * m * t * t * t, t * t * t * t];
            let rx = -(m * m * m + b1) * ax[0] - (b2 + t * t * t) * bx[3];
            let ry = -(m * m * m + b1) * ay[0] - (b2 + t * t * t) * by[3];
            for (let n = 0; n < 5; ++n) rx += k[n] * qx[n], ry += k[n] * qy[n];
            suu += b1 * b1 * (ux * ux + uy * uy);
            svv += b2 * b2 * (vx * vx + vy * vy);
            suv += b1 * b2 * (ux * vx + uy * vy);
            sur += b1 * (ux * rx + uy * ry);
            svr += b2 * (vx * rx + vy * ry);
        }
        // the pen never goes backwards: the points are kept not closer than a quarter of the way to a[1] and b[2]
        const least = 0.25;
        let ka = least,
            kb = least;
        const det = suu * svv - suv * suv;
        if (det > 0.000001) {
            ka = (sur * svv - svr * suv) / det;
            kb = (suu * svr - suv * sur) / det;
        }
        if (ka < least || kb < least) {
            const kaAlone = suu > 0 ? (sur - least * suv) / suu : least;
            const kbAlone = svv > 0 ? (svr - least * suv) / svv : least;
            if (ka < least && kb < least) ka = kb = least;
            else if (ka < least) {
                ka = least;
                kb = kbAlone > least ? kbAlone : least;
            } else {
                kb = least;
                ka = kaAlone > least ? kaAlone : least;
            }
        }
        let s = {
            type: 4,
            x: [ax[0], ax[0] + ka * ux, bx[3] + kb * vx, bx[3]],
            y: [ay[0], ay[0] + ka * uy, by[3] + kb * vy, by[3]]
        };
        // as many pieces as keep the polyline within half a cell; the length is theirs
        const k1x = 3 * (s.x[0] - 2 * s.x[1] + s.x[2]),
            k1y = 3 * (s.y[0] - 2 * s.y[1] + s.y[2]);
        const k0x = s.x[3] - 3 * s.x[2] + 3 * s.x[1] - s.x[0],
            k0y = s.y[3] - 3 * s.y[2] + 3 * s.y[1] - s.y[0];
        const atStart = 2 * Math.hypot(k1x, k1y),
            atEnd = 2 * Math.hypot(3 * k0x + k1x, 3 * k0y + k1y);
        let pieces = Math.ceil(f(Math.sqrt(Math.max(atStart, atEnd) / 4)));
        s.pieces = Math.max(1, Math.min(255, pieces));
        s.length = 0;
        let px = s.x[0],
            py = s.y[0];
        for (let i = 1; i <= s.pieces; ++i) {
            const t = i / s.pieces,
                m = 1 - t;
            const x = m * m * m * s.x[0] + 3 * m * m * t * s.x[1] + 3 * m * t * t * s.x[2] + t * t * t * s.x[3];
            const y = m * m * m * s.y[0] + 3 * m * m * t * s.y[1] + 3 * m * t * t * s.y[2] + t * t * t * s.y[3];
            s.length += Math.hypot(x - px, y - py);
            px = x, py = y;
        }
        return s;
    },

    // the strokes of a text, as dgx_hw_writer_next gives them: [{type, x[], y[], pieces, length, symbol, lift}]
    strokes(font, text, joined) {
        const hw = font.hw;
        const cps = [...text].map(c => c.codePointAt(0));
        let out = [];
        let pen = null;
        const done = s => {
            s.lift = !!pen && (s.x[0] !== pen[0] || s.y[0] !== pen[1]);
            pen = [s.x[s.type - 1], s.y[s.type - 1]];
            out.push(s);
        };
        let lineY = 0;
        const inText = (e, shift) => [e.points.map(p => p[0] + shift), e.points.map(p => p[1] - hw.symbol_offset_y - hw.base_line + lineY)];
        const strokeOf = (e, shift, symbol) => {
            const [x, y] = inText(e, shift);
            done({
                type: e.type,
                x: x,
                y: y,
                pieces: e.pieces,
                length: e.length * 0.01,
                symbol: symbol
            });
        };
        let line = this.lineBegin(font);
        let number = 0,
            prev = null,
            run = null; // {idx, number, line, lineY, end}: the symbols written so far without the pen lifted
        let joint = null; // [x, y] of the end of the symbol before, cubic
        // the postponed strokes of the run: its symbols placed once more, as they were
        const post = () => {
            let pl = Object.assign({}, run.line),
                pn = run.number;
            const keepY = lineY;
            lineY = run.lineY;
            for (let i = run.idx; i < run.end; ++i) {
                const [g, shift] = this.linePlace(pl, cps[i]);
                ++pn;
                if (!g) continue;
                const s = g.hw;
                const at = s.begin_connection + s.main_segments + s.end_connection;
                for (let k = 0; k < s.post_segments; ++k) strokeOf(g.elements[at + k], shift, pn - 1);
            }
            lineY = keepY;
            run = null;
        };
        for (let i = 0; i < cps.length; ++i) {
            const cp = cps[i];
            const g0 = cp === 10 ? null : this.glyph(font, cp);
            // two symbols are joined only when the first has an end connection and the second a begin connection
            const joinedPrev = joined && g0 && prev && prev.hw.end_connection && g0.hw.begin_connection;
            if (!joinedPrev && run) post();
            if (cp === 10) {
                ++number;
                line = this.lineBegin(font);
                lineY += hw.symbol_size_y;
                prev = null;
                continue;
            }
            if (g0 && !run) run = {
                idx: i,
                number: number,
                line: Object.assign({}, line),
                lineY: lineY,
                end: i
            };
            const gNumber = number++;
            const [g, shift] = this.linePlace(line, cp);
            if (!g) {
                prev = null;
                continue;
            }
            run.end = i + 1;
            let joinedNext = false;
            if (joined && g.hw.end_connection && i + 1 < cps.length) {
                const n = cps[i + 1];
                const gn = n === 10 ? null : this.glyph(font, n);
                joinedNext = !!(gn && gn.hw.begin_connection);
            }
            const s = g.hw,
                e = g.elements;
            // a connection which joins nothing is not written, but after a letter of joined writing that has no end
            // connection: this one is begun with its whole begin connection
            const deadEnd = joined && prev && prev.hw.begin_connection && !prev.hw.end_connection;
            let k = 0;
            if (joinedPrev) {
                // the pen comes from the symbol before by one curve, then the rest of the begin connection
                const [bx, by] = inText(e[0], shift);
                this.cubic(e[0].type, bx, by);
                const js = this.joint(joint[0], joint[1], bx, by);
                js.symbol = gNumber;
                done(js);
                k = 1;
            }
            if (joinedPrev || deadEnd)
                for (; k < s.begin_connection; ++k) strokeOf(e[k], shift, gNumber);
            for (let m = 0; m < s.main_segments; ++m) strokeOf(e[s.begin_connection + m], shift, gNumber);
            // the end connection but its last element, which goes into the joint with the next symbol
            if (joinedNext) {
                const end = s.begin_connection + s.main_segments;
                for (let m = 0; m + 1 < s.end_connection; ++m) strokeOf(e[end + m], shift, gNumber);
                const [jx, jy] = inText(e[end + s.end_connection - 1], shift);
                this.cubic(e[end + s.end_connection - 1].type, jx, jy);
                joint = [jx, jy];
            }
            prev = g;
        }
        if (run) post();
        return out;
    },
    // the effort of writing a text (no pace: the lengths of the strokes)
    effort(font, text, joined) {
        return this.strokes(font, text, joined).reduce((n, s) => Math.fround(n + Math.fround(Math.max(0, s.length))), 0);
    },

    pixel(v) {
        if (!(v > -32767)) return -32767;
        if (v > 32767) return 32767;
        return Math.trunc(v < 0 ? v - 0.5 : v + 0.5);
    },
    // the strokes of a line written into a screen of Pen at x, y (its base line) as dgx_hw_writing_draw_to does it: a cell
    // of the grid so many points, a pen (its width, | Pen.SOFT) and ink; effort: as far as that much of the writing
    // (undefined: all of it)
    draw(scr, font, text, x, y, cell, pen, ink, effort) {
        const f = Math.fround;
        let passed = 0;
        cell = f(cell);
        for (const s of this.strokes(font, text, true)) {
            let p = [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ];
            for (let i = 0; i < s.type; ++i) p[i] = [this.pixel(f(x + f(f(s.x[i]) * cell))), this.pixel(f(y + f(f(s.y[i]) * cell)))];
            const needed = Math.ceil(f(s.pieces * f(Math.sqrt(cell))));
            let pieces = !(needed >= 1) ? 1 : needed > 32767 ? 32767 : needed;
            if (s.type === 2 || s.type === 1) pieces = 1;
            let curve;
            if (s.type === 4) curve = Pen.bezier4(scr, p, pieces, pen, ink);
            else {
                if (s.type === 1) p[1] = p[2] = p[0];
                if (s.type === 2) p[2] = p[1];
                curve = Pen.bezier3(scr, p, pieces, pen, ink);
            }
            const start = passed,
                len = f(Math.max(0, s.length));
            if (effort === undefined || effort >= f(start + len)) {
                Pen.drawTo(curve, 1);
                passed = f(start + len);
                continue;
            }
            if (effort > start) Pen.drawTo(curve, f(f(effort - start) / len));
            break;
        }
    },
};
