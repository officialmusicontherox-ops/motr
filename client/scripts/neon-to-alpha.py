"""
Turns neon lettering on a black ground into the same lettering on nothing.

  python3 -P scripts/neon-to-alpha.py <in> <out.png> <width>

The black is not cut out with a threshold, which would leave a hard dark
fringe round every glow. Each pixel's brightest channel becomes its opacity
and the colour is scaled back up to full strength, so the bloom fades into
whatever is behind it exactly as it faded into black.
"""
import sys
from PIL import Image, ImageChops, ImageMath

src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
r, g, b = im.split()
alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)

def unmult(ch):
    return ImageMath.lambda_eval(
        lambda a: a["convert"](a["min"](a["float"](a["c"]) * 255.0 / a["max"](a["float"](a["al"]), 1.0), 255.0), "L"),
        c=ch, al=alpha,
    )

rgba = Image.merge("RGBA", (unmult(r), unmult(g), unmult(b), alpha))

# Crop to what is actually lit, ignoring the faint noise a generated image
# carries in its "black".
box = alpha.point(lambda v: 255 if v > 14 else 0).getbbox()
rgba = rgba.crop(box)
h = round(rgba.height * width / rgba.width)
rgba = rgba.resize((width, h), Image.LANCZOS)
rgba.save(out, optimize=True)
print(f"  {out}  {width}x{h}")
