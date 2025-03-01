import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownPostProcessor, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer } from 'obsidian';

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

		this.registerLivePreviewRenderer();

		// Markdown-Postprocessor für Admonitions registrieren
		this.registerMarkdownCodeBlockProcessor('note', this.processAdmonition.bind(this, 'note'));
		this.registerMarkdownCodeBlockProcessor('tip', this.processAdmonition.bind(this, 'tip'));
		this.registerMarkdownCodeBlockProcessor('info', this.processAdmonition.bind(this, 'info'));
		this.registerMarkdownCodeBlockProcessor('warning', this.processAdmonition.bind(this, 'warning'));
		this.registerMarkdownCodeBlockProcessor('danger', this.processAdmonition.bind(this, 'danger'));

		// Custom Admonition Syntax (:::type) verarbeiten
		this.registerMarkdownPostProcessor((el, ctx) => {
			this.processCustomAdmonitionSyntax(el, ctx);
		});

		// Einstellungs-Tab hinzufügen
		this.addSettingTab(new DocusaurusAdmonitionsSettingTab(this.app, this));

		// Debugging-Funktion für die Dokumentenstruktur hinzufügen
		this.testDocumentStructure();
	}

	loadStyles() {
		// CSS-Klassen für Admonitions hinzufügen
		document.head.appendChild(this.createAdmonitionStyles());
	}

	registerLivePreviewRenderer() {
		this.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			// Verhindere doppeltes Rendern
			if (el.hasClass('docusaurus-admonition-rendered')) return;
			el.addClass('docusaurus-admonition-rendered');

			// Verarbeite Admonitions für den Live Preview Modus
			this.processCustomAdmonitionSyntax(el, ctx);
		});
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
				await MarkdownRenderer.render(this.app, content, contentDiv, ctx.sourcePath, this);

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

	onunload() {
		// CSS entfernen, wenn das Plugin deaktiviert wird
		const styleEl = document.getElementById('docusaurus-admonitions-styles');
		if (styleEl) styleEl.remove();
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
