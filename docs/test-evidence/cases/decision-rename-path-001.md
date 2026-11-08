### Case DECISION-RENAME-PATH-001: 冲突 name 路径回退完整 ID basename

Tests:
- `test:828a28dcea8e9f97489ee21dc445c1f14ae088fca049f0ccd93159f2ef3b1da1`

Tags:
- `decision-records`

Contract:
- 目标 name basename 被其他正式来源占用时，rename 使用完整目标 ID basename，不覆盖原来源。

Proves:
- 真实 rename 将目标写入 261106-new.md，旧路径退出；占用 new.md 的另一个已建立来源字节不变。
