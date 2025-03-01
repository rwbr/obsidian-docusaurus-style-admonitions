import {
	App, Modal, Notice, Plugin, PluginSettingTab, Setting,
	MarkdownPostProcessor, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer,
	editorLivePreviewField
} from 'obsidian';
import { Decoration, DecorationSet } from '@codemirror/view';
import { Range } from '@codemirror/state';
import { ViewPlugin, EditorView } from '@codemirror/view';

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

const DEFAULT_SETTINGS: DocusaurusAdmonitionSettings = {
	enabledAdmonitions: {
		note: true,
		tip: true,
		info: true,
		warning: true,
		danger: true
	},
	customCSS: true
}

export default class DocusaurusAdmonitionsPlugin extends Plugin {
	settings: DocusaurusAdmonitionSettings;

	async onload() {
		await this.loadSettings();

		// CSS-Styles laden
		this.loadStyles();

		// Markdown-Postprocessor für Admonitions registrieren
		this.registerMarkdownCodeBlockProcessor('note', this.processAdmonition.bind(this, 'note'));
		this.registerMarkdownCodeBlockProcessor('tip', this.processAdmonition.bind(this, 'tip'));
		this.registerMarkdownCodeBlockProcessor('info', this.processAdmonition.bind(this, 'info'));
		this.registerMarkdownCodeBlockProcessor('warning', this.processAdmonition.bind(this, 'warning'));
		this.registerMarkdownCodeBlockProcessor('danger', this.processAdmonition.bind(this, 'danger'));

		// Custom Admonition Syntax (:::type) verarbeiten
		this.registerLivePreviewRenderer();

		// Einstellungs-Tab hinzufügen
		this.addSettingTab(new DocusaurusAdmonitionsSettingTab(this.app, this));

		// Debugging-Funktion für die Dokumentenstruktur hinzufügen
		this.testDocumentStructure();
	}

