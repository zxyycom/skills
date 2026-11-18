### Case AGENT-MEMORY-CONTROL-001: 停用和隐藏不删除历史

Tests:
- `test:6eec0316d4502a901a7d5435b3f189ca06660fc00641681c65bef6615c82836f`

Tags:
- `agent-memory`

Contract:
- 停止使用和停止召回不删除原文，均阻断单元及构成依赖的当前采用。

Proves:
- 预览不改变可用正文；可确认停用现行单元或隐藏待复核单元。目标和依赖的直读不提供正文、正常召回不返回它们，显式历史仍可读且标为不可采用。
