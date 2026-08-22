import { ItemView, WorkspaceLeaf, App, TextComponent, ButtonComponent, Setting } from 'obsidian';
import DiaryTimelinePlugin from '../main';
import { DiaryDay, DiaryEntry, loadDiaryDays, loadAllDiaryDays, addDiaryEntry, filterEntries } from '../utils/diary';
import { FilterBar } from '../components/FilterBar';
import { DiaryEntryComponent } from '../components/DiaryEntry';

export const VIEW_TYPE_DIARY_TIMELINE = 'diary-timeline-view';

export class DiaryTimelineView extends ItemView {
	plugin: DiaryTimelinePlugin;
	private contentEl: HTMLDivElement;
	private timelineEl: HTMLDivElement;
	private inputEl: TextComponent;
	private filterBar: FilterBar;
	private days: DiaryDay[] = [];
	private filteredDays: DiaryDay[] = [];
	private isLoading = false;
	private loadAllMode = false;

	constructor(leaf: WorkspaceLeaf, plugin: DiaryTimelinePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DIARY_TIMELINE;
	}

	getDisplayText(): string {
		return '日志时间线';
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('dt-view-container');

		this.contentEl = container.createDiv({ cls: 'dt-content' });

		this.createHeader();
		this.createFilterBar();
		this.createTimeline();
		this.createInputArea();

		await this.loadData();
	}

	private createHeader() {
		const headerEl = this.contentEl.createDiv({ cls: 'dt-header' });

		const titleEl = headerEl.createDiv({ cls: 'dt-header-title' });
		titleEl.createSpan({ text: '📅' });
		titleEl.createSpan({ text: '日志时间线' });

		const buttonGroup = headerEl.createDiv({ cls: 'dt-header-buttons' });

		const todayButton = new ButtonComponent(buttonGroup);
		todayButton.setButtonText('回到今天');
		todayButton.addClass('dt-button');
		todayButton.onClick(() => this.scrollToToday());

		const refreshButton = new ButtonComponent(buttonGroup);
		refreshButton.setIcon('refresh-cw');
		refreshButton.addClass('dt-button');
		refreshButton.onClick(() => this.loadData());

		const modeButton = new ButtonComponent(buttonGroup);
		modeButton.setButtonText(this.loadAllMode ? '最近30天' : '全部');
		modeButton.addClass('dt-button');
		modeButton.onClick(async () => {
			this.loadAllMode = !this.loadAllMode;
			modeButton.setButtonText(this.loadAllMode ? '最近30天' : '全部');
			await this.loadData();
		});
	}

	private createFilterBar() {
		this.filterBar = new FilterBar({
			placeholder: '输入正则筛选...',
			onFilter: (regex) => this.handleFilter(regex),
			onClear: () => this.handleFilterClear()
		});

		this.contentEl.appendChild(this.filterBar.getEl());
	}

	private createTimeline() {
		this.timelineEl = this.contentEl.createDiv({ cls: 'dt-timeline' });

		const loadingEl = this.timelineEl.createDiv({ cls: 'dt-loading' });
		loadingEl.textContent = '加载中...';
	}

	private createInputArea() {
		const inputContainer = this.contentEl.createDiv({ cls: 'dt-input-container' });

		const addButton = new ButtonComponent(inputContainer);
		addButton.setButtonText('➕');
		addButton.addClass('dt-add-button');

		this.inputEl = new TextComponent(inputContainer);
		this.inputEl.setPlaceholder('添加新日志...');
		this.inputEl.inputEl.addClass('dt-main-input');

		this.inputEl.inputEl.addEventListener('keydown', async (e) => {
			if (e.key === 'Enter' && !e.isComposing) {
				const content = this.inputEl.getValue().trim();
				if (content) {
					await this.addEntry(content);
					this.inputEl.setValue('');
				}
			}
		});

		addButton.onClick(async () => {
			const content = this.inputEl.getValue().trim();
			if (content) {
				await this.addEntry(content);
				this.inputEl.setValue('');
			}
		});
	}

	async loadData() {
		if (this.isLoading) return;
		this.isLoading = true;

		try {
			if (this.loadAllMode) {
				this.days = await loadAllDiaryDays(this.app, this.plugin.settings.diaryFolder);
			} else {
				this.days = await loadDiaryDays(
					this.app,
					this.plugin.settings.diaryFolder,
					this.plugin.settings.daysToLoad
				);
			}
			this.filteredDays = [...this.days];
			this.renderTimeline();
		} catch (error) {
			console.error('加载日志失败:', error);
		} finally {
			this.isLoading = false;
		}
	}

	private renderTimeline() {
		this.timelineEl.empty();

		if (this.filteredDays.length === 0) {
			const emptyEl = this.timelineEl.createDiv({ cls: 'dt-empty' });
			emptyEl.textContent = '暂无日志';
			return;
		}

		let totalEntries = 0;
		for (const day of this.days) {
			totalEntries += day.entries.length;
		}

		for (const day of this.filteredDays) {
			const dayEl = this.timelineEl.createDiv({ cls: 'dt-day' });

			const dateHeaderEl = dayEl.createDiv({ cls: 'dt-date-header' });
			dateHeaderEl.textContent = day.dateDisplay;

			const entriesEl = dayEl.createDiv({ cls: 'dt-entries' });

			if (day.entries.length === 0) {
				const noEntryEl = entriesEl.createDiv({ cls: 'dt-no-entries' });
				noEntryEl.textContent = '无日志条目';
			} else {
				for (const entry of day.entries) {
					const entryComponent = new DiaryEntryComponent({
						entry: entry,
						highlightRegex: this.filterBar.currentRegex,
						onEdit: () => this.loadData(),
						onDelete: () => this.loadData()
					});

					entriesEl.appendChild(entryComponent.getEl());
					entryComponent.load();
				}
			}
		}

		if (this.filterBar.currentRegex) {
			this.filterBar.updateMatchCount(
				this.filteredDays.reduce((sum, day) => sum + day.entries.length, 0),
				totalEntries
			);
		}
	}

	private async handleFilter(regex: RegExp | null) {
		if (regex) {
			this.filteredDays = filterEntries(this.days, regex);
		} else {
			this.filteredDays = [...this.days];
		}
		this.renderTimeline();
	}

	private async handleFilterClear() {
		this.filteredDays = [...this.days];
		this.renderTimeline();
	}

	private async addEntry(content: string) {
		await addDiaryEntry(this.app, this.plugin.settings.diaryFolder, content);
		await this.loadData();
	}

	scrollToToday() {
		const today = new Date().toISOString().split('T')[0];
		const todayEl = this.timelineEl.querySelector(`[data-date="${today}"]`);
		if (todayEl) {
			todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			this.timelineEl.scrollTop = 0;
		}
	}

	focusInput() {
		this.inputEl?.inputEl?.focus();
	}

	async onClose() {
		// 清理资源
	}
}