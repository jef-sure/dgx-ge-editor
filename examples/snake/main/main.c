/*
 * Snake on DGX-GE, made in the sprite editor: its pictures, tiles, scene, the game's actor PLAY (the score, the
 * length, the speed, the star), the title show and the pause dialog are data of snake.json (the pack the build makes
 * of it, assets/snake.pack). This file is what data cannot say: the snake goes a cell every speed ms the way the
 * arrows turn it, and what its head finds it tells PLAY; PLAY's signals say what follows.
 *
 * The same file builds for a board of the engine (idf.py: the CYD) and for the computer (make): it talks to the
 * hardware through dgx_ge_board.h, and the CYD's touch, which the engine's board leaves out, through cyd_touch.c.
 * The touch is DGX-DI's: a finger (the mouse on the computer) swipes the snake round, or taps beside its head the way
 * it is to turn; a long press pauses; a tap starts a game. The pad of DGX-DI is drawn on the display where a board can
 * show one and has no buttons.
 */
#include <stdio.h>
#include <string.h>

#include "assets/snake_pack.h"
#include "dgx_di.h"
#include "dgx_di_pad.h"
#include "dgx_ge_anim.h"
#include "dgx_ge_board.h"
#include "dgx_ge_dialog.h"
#include "dgx_ge_frame.h"
#include "dgx_ge_game.h"
#include "dgx_ge_input.h"
#include "dgx_ge_label.h"
#include "dgx_ge_layout.h"
#include "dgx_ge_pack.h"
#include "dgx_ge_pockets.h"
#include "dgx_ge_scene.h"
#include "dgx_ge_show.h"
#include "dgx_ge_talk_view.h"
#include "dgx_ge_tiles.h"
#include "dgx_ge_timers.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "fonts/TerminusTTFMedium12.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#ifdef GAME_CYD
#include "cyd_touch.h"
#endif

static const char *TAG = "snake";

extern const uint8_t snake_pack_start[] asm("_binary_snake_pack_start");
extern const uint8_t snake_pack_end[] asm("_binary_snake_pack_end");

/* what PLAY signals: the constants SIG_* of snake.json */
enum { SIG_NUMBERS = 1, SIG_OVER = 2, SIG_STAR = 3, SIG_STAR_GONE = 4, SIG_NEW = 5 };
/* the sides of a cell: a body's modifier has a bit of each it goes on to; a head's or a tail's, the number of the side its body is on */
enum { SIDE_UP, SIDE_RIGHT, SIDE_DOWN, SIDE_LEFT };
enum { DEAD = 4 }; /* a head's modifier + 4: dead */
enum { STEP_US = 16000 };
enum { MAX_CELLS = 32 * 24 }; /* the field of the editor: 32 x 22 */
enum { TITLE, PLAYING, PAUSED, OVER };

static const int DX[4] = {0, 1, 0, -1}, DY[4] = {-1, 0, 1, 0};

static dgx_ge_pack_t      pack;
static uint8_t            maps[SNAKE_SET_COUNT][16];
static const uint8_t     *map_of[SNAKE_SET_COUNT];
static dgx_ge_frame_t    *frame;
static dgx_ge_scene_t    *scene;
static dgx_ge_kinds_t     kinds;
static dgx_ge_layout_t    layout;
static dgx_image_t        layout_images[8];
static dgx_ge_tileset_t   tiles;
static dgx_ge_grid_t      grid;
static uint16_t           cells[MAX_CELLS];
static uint8_t            mods[MAX_CELLS];
static uint16_t           laid[MAX_CELLS + 1];
static const uint16_t    *field_cells; /* the field as laid in the editor: its walls */
static int                cols, rows;
static dgx_ge_actor_t     play;   /* the game's own actor: PLAY */
static dgx_ge_actor_t     sparks; /* where the snake ate */
static bool               sparkling;
static dgx_ge_actor_t     prompt; /* PRESS START, blinking */
static dgx_ge_timers_t    timers;
static dgx_ge_show_t      title;
static dgx_ge_label_t     score_label, best_label;
static dgx_ge_dialog_t    pause_dialog;
static dgx_ge_strings_t   strings;
static dgx_ge_talk_t      talk;
static dgx_ge_talk_view_t view;
static dgx_font_t        *fonts[SNAKE_FONT_COUNT];

