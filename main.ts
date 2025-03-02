import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownPostProcessorContext,
	MarkdownRenderer
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

		// 3. Code-Block-Processor für Reading Mode
		this.registerMarkdownCodeBlockProcessor('note', this.processAdmonition.bind(this, 'note'));
		this.registerMarkdownCodeBlockProcessor('tip', this.processAdmonition.bind(this, 'tip'));
		this.registerMarkdownCodeBlockProcessor('info', this.processAdmonition.bind(this, 'info'));
		this.registerMarkdownCodeBlockProcessor('warning', this.processAdmonition.bind(this, 'warning'));
		this.registerMarkdownCodeBlockProcessor('danger', this.processAdmonition.bind(this, 'danger'));

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
		// A) Reading Mode (fertige Admonitions)
		const readingModeStyle = document.createElement('style');
		readingModeStyle.id = 'docusaurus-admonitions-styles';
		readingModeStyle.textContent = `
    .docusaurus-admonition {
        margin-bottom: 1em;
        padding: 16px;
        border-radius: 8px;
        border-left: 0;
        background-color: var(--background-secondary);
        position: relative;
        overflow: hidden;
    }

    /* Farbige Seitenleiste für jeden Typ */
    .docusaurus-admonition::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
    }

    .docusaurus-admonition-note::before { background-color: #3578e5; }
    .docusaurus-admonition-tip::before { background-color: #00a400; }
    .docusaurus-admonition-info::before { background-color: #3578e5; }
    .docusaurus-admonition-warning::before { background-color: #e6a700; }
    .docusaurus-admonition-danger::before { background-color: #fa383e; }

    /* Titel mit Icons und Farben */
    .docusaurus-admonition-title {
        margin-top: 0 !important;
        margin-bottom: 14px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        font-size: 0.8em !important;
        line-height: 1.5 !important;
        display: flex !important;
        align-items: center !important;
    }

    /* Icons für jeden Admonition-Typ */
    .docusaurus-admonition-title::before {
        content: '' !important;
        margin-right: 8px !important;
        width: 20px !important;
        height: 20px !important;
        min-width: 20px !important;
        display: inline-block !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
        background-size: contain !important;
    }

    /* Icon für NOTE (Info Circle) */
    .docusaurus-admonition-note .docusaurus-admonition-title {
        color: #3578e5;
    }
    .docusaurus-admonition-note .docusaurus-admonition-title::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 512 512'%3E%3Cpath fill='%233578e5' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 128c17.67 0 32 14.33 32 32c0 17.67-14.33 32-32 32S224 177.7 224 160C224 142.3 238.3 128 256 128zM296 384h-80C202.8 384 192 373.3 192 360s10.75-24 24-24h16v-64H224c-13.25 0-24-10.75-24-24S210.8 224 224 224h32c13.25 0 24 10.75 24 24v88h16c13.25 0 24 10.75 24 24S309.3 384 296 384z'%3E%3C/path%3E%3C/svg%3E");
    }

    /* Icon für TIP (Lightbulb) */
    .docusaurus-admonition-tip .docusaurus-admonition-title {
        color: #00a400;
    }
    .docusaurus-admonition-tip .docusaurus-admonition-title::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 384 512'%3E%3Cpath fill='%2300a400' d='M112.1 454.3c0 6.297 1.816 12.44 5.284 17.69l17.14 25.69c5.25 7.875 17.17 14.28 26.64 14.28h61.67c9.438 0 21.36-6.401 26.61-14.28l17.08-25.68c2.938-4.438 5.348-12.37 5.348-17.7L272 415.1h-160L112.1 454.3zM191.4 .0132C89.44 .3257 16 82.97 16 175.1c0 44.38 16.44 84.84 43.56 115.8c16.53 18.84 42.34 58.23 52.22 91.45c.0313 .25 .0938 .5166 .125 .7823h160.2c.0313-.2656 .0938-.5166 .125-.7823c9.875-33.22 35.69-72.61 52.22-91.45C351.6 260.8 368 220.4 368 175.1C368 78.61 288.9 .0132 191.4 .0132zM192 96.01c-44.13 0-80 35.89-80 79.1C112 184.8 104.8 192 96 192S80 184.8 80 176c0-61.76 50.25-111.1 112-111.1c8.844 0 16 7.159 16 16S200.8 96.01 192 96.01z'/%3E%3C/svg%3E");
		}

		/* Icon für INFO (Info Circle) - gleich wie NOTE */
		.docusaurus-admonition-info .docusaurus-admonition-title {
			color: #3578e5;
			}
			.docusaurus-admonition-info .docusaurus-admonition-title::before {
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 512 512'%3E%3Cpath fill='%233578e5' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 128c17.67 0 32 14.33 32 32c0 17.67-14.33 32-32 32S224 177.7 224 160C224 142.3 238.3 128 256 128zM296 384h-80C202.8 384 192 373.3 192 360s10.75-24 24-24h16v-64H224c-13.25 0-24-10.75-24-24S210.8 224 224 224h32c13.25 0 24 10.75 24 24v88h16c13.25 0 24 10.75 24 24S309.3 384 296 384z'%3E%3C/path%3E%3C/svg%3E");    }

    /* Icon für WARNING (Exclamation Triangle) */
    .docusaurus-admonition-warning .docusaurus-admonition-title {
        color: #e6a700;
    }
    .docusaurus-admonition-warning .docusaurus-admonition-title::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23e6a700' d='M506.3 417l-213.3-364c-16.33-28-57.54-28-73.98 0l-213.2 364C-10.59 444.9 9.849 480 42.74 480h426.6C502.1 480 522.6 445 506.3 417zM232 168c0-13.25 10.75-24 24-24S280 154.8 280 168v128c0 13.25-10.75 24-24 24S232 309.3 232 296V168zM256 416c-17.36 0-31.44-14.08-31.44-31.44c0-17.36 14.07-31.44 31.44-31.44s31.44 14.08 31.44 31.44C287.4 401.9 273.4 416 256 416z'/%3E%3C/svg%3E");
    }

    /* Icon für DANGER (Exclamation Circle) */
    .docusaurus-admonition-danger .docusaurus-admonition-title {
        color: #fa383e;
    }
    .docusaurus-admonition-danger .docusaurus-admonition-title::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23fa383e' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM232 152C232 138.8 242.8 128 256 128s24 10.75 24 24v128c0 13.25-10.75 24-24 24S232 293.3 232 280V152zM256 400c-17.36 0-31.44-14.08-31.44-31.44c0-17.36 14.07-31.44 31.44-31.44s31.44 14.08 31.44 31.44C287.4 385.9 273.4 400 256 400z'/%3E%3C/svg%3E");
    }

    /* Inhalt-Styling */
    .docusaurus-admonition-content p:last-child {
        margin-bottom: 0;
    }
`;
		document.head.appendChild(readingModeStyle);

		// B) Live Preview / Edit Mode
		const livePreviewStyle = document.createElement('style');
		livePreviewStyle.id = 'docusaurus-admonitions-editor-styles';
		livePreviewStyle.textContent = `
    /* =============== Allgemeine Styles für Admonition-Zeilen =============== */
    .admonition-note-start, .admonition-note-end, .admonition-note-content,
    .admonition-tip-start, .admonition-tip-end, .admonition-tip-content,
    .admonition-info-start, .admonition-info-end, .admonition-info-content,
    .admonition-warning-start, .admonition-warning-end, .admonition-warning-content,
    .admonition-danger-start, .admonition-danger-end, .admonition-danger-content {
        padding-left: 12px;
        position: relative;
    }

    /* =============== Linien an der Seite für jeden Typ =============== */
    .admonition-note-start::before, .admonition-note-end::before, .admonition-note-content::before,
    .admonition-tip-start::before, .admonition-tip-end::before, .admonition-tip-content::before,
    .admonition-info-start::before, .admonition-info-end::before, .admonition-info-content::before,
    .admonition-warning-start::before, .admonition-warning-end::before, .admonition-warning-content::before,
    .admonition-danger-start::before, .admonition-danger-end::before, .admonition-danger-content::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: 4px;
    }

    /* Note Style mit Icon */
    .admonition-note-start, .admonition-note-end, .admonition-note-content {
        background-color: rgba(53, 120, 229, 0.05);
    }
    .admonition-note-start::before, .admonition-note-end::before, .admonition-note-content::before {
        background-color: #3578e5;
    }
	.admonition-note-start {
		font-weight: bold;
		color: #3578e5 !important;
		padding-left: 32px !important; /* Mehr Platz für das Icon */
		position: relative; /* Notwendig für die absolute Positionierung */
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='16' height='16'%3E%3Cpath fill='%233578e5' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 128c17.67 0 32 14.33 32 32c0 17.67-14.33 32-32 32S224 177.7 224 160C224 142.3 238.3 128 256 128zM296 384h-80C202.8 384 192 373.3 192 360s10.75-24 24-24h16v-64H224c-13.25 0-24-10.75-24-24S210.8 224 224 224h32c13.25 0 24 10.75 24 24v88h16c13.25 0 24 10.75 24 24S309.3 384 296 384z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: 8px center;
		background-size: 16px;
	}

	/* Entferne das alte ::after */
	.admonition-note-start::after {
		content: none;
	}

    /* Tip Style mit Icon */
    .admonition-tip-start, .admonition-tip-end, .admonition-tip-content {
        background-color: rgba(0, 164, 0, 0.05);
    }
    .admonition-tip-start::before, .admonition-tip-end::before, .admonition-tip-content::before {
        background-color: #00a400;
    }
	.admonition-tip-start {
		font-weight: bold;
		color: #00a400 !important;
		padding-left: 32px !important; /* Mehr Platz für das Icon */
		position: relative; /* Notwendig für die absolute Positionierung */
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 384 512' width='16' height='16'%3E%3Cpath fill='%2300a400' d='M112.1 454.3c0 6.297 1.816 12.44 5.284 17.69l17.14 25.69c5.25 7.875 17.17 14.28 26.64 14.28h61.67c9.438 0 21.36-6.401 26.61-14.28l17.08-25.68c2.938-4.438 5.348-12.37 5.348-17.7L272 415.1h-160L112.1 454.3zM191.4 .0132C89.44 .3257 16 82.97 16 175.1c0 44.38 16.44 84.84 43.56 115.8c16.53 18.84 42.34 58.23 52.22 91.45c.0313 .25 .0938 .5166 .125 .7823h160.2c.0313-.2656 .0938-.5166 .125-.7823c9.875-33.22 35.69-72.61 52.22-91.45C351.6 260.8 368 220.4 368 175.1C368 78.61 288.9 .0132 191.4 .0132zM192 96.01c-44.13 0-80 35.89-80 79.1C112 184.8 104.8 192 96 192S80 184.8 80 176c0-61.76 50.25-111.1 112-111.1c8.844 0 16 7.159 16 16S200.8 96.01 192 96.01z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: 8px center;
		background-size: 16px;
	}

	/* Entferne das alte ::after */
	.admonition-tip-start::after {
		content: none;
	}

    /* Info Style mit Icon */
    .admonition-info-start, .admonition-info-end, .admonition-info-content {
        background-color: rgba(53, 120, 229, 0.05);
    }
    .admonition-info-start::before, .admonition-info-end::before, .admonition-info-content::before {
        background-color: #3578e5;
    }
	.admonition-info-start {
		font-weight: bold;
		color: #3578e5 !important;
		padding-left: 32px !important; /* Mehr Platz für das Icon */
		position: relative; /* Notwendig für die absolute Positionierung */
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='16' height='16'%3E%3Cpath fill='%233578e5' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM256 128c17.67 0 32 14.33 32 32c0 17.67-14.33 32-32 32S224 177.7 224 160C224 142.3 238.3 128 256 128zM296 384h-80C202.8 384 192 373.3 192 360s10.75-24 24-24h16v-64H224c-13.25 0-24-10.75-24-24S210.8 224 224 224h32c13.25 0 24 10.75 24 24v88h16c13.25 0 24 10.75 24 24S309.3 384 296 384z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: 8px center;
		background-size: 16px;
	}

	/* Entferne das alte ::after */
	.admonition-info-start::after {
		content: none;
	}

    /* Warning Style mit Icon */
    .admonition-warning-start, .admonition-warning-end, .admonition-warning-content {
        background-color: rgba(230, 167, 0, 0.05);
    }
    .admonition-warning-start::before, .admonition-warning-end::before, .admonition-warning-content::before {
        background-color: #e6a700;
    }
	.admonition-warning-start {
		font-weight: bold;
		color: #e6a700 !important;
		padding-left: 32px !important; /* Mehr Platz für das Icon */
		position: relative; /* Notwendig für die absolute Positionierung */
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='16' height='16'%3E%3Cpath fill='%23e6a700' d='M506.3 417l-213.3-364c-16.33-28-57.54-28-73.98 0l-213.2 364C-10.59 444.9 9.849 480 42.74 480h426.6C502.1 480 522.6 445 506.3 417zM232 168c0-13.25 10.75-24 24-24S280 154.8 280 168v128c0 13.25-10.75 24-24 24S232 309.3 232 296V168zM256 416c-17.36 0-31.44-14.08-31.44-31.44c0-17.36 14.07-31.44 31.44-31.44s31.44 14.08 31.44 31.44C287.4 401.9 273.4 416 256 416z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: 8px center;
		background-size: 16px;
	}

	/* Entferne das alte ::after */
	.admonition-warning-start::after {
		content: none;
	}

    /* Danger Style mit Icon */
    .admonition-danger-start, .admonition-danger-end, .admonition-danger-content {
        background-color: rgba(250, 56, 62, 0.05);
    }
    .admonition-danger-start::before, .admonition-danger-end::before, .admonition-danger-content::before {
        background-color: #fa383e;
    }
	.admonition-danger-start {
		font-weight: bold;
		color: #fa383e !important;
		padding-left: 32px !important; /* Mehr Platz für das Icon */
		position: relative; /* Notwendig für die absolute Positionierung */
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='16' height='16'%3E%3Cpath fill='%23fa383e' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM232 152C232 138.8 242.8 128 256 128s24 10.75 24 24v128c0 13.25-10.75 24-24 24S232 293.3 232 280V152zM256 400c-17.36 0-31.44-14.08-31.44-31.44c0-17.36 14.07-31.44 31.44-31.44s31.44 14.08 31.44 31.44C287.4 385.9 273.4 400 256 400z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: 8px center;
		background-size: 16px;
	}

	/* Entferne das alte ::after */
	.admonition-danger-start::after {
		content: none;
	}`;
		document.head.appendChild(livePreviewStyle);

		console.log("Docusaurus Admonitions: Styles injected.");
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
		const fallbackStyles = document.createElement('style');
		fallbackStyles.id = 'docusaurus-admonitions-fallback-styles';
		fallbackStyles.textContent = `
			/* Minimaler Fallback: Hebt nur Zeilen mit :::note etc. farbig hervor. */
			.cm-line:has(.cm-string:contains(':::note')) {
				color: #448aff;
				border-left: 3px solid #448aff;
				font-weight: bold;
			}
			/* Weitere Admonition-Typen analog... */
		`;
		document.head.appendChild(fallbackStyles);
		console.log("Docusaurus Admonitions: Fallback-CSS hinzugefügt.");
	}

	/** Beim Deaktivieren: CSS & Debug-Elemente entfernen. */
	onunload() {
		const styleIds = [
			'docusaurus-admonitions-styles',
			'docusaurus-admonitions-editor-styles',
			'docusaurus-admonitions-fallback-styles'
		];
		styleIds.forEach(id => {
			const el = document.getElementById(id);
			if (el) el.remove();
		});
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
