/*
 * Pac-Man on DGX-GE, made in the sprite editor. What the game is lies in pacman.json and its scripts (the pack the
 * build makes of it, assets/pacman.pack): the maze as cells (dots, energizers blinking by themselves, walls, the door
 * of the house), the scene with its actors and zones, the pictures and their masks; the ghosts whole (bobbing in the
 * house, out through the door, where each aims in the maze, the modes, frightened, eaten, their eyes home and in
 * again), asking the game what only it knows (game.*: where Pac-Man is, the door, the dots left); who meets whom and
 * what follows (masks, hit: caught, eaten, the fruit); the game's phases and how long each lasts, its numbers and its
 * words (the actor PLAY); the fruit; the schedule of the modes; the house letting one out when no dot is eaten for a
 * while (a timer); the sounds; the title show and the pause dialog.
 *
 * This file is what data cannot say: walking the maze from the middle of a cell to the next (dgx_ge_walk.h) toward the
 * cell a ghost aims at, the answers to the ghosts' questions, the clocks (the maze stands while PLAY's phase says so),
 * and passing on what the actors say and whom they meet.
 *
 * The same file builds for a board of the engine (idf.py: the CYD, stood up as the arcade) and for the computer
 * (make): it talks to the hardware through dgx_ge_board.h, and the CYD's touch, which the engine's board leaves out,
 * through cyd_touch.c. The touch is DGX-DI's: a swipe turns Pac-Man, a tap beside him turns him that way, a long press
 * pauses, a tap starts a game. The best score is kept in NVS (on the computer: a file).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "assets/pacman_pack.h"
#include "dgx_di.h"
#include "dgx_di_pad.h"
#include "dgx_ge_anim.h"
#include "dgx_ge_board.h"
#include "dgx_ge_dialog.h"
#include "dgx_ge_frame.h"
#include "dgx_ge_game.h"
#include "dgx_ge_graph.h"
#include "dgx_ge_input.h"
#include "dgx_ge_label.h"
#include "dgx_ge_layout.h"
#include "dgx_ge_mask.h"
#include "dgx_ge_mixer.h"
#include "dgx_ge_pack.h"
#include "dgx_ge_pockets.h"
#include "dgx_ge_scene.h"
#include "dgx_ge_show.h"
#include "dgx_ge_talk_view.h"
#include "dgx_ge_tiles.h"
#include "dgx_ge_timers.h"
#include "dgx_ge_walk.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "fonts/TerminusTTFMedium12.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#ifdef GAME_CYD
#include "cyd_touch.h"
#include "drivers/ili9341.h"
#endif

static const char *TAG = "pacman";

extern const uint8_t pacman_pack_start[] asm("_binary_pacman_pack_start");
extern const uint8_t pacman_pack_end[] asm("_binary_pacman_pack_end");

enum { STEP_US = 16000 };
enum { GHOSTS = 4, BLINKY = 0 };
enum { MAX_CELLS = 28 * 31 };
/* the bodies that meet, by their handles: Pac-Man, the ghosts, the fruit */
enum { BODY_PAC, BODY_GHOST, BODY_FRUIT = BODY_GHOST + GHOSTS, BODIES };

typedef struct {
    dgx_ge_walk_bind_t walk;  /* in the maze (its state hunting, blue, eyes): its walker moves it */
    dgx_ge_actor_t     actor; /* all else: its scripts (GHOST) */
} ghost_t;

static dgx_ge_pack_t      pack;
static uint8_t            maps[PACMAN_SET_COUNT][16];
static const uint8_t     *map_of[PACMAN_SET_COUNT];
static dgx_image_t        images[PACMAN_IMG_COUNT];
static dgx_ge_frame_t    *frame;
static dgx_ge_scene_t    *scene;
static dgx_ge_kinds_t     kinds;
static dgx_ge_layout_t    layout;
static dgx_image_t        layout_images[8];
static dgx_ge_tileset_t   tiles;
static dgx_ge_grid_t      grid;
static const uint16_t    *maze_cells; /* the maze as laid in the editor */
static uint16_t           cells[MAX_CELLS];
static uint16_t           laid[MAX_CELLS + 1];
static int                cols, rows, cell;
static dgx_ge_walk_grid_t ways;
static dgx_ge_game_t      game;
static dgx_ge_actor_t     play;  /* the game's own actor: PLAY, shown in the zone message */
static dgx_ge_actor_t     modes; /* the schedule of the ghosts' modes: MODES */
static dgx_ge_actor_t     pac;
static dgx_ge_walk_bind_t pac_walk; /* his walker moves him */
static ghost_t            ghosts[GHOSTS];
static dgx_ge_actor_t     fruit;
static dgx_ge_actor_t     prompt; /* PRESS START, blinking under GAME OVER */
static dgx_ge_collisions_t *bodies;
static dgx_ge_timers_t    timers;
static dgx_ge_show_t      title;
static dgx_ge_label_t     score_label, high_label, points_label;
static dgx_ge_dialog_t    pause_dialog;
static dgx_ge_strings_t   strings;
static dgx_ge_talk_t      talk;
static dgx_ge_talk_view_t view;
static dgx_font_t        *fonts[PACMAN_FONT_COUNT];
static dgx_ge_sounds_t    sounds;
static dgx_ge_mixer_t     mixer;
static dgx_ge_sound_t     sound; /* the mixer as the game's output; none: nothing plays */

/* the places of the scene the game takes from the editor's, points of the scene: the door of the house, its middle */
static int           door_x, door_y, inside_y;
static dgx_ge_rect_t lives_zone;

/*
 * The clocks: the game's (PLAY, its timer, the dialog) stands while it is paused; the maze's (Pac-Man, the ghosts, the
 * fruit, the walkers) stands too while PLAY's phase says (READY!, a ghost eaten, caught, the level eaten); the
 * schedule's stands too while a ghost is frightened.
 */
