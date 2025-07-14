from PIL import Image, ImageDraw
import os

os.makedirs('assets', exist_ok=True)
colors = ['#6366f1', '#f59e42', '#42f57b', '#f542a7', '#42a7f5']
names = ['collection', '0', '1', '2', '3']

for i, name in enumerate(names):
    img = Image.new('RGB', (400, 400), colors[i % len(colors)])
    d = ImageDraw.Draw(img)
    text = f'NFT Vault\n{name.capitalize()}'
    d.text((40, 180), text, fill=(255, 255, 255))
    img.save(f'assets/{name}.png') 