### Case INVESTIGATION-RENAME-OWNER-RACE-001: rename 不覆盖并发出现的 resource owner target

Tests:
- `test:8439648c1932d4116f7d7f89d9bf7e8f12790096293993a4bd433f9a365df7a7`

Tags:
- `investigation-report`

Contract:
- owner target 在最终预检后出现时，rename 必须以 exclusive owner claim 拒绝迁移并回滚自身 report/index 写入；不得用目录 rename 覆盖空或非空目标，也不得清理并发创建的内容。

Proves:
- 结果为 `rolled-back`，旧 report、index 和旧 owner 内容恢复。
- 并发 target 的 `external.txt` 保留，rename 不留下新 report 路径。
