#!/usr/bin/env python3
"""Build the pixel display font shipped in source/fonts/ from an upstream Fusion Pixel Font release.

    python tools/make-pixel-font.py --src path/to/fusion-pixel-12px-proportional-zh_hans.ttf
    python tools/make-pixel-font.py --src ... --level 1          # GB2312 level-1 hanzi only (~140 KB)
    python tools/make-pixel-font.py --src ... --extra "鑫森淼"    # add characters outside GB2312

Upstream: https://github.com/TakWolf/fusion-pixel-font (SIL OFL 1.1, no reserved font name).
Download the "12px-proportional-ttf" zip from the releases page and point --src at the zh_hans TTF.
The subset keeps ASCII, Latin-1, GB2312 level-1 (+ level-2) hanzi, CJK and Western punctuation,
arrows, box drawing, geometric shapes and the playing-card suits. Needs fonttools + brotli:
    pip install fonttools brotli
"""
import argparse
import os
import subprocess
import sys
import tempfile

RANGES = [
    'U+0020-007E',  # ASCII
    'U+00A0-00FF',  # Latin-1 supplement
    'U+2010-2027',  # dashes, quotes, bullets, ellipsis
    'U+2030-205E',  # per mille, primes, references
    'U+2190-21FF',  # arrows
    'U+2500-257F',  # box drawing
    'U+25A0-25FF',  # geometric shapes
    'U+2660-2667',  # playing-card suits
    'U+3000-303F',  # CJK symbols and punctuation
    'U+FF00-FFEF',  # fullwidth forms
]


def gb2312_hanzi(level):
    chars = set()
    last_row = 0xD7 if level == 1 else 0xF7
    for hi in range(0xB0, last_row + 1):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return chars


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, help='upstream TTF (zh_hans flavour)')
    ap.add_argument('--out', default='source/fonts/FusionPixel12-Prop.subset.woff2')
    ap.add_argument('--level', type=int, choices=[1, 2], default=2, help='GB2312 hanzi level to include')
    ap.add_argument('--extra', default='', help='extra characters to include')
    args = ap.parse_args()

    chars = gb2312_hanzi(args.level) | set(args.extra)
    unicodes = RANGES + ['U+%04X' % ord(c) for c in sorted(chars)]
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(','.join(unicodes))
        listing = f.name
    try:
        cmd = [sys.executable, '-m', 'fontTools.subset', args.src,
               '--unicodes-file=' + listing, '--output-file=' + args.out,
               '--flavor=woff2', '--no-hinting', '--desubroutinize', '--layout-features=*',
               '--name-IDs=*', '--notdef-outline']
        subprocess.run(cmd, check=True)
    finally:
        os.unlink(listing)
    size = os.path.getsize(args.out)
    print('%s: %d hanzi + symbol ranges, %d KB' % (args.out, len(chars), size // 1024))


if __name__ == '__main__':
    main()
