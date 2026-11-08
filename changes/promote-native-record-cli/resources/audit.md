# 切换方案审计依据

本文件记录 2026-11-08 在 revision `dc874213f494ba5411330afe135c0542df5184a8` 核对的源码事实、只读探针和方案使用复核。它支持 Readiness，不证明尚未实现的原生安装器、正式发布或平台验收。

## 范围与事实

| 已核对对象 | 事实及实施影响 |
| --- | --- |
| [根命令](../../../package.json)、两域 skill 与生成器 | 正式业务入口仍是 TS；DR 源版本 109、IR 98。准备期要保留可用入口，C 才同步启用新说明 |
| [DR Schema](../../../tools/decision-records/src/index/decision-index-json-schema.ts)、[IR Schema](../../../tools/investigation-report/src/index/investigation-index-json-schema.ts) | Schema 构造依赖旧领域定义；退出 SDK 前需移交数据源，不能先删旧工具 |
| [通用索引 Schema](../../../tools/index-runtime/src/schemas.ts)、[源码边界](../../../docs/tooling-distribution.md#源码与依赖边界) | Index Runtime 仍有其他消费者；新纯数据格式源需明确跨域 owner，并同步现有结构源规范 |
| [基础 manifest](../../../tools/skill-package/src/release-manifest.ts) | schemaVersion 1 的每个 skill 只投影 version，额外 native 字段被忽略；可在独立模块消费扩展，避免改变所有通用 updater 闭包 |
| [updater 编排](../../../tools/skill-updater/src/index.ts)、[下载](../../../tools/skill-updater/src/release.ts) | 先比版本，再加载固定资产名，下载/校验完成后才计划和安装；版本相等会直接成功，原生路径需独立 readiness 判断 |
| [安装实现](../../../tools/skill-updater/src/installation.ts) | 写文件不设置原生 executable bit；只覆盖、不退役旧文件。现有普通恢复能力不等于原生激活/清理协议 |
| [打包](../../../scripts/lib/skill-package/skill-package-release.ts) | 打包入口先递归清空传入输出目录；正式 caller 当前传根 dist。接入原生制品前必须隔离输出，保护已有证据/构建 |
| [发布编排](../../../scripts/lib/publishing/publish-skills.ts)、[资产收集](../../../scripts/lib/publishing/publish-skills-assets.ts) | 当前收集 dist 根 ZIP，rolling 先包后 manifest 再删旧资产；需要显式本轮资产清单和两个旧名 ZIP 的退出顺序 |
| [原生维护](../../../tools/record-cli/README.md)、[候选交付](../../../tools/record-cli/delivery/README.md)、[CI](../../../.github/workflows/record-cli-candidate.yml) | 目前仅候选，Linux 与 Windows 的既有验证范围不同，正式 skill/updater 未接线；B 阶段必须补真实两平台交付证据 |

这是接线和设计审计，不是完整消费者闭包或格式等价性审计。实际 import/导出、fixture、Gate、Case 和共享依赖清单由 1.1/1.7 完成，不能以本表直接批准删除；Schema 与 Rust 之间的全部语义差异也仍须按 1.1 核对。

## 只读探针

两项均在独立 Bun 进程直接调用当前源码，无网络请求、安装写入或永久测试文件。

### 基础解析器保留兼容

向 `validateSkillReleaseManifest` 传入：

```json
{
  "schemaVersion": 1,
  "skills": {
    "decision-records": { "version": 110, "native": { "role": "decision-records" } },
    "novel-cards": { "version": 1 }
  }
}
```

实际返回 `success: true`，output 的两项仅剩 version。结论：旧解析器接受扩展但丢弃它；原生消费者须从原始 JSON 独立验证，不能复用基础投影读取扩展。此探针没有验证新扩展 Schema。

### 缺旧名资产时早失败

对两个角色分别调用 `loadRemoteSkillFiles`，config 仍用各自 `<skill>.zip`，release 仅列 `record-native-installer.zip`；remotePackage 提供合法正整数版本。将 `globalThis.fetch` 替换为计数后抛错的 stub，捕获缺资产错误并核对计数。

两个角色均返回 `does not contain <skill>.zip`，`fetchCalls=0`。结合编排中 load 位于 plan/install 之前，可得现有代码在此路径不会进入安装。该结论限于当前实现与不同版本更新路径，不覆盖同版本短路、旧远端所有历史版本或新的引导实现；正式发布必须提升版本并撤掉两个旧名资产。

## 已收敛的方案选择

- 用户确认首批 Linux x64 + Windows x64，先准备再验收再切换，不保留旧领域 TS SDK。
- 采用纯数据 Schema owner、分离源码包/二进制、包内源码摘要、原生 manifest 扩展、资产改名和显式引导；取舍及停止条件以 [design](../design.md) 和[交付契约](delivery-contract.md)为准。
- 新方案实现、两平台实际安装和真实发布仍是未完成任务。发布/用户目录安装授权在对应执行阶段核对，不把计划提交当作该授权。

## 代表性使用复核

| 接手问题 | 从实际文档恢复的执行结果 |
| --- | --- |
| 现在从哪里做起？ | tasks 1.1，先交接 Schema 并核对格式/消费者；不直接切命令 |
| 二进制放哪里，如何影响 skill 版本？ | 独立 release ZIP；描述符进入 skill 包/hash，绑定原生源码，具体资产另由 manifest 绑定 |
| 旧 updater 会不会先覆盖新说明？ | 原生 release 撤掉旧名资产，旧 updater 在安装前失败；显式引导器验证后再激活新说明 |
| 已激活但旧 SDK 清理失败怎么办？ | 报告清理待完成并保留恢复位置；同版本 readiness 不误报成功，再执行验证并续清理 |
| 什么阻止正式切换？ | 1.5 要求 2.1–2.3 当前证据全部通过；C 改动后补受影响验收，远端发布另需授权 |
| 原生唯一后端是否排斥 Node？ | 只退出领域 SDK/TS 业务 CLI；Node 安装基础设施和无业务逻辑调度器保留 |

正文承接目标与关键取舍，交付细节和依据分开按需读取；任务 ID 持有进度，资源不复制 checkbox。审计门禁只声明已完成的范围，后续格式盘点、安装故障和正式验收均保持未勾选。

## 文档交付验证

- `bun run change-plan plan changes/promote-native-record-cli --json` 成功，stage 为 Plan，基线为上述审计 revision。
- `bun run check` 的 quick 六项公共基线通过：环境、secret、JSON、JSON Schema、Markdown 链接和 lint，性能预算通过。它不证明 Rust、安装器或完整发布门禁通过。
- proposal 成功标准 1–5 分别由 1.1–1.6 的阶段约束、2.2、2.3、1.7/2.4、1.2/2.4–2.5 承接。任务与资源的使用复核未发现阻止从 1.1 开始的设计缺口。
