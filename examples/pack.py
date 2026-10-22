#!/usr/bin/env python3
"""The pack of a project folder, by the engine's own packer, as a game makes it: the document <name>.json of the
folder read by Pack.add_sprites (its pictures by kind, <KIND>.anim, dialogs/*.dlg), written as <name>.pack and its
header <name>_pack.h. The editor is not needed for it: this is what the engine takes.

python3 examples/pack.py examples/tetris/game_data [out folder] [--engine <dgx-ge>]
The engine: --engine, else $DGX_GE, else a checkout of esp32-component-dgx-ge beside the editor's folder."""
import argparse
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    a = argparse.ArgumentParser()
    a.add_argument('folder')
    a.add_argument('out', nargs='?')
    a.add_argument('--engine', default=os.environ.get('DGX_GE') or os.path.join(HERE, '..', '..', 'esp32-component-dgx-ge'))
    args = a.parse_args()
    sys.dont_write_bytecode = True
    sys.path.insert(0, os.path.join(args.engine, 'tools'))
    from dgx_ge_pack import Pack

    docs = glob.glob(os.path.join(args.folder, '*.json'))
    if len(docs) != 1:
        raise SystemExit(f'{args.folder}: one .json document is wanted at its top, there are {len(docs)}')
    name = os.path.splitext(os.path.basename(docs[0]))[0]
    out = args.out or os.path.join(args.folder, 'build')
    os.makedirs(out, exist_ok=True)
    pack = Pack(name.upper())
    made = pack.add_sprites(docs[0])
    size = pack.write(os.path.join(out, name + '.pack'), os.path.join(out, name + '_pack.h'))
    for w in pack.warnings:
        print('warning:', w)
    print(f'{name}.pack: {os.path.getsize(os.path.join(out, name + ".pack"))} bytes, {len(made)} sets of colors, '
          f'{len(pack.images)} pictures -> {out}')


if __name__ == '__main__':
    main()
