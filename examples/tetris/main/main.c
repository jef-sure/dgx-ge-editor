/*
 * Tetris on DGX-GE, made in the sprite editor: its pictures, the well and the boxes beside it, the tiles of blocks
 * (a block's piece is its cell's modifier), the shapes of the pieces (numbers of the game), the game's actor PLAY (its
 * phases, the score, the lines, the level and how fast it falls, how long a piece lies before it locks, how long full
 * lines flash), the sounds, the title show and the pause dialog are data of game_data/ (the pack the build makes of
 * it). This file is what data cannot say: the piece falls, turns and moves in the well as the buttons or the finger
 * say, lies on what is below it, and full lines go; PLAY is told what happened, its signals say what follows.
 *
 * The same file builds for a board of the engine (idf.py: the CYD) and for the computer (make). The touch is DGX-DI's
 * (the CYD's own, cyd_touch.c): a finger drawn sideways moves the piece a column for each column it goes, a tap turns
 * it, a swipe down drops it, a long press pauses; a tap starts a game.
 */
#include <stdio.h>
#include <string.h>

#include "assets/tetris_pack.h"
#include "dgx_di.h"
#include "dgx_di_pad.h"
#include "dgx_ge_anim.h"
#include "dgx_ge_board.h"
#include "dgx_ge_dialog.h"
#include "dgx_ge_frame.h"
#include "dgx_ge_game.h"
#include "dgx_ge_glue.h"
#include "dgx_ge_input.h"
#include "dgx_ge_label.h"
#include "dgx_ge_layout.h"
#include "dgx_ge_mixer.h"
#include "dgx_ge_pack.h"
#include "dgx_ge_save.h"
#include "dgx_ge_pockets.h"
#include "dgx_ge_scene.h"
#include "dgx_ge_show.h"
#include "dgx_ge_talk_view.h"
#include "dgx_ge_tiles.h"
#include "dgx_ge_timers.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include "fonts/TerminusTTFMedium12.h"
#ifdef GAME_CYD
#include "cyd_touch.h"
#endif

static const char *TAG = "tetris";

extern const uint8_t tetris_pack_start[] asm("_binary_tetris_pack_start");
extern const uint8_t tetris_pack_end[] asm("_binary_tetris_pack_end");

enum { PIECES = 7, TURNS = 4 };
enum { COLS_MAX = 16, ROWS_MAX = 32 };
enum { STEP_US = 16000 };
enum { SWIPE_MM = 2 };

static dgx_ge_pack_t      pack;
static uint8_t            maps[TETRIS_SET_COLOR_COUNT]; /* the colors of the sets: indices of the frame, a byte a color */
static const uint8_t     *map_of[TETRIS_SET_COUNT];     /* where the map of each set begins in maps */
static dgx_ge_frame_t    *frame;
static dgx_ge_scene_t    *scene;
static dgx_ge_kinds_t     kinds;
static dgx_ge_layout_t    layout;
static dgx_image_t        layout_images[16];
static dgx_ge_game_t      game;
static dgx_ge_tileset_t   tiles;
static dgx_ge_grid_t      well, next;
static uint16_t           well_cells[COLS_MAX * ROWS_MAX], next_cells[8];
static uint8_t            well_mods[COLS_MAX * ROWS_MAX], next_mods[8];
static uint16_t           well_laid[COLS_MAX * ROWS_MAX + 1], next_laid[9];
static int                cols, rows;
static dgx_ge_actor_t     play;    /* the game's own actor: PLAY */
static dgx_ge_actor_t     message; /* GAME OVER, PAUSED in the middle of the well */
static dgx_ge_actor_t     prompt;  /* PRESS START */
static dgx_ge_actor_t     falling; /* the fall: FALL, a row every game_var.fall ms */
static dgx_ge_timers_t    timers;
static dgx_ge_show_t      title;
static dgx_ge_label_t     score_label, lines_label, level_label;
static dgx_ge_dialog_t    pause_dialog;
static dgx_ge_strings_t   strings;
static dgx_ge_talk_t      talk;
static dgx_ge_talk_view_t view;
static dgx_font_t        *fonts[TETRIS_FONT_COUNT];
static dgx_ge_sounds_t    sounds;
static dgx_ge_mixer_t     mixer;
static dgx_ge_sound_t     sound; /* the mixer as the game's output; none: nothing plays */
static dgx_ge_vars_t      vars;  /* the game's variables: the player's settings, the volumes of the music and the effects */
static int32_t            heard[2] = {-1, -1};

