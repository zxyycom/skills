### Case INVESTIGATION-RESOURCE-OWNER-001: owner report must directly reference its own resource

Tests:
- `test:e96b0bc400bdf15b6a15f7788b04d5dc4cb0bbef472b69ca92f03a5ae486a400`

Tags:
- `investigation-report`

Contract:
- owner report 必须直接引用自己拥有的资源。

Proves:
- 资源归属校验器对仅 consumer 引用、owner 无直接引用的映射，返回资源必须被 owner report 引用的诊断。
