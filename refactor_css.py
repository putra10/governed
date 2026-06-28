import re
import os

css_files = [
    r"c:\Users\putra\Downloads\Greater Hunt Project\Governed\src\styles\components.css",
    r"c:\Users\putra\Downloads\Greater Hunt Project\Governed\src\styles\screens.css"
]

color_map = {
    # Very dark backgrounds -> surface
    r"#[0-1][0-9a-f][0-1][0-9a-f][0-1][0-9a-f]": "var(--color-bg)",
    r"#111": "var(--color-surface)",
    r"#0a0a0a": "var(--color-bg)",
    r"#050505": "var(--color-bg)",
    r"#161616": "var(--color-surface)",
    r"#1c1c1c": "var(--color-surface)",
    
    # Borders
    r"#222": "var(--color-border)",
    r"#333": "var(--color-border-light)",
    r"#444": "var(--color-border-light)",
    r"#555": "var(--color-border-light)",
    
    # Text colors
    r"#666": "var(--color-text-muted)",
    r"#777": "var(--color-text-muted)",
    r"#888": "var(--color-text-secondary)",
    r"#999": "var(--color-text-secondary)",
    r"#aaa": "var(--color-text-secondary)",
    r"#bbb": "var(--color-text)",
    r"#ccc": "var(--color-text)",
    r"#ddd": "var(--color-text)",
    r"#eee": "var(--color-text)",
}

def replace_colors(match):
    color = match.group(0).lower()
    for pattern, replacement in color_map.items():
        if re.fullmatch(pattern, color):
            return replacement
    return color

for filepath in css_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace simple hex codes
    new_content = re.sub(r'#[0-9a-fA-F]{3,6}\b', replace_colors, content)
    
    # Increase font weights
    new_content = re.sub(r'font-weight:\s*400;', 'font-weight: 500;', new_content)
    new_content = re.sub(r'font-weight:\s*500;', 'font-weight: 600;', new_content)
    new_content = re.sub(r'font-weight:\s*600;', 'font-weight: 700;', new_content)
    
    # Optional: Increase very small fonts (e.g. 0.4375rem -> 0.5rem)
    # new_content = re.sub(r'0\.375rem', '0.45rem', new_content)
    # new_content = re.sub(r'0\.4375rem', '0.5rem', new_content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Updated {filepath}")