static uint32_t game_ms, maze_ms, modes_ms;
static bool     paused;
static uint8_t  mode = PACMAN_SCATTER;
static bool     relay_all;
static bool     white; /* the maze flashing as a level is cleared */
static int      dots_left;
static uint32_t points_until;
static int      eaten_ghost = -1;
static uint32_t high, high_kept;
static bool     stored; /* NVS is there */
static uint32_t seed = 1;

static int32_t number(int index, int32_t otherwise)
{
    return dgx_ge_game_value(&game, index, otherwise);
}

static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx);

static void tell(dgx_ge_actor_t *actor, int event, uint32_t at_ms)
{
    dgx_ge_actor_event(actor, event, at_ms, say, NULL);
}

static int phase(void)
{
    return (int)play.params[PACMAN_PLAY_PARAM_PHASE];
}

/* ---- the maze ---- */

static int cell_at(int col, int row)
{
    if (row < 0 || row >= rows) return PACMAN_MAZE_TILE_WALL;
    col = (col % cols + cols) % cols; /* the tunnel */
    return cells[row * cols + col];
}

/* The cell a point of the scene is in (past the edges too: the tunnel). */
static void cell_of(int x, int y, int *col, int *row)
{
    y -= grid.y;
    *col = (x < 0 ? x - cell + 1 : x) / cell;
    *row = (y < 0 ? y - cell + 1 : y) / cell;
}

/* Into a cell by a side: not a wall, not the door (the house is the ghosts' own scripts); a ghost hunting does not turn up from four cells. */
static bool open(const dgx_ge_walker_t *w, int col, int row, int side, void *ctx)
{
    (void)ctx;
    const int c = cell_at(col, row);
    if (c == PACMAN_MAZE_TILE_WALL || c == PACMAN_MAZE_TILE_DOOR) return false;
    if (w->kind && side == DGX_GE_SIDE_UP && ghosts[w->kind - 1].actor.params[PACMAN_GHOST_PARAM_STATE] == PACMAN_ST_HUNTING)
        for (int i = 0; i < 4; ++i) /* the game's numbers no_up_<n>_col, _row */
            if (number(PACMAN_GAME_NO_UP_1_COL + 2 * i, -1) == col && number(PACMAN_GAME_NO_UP_1_ROW + 2 * i, -1) == row + 1) return false;
    return true;
}

/* The set of the scene laid anew (the maze white as a level is cleared, the dots as they are), drawn anew where it changed: the places, or all (n < 0). */
static void lay_set(const dgx_ge_rect_t *places, int n)
{
    map_of[PACMAN_SET_MAZE] = maps[white ? PACMAN_SET_MAZE_WHITE : PACMAN_SET_MAZE];
    dgx_ge_scene_set_begin(scene);
    dgx_ge_layout_scene(&layout, scene, &pack, map_of, layout_images);
    dgx_ge_grid_add(&grid, scene);
    dgx_ge_scene_set_end(scene);
    if (n < 0) dgx_ge_scene_invalidate(scene, 0, dgx_ge_rect(0, 0, dgx_ge_frame_width(frame), dgx_ge_frame_height(frame)));
    for (int i = 0; i < n; ++i) dgx_ge_scene_invalidate(scene, 0, places[i]);
    relay_all = false;
}

/* The dots again, as the editor laid them. */
static void fill_dots(void)
{
    dots_left = 0;
    for (int i = 0; i < cols * rows; ++i) {
        cells[i] = maze_cells[i];
        dots_left += cells[i] == PACMAN_MAZE_TILE_DOT || cells[i] == PACMAN_MAZE_TILE_ENERGIZER;
    }
}

