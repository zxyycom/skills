### Case INVESTIGATION-STAGE-PENDING-ONLY-CANCEL-001: 撤销仅 pending 存在的新增

Tests:
- `test:79a4e8f2ece6238109fc07378eb9c226ca067f5817281b34c478521bedf0a037`
- `test:7eaf96b4d509599d4e64d34bc7c42dda9d89b9c7a52cca7466ec4438eafd78f9`

Tags:
- `investigation-report`

Contract:
- domain/all 可从已变化的 pending 正式正文解析仅暂存身份；所选旧正文和 owner 资源位置以 H/P/W 并集清理。

Proves:
- 新增正文与未引用 owner 附件暂存后在 W 撤销，再选该 ID 会移除两者；最终 pending 无差异。
