# Feeling Native On Mobile (Dumped from .agents/skills/mobile-native/SKILL.md)
See original for full details.
Key rules:
- `viewport-fit=cover` + `env(safe-area-inset-*, 0px)`
- `-webkit-tap-highlight-color: transparent`
- `touch-action: manipulation` on buttons/links
- `:active` press feedback `scale(0.97)`
- `user-select: none` on controls
- `overscroll-behavior: none`
- input 16px minimum font size
- test on real hardware
