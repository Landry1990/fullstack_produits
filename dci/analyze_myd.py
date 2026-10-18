#!/usr/bin/env python3
"""Analyse empirique des fichiers MyISAM .MYD.

- Format statique (records a longueur fixe) : detection du stride.
- Format dynamique (records a longueur variable) : header = flag(1) + len(3 LE).
  Un record 'live' a flag & 0x01 == 0 (bit0 = deleted).
"""
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DCI_DIR = os.path.dirname(os.path.abspath(__file__))
TABLES = ['MQ_COMMN', 'MQ_EQUIV', 'MQ_CLASS', 'MQ_INTER', 'MQ_INTXT',
          'MQ_MONOG', 'MQ_MEMO', 'MQ_FORM', 'MQ_ALERT']


def detect_stride(path, window=65536, max_stride=4096):
    with open(path, 'rb') as f:
        data = f.read(window)
    size = os.path.getsize(path)
    if size == 0:
        return None, []
    best = []
    for stride in range(8, max_stride):
        if size % stride:
            continue
        hits = 0
        total = 0
        for off in range(0, min(size, window) - stride, stride):
            b = data[off]
            if b in (0x00, 0x01) or (b & 0xFE) == 0x00:
                hits += 1
            total += 1
        if total and hits / total > 0.95:
            best.append(stride)
    return size, best


def col_boundaries(path, stride, sample=300):
    with open(path, 'rb') as f:
        recs = []
        while len(recs) < sample:
            chunk = f.read(stride)
            if len(chunk) < stride:
                break
            recs.append(chunk)
    if not recs:
        return []
    counts = [0] * stride
    for r in recs:
        for i, b in enumerate(r):
            if b in (0x20, 0x00):
                counts[i] += 1
    n = len(recs)
    bounds = []
    in_data = False
    for i in range(stride):
        is_pad = counts[i] > n * 0.8
        if not is_pad and not in_data:
            bounds.append(i)
            in_data = True
        elif is_pad and in_data:
            in_data = False
    return bounds


def dump_records(path, stride, bounds, count=8, maxlen=80):
    with open(path, 'rb') as f:
        for i in range(count):
            rec = f.read(stride)
            if len(rec) < stride:
                break
            parts = []
            prev = 0
            for b in bounds + [stride]:
                seg = rec[prev:b]
                txt = seg.decode('cp1252', errors='backslashreplace').rstrip()
                parts.append(f'[{prev}:{b}]{txt[:maxlen]!r}')
                prev = b
            print(f'  rec#{i}: ' + ' | '.join(parts))


def parse_dynamic(path, count=8, maxlen=100):
    """Format dynamique MyISAM : header flag(1) + reclen(3 LE) quand bit0=0.

    Essaye la lecture sequentielle : si b[0] & 0x01 == 0, longueur = b[1..3] LE
    (header inclus). De la pratique : record = [flag][len_lo][len_mid][len_hi][data]
    """
    with open(path, 'rb') as f:
        data = f.read(200000)
    print('  -- tentative format dynamique (flag + len24 LE) --')
    pos = 0
    found = 0
    for i in range(count * 4):
        if pos + 4 >= len(data) or found >= count:
            break
        flag = data[pos]
        if flag & 0x01:
            # bloc supprime/chaine : on avance prudemment
            print(f'  @{pos}: flag={flag:#04x} (deleted/block) - skip')
            pos += 1
            continue
        reclen = data[pos + 1] | (data[pos + 2] << 8) | (data[pos + 3] << 16)
        if reclen < 4 or reclen > 100000 or pos + reclen > len(data):
            print(f'  @{pos}: flag={flag:#04x} reclen={reclen} invalide -> desync')
            pos += 1
            continue
        rec = data[pos + 4:pos + reclen]
        txt = rec.decode('cp1252', errors='backslashreplace')
        print(f'  @{pos} flag={flag:#04x} len={reclen}: {txt[:maxlen]!r}')
        pos += reclen
        found += 1


def raw_dump(path, offset=0, length=1024):
    with open(path, 'rb') as f:
        f.seek(offset)
        data = f.read(length)
    for i in range(0, len(data), 32):
        chunk = data[i:i + 32]
        hexs = ' '.join(f'{b:02x}' for b in chunk)
        asc = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
        print(f'  +{offset + i:08x}: {hexs:<96} {asc}')


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for t in TABLES:
        if only and t != only:
            continue
        path = os.path.join(DCI_DIR, t + '.MYD')
        size = os.path.getsize(path)
        print(f'\n{"=" * 70}\n{t}  ({size:,} octets)')
        if size == 0:
            print('  (fichier vide)')
            continue
        _, strides = detect_stride(path)
        print(f'  strides candidats : {strides[:10]}')
        if strides:
            stride = strides[0]
            print(f'  -> stride : {stride}  ({size // stride:,} records)')
            bounds = col_boundaries(path, stride)
            print(f'  frontieres : {bounds}')
            dump_records(path, stride, bounds)
        else:
            parse_dynamic(path)
            print('  -- dump brut offset 0 --')
            raw_dump(path, 0, 512)


if __name__ == '__main__':
    main()