	loadStyles() {
		// Bestehende Styles laden
		document.head.appendChild(this.createAdmonitionStyles());

		// Verbesserte Editor-CSS für die Hervorhebung von Admonitions
		const editorStyle = document.createElement('style');
		editorStyle.id = 'docusaurus-admonitions-editor-styles';
		editorStyle.textContent = `
			/* Admonition-Block-Zeilen im Editor */
			.admonition-note-start,
			.admonition-tip-start,
			.admonition-info-start,
			.admonition-warning-start,
			.admonition-danger-start {
				font-weight: bold;
			}
			
			.admonition-note-start {
				color: #448aff !important;
				border-left: 3px solid #448aff;
				padding-left: 4px;
			}

			.admonition-tip-start {
				color: #00a400 !important;
				border-left: 3px solid #00a400;
				padding-left: 4px;
			}

			.admonition-info-start {
				color: #3578e5 !important;
				border-left: 3px solid #3578e5;
				padding-left: 4px;
			}

			.admonition-warning-start {
				color: #e6a700 !important;
				border-left: 3px solid #e6a700;
				padding-left: 4px;
			}

			.admonition-danger-start {
				color: #fa383e !important;
				border-left: 3px solid #fa383e;
				padding-left: 4px;
			}

			.admonition-end {
				color: #888 !important;
				border-left: 3px solid #888;
				padding-left: 4px;
			}

			/* Zeilen zwischen Start und Ende */
			.cm-line:has(.admonition-note-start) ~ .cm-line:not(:has(.admonition-end)) {
				border-left: 3px solid rgba(68, 138, 255, 0.2);
				padding-left: 4px;
				background-color: rgba(68, 138, 255, 0.05);
			}
		`;
		document.head.appendChild(editorStyle);

		// Weitere CSS-Einstellungen...

		// Live-Preview-Styles hinzufügen
		const livePreviewStyle = document.createElement('style');
		livePreviewStyle.id = 'docusaurus-admonitions-live-styles';
		livePreviewStyle.textContent = `
				.docusaurus-admonition-live {
					background-color: var(--background-secondary);
					border-left: 5px solid;
					padding-left: 10px;
				}

				.docusaurus-admonition-note-live {
					border-left-color: #448aff !important;
				}

				.docusaurus-admonition-tip-live {
					border-left-color: #00a400 !important;
				}

				.docusaurus-admonition-info-live {
					border-left-color: #3578e5 !important;
				}

				.docusaurus-admonition-warning-live {
					border-left-color: #e6a700 !important;
				}

				.docusaurus-admonition-danger-live {
					border-left-color: #fa383e !important;
				}
			`;
		document.head.appendChild(livePreviewStyle);

		// Verbesserte Live Preview-Styles
		const livePreviewStyleImproved = document.createElement('style');
		livePreviewStyleImproved.id = 'docusaurus-admonitions-live-styles';
		livePreviewStyleImproved.textContent = `
        /* Allgemeine Stile für Admonition-Live-Blöcke */
        .docusaurus-admonition-live {
            border-left: 4px solid;
            background-color: var(--background-secondary-alt);
            padding-left: 8px;
            margin-left: 4px;
        }
        
        /* Spezifische Stile für jeden Admonition-Typ */
        /* Note */
        .admonition-note-start,
        .admonition-note-content,
        .admonition-note-end {
            border-left-color: #448aff !important;
            background-color: rgba(68, 138, 255, 0.05);
        }
        .admonition-note-start {
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            font-weight: bold;
            color: #448aff;
        }
        .admonition-note-end {
            border-bottom-left-radius: 4px;
            border-bottom-right-radius: 4px;
            color: #448aff;
        }
        
        /* Tip */
        .admonition-tip-start,
        .admonition-tip-content,
        .admonition-tip-end {
            border-left-color: #00a400 !important;
            background-color: rgba(0, 164, 0, 0.05);
        }
        .admonition-tip-start {
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            font-weight: bold;
            color: #00a400;
        }
        .admonition-tip-end {
            border-bottom-left-radius: 4px;
            border-bottom-right-radius: 4px;
            color: #00a400;
        }
        
        /* Info */
        .admonition-info-start,
        .admonition-info-content,
        .admonition-info-end {
            border-left-color: #3578e5 !important;
            background-color: rgba(53, 120, 229, 0.05);
        }
        .admonition-info-start {
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            font-weight: bold;
            color: #3578e5;
        }
        .admonition-info-end {
            border-bottom-left-radius: 4px;
            border-bottom-right-radius: 4px;
            color: #3578e5;
        }
        
        /* Warning */
        .admonition-warning-start,
        .admonition-warning-content,
        .admonition-warning-end {
            border-left-color: #e6a700 !important;
            background-color: rgba(230, 167, 0, 0.05);
        }
        .admonition-warning-start {
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            font-weight: bold;
            color: #e6a700;
        }
        .admonition-warning-end {
            border-bottom-left-radius: 4px;
            border-bottom-right-radius: 4px;
            color: #e6a700;
        }
        
        /* Danger */
        .admonition-danger-start,
        .admonition-danger-content,
        .admonition-danger-end {
            border-left-color: #fa383e !important;
            background-color: rgba(250, 56, 62, 0.05);
        }
        .admonition-danger-start {
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            font-weight: bold;
            color: #fa383e;
        }
        .admonition-danger-end {
            border-bottom-left-radius: 4px;
            border-bottom-right-radius: 4px;
            color: #fa383e;
        }
    `;
		document.head.appendChild(livePreviewStyleImproved);
	}

	createAdmonitionStyles(): HTMLElement {
		const styleEl = document.createElement('style');
		styleEl.id = 'docusaurus-admonitions-styles';
		styleEl.textContent = `
            .docusaurus-admonition {
                margin-bottom: 1em;
                padding: 15px;
                border-left: 5px solid;
                border-radius: 5px;
                background-color: var(--background-secondary);
            }
            
            .docusaurus-admonition-note {
                border-left-color: #448aff;
            }
            
            .docusaurus-admonition-tip {
                border-left-color: #00a400;
            }
            
            .docusaurus-admonition-info {
                border-left-color: #3578e5;
            }
            
            .docusaurus-admonition-warning {
                border-left-color: #e6a700;
            }
            
            .docusaurus-admonition-danger {
                border-left-color: #fa383e;
            }
            
            .docusaurus-admonition-title {
                margin-top: 0;
                margin-bottom: 10px;
                font-weight: 700;
                text-transform: uppercase;
                font-size: 0.9em;
            }
            
            .docusaurus-admonition-content p:last-child {
                margin-bottom: 0;
            }
        `;
		return styleEl;
	}

