# 工作量探针

这两项是本 Change 的隔离机制证据，不代替原生测试或端到端平台验收。在仓库根目录、Node.js 24.18 及以上运行：

```bash
node changes/record-collection-cost/evidence/cycle-probe.mjs
node changes/record-collection-cost/evidence/owner-probe.mjs
```

- `cycle-probe.mjs` 固定读取 Git 基线 `696b888b` 的图实现及当前工作区实现，验证插桩点唯一；1,000 节点、998 个短回环预期旧栈定位扫描 499,499 个位置、新位置查询 998 次，且诊断完全一致。
- `owner-probe.mjs` 从当前源码提取唯一的 owner 分组函数；1,000 个资源、100 个 owner 预期当前遍历 1,000 次，结果与旧式逐 owner 筛选一致。100,000 是旧结构的模拟扫描次数，不是完整 Git 命令测量。

源码结构或预期输出变化时探针失败，不自动推断新实现正确。探针只在临时目录构造模块并在结束时清理；Change 完成后其最终版本随计划提交保存，结项删除后可从该提交恢复。
