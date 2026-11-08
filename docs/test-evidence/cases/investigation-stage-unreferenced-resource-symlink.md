### Case INVESTIGATION-STAGE-UNREFERENCED-SYMLINK-001: 零引用完整所选树拒绝初始符号链接

Tests:
- `test:4b10fb774673f7452e3fe5f004f7909d8e5968842ee14d1500fe8f25596ded66`

Tags:
- `investigation-report`

Contract:
- 所选报告无资源引用时，domain stage 仍须拒绝所选资源根、owner 或其树成员中的符号链接。

Proves:
- Unix 真实 Git fixture 分别将根、owner 或未引用成员设为指向外部的 symlink，domain stage 均失败，全部 pending entries、符号链接与外部目标保持。
