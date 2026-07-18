# 2026-07-11 - 使用随包 reference 作为唯一固定契约

## 索引摘要
- 背景: 随包 reference 与目标项目的 `decision-record-rules.md` 同时解释固定格式时，会形成两份需要同步的契约和二次导航。
- 决策: `skills/decision-records/references/decision-record-rules.md` 独立承接目录、稳定命名、当前成员、关系、正文结构、索引和维护事务，因为它随 skill 分发且是所有项目共同使用的固定入口。

## 背景
- 随包 reference 与目标项目的 `decision-record-rules.md` 同时解释固定格式时，会形成两份需要同步的契约和二次导航。
- skill 更新、项目局部修改或复制遗漏都可能让两份规则产生漂移，未来 agent 无法直接判断哪一份代表当前固定格式。

- `decision-records` 的目标是在不同项目中复用同一套显式 Markdown 契约。
- 用户明确确认随包 `skills/decision-records/references/decision-record-rules.md` 是唯一固定契约，不在目标项目建立第二份规则导航。
- 项目仍可能需要比通用契约更严格的记录门槛，但这些约束属于项目协作或具体行为 owner。

## 决定
- 采用: `skills/decision-records/references/decision-record-rules.md` 独立承接目录、稳定命名、当前成员、关系、正文结构、索引和维护事务，因为它随 skill 分发且是所有项目共同使用的固定入口。
- 采用: 目标项目的 `docs/decisions/` 根目录只保留 `decision-index.json`；主题分类目录承接实际决策数据，逻辑归档不改变文件位置。
- 采用: `decision-index.json` 只承接当前仍作为后续工作依据的决策及其定位字段，不复制固定契约和决策理由。
- 采用: 项目专属的更高记录门槛写入 `AGENTS.md` 或相关行为 owner，不改变随包契约的固定字段和维护语义。
- 采用: 校验入口检查索引、主题分类和实际记录，不要求或接受目标项目中的契约副本。
- 不采用: 在每个目标项目复制 `decision-record-rules.md`。原因是重复 owner 会增加导航层级和长期漂移风险。

## 关系
- 修订: [2026-06-30 - 用 owner 命名决策记录根文档](260630-name-decision-root-docs-by-owner.md)
