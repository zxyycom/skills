### Case RECORD-STAGE-TARGET-EQUIVALENCE-001: 共同协调器仅在两阶段fresh等价后复用不可变target

Tests:
- `test:353722995af0e87475b5c4ec32828291e49e642e373db96933cbcd05aae27afd`
- `test:42dde101f734ecd912a354501966d3f0d0c3a120f27b80ed582a06bf48584f29`
- `test:adc8bd3e54a3eb8348944922c8124f4ee8769bbab128b233023d15ba93bcfadb`

Tags:
- `index-runtime`

Contract:
- prepare 和 verify 各自真实取得 W/P；固定 H、实际 W 字节、按 scope 策略验收的 P payload、完整 pending 身份和选择等价后，纯 target 构建及序列化可在调用内复用。

Proves:
- index/all各build及serialize一次，domain不build；各有两次真实W读取与完整P捕获。
- all/domain仍调用两次领域适配；冻结target及state拒绝改写，最终Git所选state/revision正确、未选沿用P、scope外与W保持。