static int      state = TITLE;
static uint32_t clock_ms;     /* the game's time: it stands while the pause dialog is open */
static uint32_t next_step_ms; /* when the snake goes on */
static bool     relay_all;    /* a cell laid more or fewer pieces: the set is laid anew */
static uint32_t seed = 1;

/* the snake: its cells from the tail to the head, in a ring */
static uint16_t body[MAX_CELLS];
static int      tail_at, length;
static int      way, want; /* SIDE_*: where it goes, where the arrows turn it */
static int      star = -1; /* the cell of the star, -1 none */

static int rnd(int n)
{
    seed = seed * 214013u + 2531011u;
    return (int)((seed >> 16) % (uint32_t)n);
}

static int cell_of(int c, int r)
{
    return r * cols + c;
}

static int head(void)
{
    return body[(tail_at + length - 1) % (cols * rows)];
}

/* the side of cell b seen from its neighbour a */
static int side_to(int a, int b)
{
    const int ac = a % cols, ar = a / cols, bc = b % cols, br = b / cols;
    return br < ar ? SIDE_UP : bc > ac ? SIDE_RIGHT : br > ar ? SIDE_DOWN : SIDE_LEFT;
}

/* The set of the scene: its pictures as laid in the editor, the pieces of the grid. */
static void lay_set(void)
{
    dgx_ge_scene_set_begin(scene);
    dgx_ge_layout_scene(&layout, scene, &pack, map_of, layout_images);
    dgx_ge_grid_add(&grid, scene);
    dgx_ge_scene_set_end(scene);
    dgx_ge_scene_invalidate(scene, 0, dgx_ge_rect(0, 0, dgx_ge_frame_width(frame), dgx_ge_frame_height(frame)));
    relay_all = false;
}

/* A cell becomes a tile with a modifier: only what it reaches is laid again, if it can be. */
static void put(int cell, int tile, int mod)
{
    const bool kind = cells[cell] != tile;
    if (!kind && mods[cell] == mod) return;
    cells[cell] = (uint16_t)tile;
    mods[cell]  = (uint8_t)mod;
    if (!relay_all && !dgx_ge_grid_relay(&grid, scene, cell % cols, cell / cols, kind)) relay_all = true;
}

static int random_empty(void)
{
    for (int tries = 0; tries < 10000; ++tries) {
        const int c = rnd(cols * rows);
        if (!cells[c]) return c;
    }
    return -1;
}

static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx);

/* The field as the editor laid it, without the snake, the apple and the star; the snake at its start, an apple. */
static void new_field(void)
{
    for (int i = 0; i < cols * rows; ++i) {
        cells[i] = field_cells[i] == SNAKE_SNAKE_TILE_WALL ? SNAKE_SNAKE_TILE_WALL : 0;
        mods[i]  = 0;
    }
    dgx_ge_game_t game;
    size_t        size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, SNAKE_BLOB_GAME, &size);
    dgx_ge_game_open(&game, blob, size);
    const int c0 = dgx_ge_game_value(&game, SNAKE_GAME_START_COL, 10), r0 = dgx_ge_game_value(&game, SNAKE_GAME_START_ROW, 11);
    length       = (int)play.params[SNAKE_PLAY_PARAM_LENGTH];
    if (length < 2) length = 2;
    tail_at = 0;
    for (int i = 0; i < length; ++i) body[i] = (uint16_t)cell_of(c0 - (length - 1) + i, r0);
    for (int i = 0; i < length; ++i) {
        const int c = body[i];
        if (i == 0) cells[c] = SNAKE_SNAKE_TILE_TAIL, mods[c] = SIDE_RIGHT;
        else if (i == length - 1) cells[c] = SNAKE_SNAKE_TILE_HEAD, mods[c] = SIDE_LEFT;
        else cells[c] = SNAKE_SNAKE_TILE_BODY, mods[c] = 1 << SIDE_LEFT | 1 << SIDE_RIGHT;
    }
    way = want = SIDE_RIGHT;
    star       = -1;
    const int apple = random_empty();
    if (apple >= 0) cells[apple] = SNAKE_SNAKE_TILE_APPLE;
    lay_set();
}

