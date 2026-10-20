"""Render an original cloud + ascending pipeline mark at macOS icon sizes."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
assets = root / 'assets'
iconset = assets / 'PipelineIntelligence.iconset'
iconset.mkdir(exist_ok=True)
size = 2048
image = Image.new('RGBA', (size, size))
mask = Image.new('L', (size, size))
ImageDraw.Draw(mask).rounded_rectangle((128, 128, 1920, 1920), radius=400, fill=255)
gradient = Image.new('RGBA', (size, size))
gd = ImageDraw.Draw(gradient)
for y in range(size):
    t = y / size
    gd.line((0, y, size, y), fill=(int(13 - 8*t), int(167 - 55*t), int(246 - 31*t), 255))
image.paste(gradient, (0, 0), mask)
d = ImageDraw.Draw(image)
# White cloud with an ascending chart, distinct from the voice application's microphone.
d.ellipse((370, 760, 1020, 1410), fill='white')
d.ellipse((600, 480, 1350, 1230), fill='white')
d.ellipse((1040, 675, 1680, 1315), fill='white')
d.rounded_rectangle((640, 910, 1490, 1410), radius=180, fill='white')
for x, y, bottom, color in [(690, 1060, 1290, '#83caff'), (920, 915, 1290, '#399bed'), (1150, 765, 1290, '#0875d4')]:
    d.rounded_rectangle((x, y, x+150, bottom), radius=38, fill=color)
# Match the native-looking footprint of the neighboring desktop apps.
# The prior 87.5% tile looked larger; both companion icons now use 81.25%.
inset_image = Image.new('RGBA', (size, size))
inset_image.alpha_composite(image.resize((1902, 1902), Image.Resampling.LANCZOS), (73, 73))
image = inset_image
for n in [16, 32, 64, 128, 256, 512]:
    for scale in [1, 2]:
        image.resize((n*scale, n*scale), Image.Resampling.LANCZOS).save(iconset / f'icon_{n}x{n}{"@2x" if scale == 2 else ""}.png')
image.resize((1024, 1024), Image.Resampling.LANCZOS).save(assets / 'PipelineIntelligence.icns', format='ICNS')
image.resize((256, 256), Image.Resampling.LANCZOS).save(assets / 'icon.png')
image.resize((1024, 1024), Image.Resampling.LANCZOS).save(assets / 'icon-preview.png')
print('Pipeline blue cloud icon generated.')
