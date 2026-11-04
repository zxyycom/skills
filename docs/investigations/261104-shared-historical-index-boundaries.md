---
title: "复查两域历史索引读取和诊断边界"
id: "261104-shared-historical-index-boundaries"
formedAt: "2026-11-04T10:28:14Z"
question: "两域固定历史索引的不变量与诊断应如何共同维护？"
tags:
  - "decision-records"
  - "git-integration"
  - "investigation-report"
relations:
  - type: "复查"
    target: "261104-investigate-head-index-diagnostic-loss"
    summary: "跨域复查历史读取和诊断边界"
---

## 形成时背景

前序调查解释 IR 的历史诊断丢失和 HEAD 与工作区恢复差异；本轮在代码基线 `fafc9e2b` 复查 DR 与 IR 是否对同一固定 revision 索引执行一致的安全读取，并检查诊断进入 CLI 的完整路径。跨域数据完整性、文件表示和输出安全需要独立复核，故保留前序并单独记录本轮。

## 调查目的

区分共同 Git blob／索引协议与领域历史语义，确认实际差异、可观测影响、修复归属及不扩大所选正文读取的验证边界。

## 调查范围与依据

- 检查 DR 的 `decision-history-sources.ts`、IR 的 `validation-history.ts` 与 `diagnostics.ts`，对照 Index Runtime 的严格 UTF-8 协议和共同操作模型。
- 隔离 Git 对照中，在已记录前序及有效补充关系下提交索引内一个非法 UTF-8 字节并恢复工作区；旧 IR 经宽松解码未报告历史 warning。DR 的索引读取只接受 regular，合法 executable blob 被拒绝；两者均不应接受 symlink。
- IR 历史失败的目标路径含换行时，旧 renderer 在 header 原样输出 target，可伪造独立行；已转义的 source.path 不能保护另一处输出。DR 把解析诊断拼成错误文本，丢失 code、路径和 revision；这不是对 DR 输出攻击面的复现声明。
- 本轮新增的隔离真实 Git 回归分别比较损坏 HEAD、健康工作区与后续修复提交，验证 IR warning、DR 零写失败及 DR executable 模式；共同读取矩阵覆盖缺失、两种普通 blob、symlink、非法 UTF-8 和解析失败。

## 调查结果与边界

共同读取责任是固定 revision 上的文件表示、严格 UTF-8、解析及完整诊断事实；物理缺失是否为首次空集合仍由各域证明。DR 保持历史确认的阻断及零写语义，IR 保持 warning；正文仍只读取必要身份，不将历史正文扩成全文验收。

目标定位字段转义控制字符并保留可回查路径，自由文本分字段净化和限长；结构化原因保留供调用方检查。定向回归验证固定历史状态和诊断边界；完整门禁与真实 Node／安装结果以本次交付的实际执行记录为准。隔离 fixture 不证明外部工作区或远端状态已经修复。
