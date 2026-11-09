# Design

使用当前包作为覆盖来源，不依赖跨次安装状态。

## Context

[原生发布契约](../../tools/skill-package/src/native-release-manifest.ts)绑定角色、平台和资产；[本地安装判断](../../tools/skill-updater/src/installation.ts)由 SKILL.md 承接。

## Goals / Non-Goals

支持搬迁与显式重装；不提供崩溃自动恢复或历史迁移。

## Decisions

### Intended Change

检查只下载 manifest；多级缺失目标只在确认后创建，已有祖先均须为普通目录；安装器允许同版本覆盖，更新器版本相同即退出。临时事务最后启用入口。

### Resulting Impacts

原生生成及发布链路和验证场景需同步；旧回执及包外文件保持原样。

## Risks / Trade-offs

多文件替换不原子；回滚失败时保留备份及路径诊断。

## Open Questions

无。
