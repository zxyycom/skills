//! Lock-held observations and independent freshness checks.
use super::*;
use crate::source::{MissingProof, Root, capture, capture_missing};
use std::collections::HashMap;

pub(super) struct FreshPlan<'a> {
    pub resources: resources::Resources<'a>,
    pub missing: HashMap<RelativePath, MissingProof>,
}

pub(super) fn prepare<'a, T, O: TransactionOperation<T>>(
    root: &Root,
    plan: &'a Plan<T>,
    operation: &mut O,
) -> Result<FreshPlan<'a>, TxError> {
    let resource_plan = resources::Resources::prepare(root, &plan.resources)?;
    let missing = capture_missing_baselines(root, plan)?;
    operation.fresh(root, plan)?;
    resource_plan.fresh(root)?;
    verify_protected_sources(root, plan)?;
    verify_missing_baselines(root, &missing)?;

    Ok(FreshPlan {
        resources: resource_plan,
        missing,
    })
}

// Bind absent paths before the independent fresh pass.
fn capture_missing_baselines<T>(
    root: &Root,
    plan: &Plan<T>,
) -> Result<HashMap<RelativePath, MissingProof>, TxError> {
    let mut missing = std::collections::HashMap::new();
    for (path, expected) in protected_sources(plan) {
        if matches!(expected, ExpectedFile::Missing) {
            missing.insert(
                path.clone(),
                capture_missing(root, path)
                    .map_err(|e| TxError::new("prepare-missing", e.to_string()))?,
            );
        }
    }
    Ok(missing)
}

fn verify_protected_sources<T>(root: &Root, plan: &Plan<T>) -> Result<(), TxError> {
    for (path, expected) in protected_sources(plan) {
        let actual =
            capture(root, path).map_err(|e| TxError::new("fresh-source", e.to_string()))?;
        if &actual != expected {
            return Err(TxError::new(
                "source-changed",
                format!("source changed: {}", path.as_path().display()),
            ));
        }
    }
    Ok(())
}

fn verify_missing_baselines(
    root: &Root,
    missing: &HashMap<RelativePath, MissingProof>,
) -> Result<(), TxError> {
    for (path, baseline) in missing {
        let fresh = capture_missing(root, path)
            .map_err(|e| TxError::new("fresh-missing", e.to_string()))?;
        if !baseline.equivalent(&fresh) {
            return Err(TxError::new(
                "source-changed",
                format!("missing namespace changed: {}", path.as_path().display()),
            ));
        }
    }
    Ok(())
}
