# Pac-Man for a board of the engine: idf.py build (the CYD), or another board by its directory in the engine's boards/:
#   idf.py -B build-p4 -D SDKCONFIG=build-p4/sdkconfig -D GAME_BOARD=jc8012p4a1c build
# The pack is made by the build from what the editor saved (main/CMakeLists.txt). Its sdkconfig: the board's
# settings, those of its chip's revision, then the game's own (sdkconfig.defaults). For the computer: make (Makefile).
cmake_minimum_required(VERSION 3.22)

set(GAME_BOARD cyd CACHE STRING "the board: cyd, jc8012p4a1c (10\"), jc1060p470 (7\")")
# the engine (DGX-GE, its component's folder): $DGX_GE, else a checkout of esp32-component-dgx-ge beside the editor's
# folder; main/idf_component.yml takes it from $DGX_GE, set here when it was not
if(DEFINED ENV{DGX_GE})
	get_filename_component(engine $ENV{DGX_GE} ABSOLUTE)
else()
	get_filename_component(engine ${CMAKE_CURRENT_LIST_DIR}/../../../esp32-component-dgx-ge ABSOLUTE)
endif()
if(NOT EXISTS ${engine}/boards/${GAME_BOARD}/sdkconfig.defaults)
	message(FATAL_ERROR "No engine at ${engine}: set DGX_GE to the folder of DGX-GE (a checkout of esp32-component-dgx-ge), or put that checkout beside the editor's folder")
endif()
set(ENV{DGX_GE} ${engine})
set(board ${engine}/boards/${GAME_BOARD})
if(GAME_BOARD STREQUAL "cyd")
	set(board_target esp32)
	set(board_defaults "${board}/sdkconfig.defaults")
elseif(GAME_BOARD STREQUAL "jc8012p4a1c")
	set(board_target esp32p4)
	set(board_defaults "${board}/sdkconfig.defaults;${board}/sdkconfig.defaults.rev3")
elseif(GAME_BOARD STREQUAL "jc1060p470")
	set(board_target esp32p4)
	set(board_defaults "${board}/sdkconfig.defaults;${board}/sdkconfig.defaults.rev1")
else()
	message(FATAL_ERROR "GAME_BOARD ${GAME_BOARD}: cyd, jc8012p4a1c or jc1060p470")
endif()
if(NOT SDKCONFIG_DEFAULTS)
	set(SDKCONFIG_DEFAULTS "${board_defaults};sdkconfig.defaults")
endif()
if(NOT IDF_TARGET AND NOT DEFINED ENV{IDF_TARGET})
	set(IDF_TARGET ${board_target})
endif()

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
idf_build_set_property(DEPENDENCIES_LOCK ${CMAKE_CURRENT_LIST_DIR}/dependencies.lock.${IDF_TARGET})
# the board and the engine for main/CMakeLists.txt: properties of the build, which ESP-IDF hands on even where it reads that file early
idf_build_set_property(GAME_BOARD ${GAME_BOARD})
idf_build_set_property(GAME_ENGINE ${engine})
project(pacman)
