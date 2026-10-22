#pragma once
/* The CYD's resistive touch, taken by the game (cyd_touch.c): built for the CYD only, GAME_CYD. */
#include <stdbool.h>
#include <stdint.h>

#include "dgx_screen.h"

/* The panel on its own SPI bus, its points as pixels of the display; false when it is not there. */
bool cyd_touch_start(dgx_screen_t *display);

/* The finger now: down, and where (pixels of the display; where it was last when up). */
bool cyd_touch(uint32_t now_ms, int *x, int *y);
