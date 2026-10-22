// The shell of the editor: one workbench, as of CAD. At the top the commands of the project, undo and redo, the tools
// of the mode, the count of problems and the switch of the help; on the left the tree of the project (Bench.js); in the
// middle the view of what is chosen; on the right its properties and the help; below a strip of the mode (the frames
// of a kind, the player of animations, the palette of a scene, the text of a dialog); at the bottom the line of state.
// What is shown is decided by edit.page, which the tree sets
const SpriteEdit = {
    created() {
        this.spritesStore.restore();
        // the problems are counted when the pictures kept in the browser are back, not before (no false "no picture")
        this.picturesRestored = this.spritesStore.restorePictures();
        // the folder of the last visit, offered to be opened again
        this.spritesStore.keptProjectFolder();
        // the document is kept in the browser half a second after the last change, and a step of undo is taken; the
        // folder of the project open, it is written there too
        this.spritesStore.$subscribe(() => {
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => {
                this.spritesStore.historyCapture();
                this.spritesStore.autosave();
                this.spritesStore.autosaveProjectFolder();
            }, 500);
            clearTimeout(this.problemsTimer);
            this.problemsTimer = setTimeout(() => this.refreshProblems(), 700);
        });
    },
    mounted() {
        window.addEventListener('keydown', this.onkeydown);
        this.picturesRestored.then(() => this.refreshProblems(), () => this.refreshProblems());
    },
    unmounted() {
        window.removeEventListener('keydown', this.onkeydown);
    },
    data() {
        return {
            downloadUrl: undefined,
            folderMessage: '',
            problems: [],
            resizing: null, // {startY, startH} while the strip is pulled
        };
    },
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        edit() {
            return this.spritesStore.edit;
        },
        examples() {
            return ExampleData.examples;
        },
        canWriteFolders() {
            return !!window.showDirectoryPicker;
        },
        // the state of the folder of the game: saved, being saved, not saved
        folderMark() {
            return {
                saving: '…',
                saved: '✓',
                error: '⚠'
            } [this.spritesStore.folderState] || '';
        },
        folderClass() {
            return this.spritesStore.folderState === 'error' ? 'btn-warning' : 'btn-outline-success';
        },
        sprites() {
            return this.spritesStore.sprites;
        },
        name: {
            get() {
                return this.sprites.name;
            },
            set(name) {
                this.spritesStore.setName(name);
            },
        },
        // the mode of the workbench by the page
        mode() {
            const p = this.edit.page;
            if (p === 'frames' || p === 'masks' || p === 'palettes') return 'frames';
            return p;
        },
        toolbar() {
            return {
                frames: 'FramesToolbar',
                anim: 'AnimToolbar',
                scenes: 'SceneToolbar',
                dialogs: 'DialogToolbar'
            } [this.mode] || null;
        },
        main() {
            if (this.mode === 'frames') return 'FrameCanvas';
            if (this.mode === 'anim') return 'AnimMain';
            if (this.mode === 'scenes') return this.edit.sceneView === 'map' ? 'SceneMap' : 'SceneCanvas';
            if (this.mode === 'problems') return 'ProblemsView';
            if (this.mode === 'game') return 'GameMain';
            if (this.mode === 'maps') return 'MapsMain';
            return null;
        },
        props() {
            return {
                frames: 'FramesProps',
                anim: 'AnimProps',
                scenes: 'SceneProps'
            } [this.mode] || null;
        },
        strip() {
            return {
                frames: 'FramesStrip',
                anim: 'AnimPlayer',
                scenes: 'ScenePalette'
            } [this.mode] || null;
        },
        status() {
            return {
                frames: 'FramesStatus',
                anim: 'AnimStatus',
                scenes: 'SceneStatus',
                dialogs: 'DialogStatus',
                game: 'GameStatus',
                maps: 'MapsStatus'
            } [this.mode] || null;
        },
        helpTopics() {
            return {
                frames: ['frames', 'kind', 'tree'],
                masks: ['masks', 'tree'],
                palettes: ['palettes', 'tree'],
                anim: ['anim', 'scripts', 'state', 'transitions', 'player'],
                scenes: ['scenes', 'tree'],
                game: ['game', 'tree'],
                maps: ['maps', 'tree'],
                problems: ['problems', 'tree']
            } [this.edit.page] || [];
        },
        stripHeight() {
            if (!this.strip && this.mode !== 'dialogs') return 0;
            return this.edit.stripHeight[this.mode] || 200;
        },
        errorCount() {
            return this.problems.filter(p => p.error).length;
        },
        uploadErrorMessage: {
            get() {
                return this.spritesStore.uploadErrorMessage;
            },
            set(m) {
                this.spritesStore.setUploadErrorMessage(m);
            },
        },
    },
    watch: {
        sprites: {
            handler() {
                if (this.downloadUrl) {
                    URL.revokeObjectURL(this.downloadUrl);
                    this.downloadUrl = undefined;
                }
            },
            deep: true
        },
        'spritesStore.imagesVersion'() {
            clearTimeout(this.problemsTimer);
            this.problemsTimer = setTimeout(() => this.refreshProblems(), 700);
        },
    },
    methods: {
        refreshProblems() {
            const fontNames = Fonts.names();
            this.problems = Problems.collect(this.sprites, name => Fonts.get(name) || (!name && fontNames.length ? Fonts.get(fontNames[0]) : null));
        },
        download() {
            let blob = new Blob([JSON.stringify(Maps.saved(this.sprites), null, '    ')], {
                type: 'application/json'
            });
            if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
            this.downloadUrl = URL.createObjectURL(blob);
            this.$nextTick(() => this.$refs.download.click());
        },
        uploadSprites(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                this.spritesStore.uploadSprites(evt.target.result);
                this.edit.page = 'frames';
            };
            reader.readAsText(file);
        },
        // the folder of the project by the browser's access to folders (Chrome, Edge): read, and written back by Save;
        // else the folder picked as files (it is read, and saved by downloads)
        async openProjectFolder() {
            if (!window.showDirectoryPicker) {
                this.$refs.folder.click();
                return;
            }
            const said = await this.spritesStore.openProjectFolder();
            if (!said) return;
            this.edit.page = 'frames';
            this.say(T('opened: ', 'открыто: ') + said.join(', '));
        },
        async saveProjectFolder() {
            if (!window.showDirectoryPicker) {
                this.download();
                return;
            }
            try {
                const said = await this.spritesStore.saveProjectFolder();
                if (said) this.say(this.spritesStore.folderStateText +
                    (this.errorCount ? T('. There are errors (Problems): the build will refuse what the packer refuses', '. Есть ошибки (Проблемы): сборка откажет там же, где упаковщик') : ''));
            } catch (e) {
                this.spritesStore.setUploadErrorMessage(T('Not saved: ', 'Не сохранено: ') + e.message);
            }
        },
        async reopenProjectFolder() {
            const said = await this.spritesStore.reopenProjectFolder();
            if (!said) return;
            this.edit.page = 'frames';
            this.say(T('opened: ', 'открыто: ') + said.join(', '));
        },
        say(text) {
            this.spritesStore.setUploadErrorMessage('');
            this.folderMessage = text;
            clearTimeout(this.messageTimer);
            this.messageTimer = setTimeout(() => this.folderMessage = '', 15000);
        },
        async openFolder(event) {
            const files = [...event.target.files];
            event.target.value = '';
            if (!files.length) return;
            const said = await this.spritesStore.openFolder(files);
            this.spritesStore.setUploadErrorMessage('');
            this.folderMessage = T('opened: ', 'открыто: ') + said.join(', ');
            this.edit.page = 'frames';
            clearTimeout(this.messageTimer);
            this.messageTimer = setTimeout(() => this.folderMessage = '', 15000);
        },
        // where the current document stays when another takes its place
        keptWhere() {
            const folder = this.spritesStore.projectFolderName;
            if (folder) return T('The current one stays in the folder ' + folder + ' (Open folder… opens it again)', 'Текущая останется в папке ' + folder + ' («Открыть папку…» откроет её снова)');
            return this.canWriteFolders ? T('The current one is not in a folder: it is lost unless you save it first (Save to folder…)', 'Текущая не в папке: она пропадёт, если сначала её не сохранить («Сохранить в папку…»)')
                : T('The current one is lost unless you download it first (JSON ⭳)', 'Текущая пропадёт, если сначала её не скачать (JSON ⭳)');
        },
        newDocument() {
            if (confirm(T('Start a new document? ', 'Начать новую разметку? ') + this.keptWhere())) {
                this.spritesStore.newDocument();
                this.edit.page = 'frames';
            }
        },
        openExample(event) {
            const name = event.target.value;
            event.target.value = '';
            if (!name) return;
            if (!confirm(T('Open the example instead of the current document? ', 'Открыть пример вместо текущей разметки? ') + this.keptWhere())) return;
            this.spritesStore.openExample(name);
        },
        // the strip below is pulled by its upper edge
        startResize(event) {
            this.resizing = {
                startY: event.clientY,
                startH: this.stripHeight
            };
            const move = e => {
                if (!this.resizing) return;
                const h = Math.max(60, Math.min(window.innerHeight - 260, this.resizing.startH - (e.clientY - this.resizing.startY)));
                this.edit.stripHeight[this.mode] = Math.round(h);
            };
            const up = () => {
                this.resizing = null;
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
            event.preventDefault();
        },
        // the keys of the shell: undo, redo, the filter of the tree; the modes have their own
        onkeydown(event) {
            const t = event.target;
            const inInput = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
            const ctrl = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();
            if (ctrl && key === 'f') {
                const f = document.querySelector('.tree-filter input');
                if (f) {
                    f.focus();
                    f.select();
                    event.preventDefault();
                }
                return;
            }
            if (inInput) return;
            if (ctrl && key === 'z') {
                if (event.shiftKey) this.spritesStore.redo();
                else this.spritesStore.undo();
                event.preventDefault();
                return;
            }
            if (ctrl && key === 'y') {
                this.spritesStore.redo();
                event.preventDefault();
            }
        },
    },
    template: `
        <div class="bench" :class="{'bench-span': mode === 'dialogs', 'bench-nostrip': !stripHeight}" :style="{'--strip-h': stripHeight + 'px'}">
            <div class="bench-top">
                <input class="bench-name" v-model="name" size="10" :title="T('The name of the project (the document), also the name of the JSON file', 'Название проекта (разметки), оно же имя файла JSON')">
                <div class="btn-group btn-group-sm">
                    <a style="display: none" :download="name + '.json'" :href="downloadUrl" ref="download"></a>
                    <input type="file" webkitdirectory multiple @change="openFolder" style="display: none" ref="folder"/>
                    <button @click="openProjectFolder" class="btn btn-outline-primary"
                        :title="T('Open the folder of the game as the packer reads it: the .json document, PNG in the folders of kinds, KIND.anim, dialogs/*.dlg, po/*.po, fonts *.c, all at once; its code and builds (main/, build/…) are left alone. Save writes it back there', 'Открыть папку игры так, как её читает упаковщик: разметку .json, PNG по папкам видов, ВИД.anim, dialogs/*.dlg, po/*.po, шрифты *.c — всё сразу; её код и сборки (main/, build/…) не трогаются. «Сохранить» пишет обратно туда же')">{{T('Open folder…', 'Открыть папку…')}}</button>
                    <button v-if="spritesStore.projectFolderKept && !spritesStore.projectFolderName" @click="reopenProjectFolder" class="btn btn-outline-primary"
                        :title="T('Open again the folder of the last visit, ' + spritesStore.projectFolderKept + ' (the browser asks whether the editor may read and write it)', 'Открыть снова папку прошлого раза, ' + spritesStore.projectFolderKept + ' (браузер спросит, можно ли редактору читать и писать её)')">↻ {{spritesStore.projectFolderKept}}</button>
                    <button @click="saveProjectFolder" class="btn" :class="folderClass"
                        :title="spritesStore.projectFolderName ? T('The folder of the game, ' + spritesStore.projectFolderName + ': every change is written there by itself a moment after it (the .json document, the PNG of the kinds, KIND.anim, dialogs/*.dlg); build the game there (idf.py build flash, make), the build makes the pack itself. A click writes it now. ', 'Папка игры, ' + spritesStore.projectFolderName + ': каждое изменение записывается туда само через мгновение (разметка .json, PNG видов, ВИД.anim, dialogs/*.dlg); собирайте игру там (idf.py build flash, make), пакет сборка сделает сама. Щелчок — записать сейчас. ') + spritesStore.folderStateText : T('Save into a folder of a game (chosen now) everything its build takes; from then on every change is written there by itself', 'Сохранить в папку игры (выберете сейчас) всё, что берёт её сборка; дальше каждое изменение записывается туда само')">
                        <span v-if="spritesStore.projectFolderName">{{folderMark}} {{spritesStore.projectFolderName}}</span><span v-else>{{T('Save to folder…', 'Сохранить в папку…')}}</span></button>
                    <button v-if="!canWriteFolders" @click="download" class="btn btn-outline-secondary" :title="T('Download the document as a JSON file (this browser cannot write folders: put it into the folder of the game yourself, with the .anim of the kinds and dialogs/*.dlg)', 'Скачать разметку файлом JSON (этот браузер не умеет писать в папки: положите её в папку игры сами, с .anim видов и dialogs/*.dlg)')">JSON ⭳</button>
                    <input type="file" accept=".json,application/json" @change="uploadSprites" :key="spritesStore.spritesSequence" style="display: none" ref="upload"/>
                    <button @click="$refs.upload.click()" class="btn btn-outline-secondary" :title="T('Open a JSON document instead of the current one. Then load its pictures (Load PNG frames at a kind)', 'Открыть файл разметки JSON вместо текущей. Потом загрузите к нему картинки («Загрузить PNG-кадры…» у вида)')">{{T('Open JSON…', 'Открыть JSON…')}}</button>
                    <select @change="openExample" class="btn btn-outline-success bench-examples" :title="T('Open a ready example instead of the current document: a wanderer with a sword (frames, masks, points, animations), or a whole game (Pac-Man, Tetris, Snake: kinds, animations, tiles, a scene, the numbers of the game, timers, a title show, a pause dialog) that the packer of the engine takes as it is; their folders are examples/ of the editor', 'Открыть готовый пример вместо текущей разметки: странник с мечом (кадры, маски, точки, анимации) или игра целиком (пакмен, тетрис, змейка: виды, анимации, плитки, сцена, числа игры, таймеры, заставка, диалог паузы), которую упаковщик движка берёт как есть; их папки — examples/ редактора')">
                        <option value="">{{T('Example…', 'Пример…')}}</option>
                        <option v-for="e in examples" :value="e.name">{{T(e.title[0], e.title[1])}}</option>
                    </select>
                    <button @click="newDocument" class="btn btn-outline-danger" :title="T('Start a new empty document', 'Начать новую пустую разметку')">{{T('New', 'Новый')}}</button>
                </div>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" @click="spritesStore.undo()" :disabled="!spritesStore.undoCount" :title="T('Undo (Ctrl+Z): any change of the document, scenes, animations, styles, and a step of drawing', 'Отменить (Ctrl+Z): любое изменение разметки, сцен, анимаций, стилей, и шаг рисования')">↶ {{T('Undo', 'Отменить')}}</button>
                    <button class="btn btn-outline-secondary" @click="spritesStore.redo()" :disabled="!spritesStore.redoCount" :title="T('Redo (Ctrl+Y, Ctrl+Shift+Z)', 'Вернуть (Ctrl+Y, Ctrl+Shift+Z)')">↷ {{T('Redo', 'Повторить')}}</button>
                </div>
                <component v-if="toolbar" :is="toolbar" class="bench-mode-toolbar"></component>
                <span class="bench-right">
                    <a href="#" class="bench-problems" :class="errorCount ? 'error-text' : problems.length ? 'warning-text' : 'help-text'" @click.prevent="edit.page = 'problems'"
                        :title="T('Errors and warnings of the whole project: a click opens the list', 'Ошибки и предупреждения всего проекта: щелчок открывает список')">{{errorCount}} ✖ {{problems.length - errorCount}} ⚠</a>
                    <label :title="T('The pane of explanations on the right: what it is and how it works. Hints on hovering and the line at the bottom stay without it', 'Панель пояснений справа: что это и как работает. Подсказки по наведению и строка внизу остаются и без неё')"><input type="checkbox" v-model="edit.helpShown"> {{T('Help', 'Справка')}}</label>
                    <select class="bench-lang" :value="I18n.lang" @change="I18n.set($event.target.value)" :title="T('The language of the editor: buttons, hints and explanations. The browser remembers it', 'Язык редактора: кнопки, подсказки и пояснения. Браузер его запоминает')">
                        <option v-for="[l, name] in I18n.languages" :value="l">{{name}}</option>
                    </select>
                </span>
                <div v-if="folderMessage || uploadErrorMessage" class="bench-message" :title="folderMessage">
                    <span v-if="uploadErrorMessage" class="error-text">{{uploadErrorMessage}} <button @click="uploadErrorMessage = ''">x</button></span>
                    <span v-if="folderMessage" class="help-text"><button @click="folderMessage = ''">x</button> {{folderMessage}}</span>
                </div>
            </div>
            <div class="bench-tree"><ProjectTree :problems="problems"></ProjectTree></div>
            <DialogEdit v-if="mode === 'dialogs'" class="bench-spanned"></DialogEdit>
            <template v-else>
                <div class="bench-main" :class="'bench-main-' + mode">
                    <component v-if="main" :is="main" :problems="problems"></component>
                </div>
                <div class="bench-props">
                    <component v-if="props" :is="props"></component>
                    <HelpPane v-if="edit.helpShown && helpTopics.length" :topics="helpTopics"></HelpPane>
                </div>
                <div class="bench-strip" v-if="stripHeight">
                    <div class="strip-grip" @mousedown="startResize" :title="T('Drag: the height of the strip below', 'Тяните: высота нижней полосы')"></div>
                    <component v-if="strip" :is="strip"></component>
                </div>
            </template>
            <div class="bench-status">
                <component v-if="status" :is="status"></component>
                <div v-else class="bench-status-row"><span class="status-prompt">{{T('Problems: a click on a line leads to the place.', 'Проблемы: щелчок по строке ведёт к месту.')}}</span></div>
            </div>
        </div>
    `
};
