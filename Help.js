// Explanations of the editor for people, in English and in Russian (HelpTextsEn, HelpTextsRu: the same topics): a box
// "how it works" over each part, closed once read, and hints of what the mouse and the keys do now
const HelpTextsRu = {
    tree: {
        title: 'Дерево проекта',
        text: `
<p>Слева — всё, из чего состоит игра, как в пакете движка. Щелчок по узлу открывает его в середине окна, его свойства — справа.</p>
<ul>
<li><b>Виды</b> — персонаж, предмет или правила со своей анимацией. У вида бывают картинки (<b>Кадры</b>), скрипты (<b>Скрипты</b> — всё, что вид делает: кадры, движение, удары, чутьё), переходы между ними по событиям (<b>Переходы</b>) и таблица кадров игры (<b>Кадры игры</b>). Вид без картинок — только скрипты.</li>
<li><b>Палитры</b> — наборы цветов без картинок; <b>Маски</b> — маски столкновений и какие из них встречаются (Встречи).</li>
<li><b>Наборы плиток</b> и <b>Сцены</b> — плитки и уровни; <b>Диалоги</b>, <b>Стили</b>, <b>Шрифты</b>, <b>Переводы</b> — разговоры и их вид.</li>
<li><b>Проблемы</b> — все ошибки и предупреждения проекта в одном списке; значки ⚠ и ✖ у узлов ведут туда же.</li>
</ul>
<p>Поле <b>фильтр…</b> сверху оставляет в дереве только имена с этим текстом (Ctrl+F). ▸ и ▾ раскрывают и сворачивают узлы. Под узлом «Скрипты» вида — его скрипты по группам (текущий вид раскрыт сам).</p>`
    },
    frames: {
        title: 'Разметка кадров',
        text: `
<p>Здесь размечают кадры спрайта — то, чего в самих картинках нет, — и при нужде рисуют сами картинки.</p>
<ol>
<li><b>Загрузите кадры:</b> справа в свойствах вида кнопка <b>Загрузить PNG-кадры…</b>, выберите сразу все PNG одного персонажа. Они появятся внизу лентой. Или <b>Открыть папку…</b> сверху — всю папку игры разом.</li>
<li><b>Базовая точка</b> — пиксель, которым спрайт ставится на пол в игре (обычно у ног). Инструмент <b>Базовая точка</b> и щелчок по клетке, или стрелки. Голубая линия — пол, вертикальная — ось, вокруг которой персонаж разворачивается.</li>
<li><b>Маски</b> — «тени» для столкновений: какие пиксели — тело, голова, клинок. Справа в списке масок нажмите <b>Залить</b> (маска = непрозрачные пиксели), потом поправьте инструментами <b>Кисть</b> и <b>Ластик</b>. Все маски сразу, их имена и цвета — узел <b>Маски</b> в дереве.</li>
<li><b>Точки привязки</b> — «рука», «остриё»: к ним цепляются другие спрайты. Справа <b>Добавить точку</b>, потом инструментом <b>Точки</b> поставьте точку щелчком.</li>
<li><b>Рисовать картинку</b>: <b>Карандаш</b> (цвет — в палитре справа, правая кнопка — прозрачный), <b>Заливка</b> — заливка области, <b>Пипетка</b> — взять цвет; Ctrl+Z — шаг назад. <b>+ кадр</b> справа — пустой кадр. Изменённые картинки скачайте: <b>Скачать изменённые PNG</b>.</li>
<li><b>Сохранение:</b> открытая папка игры сохраняется сама после каждого изменения (разметка, PNG, .anim, диалоги; ✓ на кнопке с её именем); новый проект — <b>Сохранить в папку…</b>. В папке <code>idf.py build flash</code> или <code>make</code> соберут игру, пакет сделают сами.</li>
</ol>
<p>Колёсико над холстом — масштаб. Чтобы проверить, что кадры стоят одинаково, включите сверху <b>Показать предыдущие / следующие</b> (соседние кадры бледно: предыдущие красноватые, следующие синеватые) или <b>Все кадры</b>. Внизу — лента кадров и <b>Пуск</b>: кадры подряд, как мультик. Попробовать на готовом: <b>Пример…</b> сверху — странник или игра целиком (пакмен, тетрис, змейка).</p>`
    },
    kind: {
        title: 'Свойства справа',
        text: `
<p><b>Вид</b>: его имя (из него и имени файла складывается имя картинки в движке), <b>маска по умолчанию</b> — какой маской считать кадр, в котором маски не нарисованы, <b>смотреть в</b> — показать картинки в цветах палитры файла, <b>смотрит влево</b> — картинки смотрят влево, <b>холст</b> — общий прямоугольник всех кадров (сетка на холсте), растёт сам, <b>Вписать</b> подгоняет.</p>
<p><b>Кадр</b> — текущий кадр, его базовая точка в пикселях картинки и имя в пакете. <b>Палитра</b> — цвета картинки, ими рисуют карандаш и заливка. <b>Маски</b> — маски в этом кадре: кружок — какую рисуют, флажок — показывать ли. <b>Точки</b> — точки привязки кадра.</p>`
    },
    masks: {
        title: 'Маски и встречи',
        text: `
<p><b>Маска</b> — 1-битная тень кадра для столкновений с индексом 0…15: тело, клинок, остриё. Что значит индекс, решает игра; движок только сообщает, какие маски пересеклись. Здесь — все маски проекта: индекс, имя (в пакете — константа MASK_ИМЯ), цвет на экране, и сколько пикселей у маски в текущем кадре. <b>Залить все</b> — залить маску по непрозрачным пикселям во всех кадрах вида, где её ещё нет.</p>
<p><b>Встречи</b> — какие маски встречаются. У тела есть хозяин (рука и меч в ней — одно целое, не встречаются никогда) и сторона: <b>own</b> — пары масок тел одной стороны (брошенный камень и бросивший), <b>foreign</b> — разных сторон (враги). Флажки пишут текст, который читает упаковщик; без текста действуют умолчания движка: own — ничего, foreign — каждая пара.</p>`
    },
    palettes: {
        title: 'Палитры',
        text: `
<p><b>Палитра</b> — цвета картинки текущего кадра: щелчок по цвету — рисовать им карандашом, поле цвета меняет его у этой картинки (или у всех картинок вида). <b>+ цвет</b> — ещё цвет, глубина картинки растёт сама.</p>
<p><b>Палитры</b> — палитры файла: наборы цветов без картинок (цвета EGA, семь палитр стражника). Цвет куска плитки может назвать палитру ([ИМЯ, n]), а вид можно смотреть в палитре (<b>смотреть в</b> в свойствах вида). <b>+ из картинки</b> — палитра из цветов текущей картинки.</p>`
    },
    anim: {
        title: 'Анимации: как это устроено',
        text: `
<p>Анимация в движке — это <b>скрипты</b> и <b>переходы</b> между ними.</p>
<ul>
<li><b>Скрипт</b> («stand», «walk», «jump») — что делает персонаж: показать кадр столько-то миллисекунд, сдвинуться, развернуться, повторить. Скрипт — это ещё и <b>состояние</b> персонажа.</li>
<li><b>Событие</b> («walk», «stop», «hit») — то, что игра сообщает персонажу: нажата кнопка, получен удар.</li>
<li><b>Переход</b> — что делает событие в каком-то состоянии: «в stand по walk перейти в walk». Когда: <b>now</b> — сразу, <b>branch</b> — в удобной точке шага, <b>end</b> — когда скрипт закончит.</li>
<li><b>Параметры</b> — числа персонажа: жизни, «что он делает». <b>Defines</b> — именованные константы для выражений. У контрола параметры 1–3 после <b>value</b> — <b>least, most, step</b>: диапазон, над картинкой в диалоге будет ползунок или переключатель.</li>
</ul>
<p><b>Где что:</b> скрипты вида — в дереве слева под <b>Скрипты</b>, по группам; шаги выбранного скрипта — в середине; его переходы (<b>Состояние</b>) — справа; проигрыватель — внизу, с кнопками событий. Сверху: <b>Скрипты</b> — шаги, <b>Переходы</b> — все правила, по событию, группы, граф и матрица, <b>Кадры игры</b> — таблица кадров по номерам. <b>+ скрипт</b> и <b>+ шаг</b> — там же сверху. Готовое — <b>Экспорт .anim</b> для движка; ошибки — узел «Проблемы».</p>`
    },
    player: {
        title: 'Проигрыватель',
        text: `
<p>Внизу: анимация, как её сыграет игра — кадры со своими длительностями, персонаж идёт по полу. Высоту полосы можно тянуть за её верхний край.</p>
<ul>
<li><b>Начать с</b> — с какого скрипта начать. Щелчок по шагу в середине ставит персонажа на этот шаг.</li>
<li>Кнопки: ⏮ — к началу, ◀ ▶| — на кадр назад и вперёд, ▶ ⏸ — пуск и пауза. Клавиши: пробел, ← →, Home.</li>
<li><b>Кнопки событий</b> справа от сцены — послать событие персонажу и посмотреть, куда он перейдёт. Зелёные — те, на которые он сейчас отвечает.</li>
<li><b>Следить</b> — вид едет за персонажем. <b>Смотрит влево</b> — если картинки нарисованы лицом влево. <b>Номера — кадры</b> — кадр «номер N» показать N-м кадром вида (если таблицы «Кадры игры» нет).</li>
</ul>`
    },
    scripts: {
        title: 'Скрипты и шаги',
        text: `
<p>В середине — шаги выбранного скрипта. <b>Шаг</b> — карточка: команды сверху и кадр снизу. Сначала делаются команды, потом кадр показывается указанное время.</p>
<ul>
<li><b>Кадр</b>: выберите картинку в списке, время в миллисекундах (ms), сдвиг картинки <b>at x, y</b> можно не задавать.</li>
<li><b>Команды</b> — серые поля с текстом, например <code>dx 3</code> (сдвинуться вперёд на 3 пикселя). Наведите — увидите, что она делает. Поправьте текст и нажмите Enter; сотрите — команда удалится. <b>+ команда</b> — новая команда перед кадром.</li>
<li><b>← →</b> переставить шаг, <b>⧉</b> копия, <b>×</b> удалить. <b>+ шаг</b> сверху — новый шаг после выбранного.</li>
<li>Вместо числа можно писать <b>выражение</b>: <code>1000 / 12</code>, <code>-power + 10</code>, <code>min(t, 0.5)*80</code>. Есть и сравнения с <code>and</code>, <code>or</code>, <code>not</code>: они дают 1 или 0.</li>
<li>Скрипт надо закончить: <code>goto</code> (перейти куда-то, например в начало — получится цикл) или <code>hold</code> (застыть). Иначе он «провалится» в следующий скрипт — редактор предупредит ⚠. Флажки <b>entry</b> (запускает игра) и <b>through</b> (переходит в следующий нарочно) гасят предупреждения.</li>
</ul>`
    },
    state: {
        title: 'Состояние и его переходы',
        text: `
<p>Справа — выбранный скрипт как состояние: <b>все события</b> и что каждое в нём делает: куда перейти и когда.</p>
<ul>
<li>Жёлтая строка «ничего не делает» — на это событие состояние не отвечает. Чтобы ответило, выберите цель в <b>+ куда…</b>.</li>
<li>Куда и когда можно поменять прямо в строке; <b>×</b> — убрать переход.</li>
<li><b>кем дан</b>: «сам» — переход задан для самого скрипта, «группа …» — для группы, в которую он входит (тогда правка меняет всю группу).</li>
<li>Красная строка — <b>конфликт</b>: два правила отвечают по-разному. Уберите одно.</li>
</ul>`
    },
    transitions: {
        title: 'Переходы: все представления',
        text: `
<p>Одни и те же правила с разных сторон; правьте там, где удобнее.</p>
<ul>
<li><b>Правила</b> — список событий (добавить, переименовать, удалить) и все правила «по событию из состояния или группы — в состояние, когда». Порядок правил ничего не значит.</li>
<li><b>По событию</b> — что делает одно событие во всех состояниях.</li>
<li><b>Группы</b> — списки состояний с общим поведением («в воздухе»). Переход группы получают все её состояния. Добавляя состояние (<b>+ состояние</b>), сначала увидите, что оно получит и не будет ли конфликта.</li>
<li><b>Граф</b> — состояния и стрелки. Выбранное в центре; справа — куда из него, слева — откуда в него. Щелчок — в центр, двойной — открыть, протянуть мышью от одного к другому — новый переход.</li>
<li><b>Матрица</b> — строки состояния, столбцы события, в клетке — куда. Точка — ничего, красное — конфликт. <b>Скрыть группу</b> гасит клетки, которые дала одна группа (например, «any» у всех), чтобы остались видны особые переходы.</li>
</ul>`
    },
    scenes: {
        title: 'Сцены: как это устроено',
        text: `
<p><b>Сцена</b> — уровень или комната. Она состоит из <b>слоёв</b>, которые рисуются по списку: первый — самый дальний. На слоях стоят объекты: <b>картинки</b>, <b>персонажи</b> (где они появятся и в каком состоянии), <b>зоны</b> (прямоугольники для логики игры) и <b>входы</b> (куда попадают из другой сцены). Ещё у сцены есть <b>сетки плиток</b>, <b>выходы</b> в другие сцены и <b>связи</b> (кнопка → ворота).</p>
<ol>
<li>В дереве <b>Сцены +</b> — новая сцена размером с экран (размер — справа в свойствах). Под выбранной сценой — её слои, сетки, выходы и связи.</li>
<li>Картинки: внизу в палитре <b>Картинки</b> щёлкните картинку, потом место на сцене. Слой — тот, что выделен в дереве (жирный).</li>
<li>Плитки: в дереве <b>Наборы плиток +</b>, справа размер клетки и <b>+ плитка</b>; потом <b>Сетки +</b>, в палитре <b>Плитки</b> выберите плитку и красьте.</li>
<li>Персонаж: палитра <b>Персонажи</b>, щелчок по сцене. Справа — с какого скрипта он начинает и его параметры.</li>
<li>Инструменты сверху; что делать дальше — пишет строка внизу. Колёсико — масштаб, средняя кнопка — двигать вид, F — вся сцена, Ctrl+Z — отменить.</li>
</ol>
<p><b>Параллакс:</b> у слоя factor 256 — едет вместе с экраном, 128 — вдвое медленнее (даль), 0 — стоит (небо). Инструментом <b>Камера</b> таскайте жёлтую рамку экрана и смотрите. <b>Карта</b> сверху — все сцены и выходы между ними.</p>`
    },
    dialogs: {
        title: 'Диалоги и стили',
        text: `
<p><b>Стиль</b> — как выглядит разговор: <b>рамка</b> (заливка с каймой или картинка из девяти кусков), её <b>место</b> на экране, <b>поле текста</b> внутри (отступы), <b>шрифт</b> DGX, <b>масштабы</b>, <b>цвета</b>. Диалог называет стиль (<code>style talk</code>); стиль, которого нет, — стиль движка по умолчанию.</p>
<ol>
<li>В дереве <b>Шрифты: Загрузить шрифт .c…</b> — исходники шрифтов DGX (их пишет font2c), и рукописные (font0ss.c). Без шрифта текст не виден; в файл разметки шрифты не входят.</li>
<li><b>Стили +</b> — стиль со значениями движка, <b>+ шаблон…</b> — из готового (речь, сообщение, меню, субтитры, записка-свиток); справа правьте поля. Рамку на показе можно тащить мышью и растягивать за правый и нижний край.</li>
<li>Выбран стиль — внизу пример реплики (<b>Реплика</b>) или ответов (<b>Ответы</b>), переключатель сверху. Текст раскладывается точно как в движке: перенос по словам, самый крупный масштаб, что влезает; не влезла важная — прокрутка, неважная — «...». <b>▶ пуск</b> и поле <b>t</b> — реплика во времени.</li>
<li>Выбран диалог (<b>Диалоги</b> в дереве: +, «Импорт…», ⭳ — выгрузить) — внизу его текст и проигрывание: <b>▶ сначала</b>, <b>next</b> (кнопка игрока), ▲▼ — выбор ответа, <b>less / more</b> — контролу; справа параметры и карманы ролей и журнал. Переводы — <b>Загрузить .po…</b> у узла <b>Переводы</b> и язык сверху.</li>
<li><b>showName</b> — имя говорящего строкой над текстом (пример имени — внизу, <b>имя</b>); <b>portrait</b> — портрет сбоку (пример — внизу, <b>face</b>).</li>
</ol>`
    },
    game: {
        title: 'Игра целиком',
        text: `
<p>То, что игра даёт пакету помимо видов, сцен и диалогов. Упаковщик читает это из JSON (необязательные поля <code>game</code>, <code>constants</code>, <code>timers</code>, <code>sounds</code>, <code>shows</code>, <code>chases</code>, <code>crops</code>) и делает то же, что вызовы <code>add_game</code>, <code>add_constants</code>, <code>add_timer</code>, <code>add_sound</code>, <code>add_show</code>, <code>add_chase</code>.</p>
<ul>
<li><b>Числа</b> игры: сколько видов, жизней, записей мира… Лежат в пакете; в заголовке — <code>PREFIX_GAME_ИМЯ</code>, в этом порядке.</li>
<li><b>Константы</b> пакета: имена чисел для текстов скриптов (<code>frame A TICK_MS ms</code>, <code>signal CLOCK_OUT</code>) — везде, где может стоять число, — и для условий ответов диалогов (<code>if board &amp; BOARD_PAD</code>). Числами их делает упаковщик, в пакет и заголовок они не идут. <code>define</code> с таким именем — ошибка; переименование меняет имя и в скриптах.</li>
<li><b>Таймеры</b>: <b>once</b> — раз через столько; <b>every</b> — каждые столько; <b>until</b> — не дольше предела. <b>сброс</b> — когда останавливается сам (уход со сцены, с карты). <b>событие</b> — что послать владельцу. <b>game</b> — идёт с начала игры (часы). В скриптах: <code>timer(ИМЯ)</code>, <code>timer start ИМЯ</code>.</li>
<li><b>Звуки</b> — имена звуков; номер — место в списке (<code>sound N</code>).</li>
<li><b>Показы</b>: заставка, история, титры. Картинки фона на своих местах, актёры видов со скриптами, и <b>реплики</b>: в такой-то момент роль получает событие; роль <b>end</b> — конец показа.</li>
<li><b>Погоня</b> вида за героем между сценами: чем чует, через какие стороны идёт, как далеко от дома, когда успокаивается.</li>
<li><b>Вырезки</b>: часть картинки кадра как своя картинка пакета (портрет из кадра для face в диалогах), со своей базовой точкой.</li>
</ul>
<p>Времена пишутся как в движке: <code>500ms</code>, <code>2s</code>. События — любого вида проекта: это события пакета.</p>`
    },
    maps: {
        title: 'Граф сцен',
        text: `
<p>Куда из сцены можно попасть, как это знает движок (<code>dgx_ge_graph.h</code>, блоб DGSG). <b>Карта</b> — облако сцен с общими данными: уровень (его данные — блоб игры) или показ (данные — показ из «Игра → Показы»). У сцены в карте — <b>номер</b> (константа игры), <b>вид</b> (room, show) и событие правилам карты (<b>при входе</b>): эти поля — в свойствах сцены («Сцены», раздел «Граф»).</p>
<ul>
<li><b>Выход по стороне</b> (exit с edge у сцены) — соседняя сцена: переходят как шли, координата поперёк края сохраняется; имени и входа у него нет.</li>
<li><b>Выход по имени</b> (exit с name: дверь, лестница, люк) — в сцену, к её <b>входу</b>, с переходом cut, fade или wipe. Игра берёт его по имени: константа <code>WORLD_EXIT_ИМЯ</code>.</li>
<li><b>Выходы карты</b> (здесь) — конец уровня, смерть, время вышло: их берут <b>правила</b> карты — вид-анимация, чей актёр живёт, пока игра на карте; событие карты ведёт в скрипт, а <code>signal N</code> говорит, какой выход взять: N — номер имени выхода из таблицы «Имена» внизу.</li>
<li><b>Вход</b> — объект сцены: место, куда смотрит, событие пришедшему (<b>arrive</b>: падает, выходит из двери) и <b>fires</b> — чьи связи запустить по приходу (вернулись к контрольной точке).</li>
<li><b>Связи</b> («Связь» у сцены): источник (плита) запускает свои связи, каждая говорит жизни клетки событие (своё или источника) и число в её параметр.</li>
<li><b>Начало</b> — сцена и вход, с которых игра начинается.</li>
</ul>
<p>Упаковщику граф отдаётся полями JSON <code>graph</code>, <code>maps</code> и полями сцен; номера имён — по первому появлению, как в таблице «Имена».</p>`
    },
    problems: {
        title: 'Проблемы',
        text: `<p>Все проверки проекта в одном списке: анимации каждого вида, сцены и плитки, стили, диалоги, встречи масок, кадры без картинок. <b>Ошибки</b> (красные) — то, что движок не примет; пока они есть, экспорт .anim не делается. <b>Предупреждения</b> — вероятные промахи. Щелчок по строке ведёт к месту.</p>`
    },
    checks: {
        title: 'Проверки',
        text: `<p><b>Ошибки</b> (красные) — то, что движок не примет; пока они есть, экспорт не делается. <b>Предупреждения</b> — вероятные промахи. Щелчок по ссылке ведёт к месту.</p>`
    },
};

