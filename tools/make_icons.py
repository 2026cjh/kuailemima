"""生成安卓图标：玉绿渐变底 + 磨砂玻璃圆盘 + 红蓝两颗带高光的球。"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os, math
RES='android/app/src/main/res'
S=1024  # 设计画布（对应自适应图标 108dp）
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(len(a)))
def gradient(size, c1, c2):
    w=h=size; img=Image.new('RGBA',(w,h)); px=img.load()
    for y in range(h):
        for x in range(w):
            t=(x+y)/(2*(w-1)); px[x,y]=lerp(c1,c2,t)+(255,)
    return img
def background(size):
    bg=gradient(size,(20,168,136),(9,86,104))
    glow=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(glow)
    r=int(size*0.55); cx,cy=int(size*0.22),int(size*0.12)
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(255,255,255,70)); glow=glow.filter(ImageFilter.GaussianBlur(size*0.12))
    glow2=Image.new('RGBA',(size,size),(0,0,0,0)); d2=ImageDraw.Draw(glow2)
    r2=int(size*0.45); d2.ellipse([int(size*0.95)-r2,int(size*0.95)-r2,int(size*0.95)+r2,int(size*0.95)+r2],fill=(255,214,160,55)); glow2=glow2.filter(ImageFilter.GaussianBlur(size*0.12))
    return Image.alpha_composite(Image.alpha_composite(bg,glow),glow2)
def sphere(size, base, dark):
    img=Image.new('RGBA',(size,size),(0,0,0,0)); px=img.load(); r=size/2
    lx,ly=0.34,0.26
    for y in range(size):
        for x in range(size):
            dx=(x+0.5-r)/r; dy=(y+0.5-r)/r; d=dx*dx+dy*dy
            if d>1: continue
            z=math.sqrt(1-d)
            shade=0.55+0.45*z
            col=lerp(dark,base,min(1,shade))
            # 高光
            hx=(x/size-lx); hy=(y/size-ly); hd=math.sqrt(hx*hx+hy*hy)
            spec=max(0,1-hd/0.17)**2
            col=lerp(col,(255,255,255),spec*0.85)
            a=255 if d<0.985 else int(255*(1-d)/0.015)
            px[x,y]=col+(max(0,min(255,a)),)
    return img
def foreground(size, mono=False):
    fg=Image.new('RGBA',(size,size),(0,0,0,0))
    c=size/2
    # 磨砂玻璃圆盘（落在安全区内：直径约 0.56）
    disc_r=size*0.30
    if not mono:
        sh=Image.new('RGBA',(size,size),(0,0,0,0)); ds=ImageDraw.Draw(sh)
        ds.ellipse([c-disc_r,c-disc_r+size*0.025,c+disc_r,c+disc_r+size*0.025],fill=(0,40,40,70)); sh=sh.filter(ImageFilter.GaussianBlur(size*0.03))
        fg=Image.alpha_composite(fg,sh)
        disc=Image.new('RGBA',(size,size),(0,0,0,0)); dd=ImageDraw.Draw(disc)
        dd.ellipse([c-disc_r,c-disc_r,c+disc_r,c+disc_r],fill=(255,255,255,62))
        fg=Image.alpha_composite(fg,disc)
        rim=Image.new('RGBA',(size,size),(0,0,0,0)); dr=ImageDraw.Draw(rim)
        dr.ellipse([c-disc_r,c-disc_r,c+disc_r,c+disc_r],outline=(255,255,255,170),width=max(2,int(size*0.008)))
        fg=Image.alpha_composite(fg,rim)
    br=int(size*0.165)
    pos=[(c-size*0.075,c-size*0.065,(232,52,64),(140,14,26)),(c+size*0.085,c+size*0.075,(48,104,232),(16,42,128))]
    for (x,y,base,dark) in pos:
        if mono:
            m=Image.new('RGBA',(size,size),(0,0,0,0)); dm=ImageDraw.Draw(m); dm.ellipse([x-br,y-br,x+br,y+br],fill=(255,255,255,255)); fg=Image.alpha_composite(fg,m); continue
        s=sphere(2*br,base,dark)
        shadow=Image.new('RGBA',(size,size),(0,0,0,0)); dsh=ImageDraw.Draw(shadow)
        dsh.ellipse([x-br*0.95,y-br*0.8+size*0.03,x+br*0.95,y+br*1.05+size*0.03],fill=(0,30,40,90)); shadow=shadow.filter(ImageFilter.GaussianBlur(size*0.02))
        fg=Image.alpha_composite(fg,shadow); fg.alpha_composite(s,(int(x-br),int(y-br)))
    if mono:  # 两球之间留一道缝，单色图标才分得清
        cut=Image.new('L',(size,size),0); dc=ImageDraw.Draw(cut); x,y=pos[1][0],pos[1][1]; g=size*0.018
        dc.ellipse([x-br-g,y-br-g,x+br+g,y+br+g],fill=255)
        a=fg.split()[3]; first=Image.new('L',(size,size),0); df=ImageDraw.Draw(first); x0,y0=pos[0][0],pos[0][1]; df.ellipse([x0-br,y0-br,x0+br,y0+br],fill=255)
        first=ImageChops.subtract(first,cut); second=Image.new('L',(size,size),0); ImageDraw.Draw(second).ellipse([x-br,y-br,x+br,y+br],fill=255)
        alpha=ImageChops.lighter(first,second); fg=Image.new('RGBA',(size,size),(255,255,255,0)); fg.putalpha(alpha)
    return fg
bg=background(S); fg=foreground(S); mono=foreground(S,True)
full=Image.alpha_composite(bg,fg)
os.makedirs('design',exist_ok=True); full.save('design/icon_full.png')
def rounded_mask(size, radius):
    m=Image.new('L',(size,size),0); ImageDraw.Draw(m).rounded_rectangle([0,0,size-1,size-1],radius=radius,fill=255); return m
dens={'mdpi':1,'hdpi':1.5,'xhdpi':2,'xxhdpi':3,'xxxhdpi':4}
for d,k in dens.items():
    p=f'{RES}/mipmap-{d}'; os.makedirs(p,exist_ok=True)
    n=int(108*k); fg.resize((n,n),Image.LANCZOS).save(f'{p}/ic_launcher_foreground.png')
    bg.resize((n,n),Image.LANCZOS).save(f'{p}/ic_launcher_background.png')
    mono.resize((n,n),Image.LANCZOS).save(f'{p}/ic_launcher_monochrome.png')
    L=int(48*k)
    # 旧版图标：取中间 72/108 的区域
    crop=full.crop((int(S*18/108),int(S*18/108),int(S*90/108),int(S*90/108))).resize((L,L),Image.LANCZOS)
    sq=Image.new('RGBA',(L,L),(0,0,0,0)); sq.paste(crop,(0,0),rounded_mask(L,int(L*0.22))); sq.save(f'{p}/ic_launcher.png')
    rd=Image.new('RGBA',(L,L),(0,0,0,0)); cm=Image.new('L',(L,L),0); ImageDraw.Draw(cm).ellipse([0,0,L-1,L-1],fill=255); rd.paste(crop,(0,0),cm); rd.save(f'{p}/ic_launcher_round.png')
    # 通知栏小图标：纯白剪影
    q=f'{RES}/drawable-{d}'; os.makedirs(q,exist_ok=True); N=int(24*k)
    m=mono.crop((int(S*0.2),int(S*0.2),int(S*0.8),int(S*0.8))).resize((N,N),Image.LANCZOS); m.save(f'{q}/ic_stat_notify.png')
    # 启动图标
    fg.crop((int(S*18/108),int(S*18/108),int(S*90/108),int(S*90/108))).resize((int(96*k),int(96*k)),Image.LANCZOS).save(f'{q}/splash_icon.png')
print('icons done')
