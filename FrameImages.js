// Pictures of frames. They are not a part of the saved file and not a part of the reactive state:
// the store only counts their changes (imagesVersion).
// A picture is found by the name of its set and the name of its file
const FrameImages = {
    images: new Map(),
    // pictures of frames removed or renamed away, by their keys then: undo brings the frame back with its picture
    removed: new Map(),

    key(setName, file) {
        return setName + '\n' + file;
    },
    get(setName, file) {
        return this.images.get(this.key(setName, file));
    },
    put(setName, file, image) {
        this.images.set(this.key(setName, file), image);
    },
    remove(setName, file) {
        const key = this.key(setName, file);
        if (this.images.has(key)) this.removed.set(key, this.images.get(key));
        this.images.delete(key);
    },
    // pictures follow their set when it is renamed (and are kept by the old name, for an undo of the renaming)
    renameSet(oldName, newName) {
        const prefix = this.key(oldName, '');
        for (const [key, image] of [...this.images]) {
            if (!key.startsWith(prefix)) continue;
            this.images.delete(key);
            this.removed.set(key, image);
            this.images.set(this.key(newName, key.substring(prefix.length)), image);
        }
    },
    // the pictures are those of the frames of the document again (after undo or redo): pictures of frames it has not
    // are put aside, frames it has get back the pictures put aside for them
    sync(doc) {
        const keys = new Set();
        for (const s of doc.sets || [])
            for (const f of s.frames || []) keys.add(this.key(s.name, f.image));
        for (const [key, image] of [...this.images]) {
            if (keys.has(key)) continue;
            this.removed.set(key, image);
            this.images.delete(key);
        }
        for (const key of keys) {
            if (this.images.has(key) || !this.removed.has(key)) continue;
            this.images.set(key, this.removed.get(key));
            this.removed.delete(key);
        }
    },

    // pictures changed by the editor and not saved yet
    changed() {
        return [...this.images].filter(([key, image]) => image.changed);
    },
    removeChanged() {
        for (const [key] of this.changed()) this.images.delete(key);
    },

    async fromFile(file) {
        return this.fromBuffer(await file.arrayBuffer());
    },
    // resolves to {width, height, bitDepth, palette, indexes, chunks, canvas}: canvas shows the picture.
    // A picture the editor changes gets changed: true and keeps the indexes it had in original
    async fromBuffer(buffer) {
        const png = await PngIndexed.decode(buffer);
        png.canvas = document.createElement('canvas');
        png.canvas.width = png.width;
        png.canvas.height = png.height;
        this.render(png);
        return png;
    },
    // the canvas shows the indexes again, index 0 is transparent; png.override: the colors of a palette shown instead
    // of its own (a preview: index n is override[n])
    render(png) {
        if (!png.width || !png.height) return;
        const palette = png.override || png.palette;
        const ctx = png.canvas.getContext('2d');
        const pixels = ctx.createImageData(png.width, png.height);
        for (let i = 0; i < png.indexes.length; ++i) {
            const index = png.indexes[i];
            if (!index) continue;
            const color = palette[index] || [255, 0, 255];
            pixels.data[i * 4] = color[0];
            pixels.data[i * 4 + 1] = color[1];
            pixels.data[i * 4 + 2] = color[2];
            pixels.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
    },
    // pictures of the same size and pixels
    same(a, b) {
        return a.width === b.width && a.height === b.height && a.indexes.length === b.indexes.length &&
            a.indexes.every((v, i) => v === b.indexes[i]);
    },
};