const HelpBox = {
    props: ['topic'],
    computed: {
        ...Pinia.mapStores(useSpriteStore),
        help() {
            return helpOf(this.topic);
        },
        open() {
            return !this.spritesStore.edit.helpClosed[this.topic];
        },
    },
    methods: {
        toggle() {
            const closed = this.spritesStore.edit.helpClosed;
            if (closed[this.topic]) delete closed[this.topic];
            else closed[this.topic] = true;
        },
    },
    template: `
        <div class="help-box" :class="{closed: !open}">
            <a href="#" class="help-toggle" @click.prevent="toggle" :title="open ? T('Hide the explanation', 'Скрыть пояснение') : T('Show the explanation', 'Показать пояснение')">
                {{open ? '▾' : '▸'}} ❓ {{help.title}}{{open ? '' : T(' — how it works', ' — как это работает')}}</a>
            <div v-if="open" class="help-body" v-html="help.text"></div>
        </div>
    `
};

// the pane of explanations on the right: the topics of the mode shown, each closed once read
const HelpPane = {
    props: ['topics'],
    computed: {
        ...Pinia.mapStores(useSpriteStore),
    },
    template: `
        <div class="help-pane">
            <div class="help-pane-head"><b>{{T('Help', 'Справка')}}</b>
                <span class="help-text">{{T('explanations; turn them on and off with Help at the top', 'пояснения; выключатель — сверху, «Справка»')}}</span></div>
            <HelpBox v-for="t in topics" :key="t" :topic="t"></HelpBox>
        </div>
    `
};