static bool     paused;
static uint32_t clock_ms; /* the game's time: it stands while the pause dialog is open */
static bool     relay_all;
static uint32_t seed = 1;

/* the well: 0 empty, else the piece + 1 of a block lying there */
static uint8_t  board[ROWS_MAX][COLS_MAX];
static int      piece, turn, at_col, at_row, coming; /* the piece falling (its 4 x 4 at at_col, at_row), the next */
static bool     lying;                                /* it lies on something: PLAY counts the time to its locking */
static bool     full[ROWS_MAX];                       /* the lines that go */
static uint8_t  bag[PIECES];
static int      bag_left;

static int phase(void)
{
    return (int)play.params[TETRIS_PLAY_PARAM_PHASE];
}

static int rnd(int n)
{
    seed = seed * 214013u + 2531011u;
    return (int)((seed >> 16) % (uint32_t)n);
}

/* the next piece of a bag of all seven, shuffled */
static int draw_piece(void)
{
    if (!bag_left) {
        for (int i = 0; i < PIECES; ++i) bag[i] = (uint8_t)i;
        for (int i = PIECES - 1; i > 0; --i) {
            const int j = rnd(i + 1);
            const uint8_t t = bag[i];
            bag[i] = bag[j], bag[j] = t;
        }
        bag_left = PIECES;
    }
    return bag[--bag_left];
}

/* a shape: 16 bits, its rows of 4 from the top, the left column the high bit (the game's numbers I_0 .. L_3) */
static bool cell_of_shape(int p, int t, int c, int r)
{
    const int32_t bits = dgx_ge_game_value(&game, p * TURNS + t, 0);
    return bits >> (15 - (r * 4 + c)) & 1;
}

static bool fits(int p, int t, int col, int row)
{
    for (int r = 0; r < 4; ++r)
        for (int c = 0; c < 4; ++c) {
            if (!cell_of_shape(p, t, c, r)) continue;
            const int x = col + c, y = row + r;
            if (x < 0 || x >= cols || y >= rows) return false;
            if (y >= 0 && board[y][x]) return false;
        }
    return true;
}

static int drop_row(void)
{
    int r = at_row;
    while (fits(piece, turn, at_col, r + 1)) ++r;
    return r;
}

/* The set of the scene laid anew (its paper, its pictures as laid in the editor, the pieces of the grids); all of it drawn anew, or only where cells changed (marked as they did). */
static void lay_set(bool all)
{
    dgx_ge_scene_set_begin(scene);
    dgx_ge_layout_scene(&layout, scene, &pack, map_of, layout_images);
    dgx_ge_grid_add(&well, scene);
    dgx_ge_grid_add(&next, scene);
    dgx_ge_scene_set_end(scene);
    if (all) dgx_ge_scene_invalidate(scene, 0, dgx_ge_rect(0, 0, dgx_ge_frame_width(frame), dgx_ge_frame_height(frame)));
    relay_all = false;
}

static void put(dgx_ge_grid_t *g, int i, int tile, int mod)
{
    const bool kind = g->cells[i] != tile;
    if (!kind && g->mods[i] == mod) return;
    const int c = i % g->cols, r = i / g->cols;
    if (relay_all) dgx_ge_scene_invalidate(scene, 0, dgx_ge_grid_change_box(g, c, r)); /* the set is laid anew: its place marked, as it was */
    g->cells[i]             = (uint16_t)tile;
    ((uint8_t *)g->mods)[i] = (uint8_t)mod;
    if (relay_all) dgx_ge_scene_invalidate(scene, 0, dgx_ge_grid_change_box(g, c, r)); /* and as it is */
    else if (!dgx_ge_grid_relay(g, scene, c, r, kind)) relay_all = true; /* its place marked all the same */
}

