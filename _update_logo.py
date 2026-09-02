from PIL import Image
import shutil

# A imagem oficial do logo fica em assets/financeiro.png.
# Todas as demais versoes (logo.png, icones PWA, apple-touch-icon) sao geradas a partir dela.
shutil.copy('assets/financeiro.png', 'assets/logo.png')

# Regenera icones PWA a partir do logo oficial
src = Image.open('assets/financeiro.png')
w, h = src.size
size = min(w, h)
left = (w - size) // 2
top = (h - size) // 2
src = src.crop((left, top, left + size, top + size))

for s in [192, 512]:
    icon = src.resize((s, s), Image.Resampling.LANCZOS)
    icon.save(f'assets/icon-{s}.png', 'PNG')

apple = src.resize((180, 180), Image.Resampling.LANCZOS)
apple.save('assets/apple-touch-icon.png', 'PNG')

print('Logos atualizados.')
