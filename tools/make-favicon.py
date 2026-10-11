#!/usr/bin/env python3
"""Draw the theme's pixel-art favicon set: a four-point star on a dark rounded square.

    python tools/make-favicon.py                      # writes the three files under source/images/
    python tools/make-favicon.py --star "#009dff" --bg "#1a1b1d"

Needs Pillow (`pip install pillow`). Every output is nearest-neighbour upscaled from the 16x16
grid below so the pixels stay crisp. favicon.ico and favicon-192x192.png keep transparent corners;
apple-touch-icon.png is fully solid because iOS fills transparency with black.
"""
import argparse
import os

from PIL import Image

GRID = [
    ".##############.",
    "################",
    "#######ss#######",
    "#######ss#######",
    "#######ss#######",
    "####s##ss##s####",
    "#####s#ss#s#####",
    "##ssssssssssss##",
    "##ssssssssssss##",
    "#####s#ss#s#####",
    "####s##ss##s####",
    "#######ss#######",
    "#######ss#######",
    "#######ss#######",
    "################",
    ".##############.",
]


def hex_rgba(text, alpha=255):
    h = text.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def draw(colors, background):
    img = Image.new('RGBA', (16, 16), background)
    for y, row in enumerate(GRID):
        for x, ch in enumerate(row):
            if ch in colors:
                img.putpixel((x, y), colors[ch])
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='source/images')
    ap.add_argument('--star', default='#f3b958')
    ap.add_argument('--bg', default='#1a1b1d')
    args = ap.parse_args()

    colors = {'#': hex_rgba(args.bg), 's': hex_rgba(args.star)}
    transparent = draw(colors, (0, 0, 0, 0))
    solid = draw(colors, hex_rgba(args.bg))
    os.makedirs(args.out, exist_ok=True)

    transparent.resize((192, 192), Image.NEAREST).save(os.path.join(args.out, 'favicon-192x192.png'))
    solid.resize((180, 180), Image.NEAREST).save(os.path.join(args.out, 'apple-touch-icon.png'))
    ico = [transparent.resize((s, s), Image.NEAREST) for s in (16, 32, 48)]
    ico[0].save(os.path.join(args.out, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48)],
                append_images=ico[1:])
    print('wrote favicon.ico, favicon-192x192.png, apple-touch-icon.png to', args.out)


if __name__ == '__main__':
    main()
