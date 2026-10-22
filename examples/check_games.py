#!/usr/bin/env python3
"""The chain of the example games checked from end to end, for the data of each (<name>/game_data: pacman, tetris, snake
by default):
1. the editor's own code (editor_check.js) reads the folder's document and its .anim texts: no errors, no warnings;
2. what it would save is the document of the folder, as it is;
3. the engine's packer (Pack.add_sprites) makes a pack of the folder;
4. the .anim texts the editor exports for the kinds make the same pack, byte for byte: an animation opened in the
   editor and written back is the same game.
python3 examples/check_games.py [names] [--engine <dgx-ge>]"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def pack_of(folder, engine, out):
    p = subprocess.run([sys.executable, '-B', os.path.join(HERE, 'pack.py'), folder, out, '--engine', engine], capture_output=True, text=True)
    if p.returncode:
        raise SystemExit(f'{folder}: the packer refuses it:\n{p.stderr[-2000:]}')
    name = os.path.basename(glob.glob(os.path.join(folder, '*.json'))[0])[:-5]
    with open(os.path.join(out, name + '.pack'), 'rb') as f:
        return f.read(), p.stdout.strip()


def main():
    a = argparse.ArgumentParser()
    a.add_argument('names', nargs='*', default=['pacman', 'tetris', 'snake'])
    a.add_argument('--engine', default=os.environ.get('DGX_GE') or os.path.join(HERE, '..', '..', 'esp32-component-dgx-ge'))
    args = a.parse_args()
    bad = 0
    for name in args.names:
        folder = os.path.join(HERE, name, 'game_data')
        with open(os.path.join(folder, name + '.json'), encoding='utf-8') as f:
            text = f.read()
        doc = json.loads(text)
        anims = {}
        for path in glob.glob(os.path.join(folder, '*.anim')):
            with open(path, encoding='utf-8') as f:
                anims[os.path.basename(path)[:-5]] = f.read()
        p = subprocess.run(['node', os.path.join(HERE, 'editor_check.js')], input=json.dumps({'doc': doc, 'anims': anims}),
                           capture_output=True, text=True)
        if p.returncode:
            raise SystemExit(p.stderr)
        r = json.loads(p.stdout)
        if r.get('error'):
            print(f'{name}: the editor does not take it: {r["error"]}')
            bad += 1
            continue
        problems = r['problems']
        for q in problems:
            print(f"  {'error' if q['error'] else 'warning'}: {q['source']}: {q['text']}")
        same = json.dumps(r['doc'], indent=4, ensure_ascii=False) == text
        with tempfile.TemporaryDirectory() as tmp:
            original, said = pack_of(folder, args.engine, os.path.join(tmp, 'a'))
            # the folder again, its animations as the editor writes them
            copy = os.path.join(tmp, name)
            shutil.copytree(folder, copy, ignore=shutil.ignore_patterns('build'))
            for kind, t in r['exported'].items():
                with open(os.path.join(copy, kind + '.anim'), 'w', encoding='utf-8') as f:
                    f.write(t)
            exported, _ = pack_of(copy, args.engine, os.path.join(tmp, 'b'))
        ok = not problems and same and original == exported
        bad += not ok
        print(f"{name}: editor {len(problems)} problems; saved as the folder has it: {'yes' if same else 'NO'}; {said}; "
              f"the editor's .anim the same pack: {'yes' if original == exported else 'NO'} -> {'ok' if ok else 'FAILED'}")
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
