# Changelog

## Unreleased

## 0.1.1 - 2026-03-30

### Added
- Added sticky/floating WoS toolbar shortcuts for DOI Query, WOS Export, SID Info, Journal Query, and WOS Query entry points.
- Added SID info quick action with clipboard copy support from the toolbar.

### Changed
- Improved toolbar icon loading so icons render reliably after page refresh.
- Updated single-panel behavior to support closing on `Esc`, outside click, DOI search submit, and SID copy success.
- Refined DOI history navigation to support direct `Up`/`Down` history browsing.
- Simplified Export Flow UUID UI by removing the UUID format hint, moving the Auto toggle inline with the UUID input, and polishing UUID refresh visuals.
- Bumped the extension version to `0.1.1`.

### Fixed
- Hardened Journal Query text capture so large Web of Science detail blocks are no longer pasted into the journal input.
- Limited automatic journal capture to short journal-like candidates and filtered common metadata labels such as DOI, ISSN, ORCID, abstract, funding, and publisher fields.
