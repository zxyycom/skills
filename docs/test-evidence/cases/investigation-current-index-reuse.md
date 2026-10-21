### Case INVESTIGATION-CURRENT-INDEX-REUSE-001: Current 加载只解析一次索引并逐次核对来源

Tests:
- `test:5454b785ae4b0e5bc3cdf0cc7e548f8f0ddfc3e790469111ce1f23b531f05467`

Tags:
- `investigation-report`

Contract:
- Current 加载复用共享加载器已经完整验证的索引，不重新序列化解析；每次调用仍独立核对当前来源 revision。

Proves:
- 当前索引与严格发布加载结果相同，首次调用只解析一次持久索引；修改正文后的第二次调用重新读取索引并返回 stale，不能复用上次成功。