/* The cells as the game is: what lies, the lines going, where the piece would land, the piece. */
static void show_well(void)
{
    static uint16_t tile[COLS_MAX * ROWS_MAX];
    static uint8_t  mod[COLS_MAX * ROWS_MAX];
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            const int i = r * cols + c;
            tile[i]     = board[r][c] ? (full[r] ? TETRIS_TETRIS_TILE_GOING : TETRIS_TETRIS_TILE_BLOCK) : 0;
            mod[i]      = board[r][c] ? board[r][c] - 1 : 0;
        }
    if (phase() == TETRIS_PH_PLAYING) {
        const int land = drop_row();
        for (int pass = 0; pass < 2; ++pass)
            for (int r = 0; r < 4; ++r)
                for (int c = 0; c < 4; ++c) {
                    const int y = (pass ? at_row : land) + r, x = at_col + c;
                    if (!cell_of_shape(piece, turn, c, r) || y < 0 || y >= rows) continue;
                    tile[y * cols + x] = pass ? TETRIS_TETRIS_TILE_BLOCK : TETRIS_TETRIS_TILE_SHADOW;
                    mod[y * cols + x]  = (uint8_t)piece;
                }
    }
    for (int i = 0; i < rows * cols; ++i) put(&well, i, tile[i], mod[i]);
    /* the next one, the top two rows of its first turn */
    for (int r = 0; r < 2; ++r)
        for (int c = 0; c < 4; ++c) {
            const bool on = phase() != TETRIS_PH_TITLE && cell_of_shape(coming, 0, c, r);
            put(&next, r * 4 + c, on ? TETRIS_TETRIS_TILE_BLOCK : 0, on ? coming : 0);
        }
}

static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx);
static void fall(uint32_t at_ms);

/* It lies on something, or not any more: PLAY counts the time to its locking. */
static void settle(uint32_t at_ms)
{
    const bool now = !fits(piece, turn, at_col, at_row + 1);
    if (now == lying) return;
    lying = now;
    dgx_ge_actor_event(&play, lying ? TETRIS_PLAY_EVENT_LANDED : TETRIS_PLAY_EVENT_LIFTED, at_ms, say, NULL);
}

/* The next piece at the top; none fits: the game is over. */
static void spawn(uint32_t at_ms)
{
    piece  = coming;
    coming = draw_piece();
    turn   = 0;
    at_col = dgx_ge_game_value(&game, TETRIS_GAME_SPAWN_COL, 3);
    at_row = -1;
    lying  = false;
    if (!fits(piece, turn, at_col, at_row) && !fits(piece, turn, at_col, ++at_row)) {
        dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_TOPPED, at_ms, say, NULL);
        dgx_ge_actor_event(&message, TETRIS_EVENT_OVER, at_ms, say, NULL);
        return;
    }
    dgx_ge_actor_event(&falling, TETRIS_EVENT_HURRY, at_ms, say, NULL); /* its fall from now */
    settle(at_ms);
}

/* The piece lies where it is: the lines it fills flash (PLAY says how long), or the next one comes. */
static void lock(uint32_t at_ms)
{
    for (int r = 0; r < 4; ++r)
        for (int c = 0; c < 4; ++c)
            if (cell_of_shape(piece, turn, c, r) && at_row + r >= 0) board[at_row + r][at_col + c] = (uint8_t)(piece + 1);
    if (lying) dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_LIFTED, at_ms, say, NULL); /* its time to lock no more counted */
    lying   = false;
    int any = 0;
    for (int r = 0; r < rows; ++r) {
        full[r] = true;
        for (int c = 0; c < cols && full[r]; ++c) full[r] = board[r][c] != 0;
        any += full[r];
    }
    if (any) dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_FULL, at_ms, say, NULL); /* PLAY: they flash a while, nothing falls */
    else spawn(at_ms);
}

/* The full lines go, those above come down; PLAY counts them. */
static void clear_lines(uint32_t at_ms)
{
    int taken = 0;
    for (int r = rows - 1; r >= 0; --r) {
        if (!full[r]) continue;
        memmove(board[1], board[0], sizeof board[0] * (size_t)r);
        memset(board[0], 0, sizeof board[0]);
        memmove(full + 1, full, sizeof full[0] * (size_t)r);
        full[0] = false;
        ++taken, ++r;
    }
    play.params[TETRIS_PLAY_PARAM_GIVEN] = taken;
    dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_TAKEN, at_ms, say, NULL);
    spawn(at_ms);
}

static void new_game(uint32_t at_ms)
{
    memset(board, 0, sizeof board);
    memset(full, 0, sizeof full);
    bag_left = 0;
    coming   = draw_piece();
    dgx_ge_actor_start(&falling, dgx_ge_kind(&kinds, TETRIS_BLOB_FALL), TETRIS_FALL_SCRIPT_FALLING, 0, 0, at_ms);
    dgx_ge_actor_start(&message, dgx_ge_kind(&kinds, TETRIS_BLOB_WORDS), TETRIS_WORDS_SCRIPT_QUIET, dgx_ge_actor_x(&message), dgx_ge_actor_y(&message), at_ms);
    spawn(at_ms);
}

