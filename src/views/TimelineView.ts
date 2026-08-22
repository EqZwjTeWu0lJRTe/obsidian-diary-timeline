import { ItemView, WorkspaceLeaf, TextComponent, ButtonComponent, Setting } from 'obsidian';
import DiaryTimelinePlugin from '../main';
import { DiaryDay, loadDiaryDays, loadAllDiaryDays, addDiaryEntry, filterEntries } from '../utils/diary';
import { DiaryEntryComponent } from '../components/DiaryEntry';

export const VIEW_TYPE_DIARY_TIMELINE = 'diary-timeline-view';

export class DiaryTimelineView extends ItemView {
	plugin: DiaryTimelinePlugin;
	private mainContentEl: HTMLDivElement;
	private timelineEl: HTMLDivElement;
	private inputEl: TextComponent;
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

		this.mainContentEl = container.createDiv({ cls: 'dt-content' });

		this.createHeader();
		this.createTimeline();
		this.createInputArea();

		await this.loadData();
	}

	private createHeader() {
		const headerEl = this.mainContentEl.createDiv({ cls: 'dt-header' });

		const titleEl = headerEl.createDiv({ cls: 'dt-header-title' });
		titleEl.createSpan({ text: '📅' });
		titleEl.createSpan({ text: '日志时间线' });

		const buttonGroup = headerEl.createDiv({ cls: 'dt-header-buttons' });

		const todayButton = new ButtonComponent(buttonGroup);
		todayButton.setButtonText('回到今天');
		todayButton.buttonEl.addClass('dt-button');
		todayButton.onClick(() => this.scrollToToday());

		const refreshButton = new ButtonComponent(buttonGroup);
		refreshButton.setIcon('refresh-cw');
		refreshButton.buttonEl.addClass('dt-button');
		refreshButton.onClick(() => this.loadData());

		const modeButton = new ButtonComponent(buttonGroup);
		modeButton.setButtonText(this.loadAllMode ? '最近30天' : '全部');
		modeButton.buttonEl.addClass('dt-button');
		modeButton.onClick(async () => {
			this.loadAllMode = !this.loadAllMode;
			modeButton.setButtonText(this.loadAllMode ? '最近30天' : '全部');
			await this.loadData();
		});
	}

	private createTimeline() {
		this.timelineEl = this.mainContentEl.createDiv({ cls: 'dt-timeline' });
	}

	private createInputArea() {
		const inputContainer = this.mainContentEl.createDiv({ cls: 'dt-input-container' });

		const addButton = new ButtonComponent(inputContainer);
		addButton.setButtonText('➕');
		addButton.buttonEl.addClass('dt-add-button');

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

			// 应用筛选
			const filterRegex = this.plugin.settings.filterRegex;
			if (filterRegex) {
				try {
					const regex = new RegExp(filterRegex, 'gi');
					this.filteredDays = filterEntries(this.days, regex);
				} catch (e) {
					this.filteredDays = [...this.days];
				}
			} else {
				this.filteredDays = [...this.days];
			}

			this.renderTimeline();
		} catch (error) {
			console.error('加载日志失败:', error);
		} finally {
			this.isLoading = false;
		}
	}

	private renderTimeline() {
		if (!this.timelineEl) return;
		
		this.timelineEl.empty();

		if (this.filteredDays.length === 0) {
			const emptyEl = this.timelineEl.createDiv({ cls: 'dt-empty' });
			emptyEl.textContent = '暂无日志';
			return;
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
						highlightRegex: this.plugin.settings.filterRegex 
							? new RegExp(this.plugin.settings.filterRegex, 'gi') 
							: null,
						onEdit: () => this.loadData(),
						onDelete: () => this.loadData()
					});

					entriesEl.appendChild(entryComponent.getEl());
					entryComponent.load();
				}
			}
		}
	}

	private async addEntry(content: string) {
		await addDiaryEntry(this.app, this.plugin.settings.diaryFolder, content);
		await this.loadData();
	}

	scrollToToday() {
		if (!this.timelineEl) return;
		
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