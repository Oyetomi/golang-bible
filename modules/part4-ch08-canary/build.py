import re,json
M='/Users/abbey/Desktop/golang-bible/modules/part4-ch08-canary/'
def rd(f): return open(M+f).read().split('\n')
def code(f,a,b,lang='go noverify',title=None,label=None):
    ls=rd(f)[a-1:b]
    t=title or f"{label or f} · lines {a}–{b}"
    return f'```{lang} title="{t}"\n'+'\n'.join(ls)+'\n```'
def whole(f,lang,title=None):
    return f'```{lang} title="{title or f}"\n'+open(M+f).read().rstrip('\n')+'\n```'
lab=open('/tmp/lab8/starter.go').read().replace('\\n','\\\\n')
tpl=open('/tmp/p4c08/chapter.tpl').read()
def sub(m):
    return eval(m.group(1))
out=re.sub(r'@@(code\(.*?\))@@',sub,tpl,flags=re.S)
out=out.replace('@@LAB@@',lab)
open('/Users/abbey/Desktop/golang-bible/content/part-4/08-progressive-delivery-canary.mdx','w').write(out)
print(len(out.split('\n')),'lines')
