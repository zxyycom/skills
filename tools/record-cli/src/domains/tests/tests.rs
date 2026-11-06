#[test]
fn calendar_and_names() {
    assert!(super::valid_timestamp("2024-02-29T23:59:59+23:59"));
    assert!(!super::valid_timestamp("2023-02-29T23:59:59Z"));
    assert_eq!(super::name_from_id("240229-thing"), "thing");
    assert_eq!(super::name_from_id("230229-thing"), "230229-thing");
    assert_eq!(super::JsTrim::js_trim("\u{feff}text\u{feff}"), "text");
    assert_eq!(
        super::JsTrim::js_trim("\u{0085}text\u{0085}"),
        "\u{0085}text\u{0085}"
    );
}
