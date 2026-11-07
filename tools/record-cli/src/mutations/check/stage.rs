use super::*;

#[derive(Debug)]
pub(crate) struct DecisionStage {
    pub result: CheckResult,
    pub index_before: ExpectedFile,
    pub target: Vec<u8>,
    pub needs_write: bool,
    pub activation_paths: Vec<String>,
}
#[derive(Debug)]
pub(crate) struct InvestigationStage {
    pub result: CheckResult,
    pub index_before: ExpectedFile,
    pub target: Vec<u8>,
    pub needs_write: bool,
}