// what the statements of scripts do, for hints: OpHelpEn, OpHelpRu; opHelp(op) in the language chosen
const OpHelpRu = {
    frame: 'показать картинку столько-то миллисекунд; кадр выражением: frame (DAGGERS_1 + min(amount, 10) - 1) 1000ms — картинка вычисляется в момент шага, имена картинок пакета — числа; amount — сколько вещей в этом персонаже (стопка на полу); frame none 100ms — ничего не показывать это время (персонаж спрятан, картинка -1)',
    set: 'присвоить параметру значение: set action 1; set drunk now + 10 — now: момент шага, секунды часов игры; set k axis(rt) — ось геймпада (lx ly rx ry −1…1, lt rt 0…1; в просмотре 0). Когда значение меняется, игре об этом сообщается',
    add: 'прибавить к параметру: add hp -1',
    dx: 'сдвинуть персонажа вперёд на столько пикселей (назад, если меньше нуля): dx 3',
    dy: 'сдвинуть персонажа вниз (вверх, если меньше нуля): dy -2',
    flip: 'развернуться в другую сторону',
    velocity: 'скорость, пикселей в секунду, x — вперёд, y — вниз: velocity 40 0',
    accel: 'ускорение, пикселей в секунду за секунду: accel 0 300 — падение',
    signal: 'сообщить игре число (что оно значит, знает игра): signal 3',
    go: 'только в правилах карты (вид, названный правилами карты в узле Карты): уйти с карты этим выходом, go next; упаковщик пишет его как signal с номером имени выхода',
    sound: 'звук номер: sound 1',
    masks: 'какие маски столкновений действуют с этого шага: masks 1 2 или по именам масок пакета: masks BODY TIP',
    branch: 'удобная точка: здесь срабатывают переходы «branch»',
    hold: 'застыть на последнем кадре (до события)',
    goto: 'перейти: к метке (цикл внутри скрипта) или к другому скрипту: goto walk; с условием — goto noknife if count(DAGGER) == 0: только если выражение не 0, иначе дальше по скрипту. count(ВИД) — сколько вещей вида в карманах',
    path: 'двигаться по формуле от t (секунды): path x: 40*t, y: -200*t + 432*t*t/2 — бросок',
    hit: 'удар: hit 2 on 1 3 damage 1 event hurt recoil parried (или по именам: hit TIP on BODY) — маска 2 бьёт по маскам 1 и 3 того, кого встретила; damage — урон, event — событие ему, recoil — событие себе. Удары держатся до следующих, до masks или до другого скрипта',
    carry: 'держать: carry hand SWORD_3 — с этого шага в точке hand кадров персонаж держит эту картинку (кадр меча под позу тела), carry hand none — ничего. Держится до следующего carry той же точки, даже в других скриптах',
    release: 'отпустить: release grip 52, -110 — то, что персонаж держит в точке grip, отпускается со скоростью 52 вперёд и 110 вверх (пикселей в секунду, как velocity; можно параметры и define). release hand — со скоростью 0 0. Игра узнаёт об этом (release) и решает, что станет с предметом (камень летит). Если в точке ничего нет — ничего не происходит',
    shoot: 'выстрелить: shoot hand DAGGER 220 0 — из точки hand вылетает снаряд вида DAGGER со скоростью 220 вперёд (пикселей в секунду, как velocity; без скорости — 0 0). Вид — число или имя анимации пакета: любого набора этого файла (упаковщик собирает их вместе, порядок не важен) или добавленной в пакет до файла; её первый скрипт говорит, что это за снаряд: картинка, падение (accel), маска, удары (hit). Летит и попадает снаряд силами игры',
    timer: 'таймер игры: timer start clock — запустить таймер clock (stop — остановить, hold — приостановить, go — продолжить); сколько он идёт — timer(clock) в выражениях. Таймеры описывает игра',
    keep: 'keep — мир держит персонажа, пока он в этом скрипте (горшок лежит — его помнят; осколки — нет)',
    draw: 'достать: draw hand SWORD — одну вещь вида SWORD из карманов в руку (точка hand). Вид — число или имя анимации пакета, как у shoot',
    stow: 'убрать: stow hand — то, что в точке hand, в карманы',
    tell: 'сказать держащему: tell holder drank_wine — этот персонаж (горшок, который пьют) просит игру послать событие тому, кто его держит. Или клетке карты (правила карты): tell cell 451, loosened, 3 — жизни клетки 451 (как считает dgx_ge_cells: у PoP (комната−1)·30 + плита) посылается событие, её свой параметр получает число (без него — 0); клетка и число — выражения. Делает это игра. Событие — общее для пакета',
    press: 'нажать кнопку в клетке карты, как будто на неё наступили — её связи срабатывают: press 720 (клетка — выражение). Делает это игра; для правил карты',
    clear: 'убрать то, что лежит в клетке карты: clear 421 (клетка — выражение). Делает это игра; для правил карты',
    appear: 'появиться: appear KID, mouse_go, 200, 55, left — персонаж вида (анимация пакета, имя или номер) появляется в точке x, y (выражения), лицом влево (без left — вправо), и получает событие — его матрица выбирает скрипт. С with его параметры задаются сразу: appear WOLF, born, x, y with age = 0, sex = rnd(1). Где он живёт, решает игра',
    sense: 'найти ближайшего: sense WOLF within 80 into enemy, edx, edy — персонаж вида (any — любой, cell — непустую клетку сетки) не дальше 80 точек; его расстояние (−1 — никого), x вперёд и y — в параметры (_ — не нужно). where — условие о найденном: its.age > 3, its.vx, its.image, its.script, its.flip; у клетки its.tile, its.mod, its.cell. Дальше копии: mate = its.cell. Радиус — число или выражение персонажа (within 30 - full / 4: голодный чует дальше). seen после радиуса — только того, до кого взгляд дотягивается сквозь завесы плиток (veil): sense WOLF within 80 seen into enemy. Кого видно, решает игра; в просмотре никого нет',
    steer: 'рулить скоростью по Рейнольдсу: steer seek 40, 10 to edx, edy (к цели), flee … from (от неё), arrive 40, 10, 30 to … (к цели, у неё 0), pursue/evade … to|from dx, dy, vx, vy (туда, где цель будет), wander 20, 5, 30 angle heading (по углу в параметре: 0 — вперёд, 90 — вниз, каждый шаг ± разброс костями игры). Скорость — предел, сила — на сколько скорость меняется за шаг (точек/с); ускорение и path сбрасываются',
    vanish: 'исчезнуть: игра убирает этого персонажа из игры',
    contact: 'contact on — искать касания местности (пол, стены) базовой точкой: игра узнает, когда персонаж в неё упрётся; contact on landed — ещё и послать в этот момент самому персонажу событие landed (горшок: летит → разбился); contact off — перестать. Или следить маской: contact 1 below on landed off fell — касается ли маска 1 чего-то сплошного снизу (inside, below, above, left, right, beside — слева или справа, front, back — по взгляду, any), within 2 — на каком расстоянии (точек; без него 1, 0 — только inside); on — событие себе в момент касания, off — когда перестала (пол ушёл из-под ног), хватит и одного из них; … off fell first within 8 — если в начале слежения (или при первом взгляде с местностью) в пределах 8 точек с этой стороны ничего нет, fell сразу (кадр, которому нужен пол, начат над пустотой; только с off, 1…255); contact 1 off — больше не следить. Следить можно за двумя масками сразу',
    label: 'метка — место, куда можно перейти командой goto',
};

