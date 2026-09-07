### Case TASK-GRAPH-SERIALIZATION-001: 规范文本按键排序，往返解析不丢失事实且 entry 不重复保存 ID

Tests:
- `test:49321e5b3d3bab35d9543860bff6a479c47dc73109cda8e128825cf1553a1bc3`

Tags:
- `task-graph`

Contract:
- task index 以根级 task 字典键承接身份，并使用确定性排序、LF 与尾换行规范序列化。

Proves:
- 规范文本按键排序，往返解析不丢失事实且 entry 不重复保存 ID。