/* In a zone of the scene of a kind (the tunnels): the cell's middle in it. */
static bool in_zones(int kind, int col, int row)
{
    const int x = col * cell + cell / 2, y = grid.y + row * cell + cell / 2;
    for (int i = 0; i < layout.zones; ++i) {
        dgx_ge_rect_t r;
        int           k;
        if (dgx_ge_layout_zone(&layout, i, &r, &k) && k == kind && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
    }
    return false;
}

/* ---- the ghosts ---- */

static ghost_t *ghost_of(const void *actor)
{
    for (int i = 0; i < GHOSTS; ++i)
        if (actor == &ghosts[i].actor) return &ghosts[i];
    return NULL;
}

static int state_of(const ghost_t *g)
{
    return (int)g->actor.params[PACMAN_GHOST_PARAM_STATE];
}

static bool frightened(void)
{
    for (int i = 0; i < GHOSTS; ++i)
        if (state_of(&ghosts[i]) == PACMAN_ST_BLUE) return true;
    return false;
}

/* The first ghost still in the house, by their order (who), -1 none. */
static int next_home(void)
{
    for (int i = 0; i < GHOSTS; ++i)
        if (state_of(&ghosts[i]) == PACMAN_ST_HOUSE) return i;
    return -1;
}

/* What a ghost asks (game.<name> of GHOST) of itself: only the game knows it. */
static float ask(int what, const dgx_ge_actor_t *who, void *ctx)
{
    (void)ctx;
    const ghost_t *g = ghost_of(who);
    int            col, row;
    switch (what) {
    case PACMAN_GHOST_GAME_PAC_COL:
    case PACMAN_GHOST_GAME_PAC_ROW:
        cell_of(dgx_ge_actor_x(&pac), dgx_ge_actor_y(&pac), &col, &row);
        return what == PACMAN_GHOST_GAME_PAC_COL ? col : row;
    case PACMAN_GHOST_GAME_PAC_WAY: return pac_walk.side < 0 ? DGX_GE_SIDE_LEFT : pac_walk.side; /* the way he goes, or went last */
    case PACMAN_GHOST_GAME_BLINKY_COL:
    case PACMAN_GHOST_GAME_BLINKY_ROW:
        cell_of(dgx_ge_actor_x(&ghosts[BLINKY].actor), dgx_ge_actor_y(&ghosts[BLINKY].actor), &col, &row);
        return what == PACMAN_GHOST_GAME_BLINKY_COL ? col : row;
    case PACMAN_GHOST_GAME_COL:
    case PACMAN_GHOST_GAME_ROW:
    case PACMAN_GHOST_GAME_TUNNEL:
        if (!g) return 0;
        cell_of(dgx_ge_actor_x(&g->actor), dgx_ge_actor_y(&g->actor), &col, &row);
        if (what == PACMAN_GHOST_GAME_TUNNEL) return in_zones(PACMAN_ZONE_TUNNEL, col, row);
        return what == PACMAN_GHOST_GAME_COL ? col : row;
    case PACMAN_GHOST_GAME_MODE: return mode;
    case PACMAN_GHOST_GAME_DOTS_LEFT: return dots_left;
    case PACMAN_GHOST_GAME_NEXT_HOME: return next_home();
    case PACMAN_GHOST_GAME_EATEN: return play.params[PACMAN_PLAY_PARAM_EATEN];
    case PACMAN_GHOST_GAME_DOOR_COL: return door_x / cell;
    case PACMAN_GHOST_GAME_DOOR_ROW: return (door_y - grid.y) / cell;
    case PACMAN_GHOST_GAME_DOOR_X: return door_x;
    case PACMAN_GHOST_GAME_DOOR_Y: return door_y;
    case PACMAN_GHOST_GAME_INSIDE_Y: return inside_y;
    default: return 0;
    }
}

/* At the middle of a cell: toward the cell it aims at (its scripts say); its eyes at the door go in, its own path from there. */
static void ghost_arrive(dgx_ge_walker_t *w, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    ghost_t       *g = &ghosts[w->kind - 1];
    const int32_t *p = g->actor.params;
    if (p[PACMAN_GHOST_PARAM_STATE] == PACMAN_ST_EYES && w->row == (door_y - grid.y) / cell && (w->col == door_x / cell || w->col == door_x / cell - 1)) {
        g->walk.actor = NULL;
        tell(&g->actor, PACMAN_EVENT_ENTER, at_ms);
        return;
    }
    w->want = (int8_t)dgx_ge_walk_toward(w, &ways, p[PACMAN_GHOST_PARAM_TCOL], p[PACMAN_GHOST_PARAM_TROW]);
}

/* Out of the house (its script says): its walker moves it from above the door, going left. */
static void ghost_out(ghost_t *g, uint32_t at_ms)
{
    dgx_ge_walk_bind_start(&g->walk, &g->actor, &ways, DGX_GE_SIDE_LEFT, at_ms);
}

/* Back the way it goes, at once (the modes change, a fright begins). */
static void reverse(ghost_t *g, uint32_t now)
{
    const int s = state_of(g);
    if ((s != PACMAN_ST_HUNTING && s != PACMAN_ST_BLUE) || g->walk.walker.dir < 0) return;
    dgx_ge_walk_bind_want(&g->walk, &ways, g->walk.walker.dir ^ 1, now, ghost_arrive, say, NULL);
}

static void frighten(uint32_t now)
{
    for (int i = 0; i < GHOSTS; ++i) {
        reverse(&ghosts[i], now);
        tell(&ghosts[i].actor, PACMAN_EVENT_FRIGHT, now); /* blue, then flashing: its scripts (hunting or blue already) */
    }
}

static void hide_all(uint32_t now)
{
    for (int i = 0; i < GHOSTS; ++i) tell(&ghosts[i].actor, PACMAN_EVENT_HIDE, now);
    tell(&fruit, PACMAN_EVENT_HIDE, now);
}

/* ---- Pac-Man ---- */

/* What PLAY's score was before it was told something: the points it gave are shown where it happened. */
static void points_at(const dgx_ge_actor_t *where, int32_t before)
{
    char s[12];
    snprintf(s, sizeof s, "%ld", (long)(play.params[PACMAN_PLAY_PARAM_SCORE] - before));
    points_label.x = (int16_t)(dgx_ge_actor_x(where) - 16), points_label.y = (int16_t)(dgx_ge_actor_y(where) - 7);
    dgx_ge_label_set(&points_label, s);
    points_until = game_ms + (uint32_t)number(PACMAN_GAME_POINTS_MS, 1500);
}

/* At the middle of a cell: what is there is eaten, PLAY told. */
static void pac_arrive(dgx_ge_walker_t *w, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (w->row < 0 || w->row >= rows || w->col < 0 || w->col >= cols) return;
    const int i = w->row * cols + w->col, c = cells[i];
    if (c != PACMAN_MAZE_TILE_DOT && c != PACMAN_MAZE_TILE_ENERGIZER) return;
    const bool energizer = c == PACMAN_MAZE_TILE_ENERGIZER;
    cells[i]             = 0;
    if (!relay_all && !dgx_ge_grid_relay(&grid, scene, w->col, w->row, true)) relay_all = true;
    --dots_left;
    w->at_ms += (uint32_t)number(energizer ? PACMAN_GAME_ENERGIZER_PAUSE_MS : PACMAN_GAME_DOT_PAUSE_MS, 0); /* he stands a moment eating it */
    if (energizer) frighten(at_ms);
    tell(&play, energizer ? PACMAN_EVENT_ENERGIZER : PACMAN_EVENT_DOT, game_ms);
}

/* ---- the game ---- */

/* Everyone where the editor put them, as at the start of a life: the ghosts and the fruit in their first scripts. */
static void put_actors(uint32_t now)
{
    /* he is told the way he goes (his scripts chomp that way) and that he stands; his speed is the game's */
    dgx_ge_layout_actor_start(&layout, PACMAN_SCENE_MAZE_ACTOR_PAC, &pac, &kinds, now);
    pac_walk = (dgx_ge_walk_bind_t){.dy = (int16_t)grid.y, .turn = PACMAN_EVENT_LEFT, .stop = PACMAN_EVENT_STOP, .speed = -1, .way = -1};
    pac_walk.walker.speed  = (uint32_t)number(PACMAN_GAME_PAC_SPEED, 0);
    pac_walk.walker.corner = (uint8_t)number(PACMAN_GAME_CORNER_POINTS, 0);
    dgx_ge_walk_bind_start(&pac_walk, &pac, &ways, DGX_GE_SIDE_LEFT, now);
    /* a ghost is told its way (its param way too, for after a fright); its speed is its param's */
    for (int i = 0; i < GHOSTS; ++i) {
        ghost_t *g = &ghosts[i];
        g->walk    = (dgx_ge_walk_bind_t){
               .dy = (int16_t)grid.y, .turn = PACMAN_EVENT_LEFT, .stop = -1, .speed = PACMAN_GHOST_PARAM_SPEED, .way = PACMAN_GHOST_PARAM_WAY};
        g->walk.walker.kind = (uint8_t)(i + 1);
        dgx_ge_layout_actor_start(&layout, PACMAN_SCENE_MAZE_ACTOR_BLINKY + i, &g->actor, &kinds, now);
    }
    dgx_ge_layout_actor_start(&layout, PACMAN_SCENE_MAZE_ACTOR_FRUIT, &fruit, &kinds, now);
    const dgx_ge_anim_t *m = dgx_ge_kind(&kinds, PACMAN_BLOB_MODES);
    if (m) dgx_ge_actor_start(&modes, m, PACMAN_MODES_SCRIPT_SCHEDULE, 0, 0, modes_ms);
    mode         = PACMAN_SCATTER;
    eaten_ghost  = -1;
    points_until = 0;
}

static void numbers(void)
{
    const int32_t s = play.params[PACMAN_PLAY_PARAM_SCORE];
    if (s > (int32_t)high) high = (uint32_t)s;
    dgx_ge_label_number(&score_label, s);
    dgx_ge_label_number(&high_label, (long)high);
}

/* The best score over a restart, in NVS (on the computer: a file, the engine's boards/host/host_nvs.c). */
static void high_load(void)
{
    esp_err_t e = nvs_flash_init();
    if (e == ESP_ERR_NVS_NO_FREE_PAGES || e == ESP_ERR_NVS_NEW_VERSION_FOUND) e = nvs_flash_erase() == ESP_OK ? nvs_flash_init() : e;
    stored = e == ESP_OK;
    nvs_handle_t h;
    if (stored && nvs_open("pacman", NVS_READONLY, &h) == ESP_OK) {
        if (nvs_get_u32(h, "high", &high) != ESP_OK) high = 0;
        nvs_close(h);
    }
    high_kept = high;
}

static void high_keep(void)
{
    nvs_handle_t h;
    if (high == high_kept || !stored || nvs_open("pacman", NVS_READWRITE, &h) != ESP_OK) return;
    nvs_set_u32(h, "high", high);
    nvs_commit(h);
    nvs_close(h);
    high_kept = high;
}

static void start_title(void)
{
    dgx_ge_scene_reset(scene, 0);
    size_t         size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_TITLE, &size);
    if (blob && dgx_ge_show_open(&title, blob, size) && dgx_ge_show_start(&title, &kinds, game_ms)) {
        dgx_ge_scene_set_begin(scene);
        dgx_ge_show_backdrop(&title, &pack, map_of, scene);
        dgx_ge_scene_set_end(scene);
    }
}

