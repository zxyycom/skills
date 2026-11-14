### Case RECORD-DELIVERY-THREE-ROLES-001: 离线清单版本与三角色安装

Tests:
- `test:2fceb6340d4f61cc15a1cabc32ce8aa851d6cb5d71bac1334098115a7c883cb1`
- `test:94490a5840c1a10903e1f3ac005209c8c79739e40fc9f42ff93c7811c9deb38f`

Tags:
- `native-delivery`

Contract:
- 离线 v1 允许且仅允许旧两角色，v2 要求三个角色各一次；安装仅写入明确标记的私有 fixture。

Proves:
- v1 双角色与 v2 三角色可解析，错误版本角色集合及重复角色被拒绝。
- v2 三角色候选在隔离 fixture 安装，三个角色字节正确且无关文件保留；不证明真实程序可运行。
