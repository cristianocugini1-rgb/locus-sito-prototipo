# Dal 18/11/2026: converte la stanza HDR di Blender nel WebP leggero usato dal sito (public/hdri/stanza-locus.webp).
# Uso: python scripts/stanza-da-hdr.py public/hdri/stanza-locus.hdr, poi copiare stanza-95.webp in public/hdri/stanza-locus.webp.
import numpy as np, sys
from PIL import Image
def read_hdr(p):
    d=open(p,'rb').read(); i=0
    while True:
        j=d.index(b'\n',i); line=d[i:j]; i=j+1
        if line.startswith(b'-Y'): _,h,_,w=line.split(); h,w=int(h),int(w); break
    out=np.zeros((h,w,4),np.uint8)
    for y in range(h):
        assert d[i]==2 and d[i+1]==2; i+=4
        for c in range(4):
            x=0
            while x<w:
                n=d[i]; i+=1
                if n>128:
                    n-=128; out[y,x:x+n,c]=d[i]; i+=1
                else:
                    out[y,x:x+n,c]=np.frombuffer(d[i:i+n],np.uint8); i+=n
                x+=n
    e=out[...,3].astype(np.int32)
    f=np.where(e>0,np.ldexp(1.0,e-136),0.0)
    return out[...,:3]*f[...,None]
rgb=read_hdr(sys.argv[1])
print('max',rgb.max(),'p99',np.percentile(rgb,99),'mean',rgb.mean())
v=np.minimum(rgb*0.62,1.6)   # quello che lo shader usa davvero
np.save('stanza_ref.npy',v)
enc=np.sqrt(v/1.6)            # radice: più gradini nelle zone scure
img=Image.fromarray(np.round(enc*255).astype(np.uint8))
for q in (90,95):
    img.save(f'stanza-{q}.webp',quality=q,method=6)
img.save('stanza-ll.webp',lossless=True,method=6)
for q in (90,95):
    back=(np.asarray(Image.open(f'stanza-{q}.webp')).astype(float)/255)**2*1.6
    print(q,'errore medio',np.abs(back-v).mean(),'max',np.abs(back-v).max())
