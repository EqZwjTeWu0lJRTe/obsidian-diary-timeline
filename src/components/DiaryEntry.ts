import { Component, Menu } from 'obsidian';
import { DiaryEntry, editDiaryEntry, deleteDiaryEntry } from '../utils/diary';

export interface DiaryEntryOptions {
	entry: DiaryEntry;
	highlightRegex?: RegExp | null;
	onEdit: (entry: DiaryEntry) => void;
	onDelete: (entry: DiaryEntry) => void;
}

export class DiaryEntryComponent extends Component {
	private containerEl: HTMLDivElement;
	private options: DiaryEntryOptions;
	private isEditing = false;

	constructor(options: DiaryEntryOptions) {
		super();
		this.options = options;
	}

	onload() {
		this.containerEl = createDiv({ cls: 'dt-entry' });

		const timeEl = this.containerEl.createSpan({ cls: 'dt-entry-time' });
		timeEl.textContent = this.options.entry.time;

		const contentEl = this.containerEl.createSpan({ cls: 'dt-entry-content' });
		contentEl.textContent = this.options.entry.content;

		if (this.options.highlightRegex) {
			this.highlightContent(contentEl, this.options.entry.content, this.options.highlightRegex);
		}

		this.containerEl.addEventListener('dblclick', (e) => {
			e.preventDefault();
			this.startEditing();
		});

		this.containerEl.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showContextMenu(e);
		});

		this.containerEl.addEventListener('mouseenter', () => {
			this.showDeleteButton();
		});

		this.containerEl.addEventListener('mouseleave', () => {
			this.hideDeleteButton();
		});
	}

	private highlightContent(el: HTMLSpanElement, text: string, regex: RegExp) {
		el.empty();
		const parts = text.split(regex);
		const matches = text.match(regex) || [];

		for (let i = 0; i < parts.length; i++) {
			el.createSpan({ text: parts[i] });
			if (i < matches.length) {
				const highlightEl = el.createSpan({ cls: 'dt-highlight' });
				highlightEl.textContent = matches[i];
			}
		}
	}

	private startEditing() {
		if (this.isEditing) return;
		this.isEditing = true;

		const contentEl = this.containerEl.querySelector('.dt-entry-content') as HTMLSpanElement;
		if (!contentEl) return;

		const originalText = this.options.entry.content;
		contentEl.empty();

		const input = createEl('input', {
			cls: 'dt-entry-edit-input',
			value: originalText
		});

		contentEl.appendChild(input);
		input.focus();
		input.select();

		const saveEdit = async () => {
			const newContent = input.value.trim();
			if (newContent && newContent !== originalText) {
				await editDiaryEntry(
					this.options.entry.app,
					this.options.entry.filePath,
					this.options.entry.lineNumber,
					newContent
				);
				this.options.entry.content = newContent;
			}
			this.isEditing = false;
			contentEl.empty();
			contentEl.textContent = this.options.entry.content;

			if (this.options.highlightRegex) {
				this.highlightContent(contentEl, this.options.entry.content, this.options.highlightRegex);
			}
		};

		input.addEventListener('blur', saveEdit);
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				saveEdit();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				this.isEditing = false;
				contentEl.empty();
				contentEl.textContent = originalText;

				if (this.options.highlightRegex) {
					this.highlightContent(contentEl, originalText, this.options.highlightRegex);
				}
			}
		});
	}

	private showContextMenu(e: MouseEvent) {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('编辑')
				.setIcon('pencil')
				.onClick(() => this.startEditing());
		});
		menu.addItem((item) => {
			item.setTitle('删除')
				.setIcon('trash')
				.onClick(() => this.handleDelete());
		});
		menu.showAtMouseEvent(e);
	}

	private showDeleteButton() {
		let deleteBtn = this.containerEl.querySelector('.dt-entry-delete') as HTMLButtonElement;
		if (!deleteBtn) {
			deleteBtn = createEl('button', { cls: 'dt-entry-delete' });
			deleteBtn.textContent = '×';
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.handleDelete();
			});
			this.containerEl.appendChild(deleteBtn);
		}
		deleteBtn.removeClass('dt-hidden');
	}

	private hideDeleteButton() {
		const deleteBtn = this.containerEl.querySelector('.dt-entry-delete') as HTMLButtonElement;
		if (deleteBtn) {
			deleteBtn.addClass('dt-hidden');
		}
	}

	private async handleDelete() {
		await deleteDiaryEntry(
			this.options.entry.app,
			this.options.entry.filePath,
			this.options.entry.lineNumber
		);
		this.options.onDelete(this.options.entry);
	}

	getEl(): HTMLDivElement {
		return this.containerEl;
	}
}