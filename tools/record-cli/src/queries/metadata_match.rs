//! Match field and relation-summary segments while retaining response evidence.
use super::matcher::Matcher;
use crate::domains::Relation;
use serde::Serialize;
use std::collections::HashSet;

#[derive(Serialize)]
pub struct RelationMatch {
    pub summary: String,
    pub target: String,
    #[serde(rename = "type")]
    pub relation_type: String,
}
pub(crate) struct MetadataEvidence {
    pub fields: Vec<&'static str>,
    pub relations: Vec<RelationMatch>,
}
pub(crate) struct MetadataSegments<'a> {
    segments: Vec<(&'static str, Option<usize>, &'a str)>,
    relations: &'a [Relation],
}
impl<'a> MetadataSegments<'a> {
    pub fn new(
        fields: &[(&'static str, &'a str)],
        tags: &'a [String],
        relations: &'a [Relation],
    ) -> Self {
        let mut segments: Vec<_> = fields
            .iter()
            .map(|&(name, text)| (name, None, text))
            .collect();
        segments.extend(tags.iter().map(|tag| ("tags", None, tag.as_str())));
        segments.extend(relations.iter().enumerate().filter_map(|(i, relation)| {
            relation
                .summary
                .as_deref()
                .filter(|text| !text.trim().is_empty())
                .map(|text| ("", Some(i), text))
        }));
        Self {
            segments,
            relations,
        }
    }
    pub fn find(self, matcher: &Matcher) -> Option<MatchedMetadata<'a>> {
        let hits = matcher.matching_segments(
            &self
                .segments
                .iter()
                .map(|(_, _, text)| *text)
                .collect::<Vec<_>>(),
        );
        (!hits.is_empty()).then_some(MatchedMetadata {
            segments: self,
            hits,
        })
    }
}

pub(crate) struct MatchedMetadata<'a> {
    segments: MetadataSegments<'a>,
    hits: Vec<usize>,
}
impl MatchedMetadata<'_> {
    pub fn evidence(self, order: &[&'static str]) -> MetadataEvidence {
        let mut fields = HashSet::new();
        let mut relations = Vec::new();
        for index in self.hits {
            let (field, relation, _) = self.segments.segments[index];
            if let Some(i) = relation {
                let r = &self.segments.relations[i];
                relations.push(RelationMatch {
                    summary: r.summary.clone().unwrap_or_default(),
                    target: r.target.clone(),
                    relation_type: r.relation_type.clone(),
                });
            } else {
                fields.insert(field);
            }
        }
        MetadataEvidence {
            fields: order
                .iter()
                .copied()
                .filter(|field| fields.contains(field))
                .collect(),
            relations,
        }
    }
}
