### Case INVESTIGATION-CANDIDATE-PARTIAL-DISCOVERY-001: 候选资源 owner 使用发布定位基线

Tests:
- `test:6a650a2d19e6790ff4d0c2db97a07881e6be1783ffa0a54f316bc1f5ea6e58f4`

Tags:
- `investigation-report`

Contract:
- 正式 owner 的当前正文位置不是候选资源声明的必要证据；索引缺失或损坏必须显式恢复。

Proves:
- owner 当前路径移动不阻断候选读取；依次损坏或删除发布索引时返回 error。
