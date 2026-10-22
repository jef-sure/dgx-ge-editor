# Pac-Man on the computer: main/ as it is, the engine's board host (SDL2) in place of a board. make, then make run;
# make clean. The display shown is the CYD standing up (as the game stands it) unless HOST_DISPLAY and HOST_MM say another.
#
# The pack is made by the build from game_data/, the folder the editor keeps, whenever it changes. The engine: DGX_GE
# (the folder of DGX-GE), else esp32-component-dgx-ge beside the editor's folder. DGX and DGX-DI: DGX= and DGX_DI=,
# else those an idf.py build downloaded into managed_components/, else esp32-component-dgx and esp32-component-dgx-di
# beside the editor's folder.
GAME          := pacman
GAME_SRCS     := main/main.c
GAME_INCLUDES := main
GAME_EMBED    := main/assets/pacman.pack
GAME_PACK_H   := main/assets/pacman_pack.h
HOST_DISPLAY  ?= 240x320
HOST_MM       ?= 43x58
ENGINE        ?= $(or $(DGX_GE),../../../esp32-component-dgx-ge)
DGX           ?= $(firstword $(wildcard managed_components/jef-sure__dgx ../../../esp32-component-dgx))
DGX_DI        ?= $(firstword $(wildcard managed_components/jef-sure__dgx-di ../../../esp32-component-dgx-di))
ifeq ($(wildcard $(ENGINE)/boards/host/host.mk),)
$(error No engine at '$(ENGINE)': DGX_GE=<the folder of DGX-GE> (a checkout of esp32-component-dgx-ge), or that checkout beside the editor's folder)
endif
ENGINE_DIR    := $(abspath $(ENGINE))

# the pack made again before anything else whenever what the editor saved is newer (the engine's host.mk reads its
# header as it is read itself); the game's C again when the header changes
PACK_INPUTS := $(wildcard game_data/*.json game_data/*/*.png game_data/*.anim game_data/dialogs/*.dlg game_data/sounds/*.wav) tools/pack.py
ifneq ($(shell [ -f $(GAME_PACK_H) ] && [ -z "$$(find $(PACK_INPUTS) -newer $(GAME_PACK_H))" ] && echo fresh),fresh)
ifneq ($(shell python3 tools/pack.py $(ENGINE_DIR) 1>&2; echo $$?),0)
$(error the pack of game_data/ could not be made: see above)
endif
endif

include $(ENGINE)/boards/host/host.mk

$(foreach s,$(GAME_SRCS),$(HOST_BUILD)/obj/$(subst /,_,$(abspath $(s:.c=))).o): $(GAME_PACK_H)
