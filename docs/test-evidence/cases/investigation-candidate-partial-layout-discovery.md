### Case INVESTIGATION-CANDIDATE-PARTIAL-DISCOVERY-001: 候选资源 owner 使用发布定位基线

Tests:
- `test:73e9f70d5e8b13badab18506123d1d9faf854a2a87a00afc2fda4f8c7d9944f3`

Tags:
- `investigation-report`

Contract:
- 正式 owner 的当前正文位置不是候选资源声明的必要证据；索引缺失或损坏必须显式恢复。

Proves:
- owner 当前路径移动不阻断候选读取；依次损坏或删除发布索引时返回 error。
