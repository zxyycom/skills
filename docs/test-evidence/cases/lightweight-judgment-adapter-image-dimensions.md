### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-017: 图片头部尺寸的领域含义

Tests:
- `test:09ea90ef28ebb19955f7a406a3dcaefbdf3ad71d3c38e2d1efc535a0b6cf4d76`

Tags:
- `lightweight-judgment`

Contract:
- 本地 PNG IHDR 与 JPEG SOF 读取分别返回显式 width 和 height，不能混淆宽高；头部尺寸不证明完整图像 codec 有效。

Proves:
- 合成 PNG 与含前置 application segment 的独立 JPEG SOF 元数据均读取为 width=301、height=280；非正方形 fixture 区分两轴顺序，不证明 JPEG 完整解码。
