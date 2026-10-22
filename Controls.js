// Ready-made controls of dialogs and pages of settings. A control is an ordinary kind: a set of frames of its states
// and its animation, whose scripts are the states and whose rules answer the events of the interface the game sends:
// focus, blur (the game moves the focus), activate, more, less (its buttons). What a control changes is its param
// value (the game is told when it changes) or a signal. A kind whose params 1, 2, 3 after value are least, most, step
// (in that order; min and max are words of expressions) has a range (dgx_ge_talk_control_range of the engine): the
// talk view puts a slider over its picture, or a switch when most - least <= step; a touch sets the value and the
// control is brought there by its own more/less events (activate for a switch). Without them a control works by
// events only. A template gives the frames, plain pictures to draw over, and the text of the animation
const Controls = {
    // the colors of the pictures: 0 is transparent
    palette: [
        [0, 0, 0],
        [40, 40, 56], // the edge
        [196, 200, 212], // normal
        [255, 214, 110], // focused
        [140, 144, 160], // pressed
        [40, 40, 56], // marks
        [80, 170, 90], // on, the value
    ],

    // a picture of indexes, drawn by fn(put(x, y, index), rect(x, y, w, h, index), box(x, y, w, h, fill))
    picture(width, height, fn) {
        let indexes = new Uint8Array(width * height);
        const put = (x, y, v) => {
            if (x >= 0 && y >= 0 && x < width && y < height) indexes[y * width + x] = v;
        };
        const rect = (x, y, w, h, v) => {
            for (let r = y; r < y + h; ++r)
                for (let c = x; c < x + w; ++c) put(c, r, v);
        };
        // a box with an edge of 1 and its corners cut
        const box = (x, y, w, h, fill) => {
            rect(x + 1, y, w - 2, h, 1);
            rect(x, y + 1, w, h - 2, 1);
            rect(x + 1, y + 1, w - 2, h - 2, fill);
        };
        fn(put, rect, box);
        return {
            width: width,
            height: height,
            bitDepth: 4,
            palette: this.palette.map(c => c.slice()),
            indexes: indexes,
            chunks: null
        };
    },

    // the animation of a control with a value, as dialogs and pages use it: the first param is the value; script 0
    // (normal) shows the picture of the value, focused the same focused (frames n0.. and f0.., one after another);
    // a change is a script that sets the value and goes back, before any frame: a dialog starts the control in
    // script 0 with the value, tells it the event and reads the value at once, no time passing. changes: {script:
    // statement}, events: {event: script}; the game's focus and blur move between normal and focused. params: the
    // lines of params, the value first (then least, most, step for a range)
    valued(P, head, params, define, changes, events) {
        let out = head + `
# Script 0 shows the picture of the value: frame (${P}_N0 + value), so the frames of one kind go one after another.
# A dialog starts it in script 0 with the value, tells it activate, more or less and reads the value back at once
event focus, blur, ${Object.keys(events).join(', ')}

${define ? define + '\n' : ''}${params.map(p => 'param ' + p).join('\n')}

group all: normal, focused

script normal
    frame (${P}_N0 + value) 1000ms
    hold
script focused
    frame (${P}_F0 + value) 1000ms
    hold
`;
        for (const [name, statement] of Object.entries(changes))
            out += `script ${name}
    ${statement}
    goto normal
script ${name}_focused
    ${statement}
    goto focused
`;
        out += `
on focus: normal -> focused now
on blur: all -> normal now
`;
        for (const [event, script] of Object.entries(events))
            out += `on ${event}: normal -> ${script} now
on ${event}: focused -> ${script}_focused now
`;
        return out;
    },

    templates: {
        button: {
            // a getter: the hint follows the language of the editor
            get title() {
                return T('Button: activate presses it (signal 1 to the game), focus and blur are the focus from the game',
                    'Кнопка: activate нажимает её (signal 1 — игре), focus и blur — фокус от игры');
            },
            pictures() {
                return [
                    ['normal.png', 2],
                    ['focused.png', 3],
                    ['pressed.png', 4]
                ].map(([file, fill]) => [file, Controls.picture(48, 16, (put, rect, box) => box(0, 0, 48, 16, fill))]);
            },
            text: P => `# A button: activate presses it, the game is told by signal 1; focus and blur are the game's
event focus, blur, activate

group all: normal, focused, pressed

script normal
    frame ${P}_NORMAL 1000ms
    hold
script focused
    frame ${P}_FOCUSED 1000ms
    hold
script pressed
    signal 1
    frame ${P}_PRESSED 150ms
    goto focused

on focus: normal -> focused now
on blur: all -> normal now
on activate: focused -> pressed now
`
        },
        toggle: {
            get title() {
                return T('Toggle: value 0 or 1, activate, more and less flip it; the range least 0, most 1, step 1 gives a switch over the picture in a dialog, flipped by a touch',
                    'Переключатель: value 0 или 1, activate, more и less переключают; диапазон least 0, most 1, step 1 — в диалоге над картинкой переключатель касанием');
            },
            pictures() {
                let out = [];
                for (const focused of [false, true])
                    for (let v = 0; v < 2; ++v)
                        out.push([(focused ? 'f' : 'n') + v + '.png', Controls.picture(14, 14, (put, rect, box) => {
                            box(0, 0, 14, 14, focused ? 3 : 2);
                            if (v) {
                                // a check mark
                                for (let k = 0; k < 3; ++k) rect(3 + k, 6 + k, 2, 2, 6);
                                for (let k = 0; k < 5; ++k) rect(6 + k, 7 - k, 2, 2, 6);
                            }
                        })]);
                return out;
            },
            text: P => Controls.valued(P, `# A toggle: param value is 0 or 1; activate, more and less turn it.
# least, most, step after value give it a range: the talk view puts a switch over its picture, a touch flips it by activate`,
                ['value 0', 'least 0', 'most 1', 'step 1'], '', {
                flip: 'set value 1 - value'
            }, {
                activate: 'flip',
                more: 'flip',
                less: 'flip'
            })
        },
        cycle: {
            get title() {
                return T('Cycle: value is one of COUNT values round, activate and more the next, less the one before; no range, by events only',
                    'Перебор: value — одно из COUNT значений по кругу, activate и more — следующее, less — предыдущее; без диапазона — только событиями');
            },
            count: 3,
            pictures() {
                let out = [];
                for (const focused of [false, true])
                    for (let v = 0; v < this.count; ++v)
                        out.push([(focused ? 'f' : 'n') + v + '.png', Controls.picture(48, 16, (put, rect, box) => {
                            box(0, 0, 48, 16, focused ? 3 : 2);
                            // arrows at the ends, a dot for each value, the chosen one filled
                            for (let k = 0; k < 4; ++k) {
                                rect(3 + k, 8 - k, 1, 2 * k, 5);
                                rect(44 - k, 8 - k, 1, 2 * k, 5);
                            }
                            for (let d = 0; d < this.count; ++d) rect(24 - this.count * 3 + d * 6 + 1, 6, 4, 4, d === v ? 6 : 1);
                        })]);
                return out;
            },
            text(P) {
                return Controls.valued(P, `# A cycle: param value is one of COUNT, round: activate and more the next, less the one before.
# No range (least, most, step): it goes round, so it works by events only`, ['value 0'],
                    'define COUNT ' + this.count, {
                        forward: 'set value (value + 1) * (value + 1 < COUNT)',
                        backward: 'set value value - 1 + COUNT * (value == 0)'
                    }, {
                        activate: 'forward',
                        more: 'forward',
                        less: 'backward'
                    });
            }
        },
        slider: {
            get title() {
                return T('Slider: value from 0 to MAX, more is more, less is less; the range least 0, most MAX, step 1 gives a slider over the picture in a dialog, set by a touch',
                    'Ползунок: value от 0 до MAX, more — больше, less — меньше; диапазон least 0, most MAX, step 1 — в диалоге над картинкой ползунок касанием');
            },
            max: 10,
            pictures() {
                let out = [];
                for (const focused of [false, true])
                    for (let v = 0; v <= this.max; ++v)
                        out.push([(focused ? 'f' : 'n') + v + '.png', Controls.picture(this.max * 6 + 6, 10, (put, rect, box) => {
                            rect(2, 4, this.max * 6 + 2, 2, 1);
                            box(v * 6, 0, 6, 10, focused ? 3 : 2);
                        })]);
                return out;
            },
            text(P) {
                return Controls.valued(P, `# A slider: param value from 0 to MAX, more adds 1, less takes 1 away.
# least, most, step after value give it a range: the talk view puts a slider over its picture, a touch sets the value
# and the control is brought there by its own more and less`, ['value ' + this.max / 2, 'least 0', 'most MAX', 'step 1'],
                    'define MAX ' + this.max, {
                        up: 'set value min(value + 1, MAX)',
                        down: 'set value max(value - 1, 0)'
                    }, {
                        more: 'up',
                        less: 'down'
                    });
            }
        },
    },
};
