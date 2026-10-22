/*
 * The CYD's touch, for this game: the engine's board of the CYD leaves its resistive panel out, so the game takes it
 * itself, as DGX-DI's table of boards has it: an XPT2046 on its own SPI (SCLK 25, MOSI 32, MISO 39, CS 33), its ADC
 * values 0..4095, lying mirrored in x. No calibration: a swipe and a tap need only where the finger goes, roughly.
 * Built for the CYD only (main/CMakeLists.txt).
 */
#include "cyd_touch.h"

#include "dgx_di.h"
#include "dgx_di_esp_lcd_touch.h"
#include "driver/spi_master.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_touch_xpt2046.h"
#include "esp_log.h"

static const char *TAG = "cyd_touch";

static dgx_di_esp_lcd_touch_t panel;
static dgx_di_pointer_t       pointer;

bool cyd_touch_start(dgx_screen_t *display)
{
    const spi_bus_config_t bus = {.sclk_io_num = 25, .mosi_io_num = 32, .miso_io_num = 39, .quadwp_io_num = -1, .quadhd_io_num = -1};
    if (spi_bus_initialize(SPI3_HOST, &bus, SPI_DMA_DISABLED) != ESP_OK) {
        ESP_LOGE(TAG, "no SPI3 for the touch");
        return false;
    }
    esp_lcd_panel_io_handle_t           io  = NULL;
    const esp_lcd_panel_io_spi_config_t ioc = ESP_LCD_TOUCH_IO_SPI_XPT2046_CONFIG(33);
    if (esp_lcd_new_panel_io_spi((esp_lcd_spi_bus_handle_t)SPI3_HOST, &ioc, &io) != ESP_OK) return false;
    const esp_lcd_touch_config_t tc = {.x_max = 4096, .y_max = 4096, .rst_gpio_num = -1, .int_gpio_num = -1};
    esp_lcd_touch_handle_t       tp = NULL;
    if (esp_lcd_touch_new_spi_xpt2046(io, &tc, &tp) != ESP_OK) {
        ESP_LOGE(TAG, "no XPT2046");
        return false;
    }
    dgx_di_esp_lcd_touch_init(&panel, tp, 1, false);
    dgx_di_pointer_init(&pointer, &panel.device, DGX_DI_MIRROR_X, display);
    dgx_di_pointer_debounce(&pointer, 40, 60);
    return true;
}

bool cyd_touch(uint32_t now_ms, int *x, int *y)
{
    dgx_di_pointer_read(&pointer, now_ms);
    return dgx_di_pointer_first(&pointer, x, y);
}
