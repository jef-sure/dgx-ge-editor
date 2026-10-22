// Reads an indexed PNG (color type 3) to the indexes of its pixels and writes it back.
// The browser decodes a picture to colors only, but a sprite is its indexes: index 0 is transparent always,
// whatever the PNG itself says of transparency
const PngIndexed = {
    signature: [137, 80, 78, 71, 13, 10, 26, 10],

    // resolves to {width, height, bitDepth, palette: [[r, g, b], ...], indexes: Uint8Array(width * height), chunks}.
    // chunks are the other chunks of the file (PLTE, tRNS...) before and after the pixels: {before: [], after: []},
    // a written picture keeps them
    async decode(buffer) {
        const data = new Uint8Array(buffer);
        const view = new DataView(buffer);
        if (data.length < 8 || this.signature.some((b, i) => data[i] !== b)) throw new Error('not a PNG file');
        let header = null;
        let palette = [];
        let chunks = [];
        let other = {
            before: [],
            after: []
        };
        let pos = 8;
        while (pos + 8 <= data.length) {
            const length = view.getUint32(pos);
            const type = String.fromCharCode(...data.subarray(pos + 4, pos + 8));
            const body = data.subarray(pos + 8, pos + 8 + length);
            if (type === 'IHDR') {
                header = {
                    width: view.getUint32(pos + 8),
                    height: view.getUint32(pos + 12),
                    bitDepth: body[8],
                    colorType: body[9],
                    interlace: body[12]
                };
            } else if (type === 'PLTE') {
                for (let i = 0; i + 2 < body.length; i += 3) palette.push([body[i], body[i + 1], body[i + 2]]);
            } else if (type === 'IDAT') {
                chunks.push(body);
            } else if (type === 'IEND') {
                break;
            }
            if (type !== 'IHDR' && type !== 'IDAT') (chunks.length ? other.after : other.before).push({
                type: type,
                body: body.slice()
            });
            pos += 12 + length;
        }
        if (!header) throw new Error('no PNG header');
        if (header.colorType !== 3) throw new Error('not an indexed PNG, its color type is ' + header.colorType);
        if (header.interlace) throw new Error('interlaced PNG is not supported');
        const raw = await this.inflate(chunks);
        const indexes = this.unfilter(raw, header.width, header.height, header.bitDepth);
        return {
            width: header.width,
            height: header.height,
            bitDepth: header.bitDepth,
            palette: palette,
            indexes: indexes,
            chunks: other
        };
    },

    async inflate(chunks) {
        const stream = new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    },

    // scanlines of an indexed picture are filtered by whole bytes: the left neighbour is the previous byte
    unfilter(raw, width, height, bitDepth) {
        const stride = Math.ceil(width * bitDepth / 8);
        if (raw.length < (stride + 1) * height) throw new Error('PNG data is too short');
        let prior = new Uint8Array(stride);
        let line = new Uint8Array(stride);
        const indexes = new Uint8Array(width * height);
        const perByte = 8 / bitDepth;
        const valueMask = (1 << bitDepth) - 1;
        for (let y = 0; y < height; ++y) {
            const p = y * (stride + 1);
            const filter = raw[p];
            for (let i = 0; i < stride; ++i) {
                const x = raw[p + 1 + i];
                const a = i ? line[i - 1] : 0;
                const b = prior[i];
                const c = i ? prior[i - 1] : 0;
                let v;
                switch (filter) {
                    case 0:
                        v = x;
                        break;
                    case 1:
                        v = x + a;
                        break;
                    case 2:
                        v = x + b;
                        break;
                    case 3:
                        v = x + ((a + b) >> 1);
                        break;
                    case 4: {
                        const pa = Math.abs(b - c);
                        const pb = Math.abs(a - c);
                        const pc = Math.abs(a + b - 2 * c);
                        v = x + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
                        break;
                    }
                    default:
                        throw new Error('bad PNG filter ' + filter);
                }
                line[i] = v & 0xff;
            }
            // pixels of less than a byte go from the high bits
            for (let px = 0; px < width; ++px) {
                const byte = line[Math.floor(px / perByte)];
                const shift = 8 - bitDepth * (px % perByte + 1);
                indexes[y * width + px] = (byte >> shift) & valueMask;
            }
            [prior, line] = [line, prior];
        }
        return indexes;
    },

    // resolves to the bytes of a PNG file of the picture: its size, depth and palette, rows without filters
    async encode(picture) {
        const width = picture.width;
        const height = picture.height;
        const bitDepth = picture.bitDepth;
        const stride = Math.ceil(width * bitDepth / 8);
        const raw = new Uint8Array((stride + 1) * height);
        const perByte = 8 / bitDepth;
        const valueMask = (1 << bitDepth) - 1;
        for (let y = 0; y < height; ++y) {
            const p = y * (stride + 1) + 1;
            for (let px = 0; px < width; ++px) {
                const shift = 8 - bitDepth * (px % perByte + 1);
                raw[p + Math.floor(px / perByte)] |= (picture.indexes[y * width + px] & valueMask) << shift;
            }
        }
        const header = new Uint8Array(13);
        const hv = new DataView(header.buffer);
        hv.setUint32(0, width);
        hv.setUint32(4, height);
        header[8] = bitDepth;
        header[9] = 3;
        let before = picture.chunks ? picture.chunks.before : [];
        if (!before.some(c => c.type === 'PLTE')) {
            // the palette written anew goes where PNG wants it: before tRNS, bKGD and hIST, after the rest
            const at = before.findIndex(c => c.type === 'tRNS' || c.type === 'bKGD' || c.type === 'hIST');
            const plte = {
                type: 'PLTE',
                body: new Uint8Array(picture.palette.flat())
            };
            before = at < 0 ? before.concat([plte]) : [...before.slice(0, at), plte, ...before.slice(at)];
        }
        // no more transparencies than colours
        before = before.map(c => c.type === 'tRNS' && c.body.length > picture.palette.length ? {
            type: 'tRNS',
            body: c.body.subarray(0, picture.palette.length)
        } : c);
        const chunks = [{
                type: 'IHDR',
                body: header
            },
            ...before,
            {
                type: 'IDAT',
                body: await this.deflate(raw)
            },
            ...(picture.chunks ? picture.chunks.after : []),
            {
                type: 'IEND',
                body: new Uint8Array(0)
            }
        ];
        let size = 8;
        for (const c of chunks) size += 12 + c.body.length;
        const out = new Uint8Array(size);
        const view = new DataView(out.buffer);
        out.set(this.signature, 0);
        let pos = 8;
        for (const c of chunks) {
            view.setUint32(pos, c.body.length);
            for (let i = 0; i < 4; ++i) out[pos + 4 + i] = c.type.charCodeAt(i);
            out.set(c.body, pos + 8);
            view.setUint32(pos + 8 + c.body.length, this.crc(out.subarray(pos + 4, pos + 8 + c.body.length)));
            pos += 12 + c.body.length;
        }
        return out;
    },

    async deflate(raw) {
        const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    },

    crc(bytes) {
        if (!this.crcTable) {
            this.crcTable = new Uint32Array(256);
            for (let n = 0; n < 256; ++n) {
                let c = n;
                for (let k = 0; k < 8; ++k) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
                this.crcTable[n] = c;
            }
        }
        let c = 0xffffffff;
        for (const b of bytes) c = this.crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    },

    // a PNG file kept in a string, as localStorage keeps it
    toBase64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
    },
    fromBase64(text) {
        const s = atob(text);
        const bytes = new Uint8Array(s.length);
        for (let i = 0; i < s.length; ++i) bytes[i] = s.charCodeAt(i);
        return bytes.buffer;
    },
};
