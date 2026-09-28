#!/usr/bin/env python3
import re, pathlib
SRC = pathlib.Path('/Users/abbey/Desktop/golang-bible/modules/part3-ch14-resilience')
B = pathlib.Path(__file__).parent
def read(f): return (SRC/f).read_text().split('\n')
def find(f, name):
    L = read(f)
    for i, l in enumerate(L):
        if re.match(r'func (\([^)]*\) )?%s\(' % re.escape(name), l) or re.match(r'type %s ' % re.escape(name), l):
            j = i
            while not L[j].startswith('}'): j += 1
            s = i
            while s > 0 and L[s-1].startswith('//'): s -= 1
            return s, j, L
    raise SystemExit('missing ' + name)
def sub(m):
    kind, f, arg = m.groups()
    if kind == 'LINES':
        a, b = map(int, arg.split('-')); return '\n'.join(read(f)[a-1:b])
    s, e, L = find(f, arg)
    return 'lines %d–%d' % (s+1, e+1) if kind == 'FUNCRANGE' else '\n'.join(L[s:e+1])
text = (B/'head.mdx').read_text() + (B/'exercises.mdx').read_text() + '\n---\n\n' + (B/'lab.mdx').read_text() + (B/'tail.mdx').read_text()
text = re.sub(r'\{\{(LINES|FUNC|FUNCRANGE):([\w.]+):([\w-]+)\}\}', sub, text)
out = pathlib.Path('/Users/abbey/Desktop/golang-bible/content/part-3/14-resilience-correctness-under-load.mdx')
out.write_text(text); print('wrote', len(text.split('\n')), 'lines')