static void numbers(void)
{
    dgx_ge_label_number(&score_label, play.params[SNAKE_PLAY_PARAM_SCORE]);
    dgx_ge_label_number(&best_label, play.params[SNAKE_PLAY_PARAM_BEST]);
}

/* What PLAY (and the dialog's tell to it) says: its signals, its timer, its sounds (none made yet). */
static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (what >= DGX_GE_ANIM_TIMER_START && what <= DGX_GE_ANIM_TIMER_GO) {
        dgx_ge_timers_said(&timers, what, value, DGX_GE_OWNER_ACTOR, 0, 0, 0, at_ms);
        return;
    }
    if (what == DGX_GE_ANIM_VANISH && actor == &sparks) sparkling = false;
    if (what != DGX_GE_ANIM_SIGNAL || actor != &play) return;
    if (value == SIG_NUMBERS) numbers();
    if (value == SIG_NEW) {
        new_field();
        state        = PLAYING;
        next_step_ms = at_ms + (uint32_t)play.params[SNAKE_PLAY_PARAM_SPEED];
    }
    if (value == SIG_OVER) state = OVER;
    if (value == SIG_STAR && star < 0) {
        star = random_empty();
        if (star >= 0) put(star, SNAKE_SNAKE_TILE_STAR, 0);
    }
    if (value == SIG_STAR_GONE && star >= 0) {
        if (cells[star] == SNAKE_SNAKE_TILE_STAR) put(star, 0, 0);
        star = -1;
    }
}

/* A timer of the pack gone off: its event to PLAY, which owns them all. */
static void fire(const dgx_ge_timer_t *timer, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (timer->event != 0xFF) dgx_ge_actor_event(&play, timer->event, at_ms, say, NULL);
}

/* The snake a cell on: what the head finds there, PLAY is told. */
static void step(uint32_t at_ms)
{
    if (want != (way + 2) % 4) way = want;
    const int h = head(), c = h % cols + DX[way], r = h / cols + DY[way];
    if (c < 0 || r < 0 || c >= cols || r >= rows) {
        put(h, SNAKE_SNAKE_TILE_HEAD, mods[h] + DEAD);
        dgx_ge_actor_event(&play, SNAKE_PLAY_EVENT_CRASH, at_ms, say, NULL);
        return;
    }
    const int  to      = cell_of(c, r);
    const int  found   = cells[to];
    const bool growing = length < play.params[SNAKE_PLAY_PARAM_LENGTH];
    if (found == SNAKE_SNAKE_TILE_WALL || found == SNAKE_SNAKE_TILE_BODY || found == SNAKE_SNAKE_TILE_HEAD ||
        (found == SNAKE_SNAKE_TILE_TAIL && growing)) {
        put(h, SNAKE_SNAKE_TILE_HEAD, mods[h] % DEAD + DEAD);
        dgx_ge_actor_event(&play, SNAKE_PLAY_EVENT_CRASH, at_ms, say, NULL);
        return;
    }
    const int n = cols * rows;
    if (!growing) { /* the tail comes after */
        const int tail = body[tail_at];
        put(tail, 0, 0);
        tail_at = (tail_at + 1) % n;
        --length;
        const int next = body[tail_at];
        put(next, SNAKE_SNAKE_TILE_TAIL, side_to(next, body[(tail_at + 1) % n]));
    }
    /* the head goes on: where it was is body, going on to where it came from and where it goes */
    const int behind = length > 1 ? body[(tail_at + length - 2) % n] : body[tail_at];
    if (length > 1) put(h, SNAKE_SNAKE_TILE_BODY, 1 << side_to(h, behind) | 1 << side_to(h, to));
    body[(tail_at + length) % n] = (uint16_t)to;
    ++length;
    put(to, SNAKE_SNAKE_TILE_HEAD, side_to(to, h));
    if (found == SNAKE_SNAKE_TILE_APPLE || found == SNAKE_SNAKE_TILE_STAR) {
        const dgx_ge_anim_t *a = dgx_ge_kind(&kinds, SNAKE_BLOB_SPARKLE);
        if (a) {
            dgx_ge_actor_start(&sparks, a, SNAKE_SPARKLE_SCRIPT_POP, grid.x + c * tiles.cell_w + tiles.cell_w / 2,
                               grid.y + r * tiles.cell_h + tiles.cell_h / 2, at_ms);
            sparkling = true;
        }
    }
    if (found == SNAKE_SNAKE_TILE_APPLE) {
        const int apple = random_empty();
        if (apple >= 0) put(apple, SNAKE_SNAKE_TILE_APPLE, 0);
        dgx_ge_actor_event(&play, SNAKE_PLAY_EVENT_ATE, at_ms, say, NULL);
    } else if (found == SNAKE_SNAKE_TILE_STAR) {
        star = -1;
        dgx_ge_actor_event(&play, SNAKE_PLAY_EVENT_STAR, at_ms, say, NULL);
    }
}

