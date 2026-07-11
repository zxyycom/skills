# 2026-07-11 - 使用随包 reference 作为唯一固定契约

## 状态
- 当前状态: active
- 导致状态变化的决策: 无
- 状态说明: 作为决策记录固定契约、目标项目目录 owner 和项目专属门槛的当前分工使用。

### 关系
- 修订: [2026-06-30 - 用 owner 命名决策记录根文档](260630-amended-name-decision-root-docs-by-owner.md)

## 问题
- 随包 reference 与目标项目的 `decision-record-rules.md` 同时解释固定格式时，会形成两份需要同步的契约和二次导航。
- skill 更新、项目局部修改或复制遗漏都可能让两份规则产生漂移，未来 agent 无法直接判断哪一份代表当前固定格式。

## 背景与约束
- `decision-records` 的目标是在不同项目中复用同一套显式 Markdown 契约。
- 用户明确确认随包 `skills/decision-records/references/decision-record-rules.md` 是唯一固定契约，不在目标项目建立第二份规则导航。
- 项目仍可能需要比通用契约更严格的记录门槛，但这些约束属于项目协作或具体行为 owner。

## 决定
- 采用: `skills/decision-records/references/decision-record-rules.md` 独立承接目录、命名、状态、关系、正文结构、索引和维护事务，因为它随 skill 分发且是所有项目共同使用的固定入口。
- 采用: 目标项目的 `docs/decisions/` 根目录只保留 `decision-record-index.md`；影响面目录和归档目录承接实际决策数据。
- 采用: `decision-record-index.md` 只承接阅读方式、状态速查、影响面说明和已生效决策链接，不复制固定契约。
- 采用: 项目专属的更高记录门槛写入 `AGENTS.md` 或相关行为 owner，不改变随包契约的固定字段和维护语义。
- 采用: 校验入口检查索引、影响面和实际记录，不要求或接受目标项目中的契约副本。
- 不采用: 在每个目标项目复制 `decision-record-rules.md`。原因是重复 owner 会增加导航层级和长期漂移风险。
- 触发条件: 初始化决策目录、读取固定格式、增加项目专属门槛或审阅目标目录根文件时，沿用本 owner 分工。

## 影响
- 本仓库删除 `docs/decisions/decision-record-rules.md`，由随包 reference 直接承接固定契约。
- `AGENTS.md` 继续承接本仓库针对 skill 与项目级决策的更高记录门槛。
- 目标项目只需要维护索引和实际决策内容，不再同步一份固定规则副本。

## 验证
- `skills/decision-records/references/decision-record-rules.md` 明确自己是唯一固定契约，并移除目标项目规则文件。
- `skills/decision-records/SKILL.md` 的 owner 分工和初始化流程不再创建项目契约副本。
- `docs/decisions/decision-record-index.md` 直接引用随包 reference，根目录不再包含第二份规则文件。
- 决策记录校验在只有索引和实际记录时通过，并拒绝根目录中的契约副本。