static void labels(void)
{
    dgx_ge_label_number(&score_label, play.params[TETRIS_PLAY_PARAM_SCORE]);
    dgx_ge_label_number(&lines_label, play.params[TETRIS_PLAY_PARAM_LINES]);
    dgx_ge_label_number(&level_label, play.params[TETRIS_PLAY_PARAM_LEVEL]);
}

/* The player's settings, the game's variables the pause dialog's sliders edit (0..10), as the mixer's volumes of its buses. */
static void volumes(void)
{
    const int32_t m = dgx_ge_var(&vars, TETRIS_GAME_VAR_MUSIC_VOLUME), e = dgx_ge_var(&vars, TETRIS_GAME_VAR_EFFECTS_VOLUME);
    if (!sound.play || (m == heard[0] && e == heard[1])) return;
    heard[0] = m, heard[1] = e;
    dgx_ge_mixer_music_volume(&mixer, (uint8_t)((m < 0 ? 0 : m > 10 ? 10 : m) * 255 / 10));
    dgx_ge_mixer_effects_volume(&mixer, (uint8_t)((e < 0 ? 0 : e > 10 ? 10 : e) * 255 / 10));
}

/*
 * The settings over a restart: the variables as the engine saves them (a chunk VARS), in NVS (on the computer: a file,
 * the engine's boards/host/host_nvs.c). A save names the pack it was made of: a pack made anew begins with its own.
 */
static void settings_load(void)
{
    uint8_t      buf[128];
    size_t       n = sizeof buf;
    nvs_handle_t h;
    if (nvs_flash_init() != ESP_OK || nvs_open("tetris", NVS_READONLY, &h) != ESP_OK) return;
    if (nvs_get_blob(h, "settings", buf, &n) == ESP_OK) {
        dgx_ge_load_t l;
        uint32_t      saved_ms;
        if (dgx_ge_load_open(&l, buf, n, dgx_ge_pack_id(&pack), &saved_ms)) dgx_ge_vars_load(&vars, &l);
    }
    nvs_close(h);
}

static void settings_keep(void)
{
    uint8_t       buf[128];
    dgx_ge_save_t s;
    nvs_handle_t  h;
    dgx_ge_save_begin(&s, buf, sizeof buf, dgx_ge_pack_id(&pack), 0);
    dgx_ge_vars_save(&vars, &s);
    const size_t n = dgx_ge_save_end(&s);
    if (!n || nvs_open("tetris", NVS_READWRITE, &h) != ESP_OK) return;
    nvs_set_blob(h, "settings", buf, n);
    nvs_commit(h);
    nvs_close(h);
}

/* What PLAY (and the dialog's tell to it) says: its sounds, its timers, its signals. */
static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (dgx_ge_anim_said_sound(&sound, what, value)) return; /* a sound, a music, its level */
    if (what >= DGX_GE_ANIM_TIMER_START && what <= DGX_GE_ANIM_TIMER_GO) {
        dgx_ge_timers_said(&timers, what, value, DGX_GE_OWNER_ACTOR, 0, 0, 0, at_ms);
        return;
    }
    if (actor == &falling) {
        if (what == DGX_GE_ANIM_SIGNAL && value == TETRIS_SIG_FALL && phase() == TETRIS_PH_PLAYING) fall(at_ms);
        return;
    }
    if (what != DGX_GE_ANIM_SIGNAL || actor != &play) return;
    if (value == TETRIS_SIG_NUMBERS) labels();
    if (value == TETRIS_SIG_NEW) {
        if (title.cast) {
            dgx_ge_show_stop(&title);
            dgx_ge_scene_reset(scene, 0);
            lay_set(true);
        }
        new_game(at_ms);
        dgx_ge_layout_music(&layout, &sound); /* the well's music */
    }
    if (value == TETRIS_SIG_LOCK && phase() == TETRIS_PH_PLAYING && lying) lock(at_ms);
    if (value == TETRIS_SIG_CLEAR) clear_lines(at_ms);
}

static void fire(const dgx_ge_timer_t *timer, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (timer->event != 0xFF) dgx_ge_actor_event(&play, timer->event, at_ms, say, NULL);
}

