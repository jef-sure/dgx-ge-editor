# Pac-Man for a board of jef-sure/boards, or for the computer. The boards are chosen once, by tools/board_select.py of
# jef-sure/boards, which wrote sdkconfig.defaults.<board> here and CMakePresets.json, whose preset builds a board in
# build/<board> (ESP-IDF 6 reads the presets; ESP-IDF 5: idf.py -B build/<board> -D SDKCONFIG=build/<board>/sdkconfig
# -D BOARD=<board> build):
#   idf.py build                            the CYD (cyd_s028r), the current board
#   idf.py --preset jc8012p4a1c build       the 10", the 7" (jc1060p470c), the 4.3" (jc4827w543c)
#   idf.py --preset host build              the computer, a window of the CYD's display (stood up): build/host/pacman.elf
# The pack is made by the build from game_data/, what the sprite editor keeps (main/CMakeLists.txt). Its sdkconfig: the
# board's settings, then the game's own (sdkconfig.defaults), a later file over an earlier.
cmake_minimum_required(VERSION 3.22)

# BOARD=<board>, which the preset of a board sets, builds with sdkconfig.defaults.<board> that board_select.py wrote,
# then with the game's own sdkconfig.defaults. A -D SDKCONFIG_DEFAULTS=... on the command line wins.
set(BOARD "" CACHE STRING "a board of this project: its file sdkconfig.defaults.<board>")
if(NOT SDKCONFIG_DEFAULTS AND BOARD)
	if(NOT EXISTS ${CMAKE_CURRENT_LIST_DIR}/sdkconfig.defaults.${BOARD})
		message(FATAL_ERROR "no sdkconfig.defaults.${BOARD} here: run board_select.py ${BOARD} . of jef-sure/boards")
	endif()
	set(SDKCONFIG_DEFAULTS "sdkconfig.defaults.${BOARD};sdkconfig.defaults")
endif()

# The engine (DGX-GE): a checkout of it, $DGX_GE, else esp32-component-dgx-ge beside the editor's folder; without one,
# the registry's (main/idf_component.yml), downloaded into managed_components/. A checkout is a component of the project
# under the name the component manager knows the engine by, jef-sure__dgx-ge: a link of that name in the build's folder
# (ESP-IDF names a component after its folder, and override_path in main/idf_component.yml leaves jef-sure__dgx-ge
# unknown).
if(DEFINED ENV{DGX_GE})
	get_filename_component(engine $ENV{DGX_GE} ABSOLUTE)
else()
	get_filename_component(engine ${CMAKE_CURRENT_LIST_DIR}/../../../esp32-component-dgx-ge ABSOLUTE)
endif()
if(EXISTS ${engine}/dgx_ge_di.cmake)
	file(MAKE_DIRECTORY ${CMAKE_BINARY_DIR})
	file(CREATE_LINK ${engine} ${CMAKE_BINARY_DIR}/jef-sure__dgx-ge SYMBOLIC)
	list(APPEND EXTRA_COMPONENT_DIRS ${CMAKE_BINARY_DIR}/jef-sure__dgx-ge)
elseif(EXISTS ${engine}/idf_component.yml)
	message(FATAL_ERROR "${engine}: a DGX-GE older than 0.5.0 (no dgx_ge_di.cmake); the game takes 0.5.0 or later")
else()
	set(engine ${CMAKE_CURRENT_LIST_DIR}/managed_components/jef-sure__dgx-ge)
endif()

# the computer (BOARD=host, the linux target of ESP-IDF): main and what it requires, the drivers of a chip are not there
if(BOARD STREQUAL "host")
	set(COMPONENTS main)
	# in a shell of ESP-IDF the linker of a chip comes first in PATH: the compiler of the computer looks in /usr/bin first
	set(CMAKE_EXE_LINKER_FLAGS "-B/usr/bin/")
endif()

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
# each board has its lock of the components beside the project: dependencies.lock.<board>
if(BOARD)
	idf_build_set_property(DEPENDENCIES_LOCK ${CMAKE_CURRENT_LIST_DIR}/dependencies.lock.${BOARD})
endif()
# the engine for main/CMakeLists.txt (its touch, its packer): a property of the build, which ESP-IDF hands on even where
# it reads that file early
idf_build_set_property(GAME_ENGINE ${engine})
project(pacman)
