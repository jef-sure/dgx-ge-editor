/*
 * Pac-Man on DGX-GE, made in the sprite editor: its pictures, the maze as cells (dots, energizers, walls, the door of
 * the house), the scene with its actors and zones, the animations of Pac-Man and the ghosts, the schedule of the
 * ghosts' modes, the game's actor PLAY (the score, lives, the bonus of a ghost, the extra life, the fruit, READY and
 * the level), the speeds and times as the game's numbers, the title show and the pause dialog are data of
 * pacman.json (the pack the build makes of it, assets/pacman.pack). This file is what data cannot say: walking the
 * maze from the middle of a cell to the next (dgx_ge_walk.h), where each ghost aims (the arcade's targets, after the
 * engine author's own Pac-Man), the house, who meets whom; what happened it tells the actors, and their signals say
 * what follows.
 *
 * The same file builds for a board of the engine (idf.py: the CYD, stood up as the arcade) and for the computer
 * (make): it talks to the hardware through dgx_ge_board.h, and the CYD's touch, which the engine's board leaves out,
 * through cyd_touch.c. The touch is DGX-DI's: a swipe turns Pac-Man, a tap beside him turns him that way, a long press
 * pauses, a tap starts a game.
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
#ifdef GAME_CYD
#include "cyd_touch.h"
#include "drivers/ili9341.h"
#endif

static const char *TAG = "pacman";

extern const uint8_t pacman_pack_start[] asm("_binary_pacman_pack_start");
extern const uint8_t pacman_pack_end[] asm("_binary_pacman_pack_end");

/* what the actors signal: the constants of pacman.json (PLAY: SIG_*, MODES: SCATTER, CHASE) and their own signal 1 */
enum { SIG_NUMBERS = 1, SIG_LEVEL = 2, SIG_OVER = 3, SIG_GO = 4, SIG_FRUIT = 5, SIG_FRUIT_GONE = 6, SIG_NEW = 7 };
enum { SCATTER = 1, CHASE = 2 };
enum { STEP_US = 16000 };
enum { GHOSTS = 4, BLINKY = 0, PINKY = 1, INKY = 2, CLYDE = 3 };
enum { MAX_CELLS = 28 * 31 };
/* what the game is doing */
enum { TITLE, READY, PLAYING, ATE, CAUGHT, DYING, CLEARED, OVER, PAUSED };
/* where a ghost is: in the house (bobbing), leaving it, in the maze, its eyes going home, going in */
enum { HOME, LEAVING, OUT, EYES, ENTERING };

static const int8_t DX[4] = {-1, 1, 0, 0}, DY[4] = {0, 0, -1, 1}; /* by DGX_GE_SIDE_*: left, right, up, down */

typedef struct {
    dgx_ge_walker_t walker; /* in the maze */
    dgx_ge_actor_t  actor;  /* its looks: GHOST, its colors by its param who */
    uint8_t         where;  /* HOME .. */
    bool            fright;
    bool            fright_over; /* its animation said the fright is over: it looks its way again after the step */
    int16_t         x, y;   /* in the house and through its door: points of the maze; in the maze, the walker's */
    int16_t         home_y;
    int8_t          bob;    /* in the house: up or down */
    int8_t          dir;    /* the way it looks */
    uint16_t        dots;   /* eaten before it leaves the house */
    uint32_t        rest;
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
static dgx_ge_actor_t     play;  /* the game's own actor: PLAY */
static dgx_ge_actor_t     modes; /* the schedule of the ghosts' modes: MODES */
static dgx_ge_actor_t     pac;
static dgx_ge_walker_t    pac_walker;
static int8_t             pac_dir;
static ghost_t            ghosts[GHOSTS];
static dgx_ge_actor_t     prompt; /* PRESS START, blinking, the game over */
static dgx_ge_timers_t    timers;
static dgx_ge_show_t      title;
static dgx_ge_label_t     score_label, high_label, points_label;
static dgx_ge_dialog_t    pause_dialog;
static dgx_ge_strings_t   strings;
static dgx_ge_talk_t      talk;
static dgx_ge_talk_view_t view;
static dgx_font_t        *fonts[PACMAN_FONT_COUNT];

/* the places of the scene the game takes from the editor's: points of the maze (the grid's), but for the zones */
static int           pac_x, pac_y, door_x, door_y, inside_y;
static dgx_ge_rect_t fruit_zone, message_zone, lives_zone;

static int      state = TITLE, paused_from;
static uint32_t state_since, clock_ms, last_ms;
static uint8_t  mode = SCATTER;
static bool     relay_all;
static bool     white; /* the maze flashing as a level is cleared */
static int      dots_left, dots_eaten;
static uint32_t last_dot_ms, points_until;
static bool     fruit;
static int      eaten_ghost = -1;
static long     high;
static uint32_t seed = 1;

static int32_t number(int index, int32_t otherwise)
{
    return dgx_ge_game_value(&game, index, otherwise);
}

static uint32_t rnd(void)
{
    seed = seed * 1103515245u + 12345u;
    return seed >> 16;
}

static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx);

static void to_state(int s, uint32_t now)
{
    state = s, state_since = now;
}

