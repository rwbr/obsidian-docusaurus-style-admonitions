import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownPostProcessorContext,
	MarkdownRenderer,
	Notice
} from 'obsidian';

import { Decoration, DecorationSet } from '@codemirror/view';
import { Range } from '@codemirror/state';
import { ViewPlugin, EditorView } from '@codemirror/view';

/** Plugin-Einstellungen */
interface DocusaurusAdmonitionSettings {
	enabledAdmonitions: {
		note: boolean;
		tip: boolean;
		info: boolean;
		warning: boolean;
		danger: boolean;
	};
	customCSS: boolean;
	enableCodeBlockSyntax: boolean; // Neue Option für die Code-Block-Syntax
}

const DEFAULT_SETTINGS: DocusaurusAdmonitionSettings = {
	enabledAdmonitions: {
		note: true,
		tip: true,
		info: true,
		warning: true,
		danger: true
	},
	customCSS: true,
	enableCodeBlockSyntax: false // Standardmäßig deaktiviert
};

export default class DocusaurusAdmonitionsPlugin extends Plugin {
	settings: DocusaurusAdmonitionSettings;

	/** Wird aufgerufen, wenn das Plugin geladen wird. */
	async onload() {
		console.log('Docusaurus Admonitions Plugin geladen');

		// 1. Plugin-Einstellungen laden
		await this.loadSettings();

		// 2. CSS-Styles einfügen
		this.injectStyles();

		// 3. Code-Block-Processor für Reading Mode (nur wenn aktiviert)
		if (this.settings.enableCodeBlockSyntax) {
			this.registerMarkdownCodeBlockProcessor('note', this.processAdmonition.bind(this, 'note'));
			this.registerMarkdownCodeBlockProcessor('tip', this.processAdmonition.bind(this, 'tip'));
			this.registerMarkdownCodeBlockProcessor('info', this.processAdmonition.bind(this, 'info'));
			this.registerMarkdownCodeBlockProcessor('warning', this.processAdmonition.bind(this, 'warning'));
			this.registerMarkdownCodeBlockProcessor('danger', this.processAdmonition.bind(this, 'danger'));
		}

		// 4. Live Preview-Unterstützung (Edit Mode)
		this.registerLivePreviewRenderer();

		// 5. Einstellungs-Tab hinzufügen
		this.addSettingTab(new DocusaurusAdmonitionsSettingTab(this.app, this));

		// Debugging-Funktion zur Verfügung stellen
		(window as any).inspectDocusaurusAdmonitions = this.inspectAdmonitions;
		console.log("Debug-Funktion verfügbar: window.inspectDocusaurusAdmonitions()");

		// Nach 3 Sekunden automatisch inspizieren
		setTimeout(() => {
			console.log(this.inspectAdmonitions());
		}, 3000);
	}

	/** Erstellt & injiziert CSS-Styles für Reading Mode und Live Preview. */
	injectStyles() {
		// Keine direkte CSS-Einfügung mehr - styles.css wird automatisch von Obsidian geladen
		console.log("Docusaurus Admonitions: Styles werden über styles.css geladen.");
	}

	/** Verarbeitet Code-Blöcke (z. B. ```note ... ```), um Reading Mode-Admonitions zu erzeugen. */
	async processAdmonition(type: string, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		if (!this.settings.enabledAdmonitions[type as keyof typeof this.settings.enabledAdmonitions]) {
			return;
		}

		// Gesamten Container leeren und neu erstellen
		el.empty();

		const admonitionDiv = el.createDiv({
			cls: ['docusaurus-admonition', `docusaurus-admonition-${type}`]
		});

		// Titel OHNE text-Option erstellen, damit wir HTML verwenden können
		const titleDiv = admonitionDiv.createDiv({
			cls: 'docusaurus-admonition-title'
		});

		// Text manuell setzen (kein HTML-Escaping)
		titleDiv.textContent = type.toUpperCase();

		console.log(`Admonition erstellt: ${type}`, {
			'Hat Titel?': admonitionDiv.querySelector('.docusaurus-admonition-title') !== null,
			'Elternelement': el.parentElement?.tagName,
			'CSS geladen?': document.getElementById('docusaurus-admonitions-styles') !== null
		});

		const contentDiv = admonitionDiv.createDiv({
			cls: 'docusaurus-admonition-content'
		});

		await MarkdownRenderer.renderMarkdown(source, contentDiv, ctx.sourcePath, this);
	}