/* What the actors say (and the dialog's tell to PLAY): their sounds, PLAY's timer, the modes, their signals. */
static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (what == DGX_GE_ANIM_SOUND) {
        dgx_ge_sound_play(&sound, value);
        return;
    }
    if (actor == &play && what >= DGX_GE_ANIM_TIMER_START && what <= DGX_GE_ANIM_TIMER_GO) {
        dgx_ge_timers_said(&timers, what, value, DGX_GE_OWNER_ACTOR, 0, 0, 0, at_ms);
        return;
    }
    if (what != DGX_GE_ANIM_SIGNAL) return;
    if (actor == &modes) {
        if ((value != PACMAN_SCATTER && value != PACMAN_CHASE) || value == mode) return;
        mode = value;
        for (int i = 0; i < GHOSTS; ++i)
            if (state_of(&ghosts[i]) == PACMAN_ST_HUNTING) reverse(&ghosts[i], maze_ms); /* the arcade's ghosts turn round as the mode changes */
        return;
    }
    ghost_t      *g = ghost_of(actor);
    const int32_t before = play.params[PACMAN_PLAY_PARAM_SCORE];
    switch (value) {
    case PACMAN_SIG_NUMBERS: numbers(); break;
    case PACMAN_SIG_LAY:
        if (title.cast) dgx_ge_show_stop(&title);
        white = false;
        fill_dots();
        lay_set(NULL, -1);
        break;
    case PACMAN_SIG_PLACE: put_actors(maze_ms); break;
    case PACMAN_SIG_DIE:
        tell(&pac, PACMAN_EVENT_DIE, maze_ms);
        hide_all(maze_ms);
        break;
    case PACMAN_SIG_HIDE: hide_all(maze_ms); break;
    case PACMAN_SIG_WHITE:
    case PACMAN_SIG_BLUE:
        white = value == PACMAN_SIG_WHITE;
        lay_set(NULL, -1);
        break;
    case PACMAN_SIG_FRUIT: tell(&fruit, PACMAN_EVENT_SHOW, maze_ms); break;
    case PACMAN_SIG_RELEASE: {
        const int i = next_home();
        if (i >= 0) tell(&ghosts[i].actor, PACMAN_EVENT_LEAVE, maze_ms);
        break;
    }
    case PACMAN_SIG_OVER: high_keep(); break;
    case PACMAN_SIG_TITLE: start_title(); break;
    case PACMAN_SIG_OUT:
        if (g) ghost_out(g, at_ms);
        break;
    case PACMAN_SIG_EATEN: /* PLAY counts it, its points where it was; all stands a while but its eyes */
        if (!g) break;
        tell(&play, PACMAN_EVENT_GHOST, game_ms);
        points_at(&g->actor, before);
        eaten_ghost = (int)(g - ghosts);
        break;
    case PACMAN_SIG_CAUGHT: tell(&play, PACMAN_EVENT_CAUGHT, game_ms); break;
    case PACMAN_SIG_GONE: tell(&play, PACMAN_EVENT_LOST, game_ms); break;
    case PACMAN_SIG_TAKEN:
        tell(&play, PACMAN_EVENT_FRUIT, game_ms);
        points_at(&fruit, before);
        break;
    default: break;
    }
}

