#!/bin/zsh
# Design-debt measurement for a Next.js repo. Run from the repo root.
# Every number in docs/product/design-debt.md comes from this script.
set -u
TSX=$(find app components lib -name '*.tsx' 2>/dev/null)
CSS=$(find app components -name '*.css' 2>/dev/null)
TOKENS=app/styles/tokens.css

echo "## 1. Inline style blocks by area"
for area in "app/admin" "app/team" "app/portal" "app/(public)" "app/api" "app" "components" "lib"; do
  files=$(find "$area" -maxdepth 1 -name '*.tsx' 2>/dev/null; find "$area" -mindepth 1 -name '*.tsx' 2>/dev/null)
  [ -z "$files" ] && continue
  total=$(echo "$files" | tr '\n' '\0' | xargs -0 grep -ho 'style={{' 2>/dev/null | wc -l | tr -d ' ')
  styled=$(echo "$files" | tr '\n' '\0' | xargs -0 grep -hoE 'style=\{\{[^}]*\b(color|background|backgroundColor|border|borderColor|borderTop|borderBottom|borderLeft|borderRight|borderRadius|fontFamily|boxShadow|outline)\s*:' 2>/dev/null | wc -l | tr -d ' ')
  okd=$(echo "$files" | tr '\n' '\0' | xargs -0 grep -h 'style={{' 2>/dev/null | grep -c 'layout-ok' | tr -d ' ')
  printf "%-14s total=%-4s styled=%-4s layout-only=%-4s marked-layout-ok=%s\n" "$area" "$total" "$styled" "$((total-styled))" "$okd"
done

echo; echo "## 2. Class prefixes per stylesheet (first dash segment, rule count)"
for f in $(echo "$CSS"); do
  echo "### $f ($(wc -l < "$f") lines)"
  grep -oE '^\s*\.[a-zA-Z][a-zA-Z0-9]*(-|\b)' "$f" | sed -E 's/^\s*\.//; s/-$/-/' | sort | uniq -c | sort -rn | head -40
done

echo; echo "## 3. Raw colours outside the token file (by file)"
grep -rnoE '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)' app components lib --include='*.tsx' --include='*.ts' --include='*.css' --include='*.js' 2>/dev/null \
  | grep -v "^$TOKENS" | grep -vE 'unicode-range|url\(' | cut -d: -f1 | sort | uniq -c | sort -rn

echo; echo "## 4. Off-scale font sizes and spacing (CSS px only)"
TYPE_SCALE="11 12 13 14 15 16 18 20 22 24 26 28 32 40 48 64 80"
SPACE_SCALE="0 2 4 6 8 10 12 14 16 18 20 24 28 32 40 48 56 64 80 96 120"
echo "font-size off-scale:"; for f in $(echo "$CSS"); do grep -oE 'font-size:\s*[0-9.]+px' "$f" | grep -oE '[0-9.]+' ; done | sort | uniq -c | sort -rn | awk -v s="$TYPE_SCALE" 'BEGIN{split(s,a," ");for(i in a)ok[a[i]]=1} !($2 in ok){print}'
echo "gap/padding/margin off-scale:"; for f in $(echo "$CSS"); do grep -oE '\b(gap|padding|margin)[a-z-]*:\s*[^;]+' "$f" | grep -oE '[0-9]+px' | grep -oE '[0-9]+'; done | sort | uniq -c | sort -rn | awk -v s="$SPACE_SCALE" 'BEGIN{split(s,a," ");for(i in a)ok[a[i]]=1} !($2 in ok){print}'

echo; echo "## 5. Page-level maxWidth outside sanctioned widths (640/880/1440)"
grep -rnoE 'maxWidth:\s*"?[0-9]{3,4}' app components --include='*.tsx' | grep -vE '(640|880|1440)' | cut -c1-120
grep -rnoE 'max-width:\s*[0-9]{3,4}px' $(echo "$CSS") | grep -vE '(640|880|1440)px' | cut -d: -f1 | sort | uniq -c | sort -rn | head

echo; echo "## 6. Components with private <style> / styled-jsx / module css"
grep -rlE '<style jsx|<style>|<style ' app components --include='*.tsx' | sort
find app components -name '*.module.css' | sort

echo; echo "## 7. CSS vars used but never defined, and hex fallbacks"
DEFINED=$(grep -rhoE '^\s*--[a-zA-Z0-9-]+\s*:' app components --include='*.css' --include='*.tsx' | sed -E 's/^\s*//; s/\s*:$//' | sort -u)
USED=$(grep -rhoE 'var\(--[a-zA-Z0-9-]+' app components lib --include='*.css' --include='*.tsx' --include='*.ts' | sed 's/var(//' | sort -u)
echo "undefined:"; comm -13 <(echo "$DEFINED") <(echo "$USED")
echo "hex fallbacks:"; grep -rnoE 'var\(--[a-zA-Z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)' app components lib --include='*.css' --include='*.tsx' --include='*.ts' | wc -l

echo; echo "## 8. Colour values in shared TS lists / DB"
grep -rnE '(accent|color|colour|hex)\s*[:=]\s*"#' lib app --include='*.ts' --include='*.tsx' | cut -c1-140 | head -20
grep -rnE '"#[0-9a-fA-F]{6}"' lib --include='*.ts' | cut -c1-140 | head -10

echo; echo "## 9. Overlapping component classes (candidates)"
for pat in progress avatar box card badge chip pill tag meter callout alert; do
  n=$(grep -oE "^\.[a-z-]*${pat}[a-z-]*" $(echo "$CSS") 2>/dev/null | sed 's/^[^:]*://' | sort -u | wc -l | tr -d ' ')
  printf "%-10s %s classes: " "$pat" "$n"; grep -ohE "^\.[a-z-]*${pat}[a-z-]*" $(echo "$CSS") 2>/dev/null | sort -u | tr '\n' ' ' | cut -c1-200; echo
done

echo; echo "## 10. Non-browser painters and the palette module"
grep -rlE 'ImageResponse|satori|qrcode|QRCode|<html|<body' lib app --include='*.ts' --include='*.tsx' --include='*.js' | sort
echo "palette module: $(ls lib/design/palette.ts 2>/dev/null || echo MISSING)"; grep -rl "design/palette" lib app --include='*.ts' --include='*.tsx' --include='*.js' | sort

echo; echo "## vercel.json region"; grep -A2 '"regions"' vercel.json
