### Case RECORD-STAGE-INDEX-SELECTED-PAYLOAD-001: index 暂存只读取所选 payload 并保持未选身份

Tests:
- `test:6cc227a05990dd059f76f848dd2426c74ca4d6d1d21415d5da870ddc096396c7`

Tags:
- `index-runtime`
- `version-control`

Contract:
- 记录暂存只读取 scope 的显式 payload，完整 pending 路径、模式、OID 与 staged 删除保持。

Proves:
- 真实 Git fixture 删除未选 blob 对象后，准备、独立 fresh、锁内 CAS 与发布仍成功；仅索引或显式来源进入实际变更，未选 executable、symlink 的完整 stage 记录与删除保持。