/* A timer of the pack gone off: its event to PLAY, which owns it. */
static void fire(const dgx_ge_timer_t *timer, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (timer->event != 0xFF) tell(&play, timer->event, at_ms);
}

/* ---- who meets whom ---- */

static dgx_ge_actor_t *body_actor(int handle)
{
    return handle == BODY_PAC ? &pac : handle == BODY_FRUIT ? &fruit : &ghosts[handle - BODY_GHOST].actor;
}

/* A hit their scripts say (caught, eaten, the fruit) is sent while the game plays: one that stands it all stops the rest. */
static dgx_ge_hit_verdict_t judge(int by, dgx_ge_actor_t *actor, int on, dgx_ge_actor_t *other, dgx_ge_hit_t *hit, void *ctx)
{
    (void)by, (void)actor, (void)on, (void)other, (void)hit, (void)ctx;
    return phase() == PACMAN_PH_PLAYING ? DGX_GE_HIT_SEND : DGX_GE_HIT_STOP;
}

/* The bodies as they are drawn (Pac-Man's side apart from the others'), and what those that meet do to each other. */
static void look(void)
{
    for (int i = 0; i < BODIES; ++i) dgx_ge_collisions_set_actor(bodies, i, &pack, body_actor(i), (uint16_t)(i + 1), i == BODY_PAC ? 1 : 2);
    dgx_ge_collisions_hits(bodies, maze_ms, judge, say, NULL);
}

/* The maze on to now: Pac-Man and the ghosts walked, the schedule, who meets whom. */
static void playing(uint32_t now)
{
    pac_walk.walker.speed = (uint32_t)number(frightened() ? PACMAN_GAME_PAC_FRIGHT_SPEED : PACMAN_GAME_PAC_SPEED, 0);
    dgx_ge_walk_bind_play(&pac_walk, &ways, now, pac_arrive, say, NULL);
    dgx_ge_actor_advance(&modes, modes_ms, say, NULL);
    for (int i = 0; i < GHOSTS; ++i)
        if (ghosts[i].walk.actor) dgx_ge_walk_bind_play(&ghosts[i].walk, &ways, now, ghost_arrive, say, NULL);
}

/* ---- the screen ---- */

/* A picture of the pack as an actor of this frame: in the colors of a set (its own: set -1). */
static void put(int image, int x, int y, int set, int layer)
{
    if (image < 0 || image >= PACMAN_IMG_COUNT) return;
    const int     s  = set >= 0 ? set : dgx_ge_pack_image_set(&pack, image);
    dgx_ge_item_t it = {.image = &images[image], .map = maps[s], .x = (int16_t)x, .y = (int16_t)y, .layer = (uint8_t)layer};
    dgx_ge_scene_actor(scene, &it);
}

static void put_actor(const dgx_ge_actor_t *actor, int set, int layer)
{
    put(actor->image, dgx_ge_actor_x(actor), dgx_ge_actor_y(actor), set, layer);
}

/* A ghost's colors: Blinky's are its kind's own, the others' the palettes of the pack, by its param who. */
static int ghost_set(const ghost_t *g)
{
    static const int sets[GHOSTS] = {PACMAN_SET_GHOST, PACMAN_SET_PINKY, PACMAN_SET_INKY, PACMAN_SET_CLYDE};
    const int        who          = (int)g->actor.params[PACMAN_GHOST_PARAM_WHO];
    return sets[who >= 0 && who < GHOSTS ? who : 0];
}

static void show_game(void)
{
    const int layer = PACMAN_SCENE_MAZE_LAYER_ACTORS, text = PACMAN_SCENE_MAZE_LAYER_TEXT;
    const int ph    = phase();
    for (int i = 0; i < GHOSTS; ++i)
        if (ph != PACMAN_PH_ATE || i != eaten_ghost) put_actor(&ghosts[i].actor, ghost_set(&ghosts[i]), layer);
    if (ph != PACMAN_PH_ATE) put_actor(&pac, -1, layer);
    put_actor(&fruit, -1, layer);
    /* the lives left, in their zone */
    for (int k = 0; k + 1 < play.params[PACMAN_PLAY_PARAM_LIVES] && k < 5; ++k)
        put(PACMAN_IMG_PAC_LEFT_1, lives_zone.x + 8 + k * 16, lives_zone.y + lives_zone.h / 2, -1, layer);
    put_actor(&play, -1, text); /* its word: READY!, GAME OVER */
    if (ph == PACMAN_PH_OVER) put_actor(&prompt, -1, text);
    if (points_until && (int32_t)(game_ms - points_until) >= 0) points_until = 0;
    if (!points_until) dgx_ge_label_set(&points_label, "");
    dgx_ge_label_show(&score_label, scene);
    dgx_ge_label_show(&high_label, scene);
    dgx_ge_label_show(&points_label, scene);
    if (paused) dgx_ge_talk_view_show(&view, &talk, scene, (uint8_t)text);
}