// the topics of explanations in English: as HelpTextsRu
const HelpTextsEn = {
    tree: {
        title: 'Project tree',
        text: `
<p>On the left is everything the game is made of, as in the engine’s package. Clicking a node opens it in the middle of the window, with its properties on the right.</p>
<ul>
<li><b>Kinds</b> — a character, an item, or rules with their own animation. A kind can have pictures (<b>Frames</b>), scripts (<b>Scripts</b> — everything the kind does: frames, movement, blows, senses), transitions between them on events (<b>Transitions</b>) and a table of game frames (<b>Game frames</b>). A kind without pictures is scripts only.</li>
<li><b>Palettes</b> — sets of colors without pictures; <b>Masks</b> — collision masks and which of them meet (Meets).</li>
<li><b>Tilesets</b> and <b>Scenes</b> — tiles and levels; <b>Dialogs</b>, <b>Styles</b>, <b>Fonts</b>, <b>Translations</b> — conversations and their look.</li>
<li><b>Problems</b> — all errors and warnings of the project in one list; the ⚠ and ✖ marks on nodes lead there too.</li>
</ul>
<p>The <b>filter</b> field at the top keeps only the names containing that text in the tree (Ctrl+F). ▸ and ▾ expand and collapse nodes. Under a kind’s Scripts are its scripts by groups (the current kind is expanded by itself).</p>`
    },
    frames: {
        title: 'Marking up frames',
        text: `
<p>Here you mark up the frames of a sprite — what the pictures themselves don’t have — and draw the pictures if needed.</p>
<ol>
<li><b>Load the frames:</b> the <b>Load PNG frames</b> button in the kind’s properties on the right; select all the PNGs of one character at once. They appear as a strip at the bottom. Or <b>Open folder</b> at the top — the whole folder of the game at once.</li>
<li><b>Base point</b> — the pixel by which the sprite stands on the floor in the game (usually at the feet). The <b>Base point</b> tool and a click on a cell, or the arrow keys. The light blue line is the floor, the vertical one is the axis the character turns around.</li>
<li><b>Masks</b> — “shadows” for collisions: which pixels are the body, the head, the blade. In the list of masks on the right press <b>Fill</b> (mask = opaque pixels), then touch it up with the <b>Brush</b> and the <b>Eraser</b>. All masks at once, their names and colors — the <b>Masks</b> node in the tree.</li>
<li><b>Attachment points</b> — “hand”, “tip”: other sprites hook onto them. <b>Add point</b> on the right, then place the point with a click using the <b>Points</b> tool.</li>
<li><b>Drawing a picture</b>: <b>Pencil</b> (the color is in the palette on the right, the right button is transparent), <b>Fill</b> — fill an area, <b>Picker</b> — take a color; Ctrl+Z — a step back. <b>New frame</b> on the right — an empty frame. Download the changed pictures: <b>Download changed PNG</b>.</li>
<li><b>Saving:</b> the open folder of the game saves itself after every change (the markup, PNG, .anim, dialogs; ✓ on the button with its name); a new project — <b>Save to folder…</b>. In the folder <code>idf.py build flash</code> or <code>make</code> build the game, making the pack themselves.</li>
</ol>
<p>The mouse wheel over the canvas zooms. To check that the frames stand the same way, turn on <b>Show previous / next</b> at the top (neighbouring frames faintly: previous ones reddish, next ones bluish) or <b>All frames</b>. At the bottom are the strip of frames and <b>Play</b>: the frames in a row, like a cartoon. To try it on a ready one: <b>Example…</b> at the top — the wanderer, or a whole game (Pac-Man, Tetris, Snake).</p>`
    },
    kind: {
        title: 'Properties on the right',
        text: `
<p><b>Kind</b> — its name (together with the file name it makes the picture’s name in the engine), <b>Default mask</b> — which mask a frame with no masks drawn counts as, <b>Preview in</b> — show the pictures in the colors of a palette of the file, <b>Faces left</b> — the pictures look left, <b>Canvas</b> — the common rectangle of all frames (the grid on the canvas), grows by itself, <b>Fit</b> fits it.</p>
<p><b>Frame</b> — the current frame, its base point in the picture’s pixels and its name in the package. <b>Palette</b> — the colors of the picture, the pencil and the fill draw with them. <b>Masks</b> — the masks in this frame: the circle — which one is drawn, the checkbox — whether to show it. <b>Points</b> — the frame’s attachment points.</p>`
    },
    masks: {
        title: 'Masks and meets',
        text: `
<p>A <b>mask</b> is a 1-bit shadow of a frame for collisions, with an index 0…15: body, blade, tip. What an index means is up to the game; the engine only reports which masks overlapped. Here are all the masks of the project: index, name (in the package — the constant MASK_NAME), color on screen, and how many pixels the mask has in the current frame. <b>Fill all</b> — fill the mask from the opaque pixels in all frames of the kind that don’t have it yet.</p>
<p><b>Meets</b> — which masks meet. A body has an owner (a hand and the sword in it are one whole and never meet) and a side: <b>own</b> — pairs of masks of bodies on the same side (a thrown stone and the thrower), <b>foreign</b> — on different sides (enemies). The checkboxes write the text the packer reads; without the text the engine’s defaults apply: own — nothing, foreign — every pair.</p>`
    },
    palettes: {
        title: 'Palettes',
        text: `
<p><b>Palette</b> — the colors of the current frame’s picture: a click on a color draws with it in the pencil, the color field changes it in this picture (or in all pictures of the kind). <b>+ color</b> — one more color, the picture’s depth grows by itself.</p>
<p><b>Palettes</b> — the palettes of the file: sets of colors without pictures (the EGA colors, the seven palettes of the guard). The color of a tile piece can name a palette ([NAME, n]), and a kind can be viewed in a palette (<b>Preview in</b> in the kind’s properties). <b>+ from picture</b> — a palette from the colors of the current picture.</p>`
    },
    anim: {
        title: 'Animations: how they work',
        text: `
<p>An animation in the engine is <b>scripts</b> and <b>transitions</b> between them.</p>
<ul>
<li>A <b>script</b> (“stand”, “walk”, “jump”) — what the character does: show a frame for so many milliseconds, move, turn around, repeat. A script is also a <b>state</b> of the character.</li>
<li>An <b>event</b> (“walk”, “stop”, “hit”) — what the game tells the character: a button pressed, a blow received.</li>
<li>A <b>transition</b> — what an event does in some state: “in stand on walk go to walk”. When: <b>now</b> — at once, <b>branch</b> — at a convenient point of a step, <b>end</b> — when the script finishes.</li>
<li><b>Params</b> — numbers of the character: lives, “what it is doing”. <b>Defines</b> — named constants for expressions. For a control, params 1–3 after <b>value</b> are <b>least, most, step</b>: a range; above the picture in a dialog there will be a slider or a switch.</li>
</ul>
<p><b>Where things are:</b> the kind’s scripts — in the tree on the left under <b>Scripts</b>, by groups; the steps of the selected script — in the middle; its transitions (<b>State</b>) — on the right; the player — at the bottom, with event buttons. At the top: <b>Scripts</b> — steps, <b>Transitions</b> — all rules, by event, groups, graph and matrix, <b>Game frames</b> — the table of frames by number. <b>+ script</b> and <b>+ step</b> are at the top as well. When done — <b>Export .anim</b> for the engine; errors — the Problems node.</p>`
    },
    player: {
        title: 'Player',
        text: `
<p>At the bottom: the animation as the game will play it — frames with their durations, the character walking on the floor. The height of the strip can be dragged by its top edge.</p>
<ul>
<li><b>From</b> — which script to start from. A click on a step in the middle puts the character on that step.</li>
<li>Buttons: ⏮ — to the start, ◀ ▶| — a frame back and forward, ▶ ⏸ — play and pause. Keys: space, ← →, Home.</li>
<li><b>Event buttons</b> to the right of the scene — send an event to the character and see where it goes. The green ones are those it answers now.</li>
<li><b>Follow</b> — the view follows the character. <b>Look left</b> — if the pictures are drawn facing left. <b>Numbers are frames</b> — show frame “number N” as the kind’s N-th frame (if there is no Game frames table).</li>
</ul>`
    },
    scripts: {
        title: 'Scripts and steps',
        text: `
<p>In the middle are the steps of the selected script. A <b>step</b> is a card: commands at the top and a frame at the bottom. First the commands are done, then the frame is shown for the given time.</p>
<ul>
<li><b>Frame</b>: choose a picture in the list, the time in milliseconds (ms); the picture offset <b>at x, y</b> is optional.</li>
<li><b>Commands</b> — grey fields with text, for example <code>dx 3</code> (move forward 3 pixels). Hover to see what it does. Edit the text and press Enter; erase it and the command is removed. <b>+ command</b> — a new command before the frame.</li>
<li><b>← →</b> move the step, <b>⧉</b> copy, <b>×</b> delete. <b>+ step</b> at the top — a new step after the selected one.</li>
<li>Instead of a number you can write an <b>expression</b>: <code>1000 / 12</code>, <code>-power + 10</code>, <code>min(t, 0.5)*80</code>. There are comparisons too, with <code>and</code>, <code>or</code>, <code>not</code>: they give 1 or 0.</li>
<li>A script must be finished: <code>goto</code> (go somewhere, for example to the start — that makes a loop) or <code>hold</code> (freeze). Otherwise it “falls through” into the next script — the editor warns with ⚠. The <b>entry</b> (the game starts it) and <b>through</b> (goes on into the next one on purpose) checkboxes silence the warnings.</li>
</ul>`
    },
    state: {
        title: 'A state and its transitions',
        text: `
<p>On the right is the selected script as a state: <b>all events</b> and what each one does in it: where to go and when.</p>
<ul>
<li>A yellow “does nothing” row — the state does not answer this event. To make it answer, choose a target in <b>+ to…</b>.</li>
<li>Where and when can be changed right in the row; <b>×</b> removes the transition.</li>
<li><b>given by</b>: “itself” — the transition is set for the script itself, “group …” — for a group it belongs to (then an edit changes the whole group).</li>
<li>A red row is a <b>conflict</b>: two rules answer differently. Remove one of them.</li>
</ul>`
    },
    transitions: {
        title: 'Transitions: all views',
        text: `
<p>The same rules from different sides; edit wherever it is handier.</p>
<ul>
<li><b>Rules</b> — the list of events (add, rename, delete) and all rules “on an event from a state or group — to a state, when”. The order of rules means nothing.</li>
<li><b>By event</b> — what one event does in all states.</li>
<li><b>Groups</b> — lists of states with common behaviour (“in the air”). A group’s transition goes to all its states. When adding a state (<b>+ state</b>) you first see what it will get and whether there will be a conflict.</li>
<li><b>Graph</b> — states and arrows. The selected one is in the centre; on the right — where it leads, on the left — what leads into it. A click puts it in the centre, a double click opens it, dragging from one to another makes a new transition.</li>
<li><b>Matrix</b> — rows are states, columns are events, a cell says where to. A dot is nothing, red is a conflict. <b>Hide group</b> dims the cells given by one group (for example “any” for all), so that the special transitions stay visible.</li>
</ul>`
    },
    scenes: {
        title: 'Scenes: how they work',
        text: `
<p>A <b>scene</b> is a level or a room. It is made of <b>layers</b>, drawn in list order: the first is the farthest. On the layers stand objects: <b>pictures</b>, <b>actors</b> (where they appear and in what state), <b>zones</b> (rectangles for the game’s logic) and <b>entries</b> (where you arrive from another scene). A scene also has <b>tile grids</b>, <b>exits</b> to other scenes and <b>links</b> (button → gate).</p>
<ol>
<li>In the tree <b>Scenes +</b> — a new scene the size of the screen (the size is in the properties on the right). Under the selected scene are its layers, grids, exits and links.</li>
<li>Pictures: in the <b>Pictures</b> palette at the bottom click a picture, then a place in the scene. The layer is the one selected in the tree (bold).</li>
<li>Tiles: in the tree <b>Tilesets +</b>, the cell size and <b>+ tile</b> on the right; then <b>Grids +</b>, choose a tile in the <b>Tiles</b> palette and paint.</li>
<li>An actor: the <b>Actors</b> palette, a click on the scene. On the right — which script it starts with and its params.</li>
<li>The tools are at the top; the line at the bottom says what to do next. Wheel — zoom, middle button — pan the view, F — the whole scene, Ctrl+Z — undo.</li>
</ol>
<p><b>Parallax:</b> a layer with factor 256 moves with the screen, 128 — half as fast (the distance), 0 — stands still (the sky). Drag the yellow screen frame with the <b>Camera</b> tool and watch. <b>Map</b> at the top — all scenes and the exits between them.</p>`
    },
    dialogs: {
        title: 'Dialogs and styles',
        text: `
<p>A <b>style</b> is how a conversation looks: the <b>frame</b> (a fill with a border or a picture of nine pieces), its <b>place</b> on screen, the <b>text field</b> inside (margins), the DGX <b>font</b>, the <b>scales</b>, the <b>colors</b>. A dialog names a style (<code>style talk</code>); a style that doesn’t exist means the engine’s default style.</p>
<ol>
<li>In the tree <b>Fonts: Load font .c…</b> — DGX font sources (written by font2c), and handwritten ones (font0ss.c). Without a font no text is visible; fonts are not part of the markup file.</li>
<li><b>Styles +</b> — a style with the engine’s values, <b>+ template…</b> — from a ready one (speech, message, menu, subtitles, scroll note); edit the fields on the right. The frame in the preview can be dragged with the mouse and stretched by its right and bottom edges.</li>
<li>With a style selected — at the bottom an example of a line (<b>Line</b>) or of answers (<b>Answers</b>), switched at the top. The text is laid out exactly as in the engine: word wrap, the largest scale that fits; if an important line doesn’t fit — scrolling, an unimportant one — “...”. <b>▶ play</b> and the <b>t</b> field — the line over time.</li>
<li>With a dialog selected (<b>Dialogs</b> in the tree: +, Import .dlg, ⭳ — export) — at the bottom its text and playback: <b>▶ start</b>, <b>next</b> (the player’s button), ▲▼ — choosing an answer, <b>less / more</b> — for a control; on the right the params and pockets of the roles, and the log. Translations — <b>Translations: Load .po</b> and the language at the top.</li>
<li><b>showName</b> — the speaker’s name as a line above the text (an example name at the bottom, <b>name</b>); <b>portrait</b> — a portrait at the side (an example at the bottom, <b>face</b>).</li>
</ol>`
    },
    game: {
        title: 'The whole game',
        text: `
<p>What the game gives the package besides kinds, scenes and dialogs. The packer reads it from the JSON (the optional fields <code>game</code>, <code>constants</code>, <code>timers</code>, <code>sounds</code>, <code>shows</code>, <code>chases</code>, <code>crops</code>) and does the same as the calls <code>add_game</code>, <code>add_constants</code>, <code>add_timer</code>, <code>add_sound</code>, <code>add_show</code>, <code>add_chase</code>.</p>
<ul>
<li><b>Numbers</b> — the game’s numbers: how many kinds, lives, world records… They are kept in the package; in the header — <code>PREFIX_GAME_NAME</code>, in this order.</li>
<li><b>Constants</b> — the package’s constants: names of numbers for script texts (<code>frame A TICK_MS ms</code>, <code>signal CLOCK_OUT</code>) — anywhere a number can be — and for the conditions of dialog answers (<code>if board &amp; BOARD_PAD</code>). The packer turns them into numbers; they go neither into the package nor into the header. A <code>define</code> with such a name is an error; renaming changes the name in the scripts too.</li>
<li><b>Timers</b> — <b>once</b> — once after so long; <b>every</b> — every so long; <b>until</b> — no longer than a limit. <b>reset</b> — when it stops by itself (leaving the scene, the map). <b>event</b> — what to send to the owner. <b>game</b> — runs from the start of the game (a clock). In scripts: <code>timer(NAME)</code>, <code>timer start NAME</code>.</li>
<li><b>Sounds</b> — the names of sounds; the number is the place in the list (<code>sound N</code>).</li>
<li><b>Shows</b> — a splash screen, a story, credits. Background pictures in their places, actors of kinds with scripts, and cues (<b>cues</b>): at such a moment a role gets an event; the role <b>end</b> is the end of the show.</li>
<li><b>Chase</b> — a kind chasing the hero between scenes: what it senses with, which sides it goes through, how far from home, when it calms down.</li>
<li><b>Crops</b> — a part of a frame’s picture as a picture of the package of its own (a portrait from a frame for face in dialogs), with its own base point.</li>
</ul>
<p>Times are written as in the engine: <code>500ms</code>, <code>2s</code>. Events are of any kind of the project: they are the package’s events.</p>`
    },
    maps: {
        title: 'Scene graph',
        text: `
<p>Where you can get to from a scene, as the engine knows it (<code>dgx_ge_graph.h</code>, the DGSG blob). A <b>map</b> is a cloud of scenes with common data: a level (its data is the game’s blob) or a show (the data is a show from Game → Shows). A scene in a map has a <b>number</b> (a game constant), a <b>kind</b> (room, show) and an event for the map’s rules on entering (<b>on enter</b>): these fields are in the scene’s properties (Scenes, the Graph section).</p>
<ul>
<li><b>An exit by side</b> (an exit with an edge of the scene) — a neighbouring scene: you cross as you walked, the coordinate across the edge is kept; it has no name and no entry.</li>
<li><b>An exit by name</b> (an exit with a name: a door, stairs, a hatch) — to a scene, to its <b>entry</b>, with a cut, fade or wipe transition. The game takes it by name: the constant <code>WORLD_EXIT_NAME</code>.</li>
<li><b>Map exits</b> (here) — the end of a level, death, time out: they are taken by the map’s <b>rules</b> — an animation kind whose actor lives while the game is on the map; a map event leads into a script, and <code>signal N</code> says which exit to take: N is the number of the exit’s name in the Names table below.</li>
<li><b>An entry</b> — an object of the scene: the place, where it faces, the event for whoever arrives (<b>arrive</b>: falls, comes out of a door) and <b>fires</b> — whose links to fire on arrival (back at a checkpoint).</li>
<li><b>Links</b> (Link in a scene): a source (a plate) fires its links; each tells a cell’s life an event (its own or the source’s) and a number into its param.</li>
<li><b>Start</b> — the scene and the entry the game starts from.</li>
</ul>
<p>The graph goes to the packer in the JSON fields <code>graph</code>, <code>maps</code> and in the fields of the scenes; the numbers of names follow the first appearance, as in the Names table.</p>`
    },
    problems: {
        title: 'Problems',
        text: `<p>All checks of the project in one list: the animations of every kind, scenes and tiles, styles, dialogs, mask meets, frames without pictures. <b>Errors</b> (red) are what the engine won’t accept; while there are any, .anim is not exported. <b>Warnings</b> are likely mistakes. A click on a row leads to the place.</p>`
    },
    checks: {
        title: 'Checks',
        text: `<p><b>Errors</b> (red) are what the engine won’t accept; while there are any, nothing is exported. <b>Warnings</b> are likely mistakes. A click on a link leads to the place.</p>`
    },
};

