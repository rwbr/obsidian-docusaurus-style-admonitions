import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownPostProcessorContext,
	MarkdownRenderer,
} from 'obsidian';

import { Decoration, DecorationSet, ViewUpdate } from '@codemirror/view';
import { Range } from '@codemirror/state';
import { ViewPlugin, EditorView } from '@codemirror/view';

/** Plugin Settings */
interface DocusaurusAdmonitionSettings {
	enabledAdmonitions: {
		note: boolean;
		tip: boolean;
		info: boolean;
		warning: boolean;
		danger: boolean;
	};
	customCSS: boolean;
}

/**
 * Default settings for the Docusaurus Admonition plugin.
 * @property {Object} enabledAdmonitions - Object controlling which admonition types are enabled.
 * @property {boolean} enabledAdmonitions.note - Whether 'note' admonitions are enabled.
 * @property {boolean} enabledAdmonitions.tip - Whether 'tip' admonitions are enabled.
 * @property {boolean} enabledAdmonitions.info - Whether 'info' admonitions are enabled.
 * @property {boolean} enabledAdmonitions.warning - Whether 'warning' admonitions are enabled.
 * @property {boolean} enabledAdmonitions.danger - Whether 'danger' admonitions are enabled.
 * @property {boolean} customCSS - Whether custom CSS styling for admonitions is enabled.
 */
const DEFAULT_SETTINGS: DocusaurusAdmonitionSettings = {
	enabledAdmonitions: {
		note: true,
		tip: true,
		info: true,
		warning: true,
		danger: true
	},
	customCSS: true,
};

export default class DocusaurusAdmonitionsPlugin extends Plugin {
	settings: DocusaurusAdmonitionSettings;

	/** Called when the plugin is loaded. */
	async onload() {
		// 1. Load plugin settings
		await this.loadSettings();

		// 2. Live Preview support (Edit Mode)
		this.registerLivePreviewRenderer();

		// 3. Add settings tab
		this.addSettingTab(new DocusaurusAdmonitionsSettingTab(this.app, this));
	}

	/** Processes the :::type syntax in Reading Mode. */
	async processCustomAdmonitionSyntax(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		const paragraphs = el.querySelectorAll('p');

		for (let i = 0; i < paragraphs.length; i++) {
			const p = paragraphs[i];
			const text = p.textContent?.trim();
			if (!text || !text.startsWith(':::')) continue;

			// Determine type
			const match = text.match(/^:::(note|tip|info|warning|danger)(?:\s|$)/);
			if (!match) continue;
			const type = match[1];

			// Single line admonition
			const singleLineMatch = text.match(/^:::(note|tip|info|warning|danger)\s+([\s\S]+?)\s+:::$/);
			if (singleLineMatch) {
				const singleType = singleLineMatch[1];
				const content = singleLineMatch[2];

				if (!this.settings.enabledAdmonitions[singleType as keyof typeof this.settings.enabledAdmonitions]) {
					continue;
				}

				const admonitionDiv = el.createDiv({
					cls: ['docusaurus-admonition', `docusaurus-admonition-${singleType}`]
				});
				admonitionDiv.createDiv({
					cls: 'docusaurus-admonition-title',
					text: singleType.toUpperCase()
				});
				const contentDiv = admonitionDiv.createDiv({ cls: 'docusaurus-admonition-content' });
				await MarkdownRenderer.renderMarkdown(content, contentDiv, ctx.sourcePath, this);
				p.replaceWith(admonitionDiv);
				continue;
			}

			// Multi-line admonition
			let endIndex = -1;
			let content: HTMLElement[] = [];
			for (let j = i + 1; j < paragraphs.length; j++) {
				const endText = paragraphs[j].textContent?.trim();
				if (endText === ':::') {
					endIndex = j;
					break;
				} else {
					content.push(paragraphs[j]);
				}
			}
			if (endIndex === -1) continue;

			if (!this.settings.enabledAdmonitions[type as keyof typeof this.settings.enabledAdmonitions]) {
				continue;
			}

			// Build container
			const admonitionDiv = el.createDiv({
				cls: ['docusaurus-admonition', `docusaurus-admonition-${type}`]
			});
			admonitionDiv.createDiv({
				cls: 'docusaurus-admonition-title',
				text: type.toUpperCase()
			});
			const contentDiv = admonitionDiv.createDiv({ cls: 'docusaurus-admonition-content' });

			for (let k = 0; k < content.length; k++) {
				contentDiv.appendChild(content[k].cloneNode(true));
			}

			p.replaceWith(admonitionDiv);
			content.forEach(el => el.remove());
			paragraphs[endIndex].remove();
			i = endIndex;
		}
	}

