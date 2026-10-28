# 剩余成本候选：复跑材料

从仓库根目录执行 `bash docs/investigations/_resources/261028-record-cost-reachability-boundaries/reproduce.sh "$PWD"`。脚本读取固定 Git 基线 `eea1d03e3429f83797e660d75326e0ebd752f61d`，复用现有 `node_modules`，不安装依赖或访问远端。需要 Node.js、Bun、Git 和 Python；形成时环境及基线源码指纹见 `provenance.json`。

脚本用 `mktemp` 创建新的 `/tmp/remaining-evidence-replay-*` 目录，输出其精确路径；其中包含 Git archive 的隔离副本、生成 fixture、计数源码和结果。脚本不覆盖旧运行，也不自动删除结果。复核者确认该输出属于本次运行并完成对账后，可仅清理所报告的精确目录；不要据名称清理其他目录。

`method-provenance.json` 记录本次归档时格式整理、唯一插桩点断言和关键计数断言后的方法指纹及重跑摘要。原有结果与基线源码指纹保留形成时状态；探针不是生产实现或端到端性能证明。
