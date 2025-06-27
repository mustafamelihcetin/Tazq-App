# Icon Contrast Check

This directory contains a script to evaluate icon visibility against dark (`#2C2C2E`) and light (`#ECEFF1`) backgrounds.

Run `python3 check_contrast.py` from the repository root. The script scans `Tazq-Frontend/Resources/Images`, resizes each icon to 24×24 and 16×16, overlays it on both backgrounds, and calculates the minimal WCAG contrast ratio.

Results are written to `icon_contrast_results.csv`. The script exits with a non-zero status if any icon falls below the required 4.5:1 ratio.