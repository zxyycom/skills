### Case GATE-INCREMENTAL-ACTIVATION-001: 增量 Gate 只执行缺少精确成功证明的 Check

Tests:
- `test:3e1907e9bf4419c46f997055e3b86c38d1b09d94c6e42dd47df1671cdb1bde11`

Tags:
- `repository-tooling`

Contract:
- 日常 Gate 必须以一次版本控制可见文件快照派生影响标签，并且只有 Check 的完整有效输入指纹命中最近通过 receipt 时才允许复用；跨 owner 依赖、必要工具和依赖图探测、依赖前置、未知路径、损坏缓存、失败执行和运行中漂移必须保守处理。Release 必须激活完整 DAG，测试批次的精确证明由独立契约承接。

Proves:
- 首次运行执行全部 59 个 base Checks，成功后原子形成 59 项可复用 receipt；稳定工作区复用全部 Checks，并以严格的空 effective aggregate policy 结算为 passed。
- Markdown 变化只激活 Markdown 与 secret Checks；shared-tools 变化传播到 validate 和领域 consumer，skill-package 变化传播到 Environment、Skill Updater 与 validate，build-system 变化传播到生成一致性 consumer；未知 owner 变化激活全部 Checks，但其稳定成功证明可在下一次复用。
- 根配置、声明环境或工具/依赖图身份变化使全部有效输入证明失效，只承载父 shell 记账的 `_` 变化不影响证明；必要工具探测失败形成带原因的全量 fallback，不能缓存 unavailable 占位值。
- 损坏 receipt 按 miss 全量重算；未通过 Check、不可写 cache、结束快照不可用与开始/结束快照漂移不发布证明，release 激活全部 62 项，起始快照不可用的 base 路径执行全部 59 项。
