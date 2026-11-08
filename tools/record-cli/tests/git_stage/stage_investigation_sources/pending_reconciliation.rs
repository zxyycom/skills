use super::*;

#[test]
fn investigation_stage_refuses_deleted_id_when_known_old_source_still_exists() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    let dir = fixture();
    let root = dir.path();
    let a = source_doc("240229-alpha", "Alpha");
    let b = source_doc("240229-beta", "Beta");
    fs::write(root.join("old-location.md"), &a).unwrap();
    fs::write(root.join("other-location.md"), &b).unwrap();
    fs::write(
        root.join("investigation-index.json"),
        source_index(&[
            ("240229-alpha", "old-location.md", "Alpha", &a),
            ("240229-beta", "other-location.md", "Beta", &b),
        ]),
    )
    .unwrap();
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "known source baseline"]);
    fs::write(root.join("unselected"), b"pending sentinel\n").unwrap();
    git(root, &["add", "--", "unselected"]);
    fs::write(
        root.join("investigation-index.json"),
        source_index(&[("240229-beta", "other-location.md", "Beta", &b)]),
    )
    .unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    for scope in [StageScope::All, StageScope::Domain] {
        let result = stage_investigations(
            &open_root(root).unwrap(),
            &RelativePath::new("investigation-index.json").unwrap(),
            &["240229-alpha".into()],
            scope,
        );
        assert!(result.is_err());
        assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
        assert_eq!(
            fs::read(root.join("old-location.md")).unwrap(),
            a.as_bytes()
        );
    }
}

#[test]
fn investigation_domain_stage_rejects_selected_source_drift_before_pending_write() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    let dir = fixture();
    let root = dir.path();
    let body = source_doc("240229-alpha", "Alpha");
    fs::write(root.join("source.md"), &body).unwrap();
    fs::write(
        root.join("investigation-index.json"),
        source_index(&[("240229-alpha", "source.md", "Alpha", &body)]),
    )
    .unwrap();
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "fresh baseline"]);
    fs::write(root.join("unselected"), b"pending sentinel\n").unwrap();
    git(root, &["add", "--", "unselected"]);
    fs::write(
        root.join("source.md"),
        body.replace("title: \"Alpha\"", "title: \"Changed\""),
    )
    .unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    let result = stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &["240229-alpha".into()],
        StageScope::Domain,
    );
    assert!(result.is_err());
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
}

#[test]
fn investigation_domain_stage_uses_pending_index_to_remove_noncanonical_pending_only_source() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    let dir = fixture();
    let root = dir.path();
    let a = source_doc("240229-alpha", "Alpha");
    let b = source_doc("240229-beta", "Beta");
    fs::write(root.join("beta.md"), &b).unwrap();
    let work_index = source_index(&[("240229-beta", "beta.md", "Beta", &b)]);
    fs::write(root.join("investigation-index.json"), &work_index).unwrap();
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "baseline"]);
    fs::write(root.join("odd-location.md"), &a).unwrap();
    let pending_index = source_index(&[
        ("240229-alpha", "odd-location.md", "Alpha", &a),
        ("240229-beta", "beta.md", "Beta", &b),
    ]);
    fs::write(root.join("investigation-index.json"), &pending_index).unwrap();
    git(
        root,
        &["add", "--", "odd-location.md", "investigation-index.json"],
    );
    fs::remove_file(root.join("odd-location.md")).unwrap();
    fs::write(root.join("investigation-index.json"), &work_index).unwrap();
    let other = git(root, &["show", ":unselected"]);
    stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &["240229-alpha".into()],
        StageScope::Domain,
    )
    .unwrap();
    assert!(git(root, &["ls-files", "--", "odd-location.md"]).is_empty());
    assert_eq!(
        git(root, &["show", ":investigation-index.json"]),
        pending_index
    );
    assert_eq!(git(root, &["show", ":unselected"]), other);
    assert_eq!(
        fs::read(root.join("investigation-index.json")).unwrap(),
        work_index
    );
}