/* The piece moved or turned, when it fits (a turn against a wall tries a column or two aside) */
static bool shift(int dc, uint32_t at_ms)
{
    if (!fits(piece, turn, at_col + dc, at_row)) return false;
    at_col += dc;
    dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_MOVED, at_ms, say, NULL);
    settle(at_ms);
    return true;
}

static void rotate(uint32_t at_ms)
{
    static const int kicks[] = {0, -1, 1, -2, 2};
    const int        t       = (turn + 1) % TURNS;
    for (unsigned i = 0; i < sizeof kicks / sizeof kicks[0]; ++i)
        if (fits(piece, t, at_col + kicks[i], at_row)) {
            turn = t, at_col += kicks[i];
            dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_TURNED, at_ms, say, NULL);
            settle(at_ms);
            return;
        }
}

static void hard_drop(uint32_t at_ms)
{
    const int land = drop_row();
    play.params[TETRIS_PLAY_PARAM_GIVEN] = (land - at_row) * 2;
    at_row = land;
    dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_DROPPED, at_ms, say, NULL);
    lock(at_ms);
}

/* A row down (FALL says when: sooner while down is held, a point a row then); on what lies below, it waits for PLAY's lock. */
static void fall(uint32_t at_ms)
{
    if (fits(piece, turn, at_col, at_row + 1)) {
        ++at_row;
        if (dgx_ge_var(&vars, TETRIS_GAME_VAR_SOFT)) {
            play.params[TETRIS_PLAY_PARAM_GIVEN] = 1;
            dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_DROPPED, at_ms, say, NULL);
        }
    }
    settle(at_ms);
}

static void start_title(uint32_t now)
{
    dgx_ge_scene_reset(scene, 0);
    size_t         size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_TITLE, &size);
    if (blob && dgx_ge_show_open(&title, blob, size) && dgx_ge_show_start(&title, &kinds, now)) {
        dgx_ge_scene_set_begin(scene);
        dgx_ge_show_backdrop(&title, &pack, map_of, scene);
        dgx_ge_scene_set_end(scene);
    }
}

/* The finger (DGX-DI's touch): drawn sideways, a column for each column it goes; a swipe down drops; a tap turns. */
static dgx_di_touch_t touch;
static bool           steered; /* this touch has done what it does */
static int            swipe_px, cell_px, drawn_x;