/* ---- the hand ---- */

/*
 * The finger (DGX-DI's touch: where it went down, where it is, a long press). A swipe is SWIPE_MM along an axis,
 * while the finger is down or where it went up (a quick swipe on a resistive panel gives a point or two before it
 * lifts), once a touch; a touch let go short of that is a tap. DGX-DI's own swipe is longer (DGX_DI_SWIPE_TRAVEL_MM)
 * and told as it is let go: too late to turn at a corner.
 */
enum { SWIPE_MM = 2 };
static dgx_di_touch_t touch;
static bool           steered;
static int            swipe_px;

static int way_to(int dx, int dy)
{
    if ((dx < 0 ? -dx : dx) > (dy < 0 ? -dy : dy)) return dx > 0 ? DGX_GE_SIDE_RIGHT : DGX_GE_SIDE_LEFT;
    return dy > 0 ? DGX_GE_SIDE_DOWN : DGX_GE_SIDE_UP;
}

static int swipe_way(void)
{
    const int dx = touch.x - touch.from_x, dy = touch.y - touch.from_y;
    if (!(touch.down || touch.released) || steered || ((dx < 0 ? -dx : dx) < swipe_px && (dy < 0 ? -dy : dy) < swipe_px)) return -1;
    steered = true;
    return way_to(dx, dy);
}

/* A tap beside Pac-Man: the way from him to it. */
static int tap_way(void)
{
    int x = 0, y = 0;
    if (!dgx_ge_scene_point_at(scene, 0, touch.x, touch.y, &x, &y)) return -1;
    return way_to(x - dgx_ge_actor_x(&pac), y - dgx_ge_actor_y(&pac));
}

static void control(dgx_ge_input_t *input, uint32_t real)
{
    if (touch.pressed) steered = false;
    const int  ph     = phase();
    const int  swiped = !paused && (ph == PACMAN_PH_PLAYING || ph == PACMAN_PH_READY) ? swipe_way() : -1;
    const bool tap    = touch.released && !steered && !touch.told;
    const bool go     = input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_A);
    if (paused) {
        talk.ahead_ms = real - game_ms; /* the game stands, the talk goes on: what it tells lands at the game's moment */
        if (input->pressed & DGX_GE_KEY_UP) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_PREV, real);
        if (input->pressed & DGX_GE_KEY_DOWN) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_NEXT, real);
        if (go) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_ACTIVATE, real);
        if (input->pressed & (DGX_GE_KEY_B | DGX_GE_KEY_BACK)) dgx_ge_talk_view_event(&view, &talk, DGX_GE_UI_BACK, real);
        if (!steered || !(touch.down || touch.released)) dgx_ge_talk_view_pointer(&view, &talk, &input->pointer, real); /* not the finger that paused */
        dgx_ge_input_spend(input, input->pressed); /* what the dialog took moves nobody */
        return;
    }
    if (ph == PACMAN_PH_TITLE || ph == PACMAN_PH_OVER) {
        if (go || tap) tell(&play, PACMAN_EVENT_START, game_ms); /* PLAY knows when it is taken: not in the first second of GAME OVER */
        return;
    }
    if (ph != PACMAN_PH_PLAYING && ph != PACMAN_PH_READY) return;
    const bool held = touch.long_press && !steered;
    if ((input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_BACK)) || held) {
        steered = true; /* the finger that paused does not answer the dialog as it goes up */
        dgx_ge_actor_t *roles[] = {&play};
        dgx_ge_cast_t   cast    = {.roles = roles, .game = &play};
        dgx_ge_talk_start(&talk, &pause_dialog, &cast, PACMAN_STYLE_MENU, real, say, NULL);
        talk.ahead_ms = real - game_ms;
        paused        = true;
        dgx_ge_input_spend(input, input->pressed);
        return;
    }
    static const uint32_t keys[4] = {DGX_GE_KEY_LEFT, DGX_GE_KEY_RIGHT, DGX_GE_KEY_UP, DGX_GE_KEY_DOWN};
    int                   w       = swiped;
    if (w < 0 && tap) w = tap_way();
    for (int s = 0; s < 4 && w < 0; ++s)
        if (input->held & keys[s]) w = s;
    if (w >= 0) {
        if (ph == PACMAN_PH_PLAYING) dgx_ge_walk_bind_want(&pac_walk, &ways, w, maze_ms, pac_arrive, say, NULL);
        else pac_walk.walker.want = (int8_t)w; /* READY!: taken as he goes */
    }
}

