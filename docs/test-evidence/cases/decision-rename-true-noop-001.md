### Case DECISION-RENAME-TRUE-NOOP-001: 同身份同路径改名是真零写

Tests:
- `test:6853127a1705285e49950e79ef665c834a02188ef4a3c5fa8cd205cf3d452e61`

Tags:
- `decision-records`

Contract:
- 同 ID 同路径 rename 在必要身份安全与可见冲突确认后，不规范正文、索引或 mode，也不要求历史改名确认。

Proves:
- Git 已记录的来源包含非规范合法正文且无关正文失效时，SDK rename 仍返回 changed=false，原始来源、inode、mode 与 index 全部保持。
