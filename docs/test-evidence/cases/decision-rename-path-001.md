### Case DECISION-RENAME-PATH-001: 冲突 name 路径回退完整 ID basename

Tests:
- `test:b0e4d4083f09b80629bd98ec15bb31eb844942fe4c7e20de7ef2b53b0c709c13`

Tags:
- `decision-records`

Contract:
- 目标 name basename 已被其他合法 sourcePath 占用时，Decision rename 只能回退完整 target ID basename，且不得覆盖占用来源。

Proves:
- rename 在完整 ID basename 建立目标文件。
- 已占用 name path 的原 Markdown 保持原字节和 identity。