static void control(dgx_ge_input_t *input, uint32_t real, uint32_t now)
{
    static uint32_t repeat_ms;
    if (touch.pressed) steered = false, drawn_x = touch.x;
    const bool tap = touch.released && !steered && !touch.told;
    const bool go  = input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_A);
    const int  ph  = phase();
    if (!paused && (ph == TETRIS_PH_TITLE || ph == TETRIS_PH_OVER)) {
        if (go || tap) dgx_ge_actor_event(&play, TETRIS_PLAY_EVENT_START, now, say, NULL); /* PLAY: SIG_NEW empties the well */
        return;
    }
    if (paused) {
        /* the talk goes by real time, what it tells lands at the game's moment (it stands) */
        if (input->pressed & DGX_GE_KEY_UP) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_PREV, real, now);
        if (input->pressed & DGX_GE_KEY_DOWN) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_NEXT, real, now);
        if (go) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_ACTIVATE, real, now);
        if (input->pressed & DGX_GE_KEY_LEFT) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_LESS, real, now);
        if (input->pressed & DGX_GE_KEY_RIGHT) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_MORE, real, now);
        if (input->pressed & (DGX_GE_KEY_B | DGX_GE_KEY_BACK)) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_BACK, real, now);
        if (!steered || !(touch.down || touch.released)) dgx_ge_talk_view_pointer(&view, &talk, &input->pointer, real, now);
        dgx_ge_input_spend(input, input->pressed); /* what the dialog took moves nothing */
        return;
    }
    if ((input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_BACK)) || (touch.long_press && !steered)) {
        steered = true; /* the finger that paused does not answer the dialog as it goes up */
        dgx_ge_actor_t *roles[] = {&play};
        dgx_ge_cast_t   cast    = {.roles = roles, .game = &play, .kinds = &kinds}; /* kinds: the sliders */
        dgx_ge_talk_start(&talk, &pause_dialog, &cast, TETRIS_STYLE_MENU, real, now, say, NULL);
        if (sound.play) dgx_ge_mixer_music_level(&mixer, 40, 300); /* the music lower under the dialog */
        paused        = true;
        dgx_ge_actor_event(&message, TETRIS_EVENT_PAUSED, now, say, NULL);
        dgx_ge_input_spend(input, input->pressed);
        return;
    }
    if (ph != TETRIS_PH_PLAYING) return;
    /* the buttons: left and right again and again while held, up or A turns, B or X drops, down falls faster */
    const int dir = input->held & DGX_GE_KEY_LEFT ? -1 : input->held & DGX_GE_KEY_RIGHT ? 1 : 0;
    if (input->pressed & (DGX_GE_KEY_LEFT | DGX_GE_KEY_RIGHT)) {
        shift(dir, now);
        repeat_ms = now + (uint32_t)dgx_ge_game_value(&game, TETRIS_GAME_REPEAT_AFTER_MS, 170);
    } else if (dir && (int32_t)(now - repeat_ms) >= 0) {
        shift(dir, now);
        repeat_ms = now + (uint32_t)dgx_ge_game_value(&game, TETRIS_GAME_REPEAT_MS, 50);
    }
    if (input->pressed & (DGX_GE_KEY_UP | DGX_GE_KEY_A)) rotate(now);
    if (input->pressed & (DGX_GE_KEY_B | DGX_GE_KEY_X)) {
        hard_drop(now);
        return;
    }
    /* the finger */
    if (touch.down && !steered) {
        while (touch.x - drawn_x >= cell_px && shift(1, now)) drawn_x += cell_px;
        while (drawn_x - touch.x >= cell_px && shift(-1, now)) drawn_x -= cell_px;
        if (touch.x - touch.from_x >= swipe_px || touch.from_x - touch.x >= swipe_px) steered = true; /* moved: no tap */
    }
    const int dy = touch.y - touch.from_y;
    if ((touch.down || touch.released) && !steered && dy >= 3 * swipe_px && dy > 2 * (touch.x - touch.from_x < 0 ? touch.from_x - touch.x : touch.x - touch.from_x)) {
        steered = true;
        hard_drop(now);
        return;
    }
    if (tap) rotate(now);
    /* down held: it falls faster (FALL reads soft), from now */
    const bool down = input->held & DGX_GE_KEY_DOWN;
    if (down != (dgx_ge_var(&vars, TETRIS_GAME_VAR_SOFT) != 0)) {
        dgx_ge_var_set(&vars, TETRIS_GAME_VAR_SOFT, down);
        if (down) dgx_ge_actor_event(&falling, TETRIS_EVENT_HURRY, now, say, NULL);
    }
}

