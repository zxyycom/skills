### Case RECORD-STAGE-TARGET-EQUIVALENCE-001: 共同协调器仅在两阶段fresh等价后复用不可变target

Tests:
- `test:3776e16ce79b677e0c32b480aae5ccb986c94f0956d3a8870f9a46403d9ece1c`
- `test:b0234a48cf1df5033e8b350d397ad6f5c21541d4f8944b0d0620de15b8957059`
- `test:f2810620cfdb3c92e453196651c6f70fc478fab3a2d2fc97d6a28b5597f92fc9`

Tags:
- `index-runtime`

Contract:
- prepare 和 verify 各自真实取得 W/P；固定 H、实际 W 字节、按 scope 策略验收的 P payload、完整 pending 身份和选择等价后，纯 target 构建及序列化可在调用内复用。

Proves:
- index/all各build及serialize一次，domain不build；各有两次真实W读取与完整P捕获。
- all/domain仍调用两次领域适配；冻结target及state拒绝改写，最终Git所选state/revision正确、未选沿用P、scope外与W保持。
