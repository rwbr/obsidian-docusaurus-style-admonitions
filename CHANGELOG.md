# Changelog

All notable changes to this project will be documented in this file.

## 0.1.1 (2025-03-03)

### Changed
- Moved all CSS styling from JavaScript to dedicated styles.css file for better theme compatibility
- Fixed settings toggle functionality - enabling/disabling admonition types now works properly
- Improved rendering performance in Live Preview mode

### Removed
- Removed code block syntax support for better Docusaurus compatibility
- Removed debugging outputs and console logs
- Removed inline styling in favor of CSS classes

## 0.1.0 (2025-03-02)

### Added
- Initial release of Obsidian Docusaurus Style Admonitions
- Support for five admonition types: note, tip, info, warning, and danger
- Support for Docusaurus-compliant syntax using `:::type`
- Compatible with both Reading Mode and Live Preview (Edit Mode)
- Plugin settings to enable/disable specific admonition types
- Optional code block syntax support (disabled by default)
- Custom styling with icons and color-coding for each admonition type