void app_main(void)
{
    board_t board_hw;
    if (!board_display_init(&board_hw)) {
        ESP_LOGE(TAG, "no display");
        return;
    }
    if (!dgx_ge_pack_open(&pack, tetris_pack_start, (size_t)(tetris_pack_end - tetris_pack_start))) {
        ESP_LOGE(TAG, "the pack does not hold together");
        return;
    }
    size_t         size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_SCENE_WELL, &size);
    if (!blob || !dgx_ge_layout_open(&layout, blob, size)) {
        ESP_LOGE(TAG, "no scene well");
        return;
    }
    blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_GAME, &size);
    if (!blob || !dgx_ge_game_open(&game, blob, size)) {
        ESP_LOGE(TAG, "no numbers of the game");
        return;
    }
    dgx_screen_t *lcd = board_hw.lcd;
    const int     w = TETRIS_SCREEN_WIDTH, h = TETRIS_SCREEN_HEIGHT;
    frame               = dgx_ge_frame_fit(lcd, w, h, 0, board_band);
    dgx_ge_layout_grid_t lw, ln;
    if (!dgx_ge_layout_grid(&layout, TETRIS_SCENE_WELL_GRID_WELL, &lw) || !dgx_ge_layout_grid(&layout, TETRIS_SCENE_WELL_GRID_NEXT, &ln) ||
        lw.cols > COLS_MAX || lw.rows > ROWS_MAX || ln.cols * ln.rows > 8) {
        ESP_LOGE(TAG, "no grids well and next");
        return;
    }
    scene = frame ? dgx_ge_scene_create(frame, layout.layers, lw.cols * lw.rows + 64, 64) : NULL;
    if (!scene) {
        ESP_LOGE(TAG, "no memory for the frame");
        return;
    }
    /* the colors of every set (the paper of the frame is the scene's, laid with it) */
    dgx_ge_frame_pack_colors(frame, &pack, maps, sizeof maps, map_of);
    dgx_ge_scene_reset(scene, 0);

    const uint8_t *ts = dgx_ge_pack_blob(&pack, lw.tiles, &size);
    if (!ts || !dgx_ge_tileset_open(&tiles, &pack, ts, size)) {
        ESP_LOGE(TAG, "no tiles");
        return;
    }
    cols = lw.cols, rows = lw.rows;
    dgx_ge_layout_grid_set(&lw, &well, &tiles, well_cells);
    well.maps = map_of, well.mods = well_mods, well.laid = well_laid;
    dgx_ge_layout_grid_set(&ln, &next, &tiles, next_cells);
    next.maps = map_of, next.mods = next_mods, next.laid = next_laid;
    /* the cells start empty: the editor's are a picture of a moment of a game */
    memset(well_cells, 0, sizeof well_cells);
    memset(next_cells, 0, sizeof next_cells);

    dgx_ge_kinds_init(&kinds, &pack, 8);
    uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
    seed         = now | 1;
    dgx_ge_actor_start(&play, dgx_ge_kind(&kinds, TETRIS_BLOB_PLAY), TETRIS_PLAY_SCRIPT_IDLE, 0, 0, now); /* its phase: the title */
    dgx_ge_actor_start(&prompt, dgx_ge_kind(&kinds, TETRIS_BLOB_WORDS), TETRIS_WORDS_SCRIPT_BLINK, w / 2, h - 30, now);
    dgx_ge_rect_t place;
    int           kind;
    if (dgx_ge_layout_zone(&layout, TETRIS_SCENE_WELL_ZONE_MESSAGE, &place, &kind))
        dgx_ge_actor_start(&message, dgx_ge_kind(&kinds, TETRIS_BLOB_WORDS), TETRIS_WORDS_SCRIPT_QUIET, place.x + place.w / 2, place.y + place.h, now);
    dgx_ge_timers_init(&timers, 4, fire, NULL);
    blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_TIMERS, &size);
    if (blob) dgx_ge_timers_define(&timers, blob, size);
    fonts[TETRIS_FONT_TERMINUSTTFMEDIUM12] = TerminusTTFMedium12();
    const uint8_t ink = map_of[TETRIS_SET_WORDS][0]; /* its first color, white: a map is by color, from 0 */
    if (dgx_ge_layout_zone(&layout, TETRIS_SCENE_WELL_ZONE_SCORE, &place, &kind))
        dgx_ge_label_init(&score_label, frame, fonts[0], place.x, place.y, place.w, place.h, DGX_GE_ALIGN_MIDDLE, TETRIS_SCENE_WELL_LAYER_TEXT, ink);
    if (dgx_ge_layout_zone(&layout, TETRIS_SCENE_WELL_ZONE_LINES, &place, &kind))
        dgx_ge_label_init(&lines_label, frame, fonts[0], place.x, place.y, place.w, place.h, DGX_GE_ALIGN_MIDDLE, TETRIS_SCENE_WELL_LAYER_TEXT, ink);
    if (dgx_ge_layout_zone(&layout, TETRIS_SCENE_WELL_ZONE_LEVEL, &place, &kind))
        dgx_ge_label_init(&level_label, frame, fonts[0], place.x, place.y, place.w, place.h, DGX_GE_ALIGN_MIDDLE, TETRIS_SCENE_WELL_LAYER_TEXT, ink);
    labels();
    blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_PAUSE, &size);
    if (!blob || !dgx_ge_dialog_open(&pause_dialog, blob, size)) ESP_LOGE(TAG, "no dialog pause");
    blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_STRINGS, &size);
    if (blob) dgx_ge_strings_open(&strings, blob, size);
    blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_STYLES, &size);
    dgx_ge_talk_view_init(&view, blob, blob ? size : 0, frame, fonts, TETRIS_FONT_COUNT);
    dgx_ge_talk_view_pictures(&view, &pack, map_of);

    bool pointing = board_pointer_start(lcd);
#ifdef GAME_CYD
    const bool cyd = !pointing && cyd_touch_start(lcd);
    pointing       = pointing || cyd;
#else
    const bool cyd = false;
