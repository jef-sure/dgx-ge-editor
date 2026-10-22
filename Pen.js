// The pen of DGX (its src/bezier.c) repeated point by point: a curve drawn as a polyline of pieces with a hard edge (a
// box of a bit a point: rows of figures, a thin line by steps) or a soft one (a box of a byte a point, an amount of
// ink: bars and discs whose edge pixels get a share). Floats are float32 as in C (Math.fround after each operation).
// A screen here is {width, height, bits: 1 | 8, data: Uint8Array(width * height)}: a point a byte, of a box of bits 0
// or 1. Used by HwFont to write handwritten text as the engine does
const Pen = (() => {
    const f = Math.fround;
    const SOFT = 0x40000000;
    const FAR = 1e6,
        SLOP = f(0.01),
        LAP = 2,
        CORNER = f(1 / 16),
        Q = 13,
        ONE = 1 << Q,
        GUARD = f(1 / 16),
        BESIDE = 5,
        SEAM = f(1 / 64),
        TOLERANCE = 0.5;
    const fbuf = new Float32Array(1),
        ubuf = new Uint32Array(fbuf.buffer);
    const floor = v => {
        const i = Math.trunc(v);
        return i - (v < i ? 1 : 0);
    };
    const half = width => width & 1 ? 0 : 0.5;
    const rsqrt = v => {
        fbuf[0] = v;
        ubuf[0] = (0x5f375a86 - (ubuf[0] >>> 1)) >>> 0;
        let y = fbuf[0];
        y = f(y * f(1.5 - f(f(f(0.5 * v) * y) * y)));
        y = f(y * f(1.5 - f(f(f(0.5 * v) * y) * y)));
        return y;
    };
    const oneOver = v => {
        const y = rsqrt(f(v * v));
        return v < 0 ? -y : y;
    };
    const fixed = v => Math.trunc(f(f(v * ONE) + (v < 0 ? -0.5 : 0.5)));
    const round = v => {
        const whole = Math.trunc(v);
        const rest = f(v - whole);
        return rest >= 0.5 ? whole + 1 : rest <= -0.5 ? whole - 1 : whole;
    };
    const long = (dx, dy) => f(Math.sqrt(f(f(f(dx) * dx) + f(f(dy) * dy))));
    const pieces = bend => {
        const p = Math.ceil(f(Math.sqrt(f(bend / f(8 * TOLERANCE)))));
        return p < 1 ? 1 : p;
    };

    // what the screen does: a point, a rectangle, both cut by the screen; a byte of ink kept the larger
    const setPixel = (scr, x, y, c) => {
        if (x >= 0 && y >= 0 && x < scr.width && y < scr.height) scr.data[y * scr.width + x] = scr.bits === 1 ? (c ? 1 : 0) : c & 0xff;
    };
    const fillRect = (scr, x, y, w, h, c) => {
        for (let r = Math.max(0, y); r < Math.min(scr.height, y + h); ++r)
            for (let q = Math.max(0, x); q < Math.min(scr.width, x + w); ++q) scr.data[r * scr.width + q] = scr.bits === 1 ? (c ? 1 : 0) : c & 0xff;
    };
    const put = (scr, i, ink, erase) => {
        if (erase) {
            if (ink) scr.data[i] = 0;
        } else if (ink > scr.data[i]) scr.data[i] = ink;
    };

    // ---- the hard pen
    const flush = s => {
        if (s.rh) fillRect(s.scr, s.rx, s.ry, s.rw, s.rh, s.color);
        s.rh = 0;
    };
    const row = (s, y, left, right) => {
        const w = right - left + 1;
        if (s.rh && s.rx === left && s.rw === w && s.ry + s.rh === y) {
            ++s.rh;
            return;
        }
        flush(s);
        s.rx = left, s.ry = y, s.rw = w, s.rh = 1;
    };
    const figure = (s, bx, by, len, f0, f1, cx, cy, d) => {
        const dx = bx - s.x,
            dy = by - s.y;
        let ctop = 1,
            cbottom = 0,
            rtop = 1,
            rbottom = 0;
        let ke = 0,
            elo = -FAR,
            ehi = FAR,
            ks = 0,
            side = 0,
            hf = FAR;
        let tip = false,
            tipSide = 0,
            tipFirst = -2147483648,
            tipLast = 2147483647,
            tipX = 0;
        if (d > 0) {
            ctop = cy + Math.trunc((s.ey - (d - 1)) / 2);
            cbottom = ctop + d - 1;
        }
        if (f1 > f0) {
            const r = f(s.width * 0.5);
            const ax = f(s.x + f(s.ex * 0.5)),
                ay = f(s.y + f(s.ey * 0.5));
            let p0x = ax,
                p0y = ay,
                p1x = f(bx + f(s.ex * 0.5)),
                p1y = f(by + f(s.ey * 0.5));
            if (f0 > 0) p0x = f(ax + f(f(dx * f0) / len)), p0y = f(ay + f(f(dy * f0) / len));
            if (f1 < len) p1x = f(ax + f(f(dx * f1) / len)), p1y = f(ay + f(f(dy * f1) / len));
            let reach;
            if (dx === 0) side = ax, hf = r, reach = 0;
            else if (dy === 0) elo = p0x < p1x ? p0x : p1x, ehi = p0x < p1x ? p1x : p0x, reach = r;
            else {
                ke = f(-dy / dx);
                ks = f(dx / dy);
                elo = f((dx > 0 ? p0x : p1x) - f((dx > 0 ? p0y : p1y) * ke));
                ehi = f((dx > 0 ? p1x : p0x) - f((dx > 0 ? p1y : p0y) * ke));
                side = f(ax - f(ay * ks));
                hf = f(f(r * len) / (dy < 0 ? -dy : dy));
                reach = f(f(r * (dx < 0 ? -dx : dx)) / len);
            }
            rtop = -floor(f(-(f(f((p0y < p1y ? p0y : p1y) - reach) - SLOP))));
            rbottom = floor(f(f((p0y < p1y ? p1y : p0y) + reach) + SLOP));
            if (d > 0 && f1 < len) {
                tip = true;
                if (dx) {
                    tipSide = dx > 0 ? 1 : -1;
                    tipX = f(ax - f(ay * ke));
                } else if (dy > 0) tipFirst = -floor(f(-(f(ay - SLOP))));
                else tipLast = floor(f(ay + SLOP));
            }
        }
        let top = ctop,
            bottom = cbottom;
        if (rtop <= rbottom) {
            if (top > bottom || rtop < top) top = rtop;
            if (top > bottom || rbottom > bottom) bottom = rbottom;
        }
        if (top < 0) top = 0;
        if (bottom >= s.scr.height) bottom = s.scr.height - 1;
        let chord = (d & 1) ^ 1;
        const bytes = s.direct,
            width = s.scr.width;
        let touched = false;
        for (let r = top; r <= bottom; ++r) {
            let left = 1,
                right = 0;
            if (r >= rtop && r <= rbottom) {
                let lo = f(elo + f(r * ke));
                let hi = f(ehi + f(r * ke));
                const c = f(side + f(r * ks));
                if (f(c - hf) > lo) lo = f(c - hf);
                if (f(c + hf) < hi) hi = f(c + hf);
                left = -floor(f(-(f(lo - SLOP))));
                right = floor(f(hi + SLOP));
            }
            if (r >= ctop && r <= cbottom) {
                const q = 2 * (r - cy) - s.ey,
                    room = d * d - q * q;
                if (r === top && r > ctop) chord = (Math.trunc(Math.sqrt(room)) & ~1) | ((d & 1) ^ 1);
                while ((chord + 2) * (chord + 2) <= room) chord += 2;
                while (chord > 0 && chord * chord > room) chord -= 2;
                let cl = cx + Math.trunc((s.ex - chord) / 2);
                let cr = cx + Math.trunc((s.ex + chord) / 2);
                if (tip) {
                    if (tipSide > 0) {
                        const edge = -floor(f(-(f(f(tipX + f(r * ke)) - SLOP))));
                        if (cl < edge) cl = edge;
                    } else if (tipSide < 0) {
                        const edge = floor(f(f(tipX + f(r * ke)) + SLOP));
                        if (cr > edge) cr = edge;
                    } else if (r < tipFirst || r > tipLast) cl = 1, cr = 0;
                }
                if (cl > cr) {} else if (left > right) left = cl, right = cr;
                else {
                    if (cl < left) left = cl;
                    if (cr > right) right = cr;
                }
            }
            if (bytes) {
                if (left < 0) left = 0;
                if (right >= width) right = width - 1;
                for (let q = left; q <= right; ++q) s.scr.data[r * width + q] = s.color & 0xff;
                continue;
            }
            if (left <= right) row(s, r, left, right);
        }
        if (!bytes) flush(s);
    };
    const thin = (s, bx, by, len, f0, f1) => {
        const dx = bx - s.x,
            dy = by - s.y;
        const wx = Math.abs(dx),
            wy = Math.abs(dy),
            n = wx > wy ? wx : wy;
        const from = Math.trunc(f(f(f0 * n) / len)),
            to = f1 >= len ? n : Math.trunc(f(f(f1 * n) / len));
        const goneX = Math.trunc((2 * from * wx + n) / (2 * n)),
            goneY = Math.trunc((2 * from * wy + n) / (2 * n));
        let overX = 2 * (from * wx - goneX * n),
            overY = 2 * (from * wy - goneY * n);
        let x = s.x + (dx < 0 ? -goneX : goneX),
            y = s.y + (dy < 0 ? -goneY : goneY);
        for (let k = from; k <= to; ++k) {
            setPixel(s.scr, x, y, s.color);
            overX += 2 * wx, overY += 2 * wy;
            if (overX >= n) x += dx < 0 ? -1 : 1, overX -= 2 * n;
            if (overY >= n) y += dy < 0 ? -1 : 1, overY -= 2 * n;
        }
    };

    // ---- the soft pen
    const bar = (s, ax, ay, ux, uy, len, start, pen, end) => {
        const edge = f(0.5 + f(s.width * 0.5)),
            wx = ux < 0 ? -ux : ux,
            wy = uy < 0 ? -uy : uy;
        const erase = (s.color & 0xff) === 0,
            stopped = pen < len;
        const width = s.scr.width,
            last = width - 1;
        const reach = stopped && f(pen + 0.5) < end ? f(pen + 0.5) : end;
        const x0 = f(ax + f(start * ux)),
            x1 = f(ax + f(reach * ux)),
            y0 = f(ay + f(start * uy)),
            y1 = f(ay + f(reach * uy));
        const outX = f(edge * wy),
            outY = f(edge * wx);
        let top = -floor(f(-(f((y0 < y1 ? y0 : y1) - outY)))),
            bottom = floor(f((y0 < y1 ? y1 : y0) + outY));
        if (top < 0) top = 0;
        if (bottom >= s.scr.height) bottom = s.scr.height - 1;
        if (top > bottom) return;
        let mostLo = f((x0 < x1 ? x0 : x1) - outX),
            mostHi = f((x0 < x1 ? x1 : x0) + outX);
        if (mostLo < 0) mostLo = 0;
        if (mostHi > last) mostHi = last;
        if (!(mostLo <= mostHi)) return;
        const mostLeft = -floor(-mostLo),
            mostRight = Math.trunc(mostHi);
        if (mostLeft > mostRight) return;
        const ox = floor(ax),
            oy = floor(ay);
        const bx = f(ax - ox),
            by = f(ay - oy);
        const uxi = fixed(ux),
            uyi = fixed(uy);
        const along0 = Math.trunc(f(f(f(bx * ux) + f(by * uy)) * ONE)),
            across0 = Math.trunc(f(f(f(bx * uy) - f(by * ux)) * ONE));
        const from = Math.trunc(f(start * ONE)),
            to = Math.trunc(f(pen * ONE)),
            soft = Math.trunc(f(edge * ONE));
        const inkAll = erase ? 255 : s.color & 0xff,
            hlf = ONE / 2;
        const span = (Math.trunc(f(reach * ONE)) - from) >>> 0;
        const box = f(mostHi - mostLo);
        const rows = f(f(box - BESIDE) * wy) > f(2 * edge) && f(f(box - BESIDE) * wx) > f(reach - start);
        let endLo = 0,
            endHi = 0,
            endStep = 0,
            sideLo = 0,
            sideHi = 0,
            sideStep = 0;
        if (rows) {
            const both = oneOver(f(ux * uy)),
                ix = f(uy * both),
                iy = f(ux * both),
                down = f(top - ay);
            const e0 = f(ax + f(f(start - f(down * uy)) * ix)),
                e1 = f(ax + f(f(reach - f(down * uy)) * ix));
            const f0 = f(ax + f(f(f(down * ux) - edge) * iy)),
                f1 = f(ax + f(f(f(down * ux) + edge) * iy));
            endLo = e0 < e1 ? e0 : e1, endHi = e0 < e1 ? e1 : e0;
            endStep = f(f(-uy) * ix);
            sideLo = f0 < f1 ? f0 : f1, sideHi = f0 < f1 ? f1 : f0;
            sideStep = f(ux * iy);
        }
        let alongRow = (mostLeft - ox) * uxi + (top - oy) * uyi - along0,
            acrossRow = (mostLeft - ox) * uyi - (top - oy) * uxi - across0;
        for (let r = top; r <= bottom; ++r, alongRow += uyi, acrossRow -= uxi) {
            let left = mostLeft,
                right = mostRight;
            if (rows) {
                const lo = f((endLo > sideLo ? endLo : sideLo) + f(1 - GUARD));
                const hi = f((endHi < sideHi ? endHi : sideHi) + GUARD);
                endLo = f(endLo + endStep), endHi = f(endHi + endStep), sideLo = f(sideLo + sideStep), sideHi = f(sideHi + sideStep);
                if (hi < mostLeft) continue;
                if (lo > mostLeft + 1) left = Math.trunc(lo);
                if (hi < mostRight) right = Math.trunc(hi);
                if (left > right) continue;
            }
            let along = alongRow + (left - mostLeft) * uxi,
                across = acrossRow + (left - mostLeft) * uyi;
            for (let q = left; q <= right; ++q, along += uxi, across += uyi) {
                if (((along - from) >>> 0) > span) continue;
                let share = soft - (across < 0 ? -across : across);
                if (stopped && hlf + (to - along) < share) share = hlf + (to - along);
                if (share <= 0) continue;
                put(s.scr, r * width + q, share >= ONE ? inkAll : (share * inkAll + hlf) >> Q, erase);
            }
        }
    };
    const disc = (s, cx, cy, d, first, firstLimit, second) => {
        const dr = f(d * 0.5),
            reach = f(dr + 0.5);
        const erase = (s.color & 0xff) === 0;
        const inkAll = erase ? 255 : s.color & 0xff;
        const last = s.scr.width - 1;
        let west = reach,
            east = reach,
            north = reach,
            south = reach;
        if (d < 1) return;
        for (let i = 0; i < 2; ++i) {
            const v = i ? second : first;
            if (!v) continue;
            const limit = i ? SEAM : firstLimit;
            const byX = f(f(reach * (v[1] < 0 ? -v[1] : v[1])) + limit),
                byY = f(f(reach * (v[0] < 0 ? -v[0] : v[0])) + limit);
            if (v[0] > 0 && byX < east) east = byX;
            if (v[0] < 0 && byX < west) west = byX;
            if (v[1] > 0 && byY < south) south = byY;
            if (v[1] < 0 && byY < north) north = byY;
        }
        let lo = f(cx - west),
            hi = f(cx + east);
        if (lo < 0) lo = 0;
        if (hi > last) hi = last;
        if (!(lo <= hi)) return;
        const left = -floor(-lo),
            right = Math.trunc(hi);
        let top = -floor(f(-(f(cy - north)))),
            bottom = floor(f(cy + south));
        if (top < 0) top = 0;
        if (bottom >= s.scr.height) bottom = s.scr.height - 1;
        if (left > right || top > bottom) return;
        let q = 6;
        while (q > 0 && f(reach * (1 << q)) > 46000) --q;
        const one = 1 << q;
        const unit = one,
            back = f(f(1 << (6 - q)) * f(1 / 64)),
            full = inkAll;
        const cxi = floor(f(f(cx * unit) + 0.5)),
            cyi = floor(f(f(cy * unit) + 0.5));
        const inner = dr > 0.5 ? Math.trunc(f(f(dr - 0.5) * unit)) : 0,
            outer = Math.trunc(f(reach * unit));
        const in2 = inner * inner,
            out2 = outer * outer;
        const wide = dr >= 2.5 && q === 6;
        const mid = f(dr * unit),
            overMid = wide ? oneOver(mid) : 0;
        const mid2 = Math.trunc(f(mid * mid));
        const halfInk = f(f(0.5 * full) + 0.5),
            ring1 = f(f(f(0.5 * overMid) * back) * full),
            ring2 = f(f(f(f(f(0.125 * overMid) * overMid) * overMid) * back) * full);
        let firstX = 0,
            firstY = 0,
            firstRow = 0,
            secondX = 0,
            secondY = 0,
            secondRow = 0;
        if (first) {
            firstX = fixed(first[0]), firstY = fixed(first[1]);
            firstRow = fixed(f(f(f(f(left - cx) * first[0]) + f(f(top - cy) * first[1])) - firstLimit));
        }
        if (second) {
            secondX = fixed(second[0]), secondY = fixed(second[1]);
            secondRow = fixed(f(f(f(f(left - cx) * second[0]) + f(f(top - cy) * second[1])) - SEAM));
        }
        const off0 = left * one - cxi;
        for (let r = top; r <= bottom; ++r, firstRow += firstY, secondRow += secondY) {
            const down = r * one - cyi,
                dy2 = down * down;
            if (dy2 >= out2) continue;
            let off = off0,
                onFirst = firstRow,
                onSecond = secondRow;
            for (let p = left; p <= right; ++p, off += one, onFirst += firstX, onSecond += secondX) {
                if (onFirst > 0 || onSecond > 0) continue;
                const d2 = off * off + dy2;
                let ink = inkAll;
                if (d2 >= out2) continue;
                if (d2 > in2) {
                    if (wide) {
                        const more = f(d2 - mid2);
                        ink = Math.trunc(f(halfInk - f(more * f(ring1 - f(more * ring2)))));
                    } else {
                        const square = f(d2);
                        ink = Math.trunc(f(f(f(reach - f(f(square * rsqrt(square)) * back)) * full) + 0.5));
                    }
                    if (ink <= 0) continue;
                }
                put(s.scr, r * s.scr.width + p, ink, erase);
            }
        }
    };

    // ---- a curve
    const begin = (b, scr, end, pc, width, color) => {
        const asked = width > 0 && !!(width & SOFT);
        if (width > 0) width &= ~SOFT;
        b.scr = scr;
        b.color = color;
        b.width = Math.min(width, 32767);
        b.started = false;
        b.soft = false;
        b.direct = scr.bits === 8 ? 1 : 0;
        b.soft = asked && width >= 1 && scr.bits === 8;
        if (b.soft) {
            const edge = f(f(b.width * 0.5) + 0.5);
            b.fx = f(b.kx[3] + half(b.width)), b.fy = f(b.ky[3] + half(b.width));
            b.little = f(f(edge - CORNER) * oneOver(f(edge + CORNER)));
            b.back = 0;
            b.nextLength = 0;
        } else {
            b.x = round(b.kx[3]);
            b.y = round(b.ky[3]);
            b.ex = b.ey = 0;
            b.rh = 0;
        }
        b.end = end;
        b.pieces = width < 1 ? 0 : Math.min(pc, 32767);
        b.done = 0;
        b.length = -1;
        b.drawn = 0;
        b.inPiece = false;
    };
    const bezier3 = (scr, p, pc, width, color) => {
        let b = {
            kx: [0, f(p[0][0] - 2 * p[1][0] + p[2][0]), f(2 * (p[1][0] - p[0][0])), f(p[0][0])],
            ky: [0, f(p[0][1] - 2 * p[1][1] + p[2][1]), f(2 * (p[1][1] - p[0][1])), f(p[0][1])]
        };
        if (pc < 1) pc = pieces(f(2 * f(Math.hypot(b.kx[1], b.ky[1]))));
        begin(b, scr, p[2], pc, width, color);
        return b;
    };
    const bezier4 = (scr, p, pc, width, color) => {
        let kx = [0, 0, 0, f(p[0][0])],
            ky = [0, 0, 0, f(p[0][1])];
        kx[2] = f(3 * (p[1][0] - p[0][0]));
        kx[1] = f(f(3 * (p[2][0] - p[1][0])) - kx[2]);
        kx[0] = f(f(f(p[3][0] - p[0][0]) - kx[2]) - kx[1]);
        ky[2] = f(3 * (p[1][1] - p[0][1]));
        ky[1] = f(f(3 * (p[2][1] - p[1][1])) - ky[2]);
        ky[0] = f(f(f(p[3][1] - p[0][1]) - ky[2]) - ky[1]);
        let b = {
            kx: kx,
            ky: ky
        };
        if (pc < 1) {
            const atStart = f(2 * f(Math.hypot(kx[1], ky[1])));
            const atEnd = f(2 * f(Math.hypot(f(f(3 * kx[0]) + kx[1]), f(f(3 * ky[0]) + ky[1]))));
            pc = pieces(atStart > atEnd ? atStart : atEnd);
        }
        begin(b, scr, p[3], pc, width, color);
        return b;
    };
    const cubicAt = (k, t) => f(f(f(f(f(f(k[0] * t) + k[1]) * t) + k[2]) * t) + k[3]);
    const point = (b, piece) => {
        if (piece >= b.pieces) return [b.end[0], b.end[1]];
        const t = f(piece / b.pieces);
        return [round(cubicAt(b.kx, t)), round(cubicAt(b.ky, t))];
    };
    const softPoint = (b, piece) => {
        const h = half(b.width);
        if (piece >= b.pieces) return [f(b.end[0] + h), f(b.end[1] + h)];
        const t = f(piece * oneOver(b.pieces));
        return [f(cubicAt(b.kx, t) + h), f(cubicAt(b.ky, t) + h)];
    };
    const length = b => {
        if (b.length < 0 && b.soft) {
            let [x0, y0] = softPoint(b, 0);
            b.length = 0;
            for (let i = 1; i <= b.pieces; ++i) {
                const [x, y] = softPoint(b, i);
                const square = f(f(f(x - x0) * f(x - x0)) + f(f(y - y0) * f(y - y0)));
                if (square > f(SLOP * SLOP)) b.length = f(b.length + f(square * rsqrt(square)));
                x0 = x, y0 = y;
            }
        }
        if (b.length < 0) {
            let x0 = round(b.kx[3]),
                y0 = round(b.ky[3]);
            b.length = 0;
            for (let i = 1; i <= b.pieces; ++i) {
                const [x, y] = point(b, i);
                b.length = f(b.length + long(x - x0, y - y0));
                x0 = x, y0 = y;
            }
        }
        return b.length;
    };
    const start = b => {
        b.started = true;
        if (b.soft) {
            disc(b, b.fx, b.fy, b.width, b.inPiece ? [b.ux, b.uy] : null, SEAM, null);
            return;
        }
        if (b.width === 1) {
            setPixel(b.scr, b.x, b.y, b.color);
            return;
        }
        if (!(b.width & 1)) {
            if (!b.ex) b.ex = 1;
            if (!b.ey) b.ey = 1;
        }
        figure(b, b.x, b.y, 0, 0, 0, b.x, b.y, b.width);
    };
    const softTo = (b, whole, target) => {
        const edge = f(f(b.width * 0.5) + 0.5);
        while (b.done < b.pieces) {
            if (!b.inPiece) {
                let x, y;
                if (b.nextLength > 0) {
                    x = b.nx, y = b.ny;
                    b.ux = b.next[0], b.uy = b.next[1];
                    b.pieceLength = b.nextLength;
                } else {
                    [x, y] = softPoint(b, b.done + 1);
                    const dx = f(x - b.fx),
                        dy = f(y - b.fy),
                        square = f(f(dx * dx) + f(dy * dy));
                    if (!(square > f(SLOP * SLOP))) {
                        ++b.done;
                        continue;
                    }
                    const by = rsqrt(square);
                    b.pieceLength = f(square * by);
                    b.ux = f(dx * by), b.uy = f(dy * by);
                }
                b.fbx = x, b.fby = y;
                b.fore = -1;
                b.nextLength = 0;
                if (b.done + 2 <= b.pieces) {
                    [b.nx, b.ny] = softPoint(b, b.done + 2);
                    const dx = f(b.nx - x),
                        dy = f(b.ny - y),
                        square = f(f(dx * dx) + f(dy * dy));
                    if (square > f(SLOP * SLOP)) {
                        const by = rsqrt(square);
                        b.nextLength = f(square * by);
                        b.next = [f(dx * by), f(dy * by)];
                        const turn = f(f(b.ux * b.next[0]) + f(b.uy * b.next[1])),
                            side = f(f(b.ux * b.next[1]) - f(b.uy * b.next[0]));
                        if (turn >= b.little) {
                            const less = f(1 - turn);
                            b.fore = f(f(edge * (side < 0 ? -side : side)) * f(0.5 + f(less * f(0.25 + f(less * f(0.125 + f(less * 0.0625)))))));
                        }
                    }
                }
                b.pieceDrawn = 0;
                b.inPiece = true;
            }
            if (!b.started) start(b);
            const from = b.pieceDrawn,
                rest = f(b.pieceLength - from);
            const end = f(b.pieceLength + (b.fore > 0 ? b.fore : 0));
            const st = from > LAP ? f(from - LAP) : -b.back;
            if (whole || f(target - b.drawn) >= rest) {
                bar(b, b.fx, b.fy, b.ux, b.uy, b.pieceLength, st, b.pieceLength, end);
                if (!(b.fore > 0)) disc(b, b.fbx, b.fby, b.width, [-b.ux, -b.uy], f(SEAM + f(b.pieceLength * f(2 / ONE))), b.nextLength > 0 ? b.next : null);
                b.drawn = f(b.drawn + rest);
                b.fx = b.fbx, b.fy = b.fby;
                b.back = b.fore > 0 ? b.fore : 0;
                b.inPiece = false;
                ++b.done;
                continue;
            }
            const to = f(from + f(target - b.drawn));
            bar(b, b.fx, b.fy, b.ux, b.uy, b.pieceLength, st, to, end);
            disc(b, f(b.fx + f(b.ux * to)), f(b.fy + f(b.uy * to)), b.width - 2, null, 0, null);
            b.pieceDrawn = to;
            b.drawn = target;
            break;
        }
    };
    // the curve as far as t of it (1 all of it): true when it is all drawn
    const drawTo = (b, t) => {
        if (b.done >= b.pieces) return true;
        const whole = t >= 1;
        const target = whole ? 0 : f(t * length(b));
        if (!whole && !(target > b.drawn)) return false;
        if (b.soft) softTo(b, whole, target);
        while (!b.soft && b.done < b.pieces) {
            if (!b.inPiece) {
                const [x, y] = point(b, b.done + 1);
                const dx = x - b.x,
                    dy = y - b.y;
                if (dx === 0 && dy === 0) {
                    ++b.done;
                    continue;
                }
                b.bx = x, b.by = y;
                b.pieceLength = long(dx, dy);
                b.pieceDrawn = 0;
                b.inPiece = true;
                if (!(b.width & 1)) {
                    if (dx) b.ey = dx > 0 ? 1 : -1;
                    if (dy) b.ex = dy > 0 ? -1 : 1;
                }
            }
            if (!b.started) start(b);
            const from = b.pieceDrawn;
            const rest = f(b.pieceLength - from);
            if (whole || f(target - b.drawn) >= rest) {
                if (b.width === 1) thin(b, b.bx, b.by, b.pieceLength, from, b.pieceLength);
                else figure(b, b.bx, b.by, b.pieceLength, from, b.pieceLength, b.bx, b.by, b.width);
                b.drawn = f(b.drawn + rest);
                b.x = b.bx, b.y = b.by;
                b.inPiece = false;
                ++b.done;
                continue;
            }
            const to = f(from + f(target - b.drawn));
            if (b.width === 1) thin(b, b.bx, b.by, b.pieceLength, from, to);
            else {
                const cx = b.x + round(f(f((b.bx - b.x) * to) / b.pieceLength));
                const cy = b.y + round(f(f((b.by - b.y) * to) / b.pieceLength));
                figure(b, b.bx, b.by, b.pieceLength, from, to, cx, cy, b.width - 2);
            }
            b.pieceDrawn = to;
            b.drawn = target;
            break;
        }
        if (b.done >= b.pieces && !b.started) start(b);
        return b.done >= b.pieces;
    };

    return {
        SOFT: SOFT,
        screen(width, height, bits) {
            return {
                width: width,
                height: height,
                bits: bits,
                data: new Uint8Array(width * height)
            };
        },
        bezier3: bezier3,
        bezier4: bezier4,
        drawTo: drawTo,
        f: f,
    };
})();