/* ---- the maze ---- */

static int cell_at(int col, int row)
{
    if (row < 0 || row >= rows) return PACMAN_MAZE_TILE_WALL;
    col = (col % cols + cols) % cols; /* the tunnel */
    return cells[row * cols + col];
}

/* Into a cell by a side: not a wall, not the door (the house is walked by the game); a ghost hunting does not turn up from four cells. */
static bool open(const dgx_ge_walker_t *w, int col, int row, int side, void *ctx)
{
    (void)ctx;
    const int c = cell_at(col, row);
    if (c == PACMAN_MAZE_TILE_WALL || c == PACMAN_MAZE_TILE_DOOR) return false;
    if (w->kind && side == DGX_GE_SIDE_UP) {
        const ghost_t *g = &ghosts[w->kind - 1];
        if (!g->fright && g->where == OUT)
            for (int i = 0; i < 4; ++i) /* the game's numbers no_up_<n>_col, _row */
                if (number(PACMAN_GAME_NO_UP_1_COL + 2 * i, -1) == col && number(PACMAN_GAME_NO_UP_1_ROW + 2 * i, -1) == row + 1) return false;
    }
    return true;
}

/* The set of the scene: its pictures as laid in the editor (the maze white as a level is cleared), the dots. */
static void lay_set(void)
{
    map_of[PACMAN_SET_MAZE] = maps[white ? PACMAN_SET_MAZE_WHITE : PACMAN_SET_MAZE];
    dgx_ge_scene_set_begin(scene);
    dgx_ge_layout_scene(&layout, scene, &pack, map_of, layout_images);
    dgx_ge_grid_add(&grid, scene);
    dgx_ge_scene_set_end(scene);
    dgx_ge_scene_invalidate(scene, 0, dgx_ge_rect(0, 0, dgx_ge_frame_width(frame), dgx_ge_frame_height(frame)));
    relay_all = false;
}

/* The dots again, as the editor laid them. */
static void fill_dots(void)
{
    dots_left = 0, dots_eaten = 0;
    for (int i = 0; i < cols * rows; ++i) {
        cells[i] = maze_cells[i];
        dots_left += cells[i] == PACMAN_MAZE_TILE_DOT || cells[i] == PACMAN_MAZE_TILE_ENERGIZER;
    }
}

/* ---- the ghosts ---- */

static void ghost_xy(const ghost_t *g, int *x, int *y)
{
    if (g->where == OUT || g->where == EYES) dgx_ge_walk_xy(&g->walker, &ways, x, y);
    else *x = g->x, *y = g->y;
}

/* Its eyes look a way: the event of that way (its animation shows its way, its eyes alone that way; frightened, as it is). */
static void ghost_look(ghost_t *g, int dir, uint32_t now)
{
    if (dir < 0) return;
    g->dir = (int8_t)dir;
    if (!g->fright || g->where == EYES) dgx_ge_actor_event(&g->actor, PACMAN_EVENT_LEFT + dir, now, say, NULL);
}

