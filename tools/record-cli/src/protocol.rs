//! Candidate CLI output. Successful trace is serialized by its domain without an envelope.
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct Diagnostic {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(rename = "causeCategory", skip_serializing_if = "Option::is_none")]
    pub cause_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovery: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct CommandError {
    pub code: Box<str>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Box<str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<Box<str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovery: Option<Box<str>>,
    #[serde(skip)]
    pub diagnostics: Vec<Diagnostic>,
    /// Already serialized DTO retained as JSON text; omitted when no facts exist.
    #[serde(skip)]
    pub partial: Option<Box<String>>,
}
impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for CommandError {}
impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into().into_boxed_str(),
            message: message.into(),
            path: None,
            field: None,
            recovery: None,
            diagnostics: Vec::new(),
            partial: None,
        }
    }
    pub fn with_partial<T: Serialize>(mut self, value: &T) -> Result<Self, serde_json::Error> {
        self.partial = Some(Box::new(serde_json::to_string(value)?));
        Ok(self)
    }
}
#[derive(Serialize)]
pub struct Success<'a, T: Serialize> {
    pub version: u8,
    pub command: &'a str,
    pub ok: bool,
    pub result: T,
    pub diagnostics: Vec<Diagnostic>,
}
#[derive(Serialize)]
pub struct Failure<'a, T: Serialize> {
    pub version: u8,
    pub command: &'a str,
    pub ok: bool,
    pub error: CommandError,
    pub diagnostics: Vec<Diagnostic>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<T>,
}
