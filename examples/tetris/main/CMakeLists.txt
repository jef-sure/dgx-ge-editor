# The game, its board and its pack. The pack is made here, as the build is configured, from game_data/, the folder
# the sprite editor keeps (tetris.json, the pictures, the .anim files, dialogs/; the sounds' samples in sounds/), by the
# engine's packer (tools/pack.py); a change of any of them configures the build again. The packer wants a python3 with Pillow: the system's, not ESP-IDF's.
idf_build_get_property(GAME_BOARD GAME_BOARD)
idf_build_get_property(engine GAME_ENGINE)
include(${engine}/boards/${GAME_BOARD}/board.cmake)
if(GAME_BOARD STREQUAL "jc8012p4a1c")
	set(board_embed "jc8012p4a1c_touch.fw")
endif()

set(game ${CMAKE_CURRENT_LIST_DIR}/..)
if(NOT CMAKE_BUILD_EARLY_EXPANSION)
	find_program(GAME_PYTHON NAMES python3 PATHS /usr/bin /usr/local/bin /opt/homebrew/bin NO_DEFAULT_PATH)
	if(NOT GAME_PYTHON)
		find_program(GAME_PYTHON NAMES python3 python REQUIRED)
	endif()
	file(GLOB inputs ${game}/game_data/*.json ${game}/game_data/*/*.png ${game}/game_data/*.anim ${game}/game_data/dialogs/*.dlg ${game}/game_data/sounds/*.wav ${game}/tools/pack.py)
	execute_process(COMMAND ${GAME_PYTHON} ${game}/tools/pack.py ${engine} ${game} RESULT_VARIABLE packed)
	if(NOT packed EQUAL 0)
		message(FATAL_ERROR "the pack of the game could not be made (${GAME_PYTHON} tools/pack.py: it needs Pillow)")
	endif()
	set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS ${inputs})
endif()

# the CYD's touch, which the engine's board leaves out: the game's own (cyd_touch.c)
if(GAME_BOARD STREQUAL "cyd")
	set(game_srcs cyd_touch.c)
	set(game_requires esp_lcd atanisoft__esp_lcd_touch_xpt2046 esp_driver_spi)
endif()

idf_component_register(
	SRCS "main.c" ${game_srcs} ${BOARD_SRCS}
	INCLUDE_DIRS "." ${BOARD_INCLUDE_DIRS}
	REQUIRES jef-sure__dgx-ge jef-sure__dgx
	PRIV_REQUIRES nvs_flash esp_timer jef-sure__dgx-di ${game_requires} ${BOARD_REQUIRES}
	EMBED_FILES "assets/tetris.pack" ${board_embed}
)
if(GAME_BOARD STREQUAL "cyd")
	target_compile_definitions(${COMPONENT_LIB} PRIVATE GAME_CYD=1)
endif()
# the params an actor keeps, as many as the pack's animations need
dgx_ge_params_of_pack(assets/tetris_pack.h)
# the events at once an actor's own say may give in one step: the engine's default, said aloud
dgx_ge_now_events(4)
# the synthesizer of music the build carries: the one its songs are of
dgx_ge_synths(nes)