/* A picture of the pack as an item of the scene, in the colors of its set. */
static bool item_of(int id, dgx_image_t *image, dgx_ge_item_t *item)
{
    if (id < 0 || !dgx_ge_pack_image(&pack, id, image)) return false;
    item->image = image;
    item->map   = maps[dgx_ge_pack_image_set(&pack, id)];
    return true;
}

static void show_actor(const dgx_ge_actor_t *a, dgx_image_t *image, int layer)
{
    dgx_ge_item_t it = {.x     = (int16_t)(dgx_ge_actor_x(a) + (a->flip ? -a->image_dx : a->image_dx)),
                        .y     = (int16_t)(dgx_ge_actor_y(a) + a->image_dy),
                        .layer = (uint8_t)layer,
                        .flags = a->flip ? DGX_GE_BLIT_FLIP_X : 0};
    if (a->image >= 0 && item_of(a->image, image, &it)) dgx_ge_scene_actor(scene, &it);
}

static void start_title(uint32_t now)
{
    state = TITLE;
    dgx_ge_scene_reset(scene, 0);
    size_t         size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, SNAKE_BLOB_TITLE, &size);
    if (blob && dgx_ge_show_open(&title, blob, size) && dgx_ge_show_start(&title, &kinds, now)) {
        dgx_ge_scene_set_begin(scene);
        dgx_ge_show_backdrop(&title, &pack, map_of, scene);
        dgx_ge_scene_set_end(scene);
    }
}

static void start_game(uint32_t now)
{
    if (state == TITLE) dgx_ge_show_stop(&title);
    state = PLAYING;
    dgx_ge_actor_event(&play, SNAKE_PLAY_EVENT_START, now, say, NULL); /* PLAY: SIG_NEW lays the field */
}

/*
 * The finger (DGX-DI's touch: where it went down, where it is, a long press). A swipe is much shorter than DGX-DI's own
 * (15 mm is a quarter of the CYD's display): SWIPE_MM along an axis, while the finger is down or where it went up
 * (a quick swipe on a resistive panel gives a point or two before it lifts), once a touch; a tap drifts 0..4 points.
 * A touch let go short of that is a tap.
 */
enum { SWIPE_MM = 2 };
static dgx_di_touch_t touch;
static bool           steered; /* this touch has turned the snake (or paused it) already */
static int            swipe_px;

static int way_to(int dx, int dy)
{
    if ((dx < 0 ? -dx : dx) > (dy < 0 ? -dy : dy)) return dx > 0 ? SIDE_RIGHT : SIDE_LEFT;
    return dy > 0 ? SIDE_DOWN : SIDE_UP;
}

/* The way a swipe goes, once it has gone far enough; -1 not yet. */
static int swipe_way(void)
{
    const int dx = touch.x - touch.from_x, dy = touch.y - touch.from_y;
    if (!(touch.down || touch.released) || steered || ((dx < 0 ? -dx : dx) < swipe_px && (dy < 0 ? -dy : dy) < swipe_px)) return -1;
    steered = true;
    return way_to(dx, dy);
}

/* A tap beside the head: the way from the head to it. */
static int tap_way(void)
{
    int x = 0, y = 0;
    if (!dgx_ge_scene_point_at(scene, 0, touch.x, touch.y, &x, &y)) return -1;
    const int h = head();
    return way_to(x - (grid.x + h % cols * tiles.cell_w + tiles.cell_w / 2), y - (grid.y + h / cols * tiles.cell_h + tiles.cell_h / 2));
}

