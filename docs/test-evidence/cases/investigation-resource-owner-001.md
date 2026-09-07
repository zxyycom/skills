### Case INVESTIGATION-RESOURCE-OWNER-001: owner report must directly reference its own resource

Tests:
- `test:e96b0bc400bdf15b6a15f7788b04d5dc4cb0bbef472b69ca92f03a5ae486a400`

Tags:
- `investigation-report`

Contract:
- owner report 必须直接引用自己拥有的资源。

Proves:
- 仅 consumer 引用 owner 资源时返回 owner-reference 诊断。
