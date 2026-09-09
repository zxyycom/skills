# Tasks

本清单按“收口默认值、同步接口与说明、重建产物、补齐证据”的顺序实施，并以完整检查作为退出条件。

## Readiness

- [x] 0.1 核对 proposal、design 与 tasks 指向同一 Outcome，并明确预期调整、必要影响、范围边界、成功标准与稳定 owner。
- [x] 0.2 核对固定契约、CLI、公开 options、候选身份归一化和生成入口，确认 `formedAt` 必填是调用方额外取时的直接原因。
- [x] 0.3 确定 effective formedAt 在候选创建边界解析一次，使用 UTC 秒精度；显式值优先且创建后保持不变。
- [x] 0.4 检查相关长期决策、原生测试和 Test Evidence Cases，确认没有阻塞问题，并完成 Decision Record 门槛判断。

## Implementation

- [ ] 1.1 将 candidate 公开类型和运行时 options 中的 `formedAt` 调整为可选，并在身份归一化前解析为显式值或规范 UTC 当前时间。
- [ ] 1.2 调整 `new` 的参数准备、缺参诊断和 help，使 `--formed-at` 成为可选覆盖，并让 CLI 复用 candidate 创建入口的默认值。
- [ ] 1.3 同步 investigation-report 的 skill 入口、固定契约和人类说明，明确默认取时、ID 派生、显式校验与后续不可变语义，并递增 skill 版本。
- [ ] 1.4 更新公开声明源码，通过 `bun run sync:investigation-report-check` 重建分发产物，并确认索引 Schema 没有非预期变化。

## Verification

- [ ] 2.1 用最小 API 测试证明缺省时间的 UTC 秒级格式、ID 与 frontmatter 一致，以及显式值和非法值继续遵循现有契约。
- [ ] 2.2 用最小 CLI 测试证明省略 `--formed-at` 可以创建 name-only candidate，help 与缺参诊断反映可选语义。
- [ ] 2.3 用生成分发测试证明 bundled CLI 与源码一致，并运行 investigation-report 原生测试和生成漂移检查。
- [ ] 2.4 同步受影响的 Test Evidence Cases 与派生索引，运行测试证据和正式 investigation 集合检查。
- [ ] 2.5 运行 `bun run check`，逐项复核成功标准、稳定 owner、skill 版本、生成产物和任务证据后再申请 complete。
