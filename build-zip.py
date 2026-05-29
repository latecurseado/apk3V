"""Empaqueta src/ en tres-valles-deploy.zip con paths POSIX (forward slashes).
PowerShell Compress-Archive usa backslashes que rompen el deploy en Cloudflare Pages."""
import zipfile, os, sys

src_dir = 'src'
zip_path = 'tres-valles-deploy.zip'

if os.path.exists(zip_path):
    os.remove(zip_path)

count = 0
total = 0
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            full = os.path.join(root, f)
            # Path relativo a src/, con forward slashes
            rel = os.path.relpath(full, src_dir).replace(os.sep, '/')
            zf.write(full, arcname=rel)
            count += 1
            total += os.path.getsize(full)

print(f'Empacados {count} archivos · {total/1024/1024:.2f} MB descomprimidos')
print(f'Zip final: {os.path.getsize(zip_path)/1024/1024:.2f} MB')
