---
name: resource-records
description: >-
  维护资源集合、精确版本、文件、图包及用途选择；查询已登记来源和派生关系，
  并以权威 Markdown 重建资源索引。
metadata:
  version: "2"
---

# Resource Records

## 职责与边界

资源记录保存集合、资源版本、文件身份、来源和用途选择。原始调用与形成时证据继续由其原 owner 保存；资源记录引用证据，不改写历史。文件位置和 SHA-256 是声明，不证明媒体存在、内容经核验或备份可用。编辑记录前核对工作区授权，用户确认与 agent 暂选分别标记，不因新候选出现而自动变更选择。

## 使用路径

先读 [记录模型](references/record-model.md)；记录结构以随包 `references/resource-record.schema.json` 为准。模板是起点，必须替换占位内容。CLI 的命令和机器协议参见 [CLI 契约](references/cli-operations.md)。索引是可重建的投影，记录 Markdown 是唯一编辑源；不要手工修改索引。检查失败先修正源记录；同步是单索引写入，不修改媒体或 Git。

已安装的 skill 使用本包 `bin/` 下的 `resource-records` 原生程序（Windows 为 `resource-records.exe`）；从源码试用时使用实际构建出的程序，不假定已安装。以目标工作区为当前目录，或在命令中指定 `--root <工作区根>`。先用 `list`、`show` 或 `search` 查现有记录；获准维护时在 `resources/records/` 新建或编辑 Markdown，按模型填写真实身份与证据，然后运行 `sync-index` 和 `check`。首次没有索引或记录变更后索引陈旧时，`check` 会失败，源记录有效后用 `sync-index` 修复。完成后用 `show` 或 `trace` 回读所需对象和关系。

选择、引用和追溯均固定资源与版本，需要文件时还要固定 member。查到记录不等于媒体可用，取用前按项目保管规则核验。引用证据应能定位调用或判断的具体条目，未知来源应明确表示，不以猜测补全。