// the statements of scripts in English: as OpHelpRu
const OpHelpEn = {
    frame: 'show a picture for so many milliseconds; a frame by expression: frame (DAGGERS_1 + min(amount, 10) - 1) 1000ms — the picture is computed at the moment of the step, the package’s picture names are numbers; amount — how many things this character is (a stack on the floor); frame none 100ms — show nothing for this time (the character is hidden, picture -1)',
    set: 'give a param a value: set action 1; set drunk now + 10 — now: the moment of the step, seconds of the game clock; set k axis(rt) — a gamepad axis (lx ly rx ry −1…1, lt rt 0…1; 0 in the preview). When the value changes, the game is told',
    add: 'add to a param: add hp -1',
    dx: 'move the character forward by so many pixels (back if less than zero): dx 3',
    dy: 'move the character down (up if less than zero): dy -2',
    flip: 'turn around to the other side',
    velocity: 'speed in pixels per second, x — forward, y — down: velocity 40 0',
    accel: 'acceleration in pixels per second per second: accel 0 300 — falling',
    signal: 'tell the game a number (the game knows what it means): signal 3',
    go: 'in the rules of a map only (the kind a map names as its rules in Maps): leave the map by this exit, go next; the packer writes it as signal with the number of the exit\'s name',
    sound: 'sound number: sound 1',
    masks: 'which collision masks act from this step on: masks 1 2 or by the package’s mask names: masks BODY TIP',
    branch: 'a convenient point: “branch” transitions fire here',
    hold: 'freeze on the last frame (until an event)',
    goto: 'go: to a label (a loop inside the script) or to another script: goto walk; with a condition — goto noknife if count(DAGGER) == 0: only if the expression is not 0, otherwise on through the script. count(KIND) — how many things of the kind are in the pockets',
    path: 'move by a formula of t (seconds): path x: 40*t, y: -200*t + 432*t*t/2 — a throw',
    hit: 'a blow: hit 2 on 1 3 damage 1 event hurt recoil parried (or by names: hit TIP on BODY) — mask 2 strikes masks 1 and 3 of whoever it met; damage — the damage, event — the event for them, recoil — the event for itself. Blows last until the next ones, until masks or until another script',
    carry: 'hold: carry hand SWORD_3 — from this step the character holds this picture at the hand point of its frames (a sword frame matching the body’s pose), carry hand none — nothing. It lasts until the next carry of the same point, even in other scripts',
    release: 'let go: release grip 52, -110 — what the character holds at the grip point is let go at a speed of 52 forward and 110 up (pixels per second, as velocity; params and defines are allowed). release hand — at a speed of 0 0. The game learns of it (release) and decides what becomes of the item (a stone flies). If there is nothing at the point, nothing happens',
    shoot: 'shoot: shoot hand DAGGER 220 0 — a missile of kind DAGGER flies out of the hand point at a speed of 220 forward (pixels per second, as velocity; without a speed — 0 0). The kind is a number or the name of a package animation: of any set of this file (the packer puts them together, the order does not matter) or of one added to the package before the file; its first script says what the missile is: picture, falling (accel), mask, blows (hit). The game makes the missile fly and hit',
    timer: 'a game timer: timer start clock — start the timer clock (stop — stop it, hold — pause it, go — resume it); how long it has run — timer(clock) in expressions. Timers are described by the game',
    keep: 'keep — the world keeps the character while it is in this script (a pot lying around is remembered; its shards are not)',
    draw: 'draw: draw hand SWORD — one thing of kind SWORD from the pockets into the hand (the hand point). The kind is a number or the name of a package animation, as for shoot',
    stow: 'stow: stow hand — what is at the hand point goes into the pockets',
    tell: 'tell the holder: tell holder drank_wine — this character (a pot being drunk from) asks the game to send an event to whoever holds it. Or to a map cell (map rules): tell cell 451, loosened, 3 — the life of cell 451 (as dgx_ge_cells counts it: in PoP (room−1)·30 + plate) gets the event, and its own param gets the number (0 without it); the cell and the number are expressions. The game does it. The event is common to the package',
    press: 'press the button in a map cell as if it was stepped on — its links fire: press 720 (the cell is an expression). The game does it; for map rules',
    clear: 'remove what lies in a map cell: clear 421 (the cell is an expression). The game does it; for map rules',
    appear: 'appear: appear KID, mouse_go, 200, 55, left — a character of a kind (a package animation, name or number) appears at the point x, y (expressions), facing left (without left — right), and gets the event — its matrix picks the script. With with, its params are set at once: appear WOLF, born, x, y with age = 0, sex = rnd(1). Where it lives is up to the game',
    sense: 'find the nearest: sense WOLF within 80 into enemy, edx, edy — a character of the kind (any — any one, cell — a non-empty grid cell) no farther than 80 points; its distance (−1 — nobody), x forward and y go into the params (_ — not needed). where — a condition on the one found: its.age > 3, its.vx, its.image, its.script, its.flip; for a cell its.tile, its.mod, its.cell. Copies follow: mate = its.cell. The radius is a number or an expression of the character (within 30 - full / 4: a hungry one senses farther). seen after the radius — only one the gaze reaches through tile veils (veil): sense WOLF within 80 seen into enemy. Who is visible is up to the game; in the preview there is nobody',
    steer: 'steer the speed the Reynolds way: steer seek 40, 10 to edx, edy (toward the target), flee … from (away from it), arrive 40, 10, 30 to … (toward the target, 0 at it), pursue/evade … to|from dx, dy, vx, vy (to where the target will be), wander 20, 5, 30 angle heading (by the angle in the param: 0 — forward, 90 — down, each step ± the spread, with the game’s dice). The speed is the limit, the force is how much the speed changes per step (points/s); acceleration and path are reset',
    vanish: 'vanish: the game removes this character from the game',
    contact: 'contact on — look for touches of the terrain (floor, walls) by the base point: the game learns when the character runs into it; contact on landed — also send the character itself the event landed at that moment (a pot: flies → breaks); contact off — stop. Or watch with a mask: contact 1 below on landed off fell — whether mask 1 touches something solid below (inside, below, above, left, right, beside — left or right, front, back — by the facing, any), within 2 — at what distance (points; 1 without it, 0 — inside only); on — an event for itself at the moment of touching, off — when it stopped (the floor went from under its feet), one of them is enough; … off fell first within 8 — if at the start of watching (or at the first look at the terrain) there is nothing within 8 points on that side, fell at once (a frame that needs a floor started over emptiness; only with off, 1…255); contact 1 off — stop watching. Two masks can be watched at once',
    label: 'a label — a place the goto command can go to',
};

// a topic of explanations {title, text} in the language chosen
function helpOf(topic) {
    return (I18n.lang === 'ru' ? HelpTextsRu[topic] : HelpTextsEn[topic]) || HelpTextsEn[topic] || HelpTextsRu[topic];
}

// what a statement of scripts does, in the language chosen ('' none)
function opHelp(op) {
    return T(OpHelpEn[op], OpHelpRu[op]) || OpHelpEn[op] || OpHelpRu[op] || '';
}
