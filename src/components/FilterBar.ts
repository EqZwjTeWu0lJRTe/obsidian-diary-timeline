import { Component, TextComponent, ButtonComponent, Setting } from 'obsidian';

export interface FilterBarOptions {
	placeholder?: string;
	onFilter: (regex: RegExp | null) => void;
	onClear: () => void;
}

export class FilterBar extends Component {
	private containerEl: HTMLDivElement;
	private input: TextComponent;
	private clearButton: ButtonComponent;
	private matchCountEl: HTMLSpanElement;
	private currentRegex: RegExp | null = null;
	private options: FilterBarOptions;

	constructor(options: FilterBarOptions) {
		super();
		this.options = options;
	}

	onload() {
		this.containerEl = createDiv({ cls: 'dt-filter-bar' });

		const inputContainer = this.containerEl.createDiv({ cls: 'dt-filter-input-container' });

		const iconEl = inputContainer.createSpan({ cls: 'dt-filter-icon' });
		iconEl.textContent = '🔍';

		this.input = new TextComponent(inputContainer);
		this.input.setPlaceholder(this.options.placeholder || '输入正则筛选...');
		this.input.inputEl.addClass('dt-filter-input');
		this.input.onChange((value) => {
			this.handleInputChange(value);
		});

		this.clearButton = new ButtonComponent(inputContainer);
		this.clearButton.setIcon('x');
		this.clearButton.addClass('dt-filter-clear');
		this.clearButton.onClick(() => {
			this.clear();
		});

		this.matchCountEl = this.containerEl.createSpan({ cls: 'dt-filter-count' });
		this.updateMatchCount(0, 0);
	}

	getEl(): HTMLDivElement {
		return this.containerEl;
	}

	private handleInputChange(value: string) {
		if (!value.trim()) {
			this.currentRegex = null;
			this.options.onClear();
			this.updateMatchCount(0, 0);
			return;
		}

		try {
			this.currentRegex = new RegExp(value, 'gi');
			this.options.onFilter(this.currentRegex);
		} catch (e) {
			this.currentRegex = null;
			this.options.onClear();
			this.updateMatchCount(0, 0);
		}
	}

	clear() {
		this.input.setValue('');
		this.currentRegex = null;
		this.options.onClear();
		this.updateMatchCount(0, 0);
	}

	updateMatchCount(matched: number, total: number) {
		if (this.matchCountEl) {
			if (this.currentRegex && matched > 0) {
				this.matchCountEl.textContent = `匹配 ${matched}/${total}`;
				this.matchCountEl.removeClass('dt-hidden');
			} else if (this.currentRegex) {
				this.matchCountEl.textContent = `匹配 0/${total}`;
				this.matchCountEl.removeClass('dt-hidden');
			} else {
				this.matchCountEl.addClass('dt-hidden');
			}
		}
	}

	focus() {
		this.input.inputEl.focus();
	}
}