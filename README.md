# Docusaurus Style Admonitions for Obsidian

A plugin for Obsidian that adds support for [Docusaurus-style admonitions](https://docusaurus.io/docs/markdown-features/admonitions). This plugin allows you to create stylish, colored callout boxes with icons for different types of information. This is especially useful, if you manage your Docusaurus content as an Obsidian Vault.

## Features

- Supports five admonition types: note, tip, info, warning, and danger
- Works in both Reading Mode and Live Preview (Edit Mode)
- Custom styling with attractive icons and color-coding
- Full compatibility with Obsidian themes
- Flexible syntax options

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Click "Browse" and search for "Docusaurus Style Admonitions"
4. Install the plugin and enable it

### Manual Installation

1. Download the latest release (main.js, styles.css, manifest.json)
2. Create a folder named obsidian-docusaurus-style-admonitions in your vault's .obsidian/plugins/ directory
3. Copy the downloaded files into this folder
4. Enable the plugin in Obsidian settings

## Usage

You can create admonitions using the official Docusaurus syntax:

```text
:::note
This is a note
:::

:::tip
Here's a useful tip!
:::

:::info
Important information
:::

:::warning
Be careful with this
:::

:::danger
This is a dangerous action!
:::
````

You can include titles like this:

:::info [Title]
This is an info element with title
:::


## Configuration

The plugin settings allow you to:

1. Enable or disable specific admonition types
2. Enable code block syntax (not enabled by default)
	- This option allows using Markdown code blocks for admonitions (````note`)
	- Note that this syntax is **not Docusaurus-compatible**

## Compatibility

- Requires Obsidian v1.4.0 or higher
- Works with most community themes

## Support

If you encounter any issues or have suggestions, please file an issue on the [GitHub repository](https://github.com/rwbr/obsidian-docusaurus-style-admonitions).

## License

This project is licensed under the MIT License.

## Author

Created by [Ralf Weinbrecher](https://github.com/rwbr)

