### Case GATE-SELECTED-BUILD-SOURCE-001: 构建脚本源码进入指标并按自动化参数阈值阻断

Tests:
- `test:995d7c829789f9aebcb82c78f95460d564c6601b2d091ac8d5513ec5c5b7fb21`

Tags:
- `repository-tooling`

Contract:
- scripts/build 是维护源码目录；selected 的代码领域投影必须保留项目文件排除策略，只豁免该真实源码根，不吸收依赖、产物或再次嵌套的 build 输出。

Proves:
- 两项指标从 repository-code 的真实 Definition 收集文件时，只选中 scripts/build/adapter.ts；node_modules、dist、再次嵌套 build、其他 scripts/tools 下 build 及技能生成副本中的八参数函数均未进入选集。
- 健康构建脚本运行真实 function-metrics 时通过且无 finding；只将维护源码改为八参数函数后，Check 与 aggregate 均 failed。
- supplemental record 恰有一项，精确指向构建脚本、tooMany、parameter-count、自动化上限七及实测八。