	async processAdmonition(type: string, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		// Prüfe ob dieser Admonition-Typ aktiviert ist
		if (!this.settings.enabledAdmonitions[type as keyof typeof this.settings.enabledAdmonitions]) {
			return;
		}

		// Container für die Admonition erstellen
		const admonitionDiv = el.createDiv({
			cls: ['docusaurus-admonition', `docusaurus-admonition-${type}`]
		});

		// Titel hinzufügen
		admonitionDiv.createDiv({
			cls: 'docusaurus-admonition-title',
			text: type.toUpperCase()
		});

		// Inhalt-Container erstellen
		const contentDiv = admonitionDiv.createDiv({
			cls: 'docusaurus-admonition-content'
		});

		// Markdown im Inhalt verarbeiten lassen
		await MarkdownRenderer.render(this.app, source, contentDiv, ctx.sourcePath, this);
	}

	async processCustomAdmonitionSyntax(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		console.log("--- Beginn der Verarbeitung: processCustomAdmonitionSyntax ---");
		console.log("Context:", ctx.sourcePath);

		// Suche nach Zeilen mit :::type Syntax
		const contentElements = el.querySelectorAll('p');
		console.log(`Gefundene Paragraphen: ${contentElements.length}`);

		for (let i = 0; i < contentElements.length; i++) {
			const element = contentElements[i];
			const text = element.textContent?.trim();
			console.log(`Paragraph ${i}: "${text}"`);

			if (!text || !text.startsWith(':::')) {
				console.log('  Nicht mit ::: beginnend - überspringen');
				continue;
			}

			// Prüfe, ob es ein Admonition-Start ist
			const match = text.match(/^:::(note|tip|info|warning|danger)(?:\s|$)/);
			if (!match) {
				console.log('  Kein gültiger Admonition-Start - überspringen');
				continue;
			}

			console.log(`  Admonition gefunden! Typ: ${match[1]}`);

			// Prüfe, ob dieser Typ aktiviert ist
			const type = match[1];
			if (!this.settings.enabledAdmonitions[type as keyof typeof this.settings.enabledAdmonitions]) {
				continue;
			}

			// Prüfe auf einzeilige Admonition wie ":::info\nInhalt\n:::"
			const singleLineMatch = text.match(/^:::(note|tip|info|warning|danger)\s+([\s\S]+?)\s+:::$/);
			if (singleLineMatch) {
				console.log(`  Einzeilige Admonition gefunden! Typ: ${singleLineMatch[1]}, Inhalt: ${singleLineMatch[2]}`);

				const type = singleLineMatch[1];
				const content = singleLineMatch[2];

				// Erstelle die Admonition
				const admonitionDiv = el.createDiv({
					cls: ['docusaurus-admonition', `docusaurus-admonition-${type}`]
				});

				// Titel hinzufügen
				admonitionDiv.createDiv({
					cls: 'docusaurus-admonition-title',
					text: type.toUpperCase()
				});

				// Inhalt-Container erstellen
				const contentDiv = admonitionDiv.createDiv({
					cls: 'docusaurus-admonition-content'
				});

				// Markdown-Inhalt rendern
				await MarkdownRenderer.renderMarkdown(content, contentDiv, ctx.sourcePath, this);

				// Original-Element ersetzen
				element.replaceWith(admonitionDiv);
				return; // Beende die Verarbeitung hier
			}

			// Suche nach dem Ende des Blocks (nur ":::")
			let endIndex = -1;
			let content = [];

			for (let j = i + 1; j < contentElements.length; j++) {
				const possibleEndElement = contentElements[j];
				if (possibleEndElement.textContent?.trim() === ':::') {
					endIndex = j;
					break;
				} else {
					content.push(possibleEndElement);
				}
			}

			if (endIndex === -1) {
				console.log(`  Kein Ende-Tag für ${type} Admonition gefunden - überspringen`);
				continue; // Kein Ende gefunden
			}

			// Container für die Admonition erstellen
			const admonitionDiv = el.createDiv({
				cls: ['docusaurus-admonition', `docusaurus-admonition-${type}`]
			});

			// Titel hinzufügen
			admonitionDiv.createDiv({
				cls: 'docusaurus-admonition-title',
				text: type.toUpperCase()
			});

			// Inhalt-Container erstellen
			const contentDiv = admonitionDiv.createDiv({
				cls: 'docusaurus-admonition-content'
			});

			// Inhalte zum Content-Div hinzufügen
			content.forEach(el => {
				contentDiv.appendChild(el.cloneNode(true));
			});

			// Original-Elemente ersetzen/entfernen
			element.replaceWith(admonitionDiv);

			// Entferne alle Inhalts- und End-Elemente
			content.forEach(el => el.remove());
			contentElements[endIndex].remove();

			// Anpassen des Index für die nächste Iteration
			i = endIndex;
		}
		console.log("--- Ende der Verarbeitung: processCustomAdmonitionSyntax ---");
	}