void app_main(void)
{
    board_t board;
    if (!board_display_init(&board)) {
        ESP_LOGE(TAG, "no display");
        return;
    }
    dgx_screen_t *lcd = board.lcd;
#ifdef GAME_CYD
    /* the CYD stood up, as the arcade: the ILI9341 as it scans, a turn (the engine's board lays it down) */
    dgx_ili9341_orientation(lcd, DgxScreenLeftRight, DgxScreenTopBottom, false);
#endif
    if (!dgx_ge_pack_open(&pack, pacman_pack_start, (size_t)(pacman_pack_end - pacman_pack_start))) {
        ESP_LOGE(TAG, "the pack does not hold together");
        return;
    }
    size_t         size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_SCENE_MAZE, &size);
    if (!blob || !dgx_ge_layout_open(&layout, blob, size)) {
        ESP_LOGE(TAG, "no scene maze");
        return;
    }
    for (int i = 0; i < PACMAN_IMG_COUNT; ++i)
        if (!dgx_ge_pack_image(&pack, i, &images[i])) {
            ESP_LOGE(TAG, "no picture %d", i);
            return;
        }
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_GAME, &size);
    if (!blob || !dgx_ge_game_open(&game, blob, size)) {
        ESP_LOGE(TAG, "no numbers of the game");
        return;
    }
    /* the game's screen, the editor's: as large as the display lets it be, in its middle */
    const int w = PACMAN_SCREEN_WIDTH, h = PACMAN_SCREEN_HEIGHT;
    int       scale = lcd->width / w < lcd->height / h ? lcd->width / w : lcd->height / h;
    scale           = scale < 1 ? 1 : scale;
    frame           = dgx_ge_frame_create(lcd, (lcd->width - w * scale) / 2, (lcd->height - h * scale) / 2, w, h);
    if (frame && scale > 1 && !dgx_ge_frame_scale(frame, scale)) frame = NULL;
    if (frame && board_band) dgx_ge_frame_band(frame, board_band);
    dgx_ge_layout_grid_t lg;
    if (!dgx_ge_layout_grid(&layout, PACMAN_SCENE_MAZE_GRID_MAZE, &lg) || lg.cols * lg.rows > MAX_CELLS) {
        ESP_LOGE(TAG, "no grid maze");
        return;
    }
    scene = frame ? dgx_ge_scene_create(frame, layout.layers, lg.cols * lg.rows / 2 + 64, 48) : NULL;
    if (!scene) {
        ESP_LOGE(TAG, "no memory for the frame");
        return;
    }
    /* the colors of every set and palette (the ghosts', the maze white) */
    for (int set = 0; set < PACMAN_SET_COUNT; ++set) {
        const uint8_t (*rgb)[3];
        const int n = dgx_ge_pack_set_colors(&pack, set, &rgb);
        if (n) dgx_ge_frame_add_colors(frame, rgb, n, maps[set]);
        map_of[set] = maps[set];
    }
    dgx_ge_scene_reset(scene, 0);

    /* the maze: its set of tiles, its cells the game's own copy; the grid walkers go on */
    const uint8_t *ts = dgx_ge_pack_blob(&pack, lg.tiles, &size);
    if (!ts || !dgx_ge_tileset_open(&tiles, &pack, ts, size)) {
        ESP_LOGE(TAG, "no tiles");
        return;
    }
    cols = lg.cols, rows = lg.rows, cell = tiles.cell_w;
    maze_cells = lg.cells;
    dgx_ge_layout_grid_set(&lg, &grid, &tiles, cells);
    grid.maps = map_of;
    grid.laid = laid;
    fill_dots();
    ways = (dgx_ge_walk_grid_t){.cols = (int16_t)cols, .rows = (int16_t)rows, .cell_w = (int16_t)cell, .cell_h = (int16_t)tiles.cell_h,
                                .wrap_x = true, .open = open};
    /* the places the editor gave: the door of the house and its middle, the words of PLAY, the lives */
    bool          left;
    dgx_ge_rect_t house, message;
    int           kind;
    if (!dgx_ge_layout_entry(&layout, PACMAN_SCENE_MAZE_ENTRY_HOUSE_DOOR, &door_x, &door_y, &left) ||
        !dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_HOUSE, &house, &kind) ||
        !dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_MESSAGE, &message, &kind) ||
        !dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_LIVES, &lives_zone, &kind)) {
        ESP_LOGE(TAG, "the scene maze lacks what the game takes from it");
        return;
    }
    inside_y = house.y + house.h / 2;

    /* the kinds, the game's actor, what the scripts ask and roll, who meets whom, the timer, the labels, the dialog */
    dgx_ge_kinds_init(&kinds, &pack, number(PACMAN_GAME_KINDS, 8));
    seed            = (uint32_t)(esp_timer_get_time() / 1000) | 1;
    dgx_ge_dice     = &seed;
    dgx_ge_expr_ask = ask;
    dgx_ge_actor_start(&play, dgx_ge_kind(&kinds, PACMAN_BLOB_PLAY), PACMAN_PLAY_SCRIPT_TITLE, message.x + message.w / 2, message.y + message.h - 1,
                       game_ms);
    dgx_ge_actor_start(&prompt, dgx_ge_kind(&kinds, PACMAN_BLOB_WORDS), PACMAN_WORDS_SCRIPT_BLINK, w / 2, message.y + 40, game_ms);
    bodies = dgx_ge_collisions_create(BODIES, cell);
    dgx_ge_meets_t meets;
    if (!bodies) {
        ESP_LOGE(TAG, "no memory for the bodies");
        return;
    }
    if (dgx_ge_pack_meets(&pack, &meets)) dgx_ge_collisions_meets(bodies, &meets);
    dgx_ge_timers_init(&timers, number(PACMAN_GAME_TIMERS, 2), fire, NULL);
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_TIMERS, &size);
    if (blob) dgx_ge_timers_define(&timers, blob, size);
    fonts[PACMAN_FONT_TERMINUSTTFMEDIUM12] = TerminusTTFMedium12();
    dgx_ge_rect_t place_of;
    const uint8_t ink = maps[PACMAN_SET_WORDS][4 - 1]; /* the white of WORDS: a map has the frame's index of value v at v - 1 */
    if (dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_SCORE, &place_of, &kind))
        dgx_ge_label_init(&score_label, frame, fonts[0], place_of.x, place_of.y, place_of.w, place_of.h, DGX_GE_ALIGN_RIGHT, PACMAN_SCENE_MAZE_LAYER_TEXT, ink);
    if (dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_HIGH, &place_of, &kind))
        dgx_ge_label_init(&high_label, frame, fonts[0], place_of.x, place_of.y, place_of.w, place_of.h, DGX_GE_ALIGN_MIDDLE, PACMAN_SCENE_MAZE_LAYER_TEXT, ink);
    dgx_ge_label_init(&points_label, frame, fonts[0], 0, 0, 32, 14, DGX_GE_ALIGN_MIDDLE, PACMAN_SCENE_MAZE_LAYER_TEXT, maps[PACMAN_SET_INKY][0]);
    high_load();
    numbers();
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_PAUSE, &size);
    if (!blob || !dgx_ge_dialog_open(&pause_dialog, blob, size)) ESP_LOGE(TAG, "no dialog pause");
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_STRINGS, &size);
    if (blob) dgx_ge_strings_open(&strings, blob, size);
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_STYLES, &size);
    dgx_ge_talk_view_init(&view, blob, blob ? size : 0, frame, fonts, PACMAN_FONT_COUNT);
    dgx_ge_talk_view_pictures(&view, &pack, map_of);

    /* the sound, where the board has it: the mixer at the board's rate, the board's task (on the computer, SDL) pulls it */
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_SOUNDS, &size);
    if (board_sound_rate && blob && dgx_ge_sounds_open(&sounds, blob, size) &&
        dgx_ge_mixer_init(&mixer, &sounds, number(PACMAN_GAME_VOICES, 4), board_sound_rate, 1)) {
        if (board_sound_start(&mixer)) {
            sound = dgx_ge_mixer_output(&mixer);
            dgx_ge_mixer_volume(&mixer, board_sound_volume);
        } else dgx_ge_mixer_free(&mixer);
    }

    /* the touch: the board's (the mouse on the computer), else the CYD's own; its gestures by the display's size */
    bool pointing = board_pointer_start(lcd);