static void control(const dgx_ge_input_t *input, uint32_t real, uint32_t now)
{
    if (touch.pressed) steered = false;
    const int  swiped = state == PLAYING ? swipe_way() : -1;
    const bool tap    = touch.released && !steered && !touch.told;
    const bool go  = input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_A);
    if (state == TITLE || state == OVER) {
        if (go || tap) start_game(now);
        return;
    }
    if (state == PAUSED) {
        if (input->pressed & DGX_GE_KEY_UP) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_PREV, real);
        if (input->pressed & DGX_GE_KEY_DOWN) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_NEXT, real);
        if (go) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_ACTIVATE, real);
        if (input->pressed & (DGX_GE_KEY_B | DGX_GE_KEY_BACK)) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_BACK, real);
        if (!steered || !(touch.down || touch.released)) dgx_ge_talk_view_pointer(&view, &talk, &input->pointer, real); /* not the finger that paused */
        return;
    }
    const bool held = touch.long_press && !steered;
    if ((input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_BACK)) || held) {
        steered = true; /* the finger that paused does not answer the dialog as it goes up */
        dgx_ge_actor_t *roles[] = {&play};
        dgx_ge_cast_t   cast    = {.roles = roles, .game = &play};
        dgx_ge_talk_start(&talk, &pause_dialog, &cast, SNAKE_STYLE_MENU, real, say, NULL);
        talk.ahead_ms = real - now;
        state         = PAUSED;
        return;
    }
    if (input->pressed & DGX_GE_KEY_UP) want = SIDE_UP;
    if (input->pressed & DGX_GE_KEY_RIGHT) want = SIDE_RIGHT;
    if (input->pressed & DGX_GE_KEY_DOWN) want = SIDE_DOWN;
    if (input->pressed & DGX_GE_KEY_LEFT) want = SIDE_LEFT;
    int w = swiped;
    if (w < 0 && tap) w = tap_way();
    if (w >= 0) want = w;
}

