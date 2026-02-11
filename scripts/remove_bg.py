#!/usr/bin/env python3
"""Elimină fundalul unei imagini folosind rembg. Utilizare: python remove_bg.py input.png [output.png]"""
import sys
import os
import io

def main():
    if len(sys.argv) < 2:
        print("Utilizare: python remove_bg.py input.png [output.png]")
        sys.exit(1)
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.replace(".png", "-no-bg.png").replace(".jpg", "-no-bg.png")

    if not os.path.isfile(input_path):
        print(f"Eroare: fișierul nu există: {input_path}")
        sys.exit(1)

    try:
        from rembg import remove
        from PIL import Image
    except ImportError:
        print("Instalează dependențele: pip install rembg pillow")
        sys.exit(1)

    with open(input_path, "rb") as f:
        input_data = f.read()
    output_data = remove(input_data, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10)
    img = Image.open(io.BytesIO(output_data))
    img.save(output_path)
    print(f"Salvat: {output_path}")

if __name__ == "__main__":
    main()
