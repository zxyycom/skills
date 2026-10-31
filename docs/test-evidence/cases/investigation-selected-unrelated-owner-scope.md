### Case INVESTIGATION-SELECTED-UNRELATED-OWNER-SCOPE-001: 旧owner核对不扩大为全库资源审计

Tests:
- `test:c3afa005fd3d82230c2ff7b4e9209ebbde46b4a76ff6dba02a003febee12a665`

Tags:
- `investigation-report`

Contract:
- selected删除只检查本次已知受影响owner缺失，不扫描其他owner树。

Proves:
- 无关owner是symlink也不阻断已知旧owner不存在的所选删除；无关路径与类型保持不变。