void app_main(void)
{
    board_t board;
    if (!board_display_init(&board)) {
        ESP_LOGE(TAG, "no display");
        return;
    }
    if (!dgx_ge_pack_open(&pack, snake_pack_start, (size_t)(snake_pack_end - snake_pack_start))) {
        ESP_LOGE(TAG, "the pack does not hold together");
        return;
    }
    size_t         size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, SNAKE_BLOB_SCENE_FIELD, &size);
    if (!blob || !dgx_ge_layout_open(&layout, blob, size)) {
        ESP_LOGE(TAG, "no scene field");
        return;
    }
    /* the game's screen, the editor's: as large as the display lets it be, in its middle */
    dgx_screen_t *lcd = board.lcd;
    const int     w = SNAKE_SCREEN_WIDTH, h = SNAKE_SCREEN_HEIGHT;
    int           scale = lcd->width / w < lcd->height / h ? lcd->width / w : lcd->height / h;
    scale               = scale < 1 ? 1 : scale;
    frame               = dgx_ge_frame_create(lcd, (lcd->width - w * scale) / 2, (lcd->height - h * scale) / 2, w, h);
    if (frame && scale > 1 && !dgx_ge_frame_scale(frame, scale)) frame = NULL;
    if (frame && board_band) dgx_ge_frame_band(frame, board_band);
    dgx_ge_layout_grid_t lg;
    if (!dgx_ge_layout_grid(&layout, SNAKE_SCENE_FIELD_GRID_FIELD, &lg) || lg.cols * lg.rows > MAX_CELLS) {
        ESP_LOGE(TAG, "no grid field");
        return;
    }
    scene = frame ? dgx_ge_scene_create(frame, layout.layers, lg.cols * lg.rows + 64, 48) : NULL;
    if (!scene) {
        ESP_LOGE(TAG, "no memory for the frame");
        return;
    }
    /* the colors of every set; the paper of the frame the grass of the palette GRASS */
    for (int set = 0; set < SNAKE_SET_COUNT; ++set) {
        const uint8_t (*rgb)[3];
        const int n = dgx_ge_pack_set_colors(&pack, set, &rgb);
        if (n) dgx_ge_frame_add_colors(frame, rgb, n, maps[set]);
        map_of[set] = maps[set];
        if (set == SNAKE_SET_GRASS && n) dgx_ge_frame_set_color(frame, 0, rgb[0][0], rgb[0][1], rgb[0][2]);
    }
    dgx_ge_scene_reset(scene, 0);

    /* the grid of the field: its set of tiles, its cells the game's own copy */
    const uint8_t *ts = dgx_ge_pack_blob(&pack, lg.tiles, &size);
    if (!ts || !dgx_ge_tileset_open(&tiles, &pack, ts, size)) {
        ESP_LOGE(TAG, "no tiles");
        return;
    }
    cols = lg.cols, rows = lg.rows;
    field_cells = lg.cells;
    dgx_ge_layout_grid_set(&lg, &grid, &tiles, cells);
    grid.maps = map_of;
    grid.mods = mods;
    grid.laid = laid;
    for (int i = 0; i < cols * rows; ++i) cells[i] = lg.cells[i], mods[i] = lg.mods ? lg.mods[i] : 0;

    /* the kinds, the game's actor, the timers, the labels, the dialog */
    dgx_ge_kinds_init(&kinds, &pack, 8);
    uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
    seed         = now | 1;
    dgx_ge_actor_start(&play, dgx_ge_kind(&kinds, SNAKE_BLOB_PLAY), SNAKE_PLAY_SCRIPT_IDLE, 0, 0, now);
    dgx_ge_actor_start(&prompt, dgx_ge_kind(&kinds, SNAKE_BLOB_WORDS), SNAKE_WORDS_SCRIPT_BLINK, w / 2, h / 2 + 30, now);
    dgx_ge_timers_init(&timers, 4, fire, NULL);
    blob = dgx_ge_pack_blob(&pack, SNAKE_BLOB_TIMERS, &size);
    if (blob) dgx_ge_timers_define(&timers, blob, size);
    fonts[SNAKE_FONT_TERMINUSTTFMEDIUM12] = TerminusTTFMedium12();
    dgx_ge_rect_t place;
    int           kind;
    const uint8_t ink = maps[SNAKE_SET_WORDS][1]; /* its second color, white: a map is by color, from 0 */
    if (dgx_ge_layout_zone(&layout, SNAKE_SCENE_FIELD_ZONE_SCORE, &place, &kind))
        dgx_ge_label_init(&score_label, frame, fonts[0], place.x, place.y, place.w, place.h, DGX_GE_ALIGN_LEFT, SNAKE_SCENE_FIELD_LAYER_TEXT, ink);
    if (dgx_ge_layout_zone(&layout, SNAKE_SCENE_FIELD_ZONE_BEST, &place, &kind))
        dgx_ge_label_init(&best_label, frame, fonts[0], place.x, place.y, place.w, place.h, DGX_GE_ALIGN_LEFT, SNAKE_SCENE_FIELD_LAYER_TEXT, ink);
    numbers();
    blob = dgx_ge_pack_blob(&pack, SNAKE_BLOB_PAUSE, &size);
    if (!blob || !dgx_ge_dialog_open(&pause_dialog, blob, size)) ESP_LOGE(TAG, "no dialog pause");
    blob = dgx_ge_pack_blob(&pack, SNAKE_BLOB_STRINGS, &size);
    if (blob) dgx_ge_strings_open(&strings, blob, size);
    blob = dgx_ge_pack_blob(&pack, SNAKE_BLOB_STYLES, &size);
    dgx_ge_talk_view_init(&view, blob, blob ? size : 0, frame, fonts, SNAKE_FONT_COUNT);
    dgx_ge_talk_view_pictures(&view, &pack, map_of);

    /* the touch: the board's (the mouse on the computer), else the CYD's own; its gestures by the display's size */
    bool pointing = board_pointer_start(lcd);
#ifdef GAME_CYD
    const bool cyd = !pointing && cyd_touch_start(lcd);
    pointing       = pointing || cyd;
#else
    const bool cyd = false;
