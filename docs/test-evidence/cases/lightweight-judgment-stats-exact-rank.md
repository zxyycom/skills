### Case LIGHTWEIGHT-JUDGMENT-STATS-EXACT-RANK-001: 十进制分位 rank 边界

Tests:
- `test:38f3dbaa2e19685878089083ce77bb8923322951d83cebc58e182bda58fbb74d`

Tags:
- `lightweight-judgment`

Contract:
- nearest-rank 按已解析百分位的规范十进制值精确取 ceil(p*n/100)，不得因浮点误差提升整数 rank；非空集合正百分位最小 rank 为1。

Proves:
- 1..100 的 P7/P14/P28/P56 精确为7/14/28/56；5000项的 P0.14 为7，Number.MIN_VALUE 对非空集合取首项。
