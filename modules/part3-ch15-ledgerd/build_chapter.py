#!/usr/bin/env python3
"""Assemble chapter 15 from head.mdx + real source excerpts.
{{CODE:file:start|end}}  fenced excerpt from the first line containing `start` to the first line after it containing `end`
{{OUT:name}}             an out/*.txt file as a text block body"""
import re, pathlib
SRC = pathlib.Path('/Users/abbey/Desktop/golang-bible/modules/part3-ch15-ledgerd')
B = pathlib.Path(__file__).parent

def code(m):
    f, spec = m.group(1), m.group(2)
    a, b = spec.split('|')
    L = (SRC/f).read_text().split('\n')
    i = next(k for k, l in enumerate(L) if a in l)
    excl = b.startswith('<')
    if excl:
        b = b[1:]
    if b == '^END':                             # the first line after start that begins with "}"
        j = next(k for k in range(i + 1, len(L)) if L[k].startswith('}'))
    else:
        j = next(k for k in range(i + 1, len(L)) if b in L[k])
    end = j - 1 if excl else j
    while excl and L[end].strip() == '':
        end -= 1
    return '```go noverify\n// %s, lines %d–%d\n%s\n```' % (f, i+1, end+1, '\n'.join(L[i:end+1]))

text = (B/'head.mdx').read_text() + (B/'exercises.mdx').read_text() + '\n---\n\n' + (B/'lab.mdx').read_text() + (B/'tail.mdx').read_text()
text = re.sub(r'\{\{CODE:([\w./]+):([^}]+)\}\}', code, text)
text = re.sub(r'\{\{OUT:(\w+)\}\}', lambda m: (SRC/'out'/(m.group(1)+'.txt')).read_text().rstrip('\n'), text)
out = pathlib.Path('/Users/abbey/Desktop/golang-bible/content/part-3/15-fintech-capstone.mdx')
out.write_text(text); print('wrote', len(text.split('\n')), 'lines')
