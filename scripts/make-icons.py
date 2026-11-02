"""Regenerates public/icons/*.png and icon.svg: a plain text mark "EQ FIT" in the app's cobalt and vermilion.
No EQ Solutions logo, no trademark symbol. Needs Python Playwright with Chromium and Pillow (Pillow re-encodes each PNG so it holds no ancillary metadata chunks).

  python3 -I scripts/make-icons.py <archivo-latin-wdth-italic.woff2> <output dir>

The font is the self-hosted Archivo (SIL OFL) the app already ships. The PNGs are committed, so this only needs to run if the mark changes.
"""
import base64
import os
import sys

COBALT, VERMILION, CREAM = '#2f50f0', '#d63a08', '#ffffff'


def svg(font_b64: str | None, maskable: bool) -> str:
    # 512 x 512 canvas. Maskable icons keep all text inside the central 80% circle (scale 0.68 about the centre).
    scale = 0.68 if maskable else 1.0
    face = ''
    family = "'Archivo Variable', 'Archivo', Impact, 'Arial Black', sans-serif"
    if font_b64:
        face = ("@font-face{font-family:'Archivo Variable';font-style:italic;font-weight:100 900;font-stretch:62% 125%;"
                f"src:url(data:font/woff2;base64,{font_b64}) format('woff2-variations');}}")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<style>{face}text{{font-family:{family};font-style:italic;font-weight:900;font-stretch:75%;fill:{CREAM};text-anchor:middle}}</style>
<rect width="512" height="512" fill="{COBALT}"/>
<g transform="translate(256 256) scale({scale}) translate(-256 -256)">
<rect x="-600" y="318" width="1712" height="116" fill="{VERMILION}"/>
<text x="256" y="300" font-size="270" letter-spacing="-8">EQ</text>
<text x="256" y="408" font-size="98" letter-spacing="14">FIT</text>
</g>
</svg>'''


def main(font_path: str, out: str) -> None:
    from playwright.sync_api import sync_playwright  # imported here so svg() can be used without Playwright installed
    font_b64 = base64.b64encode(open(font_path, 'rb').read()).decode()
    os.makedirs(out, exist_ok=True)
    # committed vector source: no embedded font, so it stays small and falls back to a heavy sans if Archivo is missing
    open(os.path.join(out, 'icon.svg'), 'w').write(svg(None, False))
    jobs = [('icon-192.png', 192, False), ('icon-512.png', 512, False), ('icon-maskable-512.png', 512, True), ('apple-touch-icon.png', 180, False)]
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, size, mask in jobs:
            page = b.new_page(viewport={'width': size, 'height': size}, device_scale_factor=1)
            page.set_content(f'<html><body style="margin:0"><style>svg{{width:{size}px;height:{size}px;display:block}}</style>{svg(font_b64, mask)}</body></html>')
            page.evaluate('document.fonts.ready')
            page.wait_for_timeout(300)
            page.screenshot(path=os.path.join(out, name), clip={'x': 0, 'y': 0, 'width': size, 'height': size})
            page.close()
            from PIL import Image
            Image.open(os.path.join(out, name)).convert('RGB').save(os.path.join(out, name), optimize=True)  # drops any ancillary chunks
        b.close()


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
