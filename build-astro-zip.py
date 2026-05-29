"""Empaqueta astro-poc/dist/ en tresvalles-astro-deploy.zip con paths POSIX.
Listo para subir a Cloudflare Pages, Netlify o cualquier hosting estático."""
import zipfile, os

src_dir = os.path.join('astro-poc', 'dist')
zip_path = 'tresvalles-astro-deploy.zip'

if not os.path.isdir(src_dir):
    raise SystemExit(f'No existe {src_dir}. Ejecuta primero: cd astro-poc && npm run build')

if os.path.exists(zip_path):
    os.remove(zip_path)

count = 0
total = 0
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, src_dir).replace(os.sep, '/')
            zf.write(full, arcname=rel)
            count += 1
            total += os.path.getsize(full)

print(f'Empacados {count} archivos · {total/1024/1024:.2f} MB descomprimidos')
print(f'Zip final: {os.path.getsize(zip_path)/1024/1024:.2f} MB')
print(f'Ruta: {os.path.abspath(zip_path)}')
