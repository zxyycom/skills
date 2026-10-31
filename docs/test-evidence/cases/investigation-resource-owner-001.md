### Case INVESTIGATION-RESOURCE-OWNER-001: owner report must directly reference its own resource

Tests:
- `test:6c83d704efa88becc0629a3e75baae4d8a7080de122373f1e6608caca216dfd3`

Tags:
- `investigation-report`

Contract:
- owner report 必须直接引用自己拥有的资源。

Proves:
- 资源归属校验器对仅 consumer 引用、owner 无直接引用的映射，返回资源必须被 owner report 引用的诊断。
