### Case INVESTIGATION-DIAGNOSTIC-RENDERING-001: 共同渲染隔离历史定位与受限错误详情

Tests:
- `test:22be93b0f07aedf95a16824797aa89d43db0740d0e4a3491b64541573e9ca3ba`

Tags:
- `investigation-report`

Contract:
- 诊断来源不与自由文本共享限长预算；原因文本安全净化、逐项限长，省略原因必须声明数量。

Proves:
- 超过 500 字符的相对来源路径与固定 revision 完整展示；五项长原因按序展示前三项，保留每项 code 与 stateId，并声明省略两项。
- 每条展示的原因 detail 不超过 500 字符，输入中的 provider token 被净化，实际输出不含该 token。
