#!/usr/bin/env python3
import re, sys, pathlib
SRC = pathlib.Path('/tmp/p3c13/acl')
B = pathlib.Path(__file__).parent

def read(f): return (SRC/f).read_text().split('\n')

def find(f, name):
    L = read(f)
    for i, l in enumerate(L):
        if re.match(r'func (\([^)]*\) )?%s\(' % re.escape(name), l) or re.match(r'type %s ' % re.escape(name), l):
            j = i
            if l.rstrip().endswith('}') and '{' in l: return i, i, L   # one-liner
            while not L[j].startswith('}'): j += 1
            # include leading comment lines
            s = i
            while s > 0 and L[s-1].startswith('//'): s -= 1
            return s, j, L
    raise SystemExit('missing ' + name)

def sub(m):
    kind, f, arg = m.group(1), m.group(2), m.group(3)
    if kind == 'LINES':
        a, b = map(int, arg.split('-')); L = read(f)
        return '\n'.join(L[a-1:b])
    s, e, L = find(f, arg)
    if kind == 'FUNCRANGE': return 'lines %d–%d' % (s+1, e+1)
    return '\n'.join(L[s:e+1])

text = (B/'head.mdx').read_text() + (B/'exercises.mdx').read_text() + '\n---\n\n' + (B/'lab.mdx').read_text() + (B/'tail.mdx').read_text()
text = re.sub(r'\{\{(LINES|FUNC|FUNCRANGE):([\w.]+):([\w-]+)\}\}', sub, text)
out = pathlib.Path('/Users/abbey/Desktop/golang-bible/content/part-3/13-broken-access-control.mdx')
out.write_text(text)
print('wrote', out, len(text.split('\n')), 'lines')