#endif
    dgx_di_touch_display(&touch, lcd, board_mm_w, board_mm_h);
    swipe_px = board_mm_w > 0 ? SWIPE_MM * lcd->width / board_mm_w : 11;
    /* the pad of DGX-DI on the display where the board can show one and has no buttons of its own */
    const bool padded = pointing && board_pad_able && !board_buttons_able &&
                        board_pad_show(lcd, dgx_di_pad_layout_classic, dgx_di_pad_layout_classic_size, 120);
    ESP_LOGI(TAG, "a frame of %dx%d, x%d, on a display of %dx%d; %s%s", w, h, scale, lcd->width, lcd->height,
             padded ? "a pad" : board_buttons_able ? "buttons" : pointing ? "a pointer" : "no input", cyd ? " (the CYD's touch)" : "");

    start_title(now);
    dgx_ge_input_t input       = {0};
    uint32_t       paused_ms   = 0; /* the real time the game's clock has stood, all told */
    uint32_t       last        = now;
    static dgx_image_t pictures[16];
    for (;;) {
        const int64_t  t0   = esp_timer_get_time();
        const uint32_t real = (uint32_t)(t0 / 1000);
        if (state == PAUSED) paused_ms += real - last;
        last     = real;
        clock_ms = real - paused_ms;
        if (pointing) {
            int x = 0, y = 0;
#ifdef GAME_CYD
            const bool down = cyd ? cyd_touch(real, &x, &y) : board_pointer(real, &x, &y);
#else
            const bool down = board_pointer(real, &x, &y);
#endif
            dgx_ge_input_pointer(&input, x, y, down);
            dgx_di_touch_take(&touch, x, y, down, real);
        }
        dgx_ge_input_update(&input, board_buttons() | (padded ? board_pad_buttons() : 0));
        control(&input, real, clock_ms);

        if (state == PAUSED) {
            dgx_ge_talk_view_play(&view, &talk, &strings, real);
            if (talk.state == DGX_GE_TALK_OVER && state == PAUSED) state = PLAYING;
        } else {
            dgx_ge_timers_play(&timers, clock_ms);
            dgx_ge_actor_advance(&play, clock_ms, say, NULL);
            while (state == PLAYING && (int32_t)(clock_ms - next_step_ms) >= 0) {
                const uint32_t at = next_step_ms;
                next_step_ms += (uint32_t)play.params[SNAKE_PLAY_PARAM_SPEED];
                step(at);
            }
            if (sparkling) dgx_ge_actor_advance(&sparks, clock_ms, say, NULL);
            if (state == TITLE) dgx_ge_show_play(&title, clock_ms, say, NULL);
            if (state == OVER) dgx_ge_actor_advance(&prompt, clock_ms, say, NULL);
            dgx_ge_rect_t places[8];
            if (state != TITLE && dgx_ge_grid_animate(&grid, clock_ms, places, 8)) relay_all = true; /* the apple shines */
        }
        if (relay_all) lay_set();

        /* what moves in this frame */
        dgx_ge_scene_actors_begin(scene);
        int p = 0;
        if (state == TITLE) {
            dgx_ge_show_items(&title, &pack, map_of, scene, NULL, NULL);
        } else {
            dgx_ge_label_show(&score_label, scene);
            dgx_ge_label_show(&best_label, scene);
            if (sparkling) show_actor(&sparks, &pictures[p++], SNAKE_SCENE_FIELD_LAYER_ACTORS);
            if (state == OVER) {
                dgx_ge_item_t it = {.x = w / 2, .y = h / 2, .layer = SNAKE_SCENE_FIELD_LAYER_TEXT};
                if (item_of(SNAKE_IMG_WORDS_GAME_OVER, &pictures[p++], &it)) dgx_ge_scene_actor(scene, &it);
                show_actor(&prompt, &pictures[p++], SNAKE_SCENE_FIELD_LAYER_TEXT);
            }
            if (state == PAUSED) dgx_ge_talk_view_show(&view, &talk, scene, SNAKE_SCENE_FIELD_LAYER_TEXT);
        }
        dgx_ge_scene_render(scene);

        const int64_t spent = esp_timer_get_time() - t0;
        vTaskDelay(spent < STEP_US ? pdMS_TO_TICKS((STEP_US - spent) / 1000) + 1 : 1);
    }
}