	/** Verarbeitet die :::type-Syntax in Reading Mode. */
	async processCustomAdmonitionSyntax(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		const paragraphs = el.querySelectorAll('p');

		for (let i = 0; i < paragraphs.length; i++) {
			const p = paragraphs[i];
			const text = p.textContent?.trim();
			if (!text || !text.startsWith(':::')) continue;

			// Typ ermitteln
			const match = text.match(/^:::(note|tip|info|warning|danger)(?:\s|$)/);
			if (!match) continue;
			const type = match[1];

			// Einzeilige Admonition
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

			// Mehrzeilige Admonition
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

			// Container bauen
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

	/** Registriert Post-Processor & CodeMirror-Dekorationen für Live Preview. */
	registerLivePreviewRenderer() {
		// A) Reading Mode: Processors
		this.registerMarkdownPostProcessor((el, ctx) => {
			this.processCustomAdmonitionSyntax(el, ctx);
		});

		// B) Live Preview (Edit Mode) via EditorView Plugin
		try {
			const pluginExtension = createAdmonitionViewPlugin();
			this.registerEditorExtension([pluginExtension]);
			console.log("Docusaurus Admonitions: Live Preview aktiviert.");
		} catch (e) {
			console.error("Docusaurus Admonitions: Live Preview konnte nicht aktiviert werden:", e);
			this.addCSS_Fallback();
		}
	}

	/** Fallback: Einfaches CSS, falls das ViewPlugin scheitert */
	addCSS_Fallback() {
		// Fallback-Styles sind jetzt in styles.css definiert
		console.log("Docusaurus Admonitions: Fallback-CSS über styles.css verfügbar.");
	}

	/** Beim Deaktivieren: CSS & Debug-Elemente entfernen. */
	onunload() {
		// Obsidian kümmert sich automatisch um das Entladen der styles.css
		console.log('Docusaurus Admonitions: Plugin entladen.');
	}

	/** Einstellungen laden */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/** Einstellungen speichern */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Debugging-Funktion für dein Dokument */
	testDocumentStructure() {
		// Temporärer Button in der Obsidian-UI
		const debugBtn = document.createElement('button');
		debugBtn.textContent = 'DEBUG';
		debugBtn.style.position = 'fixed';
		debugBtn.style.top = '10px';
		debugBtn.style.right = '10px';
		debugBtn.style.zIndex = '1000';

		debugBtn.addEventListener('click', () => {
			const activeLeaf = this.app.workspace.activeLeaf;
			if (!activeLeaf) return;

			const view = activeLeaf.view;
			if (view.getViewType() === "markdown") {
				console.log("Aktuelle Dokument-Struktur:");
				const previewEl = view.containerEl.querySelector('.markdown-preview-view');
				if (previewEl) {
					console.log(previewEl.innerHTML);
					const paragraphs = previewEl.querySelectorAll('p');
					paragraphs.forEach((p, i) => {
						console.log(`P[${i}]: "${p.textContent}"`);
					});
				}
			}
		});

		document.body.appendChild(debugBtn);
	}

	inspectAdmonitions() {
		// Suche im gesamten Dokument nach Admonitions und protokolliere deren Struktur
		const admonitions = document.querySelectorAll('.docusaurus-admonition');
		console.log(`${admonitions.length} Admonitions gefunden`);

		admonitions.forEach((adm, i) => {
			const type = Array.from(adm.classList)
				.find(c => c.startsWith('docusaurus-admonition-') && c !== 'docusaurus-admonition')
				?.replace('docusaurus-admonition-', '') || 'unbekannt';

			console.log(`Admonition #${i} (${type}):`);
			console.log('- HTML:', adm.outerHTML);
			console.log('- Titel vorhanden:', adm.querySelector('.docusaurus-admonition-title') !== null);
			console.log('- Computed Style für Titel:',
				window.getComputedStyle(
					adm.querySelector('.docusaurus-admonition-title') || adm
				)
			);
		});

		return `${admonitions.length} Admonitions inspiziert`;
	}
}

/** Einstellungs-Tab */
class DocusaurusAdmonitionsSettingTab extends PluginSettingTab {
	plugin: DocusaurusAdmonitionsPlugin;

	constructor(app: App, plugin: DocusaurusAdmonitionsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Docusaurus Admonitions Einstellungen' });

		const desc = 'Aktiviert die :::SYNTAX Admonition';
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
					})
				);
		});

		containerEl.createEl('h3', { text: 'Syntax-Optionen' });

		new Setting(containerEl)
			.setName('Code-Block-Syntax aktivieren')
			.setDesc('Ermöglicht die Verwendung von ```note Code-Blöcken für Admonitions. Diese Syntax ist nicht Docusaurus-kompatibel.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCodeBlockSyntax)
				.onChange(async (value) => {
					this.plugin.settings.enableCodeBlockSyntax = value;
					await this.plugin.saveSettings();
					// Hinweis anzeigen, dass Neustart erforderlich ist
					new Notice('Bitte Obsidian neu starten, um die Syntax-Änderung wirksam zu machen.');
				})
			);
	}
}

/** ViewPlugin: Dekoriert die :::-Zeilen im Edit Mode (Live Preview). */
function createAdmonitionViewPlugin() {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = computeAdmonitionDecorations(view);
			}

			update(update: any) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = computeAdmonitionDecorations(update.view);
				}
			}
		},
		{
			decorations: v => v.decorations
		}
	);
}

/** Erzeugt ein DecorationSet, das Start-/Endzeilen und Inhalt im Edit Mode hervorhebt. */
function computeAdmonitionDecorations(view: EditorView): DecorationSet {
	const types = ['note', 'tip', 'info', 'warning', 'danger'];
	const decorations: Range<Decoration>[] = [];
	const doc = view.state.doc;

	let pos = 0;
	while (pos < doc.length) {
		const line = doc.lineAt(pos);
		const text = line.text;

		// Prüfe auf Admonition-Start (z.B. :::note)
		let foundStart = false;
		for (const t of types) {
			const startRegex = new RegExp(`^:::${t}(?:\\s|$)`);
			if (startRegex.test(text)) {
				// Start-Zeile
				decorations.push(
					Decoration.line({
						attributes: { class: `admonition-${t}-start` }
					}).range(line.from)
				);
				foundStart = true;

				// => Ab jetzt: alle folgenden Zeilen (Inhalt) stylen, bis wir ":::"
				let innerPos = line.to + 1;
				while (innerPos < doc.length) {
					const innerLine = doc.lineAt(innerPos);
					const innerText = innerLine.text.trim();

					// Ende-Zeile?
					if (innerText === ':::') {
						decorations.push(
							Decoration.line({
								attributes: { class: `admonition-${t}-end` }
							}).range(innerLine.from)
						);
						break;
					} else {
						// Inhalt
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