#ifdef GAME_CYD
    const bool cyd = !pointing && cyd_touch_start(lcd);
    pointing       = pointing || cyd;
    /* the board's size lying down; stood up, the other way */
    dgx_di_touch_display(&touch, lcd, board_mm_h, board_mm_w);
    swipe_px = board_mm_h > 0 ? SWIPE_MM * lcd->width / board_mm_h : 11;
#else
    const bool cyd = false;
    dgx_di_touch_display(&touch, lcd, board_mm_w, board_mm_h);
    swipe_px = board_mm_w > 0 ? SWIPE_MM * lcd->width / board_mm_w : 11;
#endif
    const bool padded = pointing && board_pad_able && !board_buttons_able &&
                        board_pad_show(lcd, dgx_di_pad_layout_classic, dgx_di_pad_layout_classic_size, 120);
    ESP_LOGI(TAG, "a frame of %dx%d, x%d, on a display of %dx%d; %s%s%s", w, h, scale, lcd->width, lcd->height, sound.play ? "sound, " : "",
             padded ? "a pad" : board_buttons_able ? "buttons" : pointing ? "a pointer" : "no input", cyd ? " (the CYD's touch)" : "");

    start_title();
    dgx_ge_input_t input = {0};
    uint32_t       last  = (uint32_t)(esp_timer_get_time() / 1000);
    for (;;) {
        const int64_t  t0   = esp_timer_get_time();
        const uint32_t real = (uint32_t)(t0 / 1000);
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
        control(&input, real);

        uint32_t dt = paused ? 0 : real - last;
        if (dt > 100) dt = 100; /* a late call: no great jump */
        last = real;
        game_ms += dt;
        if (paused) {
            talk.ahead_ms = real - game_ms;
            dgx_ge_talk_view_play(&view, &talk, &strings, real);
            if (talk.state == DGX_GE_TALK_OVER) paused = false;
        } else {
            dgx_ge_timers_play(&timers, game_ms);
            dgx_ge_actor_advance(&play, game_ms, say, NULL);
            const int ph = phase();
            if (ph == PACMAN_PH_TITLE) {
                if (dgx_ge_show_play(&title, game_ms, say, NULL)) {
                    dgx_ge_show_stop(&title);
                    start_title(); /* the title goes round */
                }
            } else {
                /* the maze moves while PLAY plays, Pac-Man dies, the game is over; the schedule stands while a ghost is blue */
                if (ph == PACMAN_PH_PLAYING || ph == PACMAN_PH_DYING || ph == PACMAN_PH_OVER) maze_ms += dt;
                if (ph == PACMAN_PH_PLAYING && !frightened()) modes_ms += dt;
                if (ph == PACMAN_PH_PLAYING) playing(maze_ms);
                dgx_ge_actor_advance(&pac, maze_ms, say, NULL);
                for (int i = 0; i < GHOSTS; ++i) dgx_ge_actor_advance(&ghosts[i].actor, maze_ms, say, NULL);
                dgx_ge_actor_advance(&fruit, maze_ms, say, NULL);
                if (ph == PACMAN_PH_PLAYING) look();
                if (ph == PACMAN_PH_OVER) dgx_ge_actor_advance(&prompt, game_ms, say, NULL);
                /* the energizers blink: the set laid anew, drawn anew where they changed */
                dgx_ge_rect_t places[8];
                const int     changed = dgx_ge_grid_animate(&grid, game_ms, places, 8);
                if (changed && !relay_all) lay_set(places, changed > 8 ? -1 : changed);
            }
        }
        if (relay_all && phase() != PACMAN_PH_TITLE) lay_set(NULL, -1);

        /* what moves in this frame */
        dgx_ge_scene_actors_begin(scene);
        if (phase() == PACMAN_PH_TITLE) dgx_ge_show_items(&title, &pack, map_of, scene, NULL, NULL);
        else show_game();
        dgx_ge_scene_render(scene);

        const int64_t spent = esp_timer_get_time() - t0;
        vTaskDelay(spent < STEP_US ? pdMS_TO_TICKS((STEP_US - spent) / 1000) + 1 : 1);
    }
}
