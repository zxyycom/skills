use super::*;

#[test]
fn decision_identity_actions_ignore_unselected_formal_body_but_keep_index() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let published_index = std::fs::read(base.join("decision-index.json")).unwrap();
    let original_formal = std::fs::read(base.join("original.md")).unwrap();
    let candidate = include_str!("../fixtures/identity/decisions/draft.md")
        .replace(
            "relations: []",
            "relations:\n  - type: 修订\n    target: 261106-original\n    summary: Reason",
        )
        .replace(
            "## 目的\n\n## 背景\n\n## 决策",
            "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
        );
    std::fs::write(base.join("draft.md"), &candidate).unwrap();
    std::fs::write(base.join("original.md"), b"invalid unselected formal body").unwrap();
    let mut discard = operation(Action::Discard {
        confirm_recorded: false,
    });
    discard.selector = "draft".into();
    let out = transaction::run_transaction(&root, &mut discard);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed && !base.join("draft.md").exists());
    assert_eq!(
        std::fs::read(base.join("original.md")).unwrap(),
        b"invalid unselected formal body"
    );
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        published_index
    );
    std::fs::write(base.join("original.md"), original_formal).unwrap();
}

#[test]
fn decision_discard_rejects_incomplete_candidate_without_writes() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let index = std::fs::read(base.join("decision-index.json")).unwrap();
    let ready = include_str!("../fixtures/identity/decisions/draft.md").replace(
        "## 目的\n\n## 背景\n\n## 决策",
        "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
    );
    for bad in [
        ready.replace("alignment: null", "alignment: aligned"),
        ready.replace("createdAt: null", "createdAt: 2026-11-06T12:00:00Z"),
        ready.replace("## 决策", "## Incorrect"),
    ] {
        std::fs::write(base.join("draft.md"), &bad).unwrap();
        let mut op = operation(Action::Discard {
            confirm_recorded: false,
        });
        op.selector = "draft".into();
        let result = transaction::run_transaction(&root, &mut op);
        assert!(!result.errors.is_empty());
        assert!(!result.committed);
        assert_eq!(std::fs::read_to_string(base.join("draft.md")).unwrap(), bad);
        assert_eq!(
            std::fs::read(base.join("decision-index.json")).unwrap(),
            index
        );
    }
}

#[test]
fn decision_candidate_discard_fails_closed_on_unreadable_git_head() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let draft = include_str!("../fixtures/identity/decisions/draft.md").replace(
        "## 目的\n\n## 背景\n\n## 决策",
        "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
    );
    std::fs::write(base.join("draft.md"), &draft).unwrap();
    commit_fixture(dir.path());
    let index = std::fs::read(base.join("decision-index.json")).unwrap();
    let head = std::fs::read_to_string(dir.path().join(".git/HEAD")).unwrap();
    let reference = head.trim().strip_prefix("ref: ").unwrap();
    std::fs::write(
        dir.path().join(".git").join(reference),
        b"broken git reference\n",
    )
    .unwrap();
    let mut op = operation(Action::Discard {
        confirm_recorded: false,
    });
    op.selector = "draft".into();
    let result = transaction::run_transaction(&root, &mut op);
    assert!(!result.errors.is_empty());
    assert!(!result.changed && !result.committed);
    assert_eq!(
        std::fs::read_to_string(base.join("draft.md")).unwrap(),
        draft
    );
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        index
    );
}
