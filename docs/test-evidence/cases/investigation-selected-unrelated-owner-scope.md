### Case INVESTIGATION-SELECTED-UNRELATED-OWNER-SCOPE-001: 旧owner核对不扩大为全库资源审计

Tests:
- `test:5f91260b8d8950edfaf8f5b44eef9c6bb8b529cfd321d96088bff7c2bb1fac98`

Tags:
- `investigation-report`

Contract:
- selected删除只检查本次已知受影响owner缺失，不扫描其他owner树。

Proves:
- 无关owner是symlink也不阻断已知旧owner不存在的所选删除；无关路径与类型保持不变。