	registerLivePreviewRenderer() {
		// Reading View-Postprozessor bleibt erhalten
		this.registerMarkdownPostProcessor((el, ctx) => {
			this.processCustomAdmonitionSyntax(el, ctx);
		});

		// Live Preview Support über ViewPlugin als Editor-Erweiterung
		try {
			const admonitionExtension = createAdmonitionViewPlugin(this);
			this.registerEditorExtension([admonitionExtension]);
			console.log("Live Preview-Unterstützung wurde aktiviert");
		} catch (e) {
			console.error("Live Preview-Unterstützung konnte nicht aktiviert werden:", e);
			this.addCSS_LivePreviewStyles();
		}
	}

	// Fallback zu CSS-basierter Hervorhebung
	addCSS_LivePreviewStyles() {
		const cssElem = document.createElement('style');
		cssElem.id = 'docusaurus-fallback-live-styles';
		cssElem.textContent = `
        /* Fallback CSS für Admonition-Start-Zeilen */
        .cm-line:has(.cm-string:contains(':::note')) {
            color: #448aff;
            font-weight: bold;
            background-color: rgba(68, 138, 255, 0.05);
            border-left: 4px solid #448aff;
            padding-left: 8px;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
        }

        /* Styling für Zeilen innerhalb eines Admonition-Blocks */
        .cm-line:has(.cm-string:contains(':::note')) ~ .cm-line:not(.cm-line:has(.cm-string:contains(':::'))) {
            background-color: rgba(68, 138, 255, 0.05);
            border-left: 4px solid #448aff;
            padding-left: 8px;
        }

        /* Ende-Zeile stylen */
        .cm-line:has(.cm-string:contains(':::note')) ~ .cm-line:has(.cm-string:contains(':::'):not(:contains(':::note'))) {
            color: #448aff;
            background-color: rgba(68, 138, 255, 0.05);
            border-left: 4px solid #448aff;
            padding-left: 8px;
            border-bottom-left-radius: 4px;
            border-bottom-right-radius: 4px;
        }

        /* Gleiche Stile für die anderen Admonition-Typen... */
    `;
		document.head.appendChild(cssElem);
		console.log("Fallback CSS-Styles für Live Preview wurden hinzugefügt");
	}

	// Renderer-Funktion für Live Preview korrigieren
	createAdmonitionRenderer(view) {
		try {
			// Admonition-Typen
			const types = ['note', 'tip', 'info', 'warning', 'danger'];
			const decorations = [];

			// Dokumententext analysieren
			const viewport = view.viewport || { from: 0, to: view.state.doc.length };

			// Zeilen im sichtbaren Bereich durchgehen
			let pos = viewport.from;
			while (pos <= viewport.to) {
				// Aktuelle Zeile
				const line = view.state.doc.lineAt(pos);
				const text = line.text;

				// Prüfen auf Admonition-Start
				for (const type of types) {
					const admonitionStart = new RegExp(`^:::${type}(?:\\s|$)`);
					if (admonitionStart.test(text)) {
						// Dekoration erstellen
						const decoration = Decoration.line({
							attributes: { class: `admonition-${type}-start` }
						});
						decorations.push(decoration.range(line.from));
						break;
					}
				}

				// Prüfen auf Admonition-Ende
				if (text.trim() === ":::") {
					const decoration = Decoration.line({
						attributes: { class: "admonition-end" }
					});
					decorations.push(decoration.range(line.from));
				}

				// Zur nächsten Zeile
				pos = line.to + 1;
			}

			// Dekorationen als DecorationSet zurückgeben
			return Decoration.set(decorations, true);

		} catch (error) {
			console.error("Fehler beim Erstellen der Admonition-Dekorationen:", error);
			return Decoration.none; // Leeres Decoration-Set bei Fehler
		}
	}

