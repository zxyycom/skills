### Case DECISION-RENAME-PATH-001: 冲突 name 路径回退完整 ID basename

Tests:
- `test:5541d066bf88e805aa2850a8473d8a520cdabac6154d71940414162667dfd684`

Tags:
- `decision-records`

Contract:
- 目标 name basename 已被其他合法 sourcePath 占用时，Decision rename 只能回退完整 target ID basename，且不得覆盖占用来源。

Proves:
- rename 在完整 ID basename 建立目标文件。
- 已占用 name path 的原 Markdown 保持原字节和 identity。