#[test]
fn investigation_domain_stage_reconciles_head_pending_and_worktree_locators() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    for malformed in [false, true] {
        let dir = fixture();
        let root = dir.path();
        let body = source_doc("240229-alpha", "Alpha");
        fs::write(root.join("head-old.md"), &body).unwrap();
        fs::write(
            root.join("investigation-index.json"),
            source_index(&[("240229-alpha", "head-old.md", "Alpha", &body)]),
        )
        .unwrap();
        git(root, &["add", "--all"]);
        git(root, &["commit", "-qm", "baseline"]);
        let staged = if malformed {
            "240229-alpha.md"
        } else {
            "staged-old.md"
        };
        fs::rename(root.join("head-old.md"), root.join(staged)).unwrap();
        let pending_index = if malformed {
            b"not json".to_vec()
        } else {
            source_index(&[("240229-alpha", staged, "Alpha", &body)])
        };
        fs::write(root.join("investigation-index.json"), &pending_index).unwrap();
        git(root, &["add", "--all"]);
        fs::rename(root.join(staged), root.join("current.md")).unwrap();
        let work_index = source_index(&[("240229-alpha", "current.md", "Alpha", &body)]);
        fs::write(root.join("investigation-index.json"), &work_index).unwrap();
        let unselected = git(root, &["show", ":unselected"]);
        stage_investigations(
            &open_root(root).unwrap(),
            &RelativePath::new("investigation-index.json").unwrap(),
            &["240229-alpha".into()],
            StageScope::Domain,
        )
        .unwrap();
        assert_eq!(git(root, &["show", ":current.md"]), body.as_bytes());
        assert!(git(root, &["ls-files", "--", staged]).is_empty());
        assert!(git(root, &["ls-files", "--", "head-old.md"]).is_empty());
        assert_eq!(
            git(root, &["show", ":investigation-index.json"]),
            pending_index
        );
        assert_eq!(git(root, &["show", ":unselected"]), unselected);
    }
}

#[test]
fn investigation_domain_stage_leaves_unlocatable_pending_and_worktree_paths_unclaimed() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    for pending_middle in [true, false] {
        let dir = fixture();
        let root = dir.path();
        let a = source_doc("240229-alpha", "Alpha");
        let b = source_doc("240229-beta", "Beta");
        fs::write(root.join("head-old.md"), &a).unwrap();
        fs::write(root.join("beta.md"), &b).unwrap();
        fs::write(
            root.join("investigation-index.json"),
            source_index(&[
                ("240229-alpha", "head-old.md", "Alpha", &a),
                ("240229-beta", "beta.md", "Beta", &b),
            ]),
        )
        .unwrap();
        git(root, &["add", "--all"]);
        git(root, &["commit", "-qm", "baseline"]);
        if pending_middle {
            fs::write(root.join("middle.md"), &a).unwrap();
            git(root, &["add", "--", "middle.md"]);
            fs::rename(root.join("head-old.md"), root.join("current.md")).unwrap();
            fs::write(
                root.join("investigation-index.json"),
                source_index(&[
                    ("240229-alpha", "current.md", "Alpha", &a),
                    ("240229-beta", "beta.md", "Beta", &b),
                ]),
            )
            .unwrap();
        } else {
            fs::remove_file(root.join("head-old.md")).unwrap();
            fs::write(root.join("unknown.md"), &a).unwrap();
            fs::write(
                root.join("investigation-index.json"),
                source_index(&[("240229-beta", "beta.md", "Beta", &b)]),
            )
            .unwrap();
        }
        stage_investigations(
            &open_root(root).unwrap(),
            &RelativePath::new("investigation-index.json").unwrap(),
            &["240229-alpha".into()],
            StageScope::Domain,
        )
        .unwrap();
        assert!(git(root, &["ls-files", "--", "head-old.md"]).is_empty());
        if pending_middle {
            assert_eq!(git(root, &["show", ":middle.md"]), a.as_bytes());
            assert_eq!(git(root, &["show", ":current.md"]), a.as_bytes());
        } else {
            assert!(git(root, &["ls-files", "--", "unknown.md"]).is_empty());
            assert_eq!(fs::read(root.join("unknown.md")).unwrap(), a.as_bytes());
        }
    }
}
