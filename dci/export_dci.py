#!/usr/bin/env python3
"""Export des tables MyISAM MQ_* (format fixe, records en clair) vers CSV.

Layouts detectes empiriquement :
  MQ_COMMN  120o : flag(5) code(10) parent(10) libelle(95)
  MQ_EQUIV   26o : flag(1) code(12) cim10(8) (pad 5)
  MQ_CLASS   39o : flag(1) code_a(9) code_b(9) class_id(4 LE) pad
  MQ_INTER   13o : flag(1) a_id(4 LE) b_id(4 LE) intxt_id(4 LE)
  MQ_INTXT   55o : flag(1) id(4 LE) libelle(42) code(4) ptr(4)
  MQ_MONOG  144o : flag(1) code(9) nom(94) ptrs(7x4)
  MQ_MEMO   255o : flag(1) id(4 LE) texte(250)
  MQ_FORM   382o : flag(1) id(4 LE) nom(377)
  MQ_ALERT  vide
"""
import csv
import os
import struct
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DCI_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(DCI_DIR, 'export')
os.makedirs(OUT_DIR, exist_ok=True)


def text(b):
    return b.decode('cp1252', errors='replace').replace('\x00', '').strip()


def export(name, stride, parse):
    src = os.path.join(DCI_DIR, name + '.MYD')
    dst = os.path.join(OUT_DIR, name.lower() + '.csv')
    size = os.path.getsize(src)
    n = size // stride
    written = 0
    with open(src, 'rb') as f, open(dst, 'w', newline='', encoding='utf-8') as out:
        w = csv.writer(out, delimiter=';')
        header_written = False
        for i in range(n):
            rec = f.read(stride)
            if rec[0] & 0x01 == 0:  # bit0 = record supprime
                continue
            row = parse(rec)
            if row is None:
                continue
            if not header_written:
                w.writerow(row[0])  # header renvoye en 1er element du tuple
                header_written = True
            w.writerow(row[1])
            written += 1
    print(f'{name}: {written:,}/{n:,} records -> {os.path.basename(dst)}')


def p_commn(r):
    return (('code', 'parent', 'libelle'),
            (text(r[5:15]), text(r[15:25]), text(r[25:120])))


def p_equiv(r):
    return (('code_terrain', 'cim10'),
            (text(r[1:13]), text(r[13:21])))


def p_class(r):
    return (('code_a', 'code_b', 'class_id'),
            (text(r[1:10]), text(r[10:19]), struct.unpack('<I', r[19:23])[0]))


def p_inter(r):
    a, b, t = struct.unpack('<III', r[1:13])
    return (('a_id', 'b_id', 'intxt_id'), (a, b, t))


def p_intxt(r):
    return (('id', 'libelle', 'code', 'ptr'),
            (struct.unpack('<I', r[1:5])[0], text(r[5:47]), text(r[47:51]),
             struct.unpack('<I', r[51:55])[0]))


def p_monog(r):
    ptrs = [struct.unpack('<I', r[o:o + 4])[0] for o in range(104, 140, 4)]
    return (('code', 'nom', 'ptr1', 'ptr2', 'ptr3', 'ptr4', 'ptr5',
             'ptr6', 'ptr7', 'ptr8', 'ptr9'),
            (text(r[1:10]), text(r[10:104]), *ptrs))


def p_memo(r):
    return (('id', 'texte'),
            (struct.unpack('<I', r[1:5])[0], text(r[5:255])))


def p_form(r):
    return (('id', 'nom'), (struct.unpack('<I', r[1:5])[0], text(r[5:382])))


JOBS = [
    ('MQ_COMMN', 120, p_commn),
    ('MQ_EQUIV', 26, p_equiv),
    ('MQ_CLASS', 39, p_class),
    ('MQ_INTER', 13, p_inter),
    ('MQ_INTXT', 55, p_intxt),
    ('MQ_MONOG', 144, p_monog),
    ('MQ_MEMO', 255, p_memo),
    ('MQ_FORM', 382, p_form),
]

if __name__ == '__main__':
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for name, stride, parse in JOBS:
        if only and name != only:
            continue
        export(name, stride, parse)