	/** Registers Post-Processor & CodeMirror decorations for Live Preview. */
	registerLivePreviewRenderer() {
		// A) Reading Mode: Processors
		this.registerMarkdownPostProcessor((el, ctx) => {
			this.processCustomAdmonitionSyntax(el, ctx);
		});

		// B) Live Preview (Edit Mode) via EditorView Plugin
		try {
			const pluginExtension = createAdmonitionViewPlugin(this.settings);
			this.registerEditorExtension([pluginExtension]);
		} catch (e) {
			// Silent fallback - styles already defined in CSS
		}
	}

	/** Called when the plugin is disabled */
	onunload() {
		// No actions required - Obsidian handles resource cleanup
	}

	/** Load settings */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/** Save settings */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/** Settings Tab */
class DocusaurusAdmonitionsSettingTab extends PluginSettingTab {
	plugin: DocusaurusAdmonitionsPlugin;

	constructor(app: App, plugin: DocusaurusAdmonitionsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Docusaurus Admonitions Settings' });

		const desc = 'Enables :::SYNTAX admonition';
		const types = ['note', 'tip', 'info', 'warning', 'danger'] as const;

		types.forEach(type => {
			new Setting(containerEl)
				.setName(`${type.toUpperCase()} Admonition`)
				.setDesc(`${desc.replace('SYNTAX', type)}`)
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enabledAdmonitions[type])
					.onChange(async (value) => {
						this.plugin.settings.enabledAdmonitions[type] = value;
						await this.plugin.saveSettings();

						// Force editor refresh to apply setting changes
						this.plugin.registerLivePreviewRenderer();
					})
				);
		});
	}
}

/** ViewPlugin: Decorates the ::: lines in Edit Mode (Live Preview). */
function createAdmonitionViewPlugin(settings: DocusaurusAdmonitionSettings) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = computeAdmonitionDecorations(view, settings);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = computeAdmonitionDecorations(update.view, settings);
				}
			}
		},
		{
			decorations: v => v.decorations
		}
	);
}

/** Creates a DecorationSet that highlights start/end lines and content in Edit Mode. */
function computeAdmonitionDecorations(view: EditorView, settings: DocusaurusAdmonitionSettings): DecorationSet {
	const types = ['note', 'tip', 'info', 'warning', 'danger'];
	const decorations: Range<Decoration>[] = [];
	const doc = view.state.doc;

	let pos = 0;
	while (pos < doc.length) {
		const line = doc.lineAt(pos);
		const text = line.text;

		// Check for admonition start (e.g., :::note)
		for (const t of types) {
			// Check if this type is enabled in settings
			if (!settings.enabledAdmonitions[t as keyof typeof settings.enabledAdmonitions]) {
				continue;
			}

			const startRegex = new RegExp(`^:::${t}(?:\\s|$)`);
			if (startRegex.test(text)) {
				// Start line
				decorations.push(
					Decoration.line({
						attributes: { class: `admonition-${t}-start` }
					}).range(line.from)
				);

				// Now style all following lines (content) until we find ":::"
				let innerPos = line.to + 1;
				while (innerPos < doc.length) {
					const innerLine = doc.lineAt(innerPos);
					const innerText = innerLine.text.trim();

					// End line?
					if (innerText === ':::') {
						decorations.push(
							Decoration.line({
								attributes: { class: `admonition-${t}-end` }
							}).range(innerLine.from)
						);
						break;
					} else {
						// Content
						decorations.push(
							Decoration.line({
								attributes: { class: `admonition-${t}-content` }
							}).range(innerLine.from)
						);
					}
					innerPos = innerLine.to + 1;
				}
				break;
			}
		}
		pos = line.to + 1;
	}
	return Decoration.set(decorations, true);
}
