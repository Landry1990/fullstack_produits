from PIL import Image, ImageDraw
import os


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Background rounded emerald square
    padding = size // 12
    corner = size // 8
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner,
        fill=(5, 150, 105),  # emerald-600 #059669
    )

    # "Z" shape using polygon approximation with rounded caps
    stroke = size * 0.13
    margin_h = size * 0.26
    margin_v = size * 0.22
    x1, x2 = margin_h, size - margin_h
    y1, y2 = margin_v, size - margin_v

    # Z lines: top horizontal, diagonal, bottom horizontal
    def rounded_line(start, end, width):
        draw.line([start, end], fill=(255, 255, 255), width=width, joint="curve")

    rounded_line((x1, y1), (x2, y1), int(stroke))
    rounded_line((x2, y1), (x1, y2), int(stroke))
    rounded_line((x1, y2), (x2, y2), int(stroke))

    # White cross (pharmacy symbol)
    cx, cy = size // 2, size // 2 + size // 40
    arm_w = size * 0.10
    arm_h = size * 0.30
    gap = arm_w
    # Vertical arm
    draw.rounded_rectangle(
        [cx - arm_w / 2, cy - arm_h / 2, cx + arm_w / 2, cy + arm_h / 2],
        radius=int(arm_w / 2),
        fill=(255, 255, 255),
    )
    # Horizontal arm
    draw.rounded_rectangle(
        [cx - arm_h / 2, cy - arm_w / 2, cx + arm_h / 2, cy + arm_w / 2],
        radius=int(arm_w / 2),
        fill=(255, 255, 255),
    )

    return img


base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = os.path.join(base, "public")
os.makedirs(out_dir, exist_ok=True)

for s in [192, 512]:
    icon = draw_icon(s)
    icon.save(os.path.join(out_dir, f"pwa-icon-{s}x{s}.png"), "PNG")
    print(f"Generated pwa-icon-{s}x{s}.png")
