

export {}; // This is a very essential line. If you don't have any other top-level `import/export` statements, those typings will work not as expected.
declare module "obsidian" {
	interface MarkdownPostProcessorContext {
		el: HTMLElement;
		containerEl: HTMLElement;
	}
}