/* Blinky hurrying: so few dots left ("Cruise Elroy"): 0 not, 1, 2. */
static int elroy(const ghost_t *g)
{
    if (g != &ghosts[BLINKY] || g->fright || g->where != OUT) return 0;
    return dots_left <= number(PACMAN_GAME_ELROY2_DOTS, 10) ? 2 : dots_left <= number(PACMAN_GAME_ELROY1_DOTS, 20) ? 1 : 0;
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

static uint32_t ghost_speed(const ghost_t *g)
{
    if (g->where == EYES) return (uint32_t)number(PACMAN_GAME_EYES_SPEED, 0);
    if (in_zones(PACMAN_ZONE_TUNNEL, g->walker.col, g->walker.row)) return (uint32_t)number(PACMAN_GAME_GHOST_TUNNEL_SPEED, 0);
    const int e = elroy(g);
    if (e) return (uint32_t)number(e == 2 ? PACMAN_GAME_ELROY2_SPEED : PACMAN_GAME_ELROY1_SPEED, 0);
    return (uint32_t)number(g->fright ? PACMAN_GAME_GHOST_FRIGHT_SPEED : PACMAN_GAME_GHOST_SPEED, 0);
}

/* The cell Pac-Man is in, and so many cells before him (looking up, as many to the left too: the arcade's). */
static void pac_ahead(int n, int *col, int *row)
{
    int x, y;
    dgx_ge_walk_xy(&pac_walker, &ways, &x, &y);
    const int d = pac_dir >= 0 ? pac_dir : DGX_GE_SIDE_LEFT;
    *col = x / cell + DX[d] * n, *row = y / cell + DY[d] * n;
    if (d == DGX_GE_SIDE_UP) *col -= n;
}

/* Where a ghost aims scattering: the game's numbers <ghost>_corner_col, _row, in the order of the ghosts. */
static void corner(int i, int *col, int *row)
{
    *col = number(PACMAN_GAME_BLINKY_CORNER_COL + 2 * i, 0);
    *row = number(PACMAN_GAME_BLINKY_CORNER_ROW + 2 * i, 0);
}

/* Where a ghost aims now. */
static void target(int i, int *col, int *row)
{
    const ghost_t *g = &ghosts[i];
    if (g->where == EYES) {
        *col = door_x / cell, *row = door_y / cell;
        return;
    }
    if (mode == SCATTER && !elroy(g)) { /* Blinky hurrying hunts scattering too */
        corner(i, col, row);
        return;
    }
    switch (i) {
    case PINKY: pac_ahead(4, col, row); break;
    case INKY: {
        int ac, ar, bx, by;
        pac_ahead(2, &ac, &ar);
        ghost_xy(&ghosts[BLINKY], &bx, &by);
        *col = 2 * ac - bx / cell, *row = 2 * ar - by / cell;
        break;
    }
    case CLYDE: {
        int pc, pr, x, y;
        pac_ahead(0, &pc, &pr);
        ghost_xy(g, &x, &y);
        const int dc = pc - x / cell, dr = pr - y / cell;
        if (dc * dc + dr * dr > 64) *col = pc, *row = pr;
        else corner(i, col, row);
        break;
    }
    default: pac_ahead(0, col, row); break;
    }
}

/* Back the way it goes, at once (the modes change, a fright begins). */
static void reverse(ghost_t *g, uint32_t now)
{
    if (g->where != OUT || g->walker.dir < 0) return;
    const int back = g->walker.dir ^ 1;
    dgx_ge_walk_want(&g->walker, &ways, back, now, NULL, NULL);
    ghost_look(g, back, now);
}

/* At the middle of a cell: which way next. */
static void ghost_arrive(dgx_ge_walker_t *w, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    ghost_t *g = &ghosts[w->kind - 1];
    if (g->where == EYES && w->row == door_y / cell && (w->col == door_x / cell || w->col == door_x / cell - 1)) {
        /* home: in through the door */
        int x, y;
        dgx_ge_walk_xy(w, &ways, &x, &y);
        g->x = (int16_t)x, g->y = (int16_t)y, g->where = ENTERING;
        return;
    }
    int side;
    if (g->fright && g->where == OUT) {
        /* frightened: a way at random, not back */
        side = -1;
        for (int k = 0, first = (int)(rnd() & 3); k < 4 && side < 0; ++k) {
            const int s = (first + k) & 3;
            if (w->dir >= 0 && s == (w->dir ^ 1)) continue;
            if (open(w, w->col + DX[s], w->row + DY[s], s, NULL)) side = s;
        }
    } else {
        int col, row;
        target(w->kind - 1, &col, &row);
        side = dgx_ge_walk_toward(w, &ways, col, row);
    }
    w->want  = (int8_t)side;
    w->speed = ghost_speed(g);
    if (side >= 0 && side != g->dir) ghost_look(g, side, at_ms);
}

/* A ghost out of the house into the maze, above its door, going left. */
static void ghost_out(ghost_t *g, uint32_t now)
{
    const int     col = door_x / cell, row = door_y / cell;
    const uint8_t kind = g->walker.kind;
    dgx_ge_walk_start(&g->walker, col, row, (uint32_t)number(PACMAN_GAME_GHOST_SPEED, 0), now);
    g->walker.kind = kind;
    g->walker.dir  = DGX_GE_SIDE_LEFT;
    g->walker.pos  = (door_x - (col * cell + cell / 2)) * -256; /* half a cell on its way left */
    g->where       = OUT;
    g->walker.speed = ghost_speed(g);
    ghost_look(g, DGX_GE_SIDE_LEFT, now);
}

/* Moved toward a point at a speed for so long (points a second x 256): true there. */
static bool toward(int16_t *v, int to, uint32_t speed, uint32_t dt_ms, uint32_t *rest)
{
    const uint32_t step = (speed * dt_ms + *rest) / 256000u;
    *rest               = (speed * dt_ms + *rest) % 256000u;
    if (*v < to) *v = (int16_t)(*v + (int)step > to ? to : *v + (int)step);
    else if (*v > to) *v = (int16_t)(*v - (int)step < to ? to : *v - (int)step);
    return *v == to;
}

/* The house: bobbing in it, out through the door, in again as eyes (alive again then: home). */
static void ghost_house(ghost_t *g, uint32_t dt_ms, uint32_t now)
{
    const uint32_t v = (uint32_t)number(g->where == ENTERING ? PACMAN_GAME_EYES_SPEED : PACMAN_GAME_HOUSE_SPEED, 0);
    switch (g->where) {
    case HOME:
        if (toward(&g->y, g->home_y + 4 * g->bob, v, dt_ms, &g->rest)) g->bob = (int8_t)-g->bob;
        if (g->dir != (g->bob < 0 ? DGX_GE_SIDE_UP : DGX_GE_SIDE_DOWN)) ghost_look(g, g->bob < 0 ? DGX_GE_SIDE_UP : DGX_GE_SIDE_DOWN, now);
        break;
    case LEAVING:
        if (g->x != door_x) {
            const int d = g->x < door_x ? DGX_GE_SIDE_RIGHT : DGX_GE_SIDE_LEFT;
            if (g->dir != d) ghost_look(g, d, now);
            toward(&g->x, door_x, v, dt_ms, &g->rest);
        } else {
            if (g->dir != DGX_GE_SIDE_UP) ghost_look(g, DGX_GE_SIDE_UP, now);
            if (toward(&g->y, door_y, v, dt_ms, &g->rest)) ghost_out(g, now);
        }
        break;
    case ENTERING:
        if (g->x != door_x) toward(&g->x, door_x, v, dt_ms, &g->rest);
        else if (toward(&g->y, inside_y, v, dt_ms, &g->rest)) {
            /* alive again: its animation home, and out again at once */
            g->where = LEAVING, g->fright = false;
            dgx_ge_actor_event(&g->actor, PACMAN_EVENT_HOME, now, say, NULL);
            ghost_look(g, DGX_GE_SIDE_UP, now);
        }
        break;
    default: break;
    }
}

/* Out of the house, as many dots eaten as each waits for; or one more when no dot is eaten for a while. */
static void release(uint32_t now)
{
    const uint32_t idle = (uint32_t)number(PACMAN_GAME_IDLE_RELEASE_MS, 4000);
    for (int i = 0; i < GHOSTS; ++i) {
        ghost_t *g = &ghosts[i];
        if (g->where != HOME) continue;
        if (dots_eaten >= g->dots || now - last_dot_ms >= idle) {
            g->where = LEAVING;
            if (now - last_dot_ms >= idle) last_dot_ms = now;
        }
        return; /* one at a time, in their order */
    }
}

/* ---- Pac-Man ---- */

static void pac_look(int dir, uint32_t now)
{
    if (dir < 0) {
        dgx_ge_actor_event(&pac, PACMAN_EVENT_STOP, now, say, NULL);
        return;
    }
    const int  s     = pac.script;
    const bool still = s == PACMAN_PAC_SCRIPT_WHOLE || (s >= PACMAN_PAC_SCRIPT_STILL_RIGHT && s <= PACMAN_PAC_SCRIPT_STILL_DOWN);
    if (dir == pac_dir && !still) return; /* chomping that way already */
    pac_dir = (int8_t)dir;
    dgx_ge_actor_event(&pac, PACMAN_EVENT_LEFT + dir, now, say, NULL);
}

/* What the score was before PLAY was told something: the points it gave are shown */
static void points_at(int x, int y, long before, uint32_t now, uint32_t ms)
{
    char s[12];
    snprintf(s, sizeof s, "%ld", (long)play.params[PACMAN_PLAY_PARAM_SCORE] - before);
    points_label.x = (int16_t)(x - 16), points_label.y = (int16_t)(grid.y + y - 7);
    dgx_ge_label_set(&points_label, s);
    points_until = now + ms;
}

static void frighten(uint32_t now)
{
    for (int i = 0; i < GHOSTS; ++i) {
        ghost_t *g = &ghosts[i];
        if (g->where == EYES || g->where == ENTERING) continue;
        g->fright = true, g->fright_over = false;
        reverse(g, now);
        dgx_ge_actor_event(&g->actor, PACMAN_EVENT_FRIGHT, now, say, NULL); /* blue, then flashing: its animation, which says when it is over */
    }
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
    --dots_left, ++dots_eaten;
    last_dot_ms = at_ms;
    w->at_ms += (uint32_t)number(energizer ? PACMAN_GAME_ENERGIZER_PAUSE_MS : PACMAN_GAME_DOT_PAUSE_MS, 0); /* he stands a moment eating it */
    if (energizer) frighten(at_ms);
    dgx_ge_actor_event(&play, energizer ? PACMAN_EVENT_ENERGIZER : PACMAN_EVENT_DOT, at_ms, say, NULL);
}

/* ---- the game ---- */

/* Everyone where the editor put them, as at the start of a life. */
static void put_actors(uint32_t now)
{
    const uint32_t speed = (uint32_t)number(PACMAN_GAME_PAC_SPEED, 0);
    dgx_ge_walk_start(&pac_walker, pac_x / cell, pac_y / cell, speed, now);
    pac_walker.dir    = DGX_GE_SIDE_LEFT;
    pac_walker.pos    = (pac_x - (pac_walker.col * cell + cell / 2)) * -256;
    pac_walker.corner = (uint8_t)number(PACMAN_GAME_CORNER_POINTS, 0);
    pac_dir           = DGX_GE_SIDE_LEFT;
    dgx_ge_layout_actor_start(&layout, PACMAN_SCENE_MAZE_ACTOR_PAC, &pac, &kinds, now);
    for (int i = 0; i < GHOSTS; ++i) {
        ghost_t *g = &ghosts[i];
        memset(g, 0, sizeof(*g));
        g->walker.kind = (uint8_t)(i + 1);
        dgx_ge_layout_actor_start(&layout, PACMAN_SCENE_MAZE_ACTOR_BLINKY + i, &g->actor, &kinds, now);
        g->x = (int16_t)dgx_ge_actor_x(&g->actor), g->y = (int16_t)(dgx_ge_actor_y(&g->actor) - grid.y);
        g->home_y = g->y;
        g->bob    = i & 1 ? 1 : -1;
        g->dir    = -1;
        g->dots   = (uint16_t)(i == INKY ? number(PACMAN_GAME_INKY_DOTS, 30) : i == CLYDE ? number(PACMAN_GAME_CLYDE_DOTS, 60) : 0);
        if (g->x == door_x && g->y == door_y) ghost_out(g, now); /* Blinky stands above the door: out at once */
    }
    const dgx_ge_anim_t *m = dgx_ge_kind(&kinds, PACMAN_BLOB_MODES);
    if (m) dgx_ge_actor_start(&modes, m, PACMAN_MODES_SCRIPT_SCHEDULE, 0, 0, now);
    mode         = SCATTER;
    fruit        = false;
    last_dot_ms  = now;
    points_until = 0;
}

static void numbers(void)
{
    const long s = (long)play.params[PACMAN_PLAY_PARAM_SCORE];
    if (s > high) high = s;
    dgx_ge_label_number(&score_label, s);
    dgx_ge_label_number(&high_label, high);
}

/* Everything that moves with time stands so long (READY!, a ghost eaten, caught). */
static void stand(uint32_t dt_ms)
{
    pac_walker.at_ms += dt_ms;
    pac.due_ms += dt_ms;
    modes.due_ms += dt_ms;
    last_dot_ms += dt_ms;
    for (int i = 0; i < GHOSTS; ++i) {
        ghosts[i].walker.at_ms += dt_ms;
        ghosts[i].actor.due_ms += dt_ms;
    }
}

/* What the actors (and the dialog's tell to PLAY) say: PLAY's signals and timers, the modes, a fright over, Pac-Man gone. */
static void say(dgx_ge_actor_t *actor, dgx_ge_anim_say_t what, uint8_t value, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (actor == &play && what >= DGX_GE_ANIM_TIMER_START && what <= DGX_GE_ANIM_TIMER_GO) {
        dgx_ge_timers_said(&timers, what, value, DGX_GE_OWNER_ACTOR, 0, 0, 0, at_ms);
        return;
    }
    if (what != DGX_GE_ANIM_SIGNAL) return; /* sounds: the pack names them, none is made yet */
    if (actor == &modes) {
        if ((value != SCATTER && value != CHASE) || value == mode) return;
        mode = value;
        for (int i = 0; i < GHOSTS; ++i)
            if (!ghosts[i].fright) reverse(&ghosts[i], at_ms); /* the arcade's ghosts turn round as the mode changes */
        return;
    }
    for (int i = 0; i < GHOSTS; ++i)
        if (actor == &ghosts[i].actor && value == 1) ghosts[i].fright_over = true;
    if (actor == &pac && value == 1 && state == DYING) {
        /* he is gone: everyone back, READY! again (PLAY's timer), or the game is over */
        put_actors(at_ms);
        to_state(READY, at_ms);
        dgx_ge_actor_event(&play, PACMAN_EVENT_LOST, at_ms, say, NULL);
        return;
    }
    if (actor != &play) return;
    switch (value) {
    case SIG_NUMBERS: numbers(); break;
    case SIG_NEW:
        white = false;
        fill_dots();
        put_actors(at_ms);
        lay_set();
        to_state(READY, at_ms);
        break;
    case SIG_GO:
        if (state == READY) to_state(PLAYING, at_ms);
        break;
    case SIG_LEVEL: to_state(CLEARED, at_ms); break;
    case SIG_OVER: to_state(OVER, at_ms); break;
    case SIG_FRUIT: fruit = true; break;
    case SIG_FRUIT_GONE: fruit = false; break;
    default: break;
    }
}

/* A timer of the pack gone off: its event to PLAY, which owns them all. */
static void fire(const dgx_ge_timer_t *timer, uint32_t at_ms, void *ctx)
{
    (void)ctx;
    if (timer->event != 0xFF) dgx_ge_actor_event(&play, timer->event, at_ms, say, NULL);
}

/* Who meets Pac-Man: a ghost in his cell. */
static void meetings(uint32_t now)
{
    int px, py;
    dgx_ge_walk_xy(&pac_walker, &ways, &px, &py);
    for (int i = 0; i < GHOSTS; ++i) {
        ghost_t *g = &ghosts[i];
        if (g->where != OUT) continue;
        int x, y;
        ghost_xy(g, &x, &y);
        if (x / cell != px / cell || y / cell != py / cell) continue;
        if (g->fright) {
            /* eaten: PLAY counts it, its points where it was, then its eyes go home */
            const long before = (long)play.params[PACMAN_PLAY_PARAM_SCORE];
            dgx_ge_actor_event(&play, PACMAN_EVENT_GHOST, now, say, NULL);
            points_at(x, y, before, now, (uint32_t)number(PACMAN_GAME_EAT_GHOST_MS, 1000));
            eaten_ghost = i;
            g->where = EYES, g->fright = false;
            dgx_ge_actor_event(&g->actor, PACMAN_EVENT_EATEN, now, say, NULL);
            g->walker.speed = ghost_speed(g);
            ghost_look(g, g->walker.dir >= 0 ? g->walker.dir : DGX_GE_SIDE_UP, now);
            to_state(ATE, now);
            return;
        }
        to_state(CAUGHT, now);
        return;
    }
}

static void playing(uint32_t now, uint32_t dt)
{
    dgx_ge_walk_play(&pac_walker, &ways, now, pac_arrive, NULL);
    pac_walker.speed = (uint32_t)number(ghosts[0].fright || ghosts[1].fright || ghosts[2].fright || ghosts[3].fright ? PACMAN_GAME_PAC_FRIGHT_SPEED : PACMAN_GAME_PAC_SPEED, 0);
    pac_look(pac_walker.dir, now);
    /* the schedule stands while the ghosts are frightened */
    bool frightened = false;
    for (int i = 0; i < GHOSTS; ++i) frightened |= ghosts[i].fright;
    if (frightened) modes.due_ms += dt;
    dgx_ge_actor_advance(&modes, now, say, NULL);
    release(now);
    for (int i = 0; i < GHOSTS; ++i) {
        ghost_t *g = &ghosts[i];
        if (g->where == OUT || g->where == EYES) {
            g->walker.speed = ghost_speed(g);
            dgx_ge_walk_play(&g->walker, &ways, now, ghost_arrive, NULL);
        } else ghost_house(g, dt, now);
    }
    /* the fruit, eaten where it stands: his cell in its zone */
    if (fruit) {
        int x, y;
        dgx_ge_walk_xy(&pac_walker, &ways, &x, &y);
        y += grid.y;
        if (x >= fruit_zone.x && x < fruit_zone.x + fruit_zone.w && y / cell == (fruit_zone.y + fruit_zone.h / 2) / cell) {
            const long before = (long)play.params[PACMAN_PLAY_PARAM_SCORE];
            fruit             = false;
            dgx_ge_actor_event(&play, PACMAN_EVENT_FRUIT, now, say, NULL);
            points_at(fruit_zone.x + fruit_zone.w / 2, fruit_zone.y + fruit_zone.h / 2 - grid.y, before, now, 2000);
        }
    }
    meetings(now);
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

/* A ghost's colors: Blinky's are its kind's own, the others' the palettes of the pack, by its param who. */
static int ghost_set(const ghost_t *g)
{
    static const int sets[GHOSTS] = {PACMAN_SET_GHOST, PACMAN_SET_PINKY, PACMAN_SET_INKY, PACMAN_SET_CLYDE};
    const int        who          = (int)g->actor.params[PACMAN_GHOST_PARAM_WHO];
    return sets[who >= 0 && who < GHOSTS ? who : 0];
}

static void show_game(uint32_t now)
{
    const int layer = PACMAN_SCENE_MAZE_LAYER_ACTORS, text = PACMAN_SCENE_MAZE_LAYER_TEXT;
    const bool ghosts_seen = state != DYING && state != CLEARED && state != OVER;
    for (int i = 0; ghosts_seen && i < GHOSTS; ++i) {
        const ghost_t *g = &ghosts[i];
        if (state == ATE && i == eaten_ghost) continue;
        int x, y;
        ghost_xy(g, &x, &y);
        put(g->actor.image, x, grid.y + y, ghost_set(g), layer);
    }
    if (state != ATE && state != OVER) {
        int x, y;
        dgx_ge_walk_xy(&pac_walker, &ways, &x, &y);
        put(pac.image, x, grid.y + y, -1, layer);
    }
    if (fruit && ghosts_seen) put(PACMAN_IMG_FRUIT_CHERRY, fruit_zone.x + fruit_zone.w / 2, fruit_zone.y + fruit_zone.h / 2, -1, layer);
    /* the lives left, in their zone */
    for (int k = 0; k + 1 < play.params[PACMAN_PLAY_PARAM_LIVES] && k < 5; ++k)
        put(PACMAN_IMG_PAC_LEFT_1, lives_zone.x + 8 + k * 16, lives_zone.y + lives_zone.h / 2, -1, layer);
    /* READY!, GAME OVER in their zone */
    const int mx = message_zone.x + message_zone.w / 2, my = message_zone.y + message_zone.h - 1;
    if (state == READY) put(PACMAN_IMG_WORDS_READY, mx, my, -1, text);
    if (state == OVER) {
        put(PACMAN_IMG_WORDS_GAME_OVER, mx, my, -1, text);
        dgx_ge_item_t it = {.x = (int16_t)(dgx_ge_actor_x(&prompt)), .y = (int16_t)dgx_ge_actor_y(&prompt), .layer = (uint8_t)text};
        if (prompt.image >= 0) put(prompt.image, it.x, it.y, -1, text);
    }
    if (points_until && (int32_t)(now - points_until) >= 0) points_until = 0;
    if (!points_until) dgx_ge_label_set(&points_label, "");
    dgx_ge_label_show(&score_label, scene);
    dgx_ge_label_show(&high_label, scene);
    dgx_ge_label_show(&points_label, scene);
    if (state == PAUSED) dgx_ge_talk_view_show(&view, &talk, scene, (uint8_t)text);
}

/* ---- the hand ---- */

/*
 * The finger (DGX-DI's touch: where it went down, where it is, a long press). A swipe is SWIPE_MM along an axis,
 * while the finger is down or where it went up (a quick swipe on a resistive panel gives a point or two before it
 * lifts), once a touch; a touch let go short of that is a tap.
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
    int x = 0, y = 0, px, py;
    if (!dgx_ge_scene_point_at(scene, 0, touch.x, touch.y, &x, &y)) return -1;
    dgx_ge_walk_xy(&pac_walker, &ways, &px, &py);
    return way_to(x - px, y - grid.y - py);
}

static void start_title(uint32_t now)
{
    to_state(TITLE, now);
    dgx_ge_scene_reset(scene, 0);
    size_t         size;
    const uint8_t *blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_TITLE, &size);
    if (blob && dgx_ge_show_open(&title, blob, size) && dgx_ge_show_start(&title, &kinds, now)) {
        dgx_ge_scene_set_begin(scene);
        dgx_ge_show_backdrop(&title, &pack, map_of, scene);
        dgx_ge_scene_set_end(scene);
    }
}

static void start_game(uint32_t now)
{
    if (state == TITLE) dgx_ge_show_stop(&title);
    to_state(READY, now);
    dgx_ge_actor_event(&play, PACMAN_EVENT_START, now, say, NULL); /* PLAY: SIG_NEW lays the maze, READY! for its time */
}

static void control(const dgx_ge_input_t *input, uint32_t real, uint32_t now)
{
    if (touch.pressed) steered = false;
    const int  swiped = state == PLAYING || state == READY ? swipe_way() : -1;
    const bool tap    = touch.released && !steered && !touch.told;
    const bool go     = input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_A);
    if (state == TITLE || (state == OVER && now - state_since > 1000)) {
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
    if (state != PLAYING && state != READY) return;
    const bool held = touch.long_press && !steered;
    if ((input->pressed & (DGX_GE_KEY_START | DGX_GE_KEY_BACK)) || held) {
        steered = true; /* the finger that paused does not answer the dialog as it goes up */
        dgx_ge_actor_t *roles[] = {&play};
        dgx_ge_cast_t   cast    = {.roles = roles, .game = &play};
        dgx_ge_talk_start(&talk, &pause_dialog, &cast, PACMAN_STYLE_MENU, real, say, NULL);
        talk.ahead_ms = real - now;
        paused_from   = state;
        state         = PAUSED;
        return;
    }
    static const uint32_t keys[4] = {DGX_GE_KEY_LEFT, DGX_GE_KEY_RIGHT, DGX_GE_KEY_UP, DGX_GE_KEY_DOWN};
    int                   w       = swiped;
    if (w < 0 && tap) w = tap_way();
    for (int s = 0; s < 4 && w < 0; ++s)
        if (input->held & keys[s]) w = s;
    if (w >= 0) {
        if (state == PLAYING) dgx_ge_walk_want(&pac_walker, &ways, w, now, pac_arrive, NULL);
        else pac_walker.want = (int8_t)w; /* READY!: taken as he goes */
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
    /* the places the editor gave: where Pac-Man starts, the door of the house and its middle, the zones */
    dgx_ge_layout_actor_t a;
    bool                  left;
    dgx_ge_rect_t         house;
    int                   kind;
    if (!dgx_ge_layout_actor(&layout, PACMAN_SCENE_MAZE_ACTOR_PAC, &a) ||
        !dgx_ge_layout_entry(&layout, PACMAN_SCENE_MAZE_ENTRY_HOUSE_DOOR, &door_x, &door_y, &left) ||
        !dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_HOUSE, &house, &kind) ||
        !dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_FRUIT, &fruit_zone, &kind) ||
        !dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_MESSAGE, &message_zone, &kind) ||
        !dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_LIVES, &lives_zone, &kind)) {
        ESP_LOGE(TAG, "the scene maze lacks what the game takes from it");
        return;
    }
    pac_x = a.x, pac_y = a.y - grid.y, door_y -= grid.y;
    inside_y = house.y + house.h / 2 - grid.y;

    /* the kinds, the game's actor, the timers, the labels, the dialog */
    dgx_ge_kinds_init(&kinds, &pack, 8);
    uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
    seed         = now | 1;
    dgx_ge_actor_start(&play, dgx_ge_kind(&kinds, PACMAN_BLOB_PLAY), PACMAN_PLAY_SCRIPT_IDLE, 0, 0, now);
    dgx_ge_actor_start(&prompt, dgx_ge_kind(&kinds, PACMAN_BLOB_WORDS), PACMAN_WORDS_SCRIPT_BLINK, w / 2, message_zone.y + 40, now);
    dgx_ge_timers_init(&timers, 4, fire, NULL);
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_TIMERS, &size);
    if (blob) dgx_ge_timers_define(&timers, blob, size);
    fonts[PACMAN_FONT_TERMINUSTTFMEDIUM12] = TerminusTTFMedium12();
    dgx_ge_rect_t place;
    const uint8_t ink = maps[PACMAN_SET_WORDS][4 - 1]; /* the white of WORDS: a map has the frame's index of value v at v - 1 */
    if (dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_SCORE, &place, &kind))
        dgx_ge_label_init(&score_label, frame, fonts[0], place.x, place.y, place.w, place.h, DGX_GE_ALIGN_RIGHT, PACMAN_SCENE_MAZE_LAYER_TEXT, ink);
    if (dgx_ge_layout_zone(&layout, PACMAN_SCENE_MAZE_ZONE_HIGH, &place, &kind))
        dgx_ge_label_init(&high_label, frame, fonts[0], place.x, place.y, place.w, place.h, DGX_GE_ALIGN_MIDDLE, PACMAN_SCENE_MAZE_LAYER_TEXT, ink);
    dgx_ge_label_init(&points_label, frame, fonts[0], 0, 0, 32, 14, DGX_GE_ALIGN_MIDDLE, PACMAN_SCENE_MAZE_LAYER_TEXT, maps[PACMAN_SET_INKY][0]);
    numbers();
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_PAUSE, &size);
    if (!blob || !dgx_ge_dialog_open(&pause_dialog, blob, size)) ESP_LOGE(TAG, "no dialog pause");
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_STRINGS, &size);
    if (blob) dgx_ge_strings_open(&strings, blob, size);
    blob = dgx_ge_pack_blob(&pack, PACMAN_BLOB_STYLES, &size);
    dgx_ge_talk_view_init(&view, blob, blob ? size : 0, frame, fonts, PACMAN_FONT_COUNT);
    dgx_ge_talk_view_pictures(&view, &pack, map_of);

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
    ESP_LOGI(TAG, "a frame of %dx%d, x%d, on a display of %dx%d; %s%s", w, h, scale, lcd->width, lcd->height,
             padded ? "a pad" : board_buttons_able ? "buttons" : pointing ? "a pointer" : "no input", cyd ? " (the CYD's touch)" : "");

    start_title(now);
    dgx_ge_input_t input     = {0};
    uint32_t       paused_ms = 0, last = now;
    last_ms                  = now;
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

        uint32_t dt = clock_ms - last_ms;
        if (dt > 100) dt = 100; /* a late call: no great jump */
        last_ms        = clock_ms;
        const uint32_t in = clock_ms - state_since;
        if (state == PAUSED) {
            dgx_ge_talk_view_play(&view, &talk, &strings, real);
            if (talk.state == DGX_GE_TALK_OVER && state == PAUSED) state = paused_from;
        } else {
            dgx_ge_timers_play(&timers, clock_ms);
            dgx_ge_actor_advance(&play, clock_ms, say, NULL);
            switch (state) {
            case TITLE:
                if (dgx_ge_show_play(&title, clock_ms, say, NULL)) {
                    dgx_ge_show_stop(&title);
                    start_title(clock_ms); /* the title goes round */
                }
                break;
            case READY: stand(dt); break;
            case PLAYING: playing(clock_ms, dt); break;
            case ATE:
                stand(dt);
                if (in >= (uint32_t)number(PACMAN_GAME_EAT_GHOST_MS, 1000)) to_state(PLAYING, clock_ms);
                break;
            case CAUGHT:
                stand(dt);
                if (in >= 1000) {
                    dgx_ge_actor_event(&pac, PACMAN_EVENT_DIE, clock_ms, say, NULL);
                    to_state(DYING, clock_ms);
                }
                break;
            case CLEARED: {
                /* a while, then the maze flashes white and blue; PLAY's READY! brings the next level */
                stand(dt);
                const bool w_now = in >= 400 && ((in - 400) / 233) % 2 == 0 && in < 400 + 6 * 233;
                if (w_now != white) white = w_now, relay_all = true;
                if (in >= 400 + 6 * 233) {
                    white = false;
                    fill_dots();
                    put_actors(clock_ms);
                    relay_all = true;
                    to_state(READY, clock_ms);
                }
                break;
            }
            case OVER:
                dgx_ge_actor_advance(&prompt, clock_ms, say, NULL);
                if (in >= 8000) start_title(clock_ms);
                break;
            default: break;
            }
            /* the looks: Pac-Man (dying: he says when he is gone), the ghosts (a fright over: their way again) */
            if (state != TITLE) {
                dgx_ge_actor_advance(&pac, clock_ms, say, NULL);
                for (int i = 0; i < GHOSTS; ++i) {
                    ghost_t *g = &ghosts[i];
                    dgx_ge_actor_advance(&g->actor, clock_ms, say, NULL);
                    if (g->fright_over) {
                        g->fright_over = false, g->fright = false;
                        dgx_ge_actor_event(&g->actor, PACMAN_EVENT_LEFT + (g->dir >= 0 ? g->dir : DGX_GE_SIDE_LEFT), clock_ms, say, NULL);
                    }
                }
                /* the energizers blink: the set laid anew where they change */
                dgx_ge_rect_t places[8];
                const int     changed = dgx_ge_grid_animate(&grid, clock_ms, places, 8);
                if (changed) {
                    relay_all = true;
                }
            }
        }
        if (relay_all && state != TITLE) lay_set();

        /* what moves in this frame */
        dgx_ge_scene_actors_begin(scene);
        if (state == TITLE) dgx_ge_show_items(&title, &pack, map_of, scene, NULL, NULL);
        else show_game(clock_ms);
        dgx_ge_scene_render(scene);

        const int64_t spent = esp_timer_get_time() - t0;
        vTaskDelay(spent < STEP_US ? pdMS_TO_TICKS((STEP_US - spent) / 1000) + 1 : 1);
    }
}
