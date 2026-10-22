// A mask as it is saved: {x, y, width, height, rows}.
// x, y are the left upper pixel of the mask from the base point of the frame, rows are strings of hex digits,
// a digit is 4 pixels, the high bit is the left one. The last digit of a row is padded with zero bits.
// The editor keeps a mask cut to its pixels; a mask without pixels is {x: 0, y: 0, width: 0, height: 0, rows: []}.
// To change a mask it is turned to a grid: {x, y, width, height, bits: Uint8Array(width * height)}
const Mask = {
    empty() {
        return {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rows: []
        };
    },
    grid(x, y, width, height) {
        return {
            x: x,
            y: y,
            width: width,
            height: height,
            bits: new Uint8Array(width * height)
        };
    },
    decode(mask) {
        const g = this.grid(mask.x, mask.y, mask.width, mask.height);
        for (let r = 0; r < mask.height; ++r) {
            const row = mask.rows[r] || '';
            for (let c = 0; c < mask.width; ++c) {
                const digit = parseInt(row[c >> 2] || '0', 16) || 0;
                if (digit & (8 >> (c & 3))) g.bits[r * mask.width + c] = 1;
            }
        }
        return g;
    },
    // cuts the grid to its pixels
    encode(g) {
        let left = g.width,
            top = g.height,
            right = -1,
            bottom = -1;
        for (let r = 0; r < g.height; ++r) {
            for (let c = 0; c < g.width; ++c) {
                if (!g.bits[r * g.width + c]) continue;
                if (c < left) left = c;
                if (c > right) right = c;
                if (r < top) top = r;
                if (r > bottom) bottom = r;
            }
        }
        if (right < 0) return this.empty();
        const width = right - left + 1;
        const height = bottom - top + 1;
        let rows = [];
        for (let r = top; r <= bottom; ++r) {
            let row = '';
            for (let c = 0; c < width; c += 4) {
                let digit = 0;
                for (let b = 0; b < 4 && c + b < width; ++b) {
                    if (g.bits[r * g.width + left + c + b]) digit |= 8 >> b;
                }
                row += digit.toString(16);
            }
            rows.push(row);
        }
        return {
            x: g.x + left,
            y: g.y + top,
            width: width,
            height: height,
            rows: rows
        };
    },
    // calls fn(x, y) for every pixel of the mask, coordinates from the base point
    forEach(mask, fn) {
        const g = this.decode(mask);
        for (let r = 0; r < g.height; ++r) {
            for (let c = 0; c < g.width; ++c) {
                if (g.bits[r * g.width + c]) fn(g.x + c, g.y + r);
            }
        }
    },
    count(mask) {
        let n = 0;
        this.forEach(mask, () => ++n);
        return n;
    },
    // sets (value true) or clears pixels [{x, y}, ...] of a mask, an absent mask is an empty one
    paint(mask, pixels, value) {
        if (!mask) mask = this.empty();
        let left = Infinity,
            top = Infinity,
            right = -Infinity,
            bottom = -Infinity;
        let take = (x, y, w, h) => {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x + w);
            bottom = Math.max(bottom, y + h);
        };
        if (mask.width && mask.height) take(mask.x, mask.y, mask.width, mask.height);
        if (value) {
            for (const p of pixels) take(p.x, p.y, 1, 1);
        }
        if (right === -Infinity) return this.empty();
        const g = this.grid(left, top, right - left, bottom - top);
        const old = this.decode(mask);
        for (let r = 0; r < old.height; ++r) {
            for (let c = 0; c < old.width; ++c) {
                if (old.bits[r * old.width + c]) g.bits[(old.y - top + r) * g.width + old.x - left + c] = 1;
            }
        }
        for (const p of pixels) {
            const c = p.x - left;
            const r = p.y - top;
            if (c < 0 || r < 0 || c >= g.width || r >= g.height) continue;
            g.bits[r * g.width + c] = value ? 1 : 0;
        }
        return this.encode(g);
    },
    shift(mask, dx, dy) {
        if (!mask.width || !mask.height) return mask;
        return Object.assign({}, mask, {
            x: mask.x + dx,
            y: mask.y + dy
        });
    },
    // the default mask of a frame: its pixels of not zero indexes
    fromPicture(picture, origin) {
        const g = this.grid(-origin.x, -origin.y, picture.width, picture.height);
        for (let i = 0; i < picture.indexes.length; ++i) {
            if (picture.indexes[i]) g.bits[i] = 1;
        }
        return this.encode(g);
    },
};
