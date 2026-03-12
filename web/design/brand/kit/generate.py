#!/usr/bin/env python3
"""Generate the Epure chain-link logo kit from design tokens."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# kit/ → brand/ → design/ → web/ (standalone product checkout)
WEB_ROOT = ROOT.parents[2]

MARK_PATHS = (
    'M31.85 0H16A16 16 0 0 0 0 16a16 16 0 0 0 16 16h1.65L22.075 23.5H16'
    "A7.5 7.5 0 0 1 8.5 16 7.5 7.5 0 0 1 16 8.5h11.425Z"
)
MARK_PATHS_RIGHT = (
    "M36.35 0 31.925 8.5H38A7.5 7.5 0 0 1 45.5 16 7.5 7.5 0 0 1 38 23.5H26.575"
    "L22.15 32H38a16 16 0 0 0 16-16 16 16 0 0 0-16-16Z"
)

MARK_W = 54.0
MARK_H = 32.0

ICON_SIZES = (16, 32, 48, 64, 128, 180, 192, 512)
ICON_VARIANTS = {
    "primary": {"bg": "accent", "mark": "accentContrast"},
    "surface": {"bg": "surface", "mark": "accent"},
    "subtle": {"bg": "bgSubtle", "mark": "accent"},
    "muted": {"bg": "accentMuted", "mark": "accent"},
    "ink": {"bg": "ink", "mark": "accentContrast"},
}

MARK_VARIANTS = {
    "mono-ink": {"bg": None, "mark": "ink"},
    "mono-accent": {"bg": None, "mark": "accent"},
    "mono-white": {"bg": None, "mark": "accentContrast"},
    "on-accent": {"bg": "accent", "mark": "accentContrast"},
    "on-bg": {"bg": "bg", "mark": "accent"},
    "on-bg-subtle": {"bg": "bgSubtle", "mark": "accent"},
    "on-surface": {"bg": "surface", "mark": "accent"},
    "on-ink": {"bg": "ink", "mark": "accentContrast"},
}

LOCKUP_VARIANTS = {
    "mono-ink": {"bg": None, "mark": "accent", "wordmark": "ink"},
    "mono-accent": {"bg": None, "mark": "accent", "wordmark": "accent"},
    "on-light": {"bg": "bg", "mark": "accent", "wordmark": "ink"},
    "on-surface": {"bg": "surface", "mark": "accent", "wordmark": "ink"},
    "on-subtle": {"bg": "bgSubtle", "mark": "accent", "wordmark": "ink"},
    "on-accent": {"bg": "accent", "mark": "accentContrast", "wordmark": "accentContrast"},
    "on-ink": {"bg": "ink", "mark": "accentContrast", "wordmark": "accentContrast"},
    "on-muted": {"bg": "accentMuted", "mark": "accent", "wordmark": "ink"},
}


def load_palette() -> dict:
    return json.loads((ROOT / "palette.json").read_text())


def color(palette: dict, token: str) -> str:
    return palette["colors"][token]


def mark_group(fill: str, transform: str | None = None) -> str:
    transform_attr = f' transform="{transform}"' if transform else ""
    return (
        f'<g fill="{fill}"{transform_attr}>'
        f'<path d="{MARK_PATHS}"/>'
        f'<path d="{MARK_PATHS_RIGHT}"/>'
        f"</g>"
    )


def mark_transform_for_box(box: float, padding_ratio: float = 0.1875) -> str:
    inner = box * (1 - 2 * padding_ratio)
    scale = min(inner / MARK_W, inner / MARK_H)
    width = MARK_W * scale
    height = MARK_H * scale
    tx = (box - width) / 2
    ty = (box - height) / 2
    return f"translate({tx:.4f} {ty:.4f}) scale({scale:.6f})"


def wordmark_text(
    x: float,
    y_center: float,
    fill: str,
    palette: dict,
    font_size: float,
) -> str:
    family = palette["typography"]["wordmark"]["family"]
    weight = palette["typography"]["wordmark"]["weight"]
    tracking = palette["typography"]["wordmark"]["trackingEm"] * font_size
    return (
        f'<text x="{x:.3f}" y="{y_center:.3f}" fill="{fill}" '
        f'font-family="{family}" font-size="{font_size:.3f}" font-weight="{weight}" '
        f'letter-spacing="{tracking:.3f}" dominant-baseline="central">Epure</text>'
    )


def lockup_metrics(palette: dict) -> tuple[float, float, float, float]:
    gap = MARK_H * palette["geometry"]["lockupGapRatio"]
    font_size = MARK_H * palette["geometry"]["wordmarkSizeRatio"]
    wordmark_x = MARK_W + gap
    wordmark_w = font_size * 3.05
    total_w = wordmark_x + wordmark_w
    return gap, font_size, wordmark_x, total_w


def svg_open(
    width: float | None,
    height: float | None,
    view_box: str,
    *,
    role: str = "img",
    label: str = "Epure",
) -> str:
    size_attrs = ""
    if width is not None and height is not None:
        size_attrs = f' width="{int(width)}" height="{int(height)}"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg"{size_attrs} viewBox="{view_box}" '
        f'role="{role}" aria-label="{label}">'
    )


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n")


def generate_source(palette: dict) -> None:
    source = ROOT / "source"
    gap, font_size, wordmark_x, total_w = lockup_metrics(palette)

    write(
        source / "mark.svg",
        "\n".join(
            [
                svg_open(None, None, f"0 0 {MARK_W:g} {MARK_H:g}", label="Epure mark"),
                mark_group("currentColor"),
                "</svg>",
            ]
        ),
    )

    write(
        source / "wordmark.svg",
        "\n".join(
            [
                svg_open(None, None, f"0 0 {total_w:.2f} {MARK_H:g}", label="Epure"),
                wordmark_text(0, MARK_H / 2, "currentColor", palette, font_size),
                "</svg>",
            ]
        ),
    )

    write(
        source / "lockup.svg",
        "\n".join(
            [
                svg_open(None, None, f"0 0 {total_w:.2f} {MARK_H:g}", label="Epure"),
                mark_group(color(palette, "accent")),
                wordmark_text(
                    wordmark_x,
                    MARK_H / 2,
                    color(palette, "ink"),
                    palette,
                    font_size,
                ),
                "</svg>",
            ]
        ),
    )


def generate_mark_variants(palette: dict) -> None:
    out = ROOT / "mark"
    for name, spec in MARK_VARIANTS.items():
        bg = spec["bg"]
        mark = color(palette, spec["mark"])
        parts = [svg_open(None, None, f"0 0 {MARK_W:g} {MARK_H:g}", label=f"Epure mark — {name}")]
        if bg:
            parts.append(f'<rect width="{MARK_W:g}" height="{MARK_H:g}" fill="{color(palette, bg)}"/>')
        parts.append(mark_group(mark))
        parts.append("</svg>")
        write(out / f"{name}.svg", "\n".join(parts))


def generate_lockup_variants(palette: dict) -> None:
    out = ROOT / "lockup"
    gap, font_size, wordmark_x, total_w = lockup_metrics(palette)

    for name, spec in LOCKUP_VARIANTS.items():
        bg = spec["bg"]
        mark = color(palette, spec["mark"])
        wordmark = color(palette, spec["wordmark"])
        parts = [
            svg_open(None, None, f"0 0 {total_w:.2f} {MARK_H:g}", label=f"Epure — {name}")
        ]
        if bg:
            parts.append(
                f'<rect width="{total_w:.2f}" height="{MARK_H:g}" fill="{color(palette, bg)}"/>'
            )
        parts.append(mark_group(mark))
        parts.append(
            wordmark_text(wordmark_x, MARK_H / 2, wordmark, palette, font_size)
        )
        parts.append("</svg>")
        write(out / f"{name}.svg", "\n".join(parts))


def generate_icons(palette: dict) -> None:
    radius_ratio = palette["geometry"]["iconRadiusRatio"]
    for variant_name, spec in ICON_VARIANTS.items():
        variant_dir = ROOT / "icon" / variant_name
        for size in ICON_SIZES:
            radius = round(size * radius_ratio, 4)
            transform = mark_transform_for_box(size)
            parts = [
                svg_open(size, size, f"0 0 {size} {size}", label=f"Epure icon — {variant_name}"),
                f'<rect width="{size}" height="{size}" rx="{radius}" fill="{color(palette, spec["bg"])}"/>',
                mark_group(color(palette, spec["mark"]), transform),
                "</svg>",
            ]
            write(variant_dir / f"icon-{size}.svg", "\n".join(parts))


def generate_favicon_assets(palette: dict) -> None:
    favicon_dir = ROOT / "favicon"
    primary_32 = (ROOT / "icon" / "primary" / "icon-32.svg").read_text()
    write(favicon_dir / "favicon.svg", primary_32)

    apple = (ROOT / "icon" / "primary" / "icon-180.svg").read_text()
    write(favicon_dir / "apple-touch-icon.svg", apple)

    size = 32
    transform = mark_transform_for_box(size, padding_ratio=0.12)
    mask = "\n".join(
        [
            svg_open(size, size, f"0 0 {size} {size}", label="Epure mask icon"),
            mark_group(color(palette, "ink"), transform),
            "</svg>",
        ]
    )
    write(favicon_dir / "mask-icon.svg", mask)

    manifest_icons = favicon_dir / "manifest-icons"
    for size in (192, 512):
        src = ROOT / "icon" / "primary" / f"icon-{size}.svg"
        write(manifest_icons / f"icon-{size}.svg", src.read_text())


def generate_social(palette: dict) -> None:
    social = ROOT / "social"
    size = 512
    radius = round(size * palette["geometry"]["iconRadiusRatio"], 2)
    gap, font_size, wordmark_x, total_w = lockup_metrics(palette)
    lockup_scale = (size * 0.42) / total_w
    lockup_h = MARK_H * lockup_scale
    lockup_w = total_w * lockup_scale
    tx = (size - lockup_w) / 2
    ty = (size - lockup_h) / 2
    transform = f"translate({tx:.3f} {ty:.3f}) scale({lockup_scale:.6f})"

    for name, bg_token, mark_token, word_token in (
        ("profile-accent", "accent", "accentContrast", "accentContrast"),
        ("profile-light", "bg", "accent", "ink"),
        ("profile-surface", "surface", "accent", "ink"),
    ):
        parts = [
            svg_open(size, size, f"0 0 {size} {size}", label=f"Epure {name}"),
            f'<rect width="{size}" height="{size}" rx="{radius}" fill="{color(palette, bg_token)}"/>',
            f'<g transform="{transform}">',
            mark_group(color(palette, mark_token)),
            wordmark_text(
                wordmark_x,
                MARK_H / 2,
                color(palette, word_token),
                palette,
                font_size,
            ),
            "</g>",
            "</svg>",
        ]
        write(social / f"{name}.svg", "\n".join(parts))


def sync_public_assets() -> None:
    """Sync the product favicon in this repo only."""
    favicon_src = ROOT / "favicon" / "favicon.svg"
    public_icon = WEB_ROOT / "public" / "favicon.svg"
    if public_icon.parent.is_dir() and favicon_src.exists():
        write(public_icon, favicon_src.read_text())

    mark_src = ROOT / "source" / "mark.svg"
    if mark_src.exists():
        write(ROOT.parent / "epure-mark.svg", mark_src.read_text())


def main() -> None:
    palette = load_palette()
    generate_source(palette)
    generate_mark_variants(palette)
    generate_lockup_variants(palette)
    generate_icons(palette)
    generate_favicon_assets(palette)
    generate_social(palette)
    sync_public_assets()
    print(f"Generated Epure logo kit at {ROOT}")
    print(f"Synced favicon to {WEB_ROOT / 'public' / 'favicon.svg'}")


if __name__ == "__main__":
    main()