	onunload() {
		// CSS entfernen
		['docusaurus-admonitions-styles', 'docusaurus-admonitions-editor-styles',
			'docusaurus-admonitions-live-styles', 'docusaurus-fallback-live-styles'].forEach(id => {
				const elem = document.getElementById(id);
				if (elem) elem.remove();
			});

		// Debug-Button entfernen
		const debugBtn = document.querySelector('button[style*="position: fixed"]');
		if (debugBtn) debugBtn.remove();

		console.log('Docusaurus Admonitions Plugin wurde deaktiviert');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Debugging-Funktion für die Dokumentenstruktur
	testDocumentStructure() {
		// Temporärer Button in der Obsidian-UI hinzufügen
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
					console.log("Paragraphen im Dokument:");
					const paragraphs = previewEl.querySelectorAll('p');
					paragraphs.forEach((p, i) => {
						console.log(`P[${i}]: "${p.textContent}"`);
					});
				}
			}
		});

		document.body.appendChild(debugBtn);
	}
}


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

		// Admonition-Typen aktivieren/deaktivieren
		new Setting(containerEl)
			.setName('Note Admonition')
			.setDesc('Aktiviert die :::note Admonition')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabledAdmonitions.note)
				.onChange(async (value) => {
					this.plugin.settings.enabledAdmonitions.note = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Tip Admonition')
			.setDesc('Aktiviert die :::tip Admonition')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabledAdmonitions.tip)
				.onChange(async (value) => {
					this.plugin.settings.enabledAdmonitions.tip = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Info Admonition')
			.setDesc('Aktiviert die :::info Admonition')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabledAdmonitions.info)
				.onChange(async (value) => {
					this.plugin.settings.enabledAdmonitions.info = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Warning Admonition')
			.setDesc('Aktiviert die :::warning Admonition')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabledAdmonitions.warning)
				.onChange(async (value) => {
					this.plugin.settings.enabledAdmonitions.warning = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Danger Admonition')
			.setDesc('Aktiviert die :::danger Admonition')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabledAdmonitions.danger)
				.onChange(async (value) => {
					this.plugin.settings.enabledAdmonitions.danger = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Eigenes CSS')
			.setDesc('Verwendet angepasstes CSS für Admonitions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.customCSS)
				.onChange(async (value) => {
					this.plugin.settings.customCSS = value;
					await this.plugin.saveSettings();
					// CSS neu laden
					const oldStyle = document.getElementById('docusaurus-admonitions-styles');
					if (oldStyle) oldStyle.remove();
					if (value) {
						document.head.appendChild(this.plugin.createAdmonitionStyles());
					}
				}));
	}
}

function createAdmonitionViewPlugin(plugin: DocusaurusAdmonitionsPlugin) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = computeAdmonitionDecorations(view);
			}
			update(update: any) {
				// Bei Änderungen Decorate neu berechnen
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

function computeAdmonitionDecorations(view: EditorView): DecorationSet {
	const types = ['note', 'tip', 'info', 'warning', 'danger'];
	const decorations: Range<Decoration>[] = [];

	const doc = view.state.doc;
	const viewport = view.viewport || { from: 0, to: doc.length };

	// Admonition-Block-Tracking
	let currentType = null;
	let blockStart = -1;

	let pos = viewport.from;
	while (pos <= viewport.to) {
		const line = doc.lineAt(pos);
		const text = line.text;

		// Prüfe auf Admonition-Start
		let foundStart = false;
		if (!currentType) {
			for (const type of types) {
				const startRegex = new RegExp(`^:::${type}(?:\\s|$)`);
				if (startRegex.test(text)) {
					currentType = type;
					blockStart = line.from;
					foundStart = true;

					// Spezielle Klasse für die Start-Zeile
					decorations.push(
						Decoration.line({
							attributes: {
								class: `docusaurus-admonition-live admonition-${type}-start`
							}
						}).range(line.from)
					);
					break;
				}
			}
		}

		// Innerhalb eines Admonition-Blocks
		if (currentType && !foundStart && text.trim() !== ":::") {
			// Inhalt-Zeilen mit dem gleichen Stil wie der Typ
			decorations.push(
				Decoration.line({
					attributes: {
						class: `docusaurus-admonition-live admonition-${currentType}-content`
					}
				}).range(line.from)
			);
		}

		// Prüfe auf Admonition-Ende
		if (currentType && text.trim() === ":::") {
		// Ende-Zeile mit dem gleichen Stil wie der Typ
			decorations.push(
				Decoration.line({
					attributes: {
						class: `docusaurus-admonition-live admonition-${currentType}-end`
					}
				}).range(line.from)
			);

			// Block-Tracking zurücksetzen
			currentType = null;
			blockStart = -1;
		}

		pos = line.to + 1;
	}

	return Decoration.set(decorations, true);
}

