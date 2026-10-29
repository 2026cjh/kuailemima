"""生成图标预览图 design/logo_preview.png（桌面圆角方形、圆形、通知栏小图标）"""
import sys, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter
NAME = '快乐密码'
font = subprocess.run(['fc-match', '-f', '%{file}', 'Noto Sans CJK SC'], capture_output=True, text=True).stdout.strip()
src = Image.open('design/icon_full.png').convert('RGBA')
W, H = 1200, 620
bg = Image.new('RGBA', (W, H), (236, 241, 239, 255)); d = ImageDraw.Draw(bg)
def masked(img, size, shape):
    crop = img.crop((int(1024*18/108),)*2 + (int(1024*90/108),)*2).resize((size, size), Image.LANCZOS)
    m = Image.new('L', (size, size), 0); dm = ImageDraw.Draw(m)
    (dm.rounded_rectangle([0, 0, size-1, size-1], radius=int(size*0.23), fill=255) if shape == 'sq' else dm.ellipse([0, 0, size-1, size-1], fill=255))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0)); out.paste(crop, (0, 0), m); return out
def shadow(size, shape):
    s = Image.new('RGBA', (size+80, size+80), (0, 0, 0, 0)); ds = ImageDraw.Draw(s)
    (ds.rounded_rectangle([40, 52, 40+size, 52+size], radius=int(size*0.23), fill=(20, 52, 46, 70)) if shape == 'sq' else ds.ellipse([40, 52, 40+size, 52+size], fill=(20, 52, 46, 70)))
    return s.filter(ImageFilter.GaussianBlur(18))
f1 = ImageFont.truetype(font, 32); f2 = ImageFont.truetype(font, 22)
for (x, shape, label) in [(90, 'sq', '圆角方形'), (470, 'ci', '圆形')]:
    bg.alpha_composite(shadow(300, shape), (x-40, 70)); bg.alpha_composite(masked(src, 300, shape), (x, 110))
    for txt, f, y, col in [(NAME, f1, 435, (15, 31, 28)), (label, f2, 482, (127, 142, 138))]:
        d.text((x+150-d.textlength(txt, font=f)/2, y), txt, font=f, fill=col)
nx = 900; d.rounded_rectangle([nx-20, 180, nx+250, 330], radius=24, fill=(255, 255, 255, 200), outline=(255, 255, 255))
ic = Image.open('android/app/src/main/res/drawable-xxxhdpi/ic_stat_notify.png').convert('RGBA').resize((56, 56), Image.LANCZOS)
tint = Image.new('RGBA', ic.size, (12, 138, 110, 255)); tint.putalpha(ic.split()[3]); bg.alpha_composite(tint, (nx, 200))
d.text((nx+70, 205), '双色球开奖', font=f2, fill=(15, 31, 28)); d.text((nx, 275), '04 05 20 21 26 30 + 12', font=f2, fill=(74, 92, 88))
d.text((nx+115-d.textlength('通知栏图标', font=f2)/2, 350), '通知栏图标', font=f2, fill=(127, 142, 138))
d.text((60, 40), NAME + ' · 应用图标', font=ImageFont.truetype(font, 34), fill=(15, 31, 28))
bg.convert('RGB').save('design/logo_preview.png'); print('ok')
