// A small picture of a frame with its base point
const FrameThumb = {
    props: ['setName', 'frame', 'scale'],
    mounted() {
        this.draw();
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        // what the picture depends on: the base point and loaded pictures, not masks
        drawKey() {
            return [this.spritesStore.imagesVersion, this.setName, this.frame.image, this.frame.width, this.frame.height,
                this.frame.origin.x, this.frame.origin.y, this.scale
            ].join(',');
        },
    },
    watch: {
        drawKey() {
            this.draw();
        },
    },
    methods: {
        draw() {
            const canvas = this.$refs.canvas;
            const s = this.scale > 0 ? this.scale : 1;
            const picture = FrameImages.get(this.setName, this.frame.image);
            const width = Math.max(this.frame.width, 1);
            const height = Math.max(this.frame.height, 1);
            canvas.width = width * s;
            canvas.height = height * s;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (picture) ctx.drawImage(picture.canvas, 0, 0, picture.width * s, picture.height * s);
            const o = this.frame.origin;
            if (o.x >= 0 && o.y >= 0 && o.x < width && o.y < height) {
                ctx.fillStyle = 'rgba(0, 90, 255, 0.8)';
                ctx.fillRect(o.x * s, o.y * s, s, s);
            }
        },
    },
    template: `<canvas ref="canvas"></canvas>`
};

const FrameList = {
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        set() {
            return this.spritesStore.currentSet;
        },
        missing() {
            return new Set(this.spritesStore.framesWithoutImages);
        },
        changed() {
            return new Set(this.spritesStore.framesWithChangedImages);
        },
    },
    methods: {
        maskCount(frame) {
            return Object.keys(frame.masks).length;
        },
        pointCount(frame) {
            return Object.keys(frame.points).length;
        },
    },
    template: `
        <div class="frame-list" v-if="set">
            <div v-for="(frame, fi) in set.frames" :key="frame.image" @click="spritesStore.selectFrame(fi)"
                class="frame-cell" :class="{'frame-current': fi === spritesStore.edit.frameIndex, 'frame-missing': missing.has(frame)}"
                :title="frame.image + T(': masks ' + maskCount(frame) + ', points ' + pointCount(frame) + (missing.has(frame) ? '; the picture is not loaded' : '') + '. Click to open the frame. The blue pixel is the base point', ': масок ' + maskCount(frame) + ', точек ' + pointCount(frame) + (missing.has(frame) ? '; картинка не загружена' : '') + '. Щёлкните, чтобы открыть кадр. Синий пиксель — базовая точка')">
                <div class="frame-name">{{frame.image}}</div>
                <FrameThumb :set-name="set.name" :frame="frame" :scale="2"></FrameThumb>
                <div class="frame-marks">
                    <span v-if="maskCount(frame)">{{T('m', 'м')}}{{maskCount(frame)}}</span>
                    <span v-if="pointCount(frame)">{{T('p', 'т')}}{{pointCount(frame)}}</span>
                    <span v-if="changed.has(frame)" class="error-text" :title="T('The picture is changed by the Move tool and not saved', 'Картинка изменена инструментом «Сдвиг» и не сохранена')">✎</span>
                </div>
            </div>
        </div>
    `
};
