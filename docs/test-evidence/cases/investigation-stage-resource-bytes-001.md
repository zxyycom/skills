### Case INVESTIGATION-STAGE-RESOURCE-BYTES-001: 资源字节不参与正式来源 revision 与发布索引

Tests:
- `test:c925427adbac6d79632b597719e5e376df1b407ba989208f6a098684bc002385`

Tags:
- `investigation-report`

Contract:
- 资源字节不进入正式报告 source revision，单独修改资源不改写已发布报告索引。

Proves:
- 真实资源由 before 改为 after 后，重新取得的正式 source revision 与发布 index 完整字节保持原值，资源仍为 after。
