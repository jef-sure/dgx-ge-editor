#!/usr/bin/env python3
"""Puts the examples (their documents and their pictures) into ExampleData.js for the choice "Example": a page opened
from a file cannot read the files next to it. Run it after an example changes: python3 examples/make_example_data.py"""
import base64
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
# the folder, its document, the title the choice shows
EXAMPLES = [('wanderer', 'wanderer.json', 'Wanderer: a figure with a sword', 'Странник с мечом'),
            ('pacman/game_data', 'pacman.json', 'Pac-Man: a whole game', 'Пакмен: игра целиком'),
            ('tetris/game_data', 'tetris.json', 'Tetris: a whole game', 'Тетрис: игра целиком'),
            ('snake/game_data', 'snake.json', 'Snake: a whole game', 'Змейка: игра целиком')]

examples = []
count = 0
for folder, doc, en, ru in EXAMPLES:
    source = os.path.join(HERE, folder)
    with open(os.path.join(source, doc), encoding='utf-8') as f:
        markup = json.load(f)
    pictures = {}  # '<kind>/<file>' -> PNG in base64
    for st in markup['sets']:
        for frame in st['frames']:
            for path in (os.path.join(source, st['name'], frame['image']), os.path.join(source, frame['image'])):
                if os.path.exists(path):
                    with open(path, 'rb') as f:
                        pictures[st['name'] + '/' + frame['image']] = base64.b64encode(f.read()).decode('ascii')
                    break
            else:
                raise SystemExit(f'{folder}: no picture {st["name"]}/{frame["image"]}')
    count += len(pictures)
    examples.append({'name': folder.split('/')[0], 'title': [en, ru], 'markup': markup, 'pictures': pictures})
with open(os.path.join(HERE, '..', 'ExampleData.js'), 'w', encoding='utf-8') as out:
    out.write('// The examples of examples/ for the choice "Example", made by examples/make_example_data.py\n')
    out.write('const ExampleData = ' + json.dumps({'examples': examples}, separators=(',', ':'), ensure_ascii=False) + ';\n')
print(len(examples), 'examples,', count, 'pictures')