#endif
    dgx_di_touch_display(&touch, lcd, board_mm_w, board_mm_h);
    swipe_px = board_mm_w > 0 ? SWIPE_MM * lcd->width / board_mm_w : 11;
    cell_px  = tiles.cell_w * frame->scale;
    const bool padded = pointing && board_pad_able && !board_buttons_able &&
                        board_pad_show(lcd, dgx_di_pad_layout_classic, dgx_di_pad_layout_classic_size, 120);
    /* the sound, where the board has it: the mixer at the board's rate, the board's task (on the computer, SDL) pulls it */
    blob = dgx_ge_pack_blob(&pack, TETRIS_BLOB_SOUNDS, &size);
    sound = board_sound_open(&mixer, &sounds, blob, size, dgx_ge_game_value(&game, TETRIS_GAME_VOICES, 4));
    dgx_ge_expr_sound = &sound; /* the music a script waits for (music in expressions) */
    blob              = dgx_ge_pack_blob(&pack, TETRIS_BLOB_VARIABLES, &size);
    if (blob && dgx_ge_vars_open(&vars, blob, size)) dgx_ge_game_vars = &vars;
    settings_load();
    volumes();
    ESP_LOGI(TAG, "a frame of %dx%d, x%d, on a display of %dx%d; %s%s%s", w, h, frame->scale, lcd->width, lcd->height, sound.play ? "sound, " : "",
             padded ? "a pad" : board_buttons_able ? "buttons" : pointing ? "a pointer" : "no input", cyd ? " (the CYD's touch)" : "");

    lay_set(true); /* the scene's paper, the title on it */
    start_title(now);
    dgx_ge_input_t     input     = {0};
    uint32_t           last  = now;
    static dgx_image_t pictures[8];
    clock_ms = now;
    for (;;) {
        const int64_t  t0   = esp_timer_get_time();
        const uint32_t real = (uint32_t)(t0 / 1000);
        if (!paused) clock_ms += real - last;
        last = real;
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

        if (paused) {
            dgx_ge_talk_view_play(&view, &talk, &strings, real, clock_ms);
            volumes();
            if (talk.state == DGX_GE_TALK_OVER) {
                paused = false;
                settings_keep();
                if (sound.play) dgx_ge_mixer_music_level(&mixer, 100, 300);
                dgx_ge_actor_event(&message, TETRIS_EVENT_RESUME, clock_ms, say, NULL);
            }
        } else {
            dgx_ge_timers_play(&timers, clock_ms);
            dgx_ge_actor_advance(&play, clock_ms, say, NULL);
            if (falling.anim) dgx_ge_actor_advance(&falling, clock_ms, say, NULL); /* the piece falls a row at each moment (while lines go, it stands: fall) */
            if (phase() == TETRIS_PH_TITLE) dgx_ge_show_play(&title, clock_ms, say, NULL);
            else {
                dgx_ge_actor_advance(&message, clock_ms, say, NULL);
                dgx_ge_actor_advance(&prompt, clock_ms, say, NULL);
            }
            /* the lines going flash: their cells laid again, drawn anew where they changed */
            if (phase() != TETRIS_PH_TITLE && !dgx_ge_grid_play(&well, scene, clock_ms)) relay_all = true;
        }
        if (phase() != TETRIS_PH_TITLE) show_well();
        if (relay_all) lay_set(false);

        dgx_ge_scene_actors_begin(scene);
        int p = 0;
        if (phase() == TETRIS_PH_TITLE) {
            dgx_ge_show_items(&title, &pack, map_of, scene, NULL, NULL);
        } else {
            dgx_ge_label_show(&score_label, scene);
            dgx_ge_label_show(&lines_label, scene);
            dgx_ge_label_show(&level_label, scene);
            dgx_ge_scene_show_actor(scene, &message, TETRIS_SCENE_WELL_LAYER_TEXT, &pack, map_of, &pictures[p++]);
            if (phase() == TETRIS_PH_OVER) dgx_ge_scene_show_actor(scene, &prompt, TETRIS_SCENE_WELL_LAYER_TEXT, &pack, map_of, &pictures[p++]);
            if (paused) dgx_ge_talk_view_show(&view, &talk, scene, TETRIS_SCENE_WELL_LAYER_TEXT);
        }
        dgx_ge_scene_render(scene);

        board_pace(t0, STEP_US); /* the rest of the step waited, a tick given up at least */
    }
}
