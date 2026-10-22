// The current frame on the canvas of its set: a pixel of the frame is a cell of the grid,
// all frames stand on the canvas by their base points, coordinates are from the base point
const FrameCanvas = {
    data() {
        return {
            cursor: null, // {x, y} under the mouse
            stroke: null, // {value, last: {x, y}} while a brush or an eraser draws
            rect: null, // {x0, y0, x1, y1, value, select} while a rectangle is drawn or an area is selected
            dragPoint: '', // name of the point the mouse moves
            dragArea: null, // {last: {x, y}} while the mouse moves the selected area
        };
    },
    mounted() {
        this.ctx = this.$refs.canvas.getContext('2d');
        window.addEventListener('mouseup', this.onmouseup);
        this.draw();
    },
    unmounted() {
        window.removeEventListener('mouseup', this.onmouseup);
        if (this.drawRequest) cancelAnimationFrame(this.drawRequest);
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        set() {
            return this.spritesStore.currentSet;
        },
        frame() {
            return this.spritesStore.currentFrame;
        },
        // the canvas of the set; without frames a small one around the base point
        area() {
            const c = this.set ? this.set.canvas : null;
            if (c && c.width && c.height) return c;
            return {
                left: -8,
                top: -15,
                width: 16,
                height: 16
            };
        },
        zoom() {
            return Math.max(1, this.edit.zoom | 0);
        },
        cursorText() {
            if (!this.cursor) return '';
            let text = 'x: ' + this.cursor.x + ', y: ' + this.cursor.y;
            const frame = this.frame;
            if (frame) {
                const px = this.cursor.x + frame.origin.x;
                const py = this.cursor.y + frame.origin.y;
                if (px >= 0 && py >= 0 && px < frame.width && py < frame.height) {
                    text += T('; picture ', '; картинка ') + px + ', ' + py;
                    const picture = this.picture(frame);
                    if (picture) text += T(', index ', ', индекс ') + picture.indexes[py * picture.width + px];
                }
            }
            return text;
        },
    },
    watch: {
        'spritesStore.sprites': {
            handler() {
                this.requestDraw();
            },
            deep: true
        },
        'spritesStore.edit': {
            handler() {
                this.requestDraw();
            },
            deep: true
        },
        'spritesStore.imagesVersion'() {
            this.requestDraw();
        },
        'spritesStore.selection': {
            handler() {
                this.requestDraw();
            },
            deep: true
        },
        cursor() {
            this.requestDraw();
        },
        // the line of state shows what is under the mouse
        cursorText(t) {
            FrameUi.cursorText = t;
        },
        rect: {
            handler() {
                this.requestDraw();
            },
            deep: true
        },
    },
    methods: {
        picture(frame) {
            this.spritesStore.imagesVersion;
            return FrameImages.get(this.set.name, frame.image);
        },
        requestDraw() {
            if (this.drawRequest) return;
            this.drawRequest = requestAnimationFrame(() => {
                this.drawRequest = 0;
                this.draw();
            });
        },
        // screen position of a pixel given from the base point
        toScreen(x, y) {
            return [(x - this.area.left) * this.zoom, (y - this.area.top) * this.zoom];
        },
        cellAt(event) {
            const canvas = this.$refs.canvas;
            const r = canvas.getBoundingClientRect();
            // the pixels start inside the border of the canvas
            return {
                x: Math.floor((event.clientX - r.left - canvas.clientLeft) / this.zoom) + this.area.left,
                y: Math.floor((event.clientY - r.top - canvas.clientTop) / this.zoom) + this.area.top
            };
        },
        draw() {
            const canvas = this.$refs.canvas;
            if (!canvas) return;
            const z = this.zoom;
            const a = this.area;
            const width = a.width * z + 1;
            const height = a.height * z + 1;
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            const ctx = this.ctx;
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            if (this.set) this.drawFrames();
            this.drawGrid();
            this.drawBase();
            if (this.frame && this.edit.showMasks) this.drawMasks();
            if (this.spritesStore.selection) this.drawSelection();
            if (this.rect) this.drawRect();
            if (this.frame && this.edit.showPoints) this.drawPoints();
            if (this.cursor) {
                const [sx, sy] = this.toScreen(this.cursor.x, this.cursor.y);
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.strokeRect(sx + 0.5, sy + 0.5, z, z);
            }
        },
        // tint: a colour the picture is washed with, so a neighbour before is told from one after
        drawPicture(frame, alpha, tint) {
            const picture = this.picture(frame);
            if (!picture) return;
            let source = picture.canvas;
            if (tint) {
                source = document.createElement('canvas');
                source.width = picture.width;
                source.height = picture.height;
                const c = source.getContext('2d');
                c.drawImage(picture.canvas, 0, 0);
                c.globalCompositeOperation = 'source-atop';
                c.fillStyle = tint;
                c.fillRect(0, 0, source.width, source.height);
            }
            const [sx, sy] = this.toScreen(-frame.origin.x, -frame.origin.y);
            this.ctx.globalAlpha = alpha;
            this.ctx.drawImage(source, sx, sy, picture.width * this.zoom, picture.height * this.zoom);
            this.ctx.globalAlpha = 1;
        },
        drawFrames() {
            const frames = this.set.frames;
            const current = this.edit.frameIndex;
            if (this.edit.allFrames) {
                frames.forEach((f, i) => {
                    if (i !== current) this.drawPicture(f, 0.12);
                });
            } else {
                for (let d = this.edit.onion; d > 0; --d) {
                    const alpha = 0.35 / d;
                    if (this.edit.onionPrev && current - d >= 0) this.drawPicture(frames[current - d], alpha, 'rgba(220, 40, 40, 0.5)');
                    if (this.edit.onionNext && current + d < frames.length) this.drawPicture(frames[current + d], alpha, 'rgba(40, 90, 230, 0.5)');
                }
            }
            if (this.frame && this.edit.showImage) this.drawPicture(this.frame, 1);
        },
        drawGrid() {
            const ctx = this.ctx;
            const z = this.zoom;
            const a = this.area;
            if (z < 4) return;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let c = 0; c <= a.width; ++c) {
                ctx.moveTo(c * z + 0.5, 0);
                ctx.lineTo(c * z + 0.5, a.height * z + 1);
            }
            for (let r = 0; r <= a.height; ++r) {
                ctx.moveTo(0, r * z + 0.5);
                ctx.lineTo(a.width * z + 1, r * z + 0.5);
            }
            ctx.stroke();
        },
        // the base line is the row of the base point, the base column is the column sprites are mirrored around
        drawBase() {
            const ctx = this.ctx;
            const z = this.zoom;
            const a = this.area;
            const [ox, oy] = this.toScreen(0, 0);
            ctx.fillStyle = 'rgba(0, 120, 255, 0.10)';
            ctx.fillRect(0, oy, a.width * z + 1, z + 1);
            ctx.fillRect(ox, 0, z + 1, a.height * z + 1);
            ctx.strokeStyle = 'rgba(0, 90, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // feet stand on the lower edge of the base row
            ctx.moveTo(0, oy + z + 0.5);
            ctx.lineTo(a.width * z + 1, oy + z + 0.5);
            // the mirror axis goes through the middle of the base column
            ctx.moveTo(ox + Math.floor(z / 2) + 0.5, 0);
            ctx.lineTo(ox + Math.floor(z / 2) + 0.5, a.height * z + 1);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.strokeRect(ox + 1, oy + 1, z - 1, z - 1);
            ctx.lineWidth = 1;
        },
        drawMasks() {
            const ctx = this.ctx;
            const z = this.zoom;
            const frame = this.frame;
            for (const m of this.spritesStore.sprites.masks) {
                if (this.edit.hiddenMasks[m.index] || !(m.index in frame.masks)) continue;
                const current = m.index === this.edit.maskIndex;
                const g = Mask.decode(frame.masks[m.index]);
                const has = (c, r) => c >= 0 && r >= 0 && c < g.width && r < g.height && g.bits[r * g.width + c];
                ctx.fillStyle = m.color;
                ctx.globalAlpha = current ? 0.5 : 0.3;
                for (let r = 0; r < g.height; ++r) {
                    for (let c = 0; c < g.width; ++c) {
                        if (!has(c, r)) continue;
                        const [sx, sy] = this.toScreen(g.x + c, g.y + r);
                        ctx.fillRect(sx + 1, sy + 1, z - 1 || 1, z - 1 || 1);
                    }
                }
                // the outline shows the mask on pictures of a near color
                ctx.globalAlpha = 1;
                ctx.strokeStyle = m.color;
                ctx.lineWidth = current ? 2 : 1;
                ctx.beginPath();
                for (let r = 0; r < g.height; ++r) {
                    for (let c = 0; c < g.width; ++c) {
                        if (!has(c, r)) continue;
                        const [sx, sy] = this.toScreen(g.x + c, g.y + r);
                        if (!has(c, r - 1)) {
                            ctx.moveTo(sx, sy + 0.5);
                            ctx.lineTo(sx + z + 1, sy + 0.5);
                        }
                        if (!has(c, r + 1)) {
                            ctx.moveTo(sx, sy + z + 0.5);
                            ctx.lineTo(sx + z + 1, sy + z + 0.5);
                        }
                        if (!has(c - 1, r)) {
                            ctx.moveTo(sx + 0.5, sy);
                            ctx.lineTo(sx + 0.5, sy + z + 1);
                        }
                        if (!has(c + 1, r)) {
                            ctx.moveTo(sx + z + 0.5, sy);
                            ctx.lineTo(sx + z + 0.5, sy + z + 1);
                        }
                    }
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        },
        // dashes black on white are seen on any picture
        drawFrameOf(left, top, width, height) {
            const ctx = this.ctx;
            const [sx, sy] = this.toScreen(left, top);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'white';
            ctx.strokeRect(sx + 0.5, sy + 0.5, width * this.zoom, height * this.zoom);
            ctx.strokeStyle = 'black';
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(sx + 0.5, sy + 0.5, width * this.zoom, height * this.zoom);
            ctx.setLineDash([]);
        },
        drawSelection() {
            const s = this.spritesStore.selection;
            this.drawFrameOf(s.left + s.dx, s.top + s.dy, s.width, s.height);
        },
        inSelection(cell) {
            const s = this.spritesStore.selection;
            return s && cell.x >= s.left + s.dx && cell.y >= s.top + s.dy &&
                cell.x < s.left + s.dx + s.width && cell.y < s.top + s.dy + s.height;
        },
        drawRect() {
            const ctx = this.ctx;
            const r = this.normalRect(this.rect);
            if (this.rect.select) {
                this.drawFrameOf(r.left, r.top, r.width, r.height);
                return;
            }
            const [sx, sy] = this.toScreen(r.left, r.top);
            const m = this.spritesStore.maskDefinition(this.edit.maskIndex);
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = r.value && m ? m.color : 'white';
            ctx.fillRect(sx, sy, r.width * this.zoom, r.height * this.zoom);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = r.value ? 'black' : 'red';
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(sx + 0.5, sy + 0.5, r.width * this.zoom, r.height * this.zoom);
            ctx.setLineDash([]);
        },
        drawPoints() {
            const ctx = this.ctx;
            const z = this.zoom;
            ctx.font = '12px sans-serif';
            ctx.textBaseline = 'middle';
            for (const name in this.frame.points) {
                const p = this.frame.points[name];
                const [sx, sy] = this.toScreen(p.x, p.y);
                const cx = sx + z / 2 + 0.5;
                const cy = sy + z / 2 + 0.5;
                const selected = name === this.edit.pointName;
                const radius = Math.max(3, z * 0.6);
                // what hangs on a point behind the body: a dashed circle
                const behind = p.z < 0;
                ctx.strokeStyle = selected ? '#ff00ff' : '#202020';
                ctx.lineWidth = selected ? 2 : 1;
                if (behind) ctx.setLineDash([3, 2]);
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(cx - radius - 3, cy);
                ctx.lineTo(cx + radius + 3, cy);
                ctx.moveTo(cx, cy - radius - 3);
                ctx.lineTo(cx, cy + radius + 3);
                ctx.stroke();
                const label = name + (behind ? ' (behind ' + p.z + ')' : p.z !== 1 ? ' (z ' + p.z + ')' : '');
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'white';
                ctx.strokeText(label, cx + radius + 5, cy);
                ctx.fillStyle = selected ? '#c000c0' : 'black';
                ctx.fillText(label, cx + radius + 5, cy);
                ctx.lineWidth = 1;
            }
        },
        normalRect(r) {
            return {
                left: Math.min(r.x0, r.x1),
                top: Math.min(r.y0, r.y1),
                width: Math.abs(r.x1 - r.x0) + 1,
                height: Math.abs(r.y1 - r.y0) + 1,
                value: r.value
            };
        },
        // pixels of a line from a to b, so a fast mouse leaves no gaps
        linePixels(a, b) {
            let pixels = [];
            let x = a.x,
                y = a.y;
            const dx = Math.abs(b.x - x),
                dy = -Math.abs(b.y - y);
            const sx = x < b.x ? 1 : -1,
                sy = y < b.y ? 1 : -1;
            let err = dx + dy;
            for (;;) {
                pixels.push({
                    x: x,
                    y: y
                });
                if (x === b.x && y === b.y) break;
                const e2 = 2 * err;
                if (e2 >= dy) {
                    err += dy;
                    x += sx;
                }
                if (e2 <= dx) {
                    err += dx;
                    y += sy;
                }
            }
            return pixels;
        },
        pointAt(cell) {
            if (!this.frame) return '';
            for (const name in this.frame.points) {
                const p = this.frame.points[name];
                if (p.x === cell.x && p.y === cell.y) return name;
            }
            return '';
        },
        // the right button does the opposite: the brush erases, the eraser draws
        onmousedown(event) {
            if (event.button !== 0 && event.button !== 2) return;
            this.$refs.canvas.focus();
            const cell = this.cellAt(event);
            const store = this.spritesStore;
            const opposite = event.button === 2;
            switch (this.edit.tool) {
                case 'origin':
                    // the clicked pixel becomes the base point
                    store.moveOrigin(cell.x, cell.y);
                    break;
                case 'brush':
                case 'eraser': {
                    const value = (this.edit.tool === 'brush') !== opposite;
                    this.stroke = {
                        value: value,
                        last: cell
                    };
                    store.paint([cell], value);
                    break;
                }
                case 'pencil':
                    // the picture itself: the colour chosen, the right button transparent
                    this.stroke = {
                        pencil: true,
                        index: opposite ? 0 : this.edit.colorIndex,
                        last: cell
                    };
                    store.paintPicture([cell], this.stroke.index, true);
                    break;
                case 'fill':
                    store.fillPicture(cell, opposite ? 0 : this.edit.colorIndex);
                    break;
                case 'picker':
                    store.pickColor(cell);
                    break;
                case 'rect':
                    this.rect = {
                        x0: cell.x,
                        y0: cell.y,
                        x1: cell.x,
                        y1: cell.y,
                        value: !opposite
                    };
                    break;
                case 'move':
                    // the selected area is dragged, a rectangle elsewhere is a new selection
                    if (this.inSelection(cell)) {
                        this.dragArea = {
                            last: cell
                        };
                    } else {
                        store.dropSelection();
                        this.rect = {
                            x0: cell.x,
                            y0: cell.y,
                            x1: cell.x,
                            y1: cell.y,
                            value: true,
                            select: true
                        };
                    }
                    break;
                case 'point': {
                    const hit = this.pointAt(cell);
                    if (hit) {
                        store.selectPoint(hit);
                    } else if (this.frame && this.edit.pointName in this.frame.points) {
                        store.setPoint(this.edit.pointName, cell.x, cell.y);
                    } else {
                        store.addPoint('', cell);
                    }
                    this.dragPoint = this.edit.pointName;
                    break;
                }
            }
        },
        onmousemove(event) {
            const cell = this.cellAt(event);
            if (!this.cursor || this.cursor.x !== cell.x || this.cursor.y !== cell.y) this.cursor = cell;
            if (this.stroke && (cell.x !== this.stroke.last.x || cell.y !== this.stroke.last.y)) {
                if (this.stroke.pencil) this.spritesStore.paintPicture(this.linePixels(this.stroke.last, cell), this.stroke.index);
                else this.spritesStore.paint(this.linePixels(this.stroke.last, cell), this.stroke.value);
                this.stroke.last = cell;
            }
            if (this.rect) {
                this.rect.x1 = cell.x;
                this.rect.y1 = cell.y;
            }
            if (this.dragPoint) this.spritesStore.setPoint(this.dragPoint, cell.x, cell.y);
            if (this.dragArea && (cell.x !== this.dragArea.last.x || cell.y !== this.dragArea.last.y)) {
                this.spritesStore.moveSelection(cell.x - this.dragArea.last.x, cell.y - this.dragArea.last.y);
                this.dragArea.last = cell;
            }
        },
        onmouseleave() {
            this.cursor = null;
        },
        // the wheel zooms by the steps of the zoom list
        onwheel(event) {
            const zooms = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];
            const i = zooms.indexOf(this.edit.zoom);
            const j = Math.max(0, Math.min(zooms.length - 1, (i < 0 ? 5 : i) + (event.deltaY < 0 ? 1 : -1)));
            this.edit.zoom = zooms[j];
            event.preventDefault();
        },
        onmouseup() {
            this.stroke = null;
            this.dragPoint = '';
            this.dragArea = null;
            if (this.rect) {
                const r = this.normalRect(this.rect);
                if (this.rect.select) this.spritesStore.select(r.left, r.top, r.width, r.height);
                else this.spritesStore.paint(rectPixels(r.left, r.top, r.width, r.height), r.value);
                this.rect = null;
            }
        },
    },
    template: `
        <div class="frame-canvas-box">
            <canvas class="frame-canvas" ref="canvas" tabindex="0"
                @mousedown="onmousedown" @mousemove="onmousemove" @mouseleave="onmouseleave" @wheel="onwheel" @contextmenu.prevent></canvas>
        </div>
    `
};
