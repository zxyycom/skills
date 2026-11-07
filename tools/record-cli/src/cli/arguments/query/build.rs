use super::*;

pub(super) struct QueryBuilder<'a> {
    pub domain: Domain,
    pub values: &'a HashMap<String, Vec<String>>,
    pub positional: &'a [String],
    pub tags: Vec<String>,
    pub relation: RelationFilter,
    pub direction: Option<RequestedDirection>,
    pub status: StatusFilter,
    pub alignment: AlignmentFilter,
}

fn number(
    values: &HashMap<String, Vec<String>>,
    key: &str,
    default: u64,
    min: u64,
    max: u64,
) -> Result<u64, ArgumentError> {
    let Some(value) = values.get(key).and_then(|entries| entries.first()) else {
        return Ok(default);
    };
    if value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
        return Err(ArgumentError(format!("invalid --{key}")));
    }
    let n = value
        .parse::<u64>()
        .map_err(|_| ArgumentError(format!("invalid --{key}")))?;
    if n < min || n > max {
        return Err(ArgumentError(format!("--{key} out of range")));
    }
    Ok(n)
}

fn parse_search_scope(value: &str) -> Result<SearchScope, ArgumentError> {
    match value {
        "content" => Ok(SearchScope::Content),
        "metadata" => Ok(SearchScope::Metadata),
        _ => Err(ArgumentError("invalid --in".into())),
    }
}

fn parse_match_mode(value: &str) -> Result<MatchMode, ArgumentError> {
    match value {
        "all" => Ok(MatchMode::All),
        "any" => Ok(MatchMode::Any),
        "phrase" => Ok(MatchMode::Phrase),
        _ => Err(ArgumentError("invalid --match".into())),
    }
}

fn validate_search_text(text: &str) -> Result<(), ArgumentError> {
    use unicode_normalization::UnicodeNormalization;
    let normalized = text.nfkc().collect::<String>();
    if normalized
        .trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
        .is_empty()
    {
        return Err(ArgumentError("search text must not be empty".into()));
    }
    Ok(())
}

fn search_options(
    domain: Domain,
    values: &HashMap<String, Vec<String>>,
    text: &str,
    tags: Vec<String>,
    relation: RelationFilter,
) -> Result<SearchOptions, ArgumentError> {
    let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
    validate_search_text(text)?;
    let scope = parse_search_scope(get("in").as_deref().unwrap_or("content"))?;
    let mode = parse_match_mode(get("match").as_deref().unwrap_or("all"))?;
    if domain == Domain::Decision && scope == SearchScope::Content && values.contains_key("limit") {
        return Err(ArgumentError(
            "content search does not accept --limit".into(),
        ));
    }
    let default_limit = match (domain, scope) {
        (Domain::Decision, SearchScope::Content) => 20,
        (Domain::Decision, _) => 100,
        _ => 50,
    };
    Ok(SearchOptions {
        text: text.to_owned(),
        scope,
        mode,
        tags,
        relation,
        limit: number(values, "limit", default_limit, 1, 1000)?,
    })
}

impl QueryBuilder<'_> {
    pub(super) fn build(self, command: &str) -> Result<Query, ArgumentError> {
        Ok(match command {
            "candidates" => match self.domain {
                Domain::Decision => Query::Decision(DecisionQueryCommand::Candidates),
                Domain::Investigation => {
                    Query::Investigation(InvestigationQueryCommand::Candidates)
                }
            },
            "check" => match self.domain {
                Domain::Decision => Query::Decision(DecisionQueryCommand::Check),
                Domain::Investigation => Query::Investigation(InvestigationQueryCommand::Check {
                    ids: self.values.get("id").cloned().unwrap_or_default(),
                }),
            },
            "show" | "show-candidate" => self.show(command),
            "trace" => return self.trace(),
            "list" => return self.list(),
            "search" => return self.search(),
            _ => unreachable!(),
        })
    }
    fn show(&self, command: &str) -> Query {
        let selector = self.positional[0].clone();
        match (self.domain, command) {
            (Domain::Decision, "show") => Query::Decision(DecisionQueryCommand::Show { selector }),
            (Domain::Decision, _) => {
                Query::Decision(DecisionQueryCommand::ShowCandidate { selector })
            }
            (Domain::Investigation, "show") => {
                Query::Investigation(InvestigationQueryCommand::Show { selector })
            }
            _ => Query::Investigation(InvestigationQueryCommand::ShowCandidate { selector }),
        }
    }

    fn trace(self) -> Result<Query, ArgumentError> {
        let QueryBuilder {
            domain,
            values,
            positional,
            direction,
            ..
        } = self;
        let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
        let depth = match get("depth").as_deref() {
            Some("all") => None,
            _ => Some(number(values, "depth", 5, 0, 9_007_199_254_740_991)?),
        };
        let options = TraceOptions {
            selector: positional[0].clone(),
            direction: direction.unwrap_or(RequestedDirection::Both),
            depth,
            max_records: number(values, "max-records", 50, 1, 9_007_199_254_740_991)?,
        };
        Ok(match domain {
            Domain::Decision => Query::Decision(DecisionQueryCommand::Trace(options)),
            Domain::Investigation => {
                Query::Investigation(InvestigationQueryCommand::Trace(options))
            }
        })
    }

    fn list(self) -> Result<Query, ArgumentError> {
        let QueryBuilder {
            domain,
            values,
            tags,
            relation,
            status,
            alignment,
            ..
        } = self;
        let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
        let options = ListOptions {
            tags,
            relation,
            limit: number(values, "limit", 10, 1, 1000)?,
            offset: number(values, "offset", 0, 0, 9_007_199_254_740_991)?,
            detail: values.contains_key("detail"),
        };
        Ok(match domain {
            Domain::Decision => Query::Decision(DecisionQueryCommand::List {
                options,
                status,
                alignment,
                created_from: get("created-from"),
                created_to: get("created-to"),
                full_time: values.contains_key("full-time"),
            }),
            Domain::Investigation => Query::Investigation(InvestigationQueryCommand::List {
                options,
                formed_from: get("formed-from"),
                formed_to: get("formed-to"),
            }),
        })
    }

    fn search(self) -> Result<Query, ArgumentError> {
        let QueryBuilder {
            domain,
            values,
            positional,
            tags,
            relation,
            status,
            alignment,
            ..
        } = self;
        let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
        let options = search_options(domain, values, &positional[0], tags, relation)?;
        Ok(match domain {
            Domain::Decision => Query::Decision(DecisionQueryCommand::Search {
                options,
                status,
                alignment,
            }),
            Domain::Investigation => Query::Investigation(InvestigationQueryCommand::Search {
                options,
                formed_from: get("formed-from"),
                formed_to: get("formed-to"),
            }),
        })
    }
}
