### Case INVESTIGATION-RENAME-PATH-001: 被占用 name 路径回退完整 ID basename

Tests:
- `test:b8d52ecfb0d9008d71ed02ef696ed5ffc7abd88e18e0cfcca750a3671515edf8`

Tags:
- `investigation-report`

Contract:
- formal target name path 已被独立 sourcePath 占用时，rename 只能回退完整 target ID basename，且不能覆盖该来源。

Proves:
- rename 选择完整 ID sourcePath。
- 已占用 name path 的报告字节保持不变。
