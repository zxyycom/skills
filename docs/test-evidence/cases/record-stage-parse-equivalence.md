### Case RECORD-STAGE-PARSE-EQUIVALENCE-001: 两域fresh真实读取后复用同调用解析

Tests:
- `test:d04acca477bb503216c2ce5afecc529194f43367355a9190e09b3cbf66e73a1a`
- `test:e13917ad335ae93f508c669b7f0891b6bd9fbc44bb7c0307a4dd6c0a2cde652d`

Tags:
- `index-runtime`

Contract:
- 独立阶段仍实际读取 W，并按 scope 策略验收 P 的 payload 与完整成员身份；同调用实际字节和完整 snapshot 证据等价后可复用不可变解析。

Proves:
- 两域各有两次实际W readFile，而相同W内容仅JSON.parse一次，H与P分别解析一次。
- 独立Git读取的最终pending只接纳所选投影。
