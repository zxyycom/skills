### Case RECORD-STAGE-PARSE-EQUIVALENCE-001: 两域fresh真实读取后复用同调用解析

Tests:
- `test:4bd23531078f431024342dbced0241ee0ff802e041b03dc64d5d2d84ab6e4380`
- `test:d804b8fee726218117778c7759adb9a180176830f1d476885e0884fe7169d01a`

Tags:
- `index-runtime`

Contract:
- 独立阶段仍实际读取 W，并按 scope 策略验收 P 的 payload 与完整成员身份；同调用实际字节和完整 snapshot 证据等价后可复用不可变解析。

Proves:
- 两域各有两次实际W readFile，而相同W内容仅JSON.parse一次，H与P分别解析一次。
- 独立Git读取的最终pending只接纳所选投影。
