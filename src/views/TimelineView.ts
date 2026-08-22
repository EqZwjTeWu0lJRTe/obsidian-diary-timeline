import { ItemView, WorkspaceLeaf, TextComponent, ButtonComponent, Setting } from 'obsidian';
import DiaryTimelinePlugin from '../main';
import { DiaryDay, loadDiaryDays, loadAllDiaryDays, addDiaryEntry, filterEntries } from '../utils/diary';
import { DiaryEntryComponent } from '../components/DiaryEntry';
import { log, exportLogsToFile } from '../utils/logger';

export const VIEW_TYPE_DIARY_TIMELINE = 'diary-timeline-view';

export class DiaryTimelineView extends ItemView {
	plugin: DiaryTimelinePlugin;
	private mainContentEl: HTMLDivElement | null = null;
	private timelineEl: HTMLDivElement | null = null;
	private inputEl: TextComponent | null = null;
	private days: DiaryDay[] = [];
	private filteredDays: DiaryDay[] = [];
	private isLoading = false;
	private loadAllMode = false;

	constructor(leaf: WorkspaceLeaf, plugin: DiaryTimelinePlugin) {
		super(leaf);
		this.plugin = plugin;
		log('INFO', 'DiaryTimelineView 创建');
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
		log('INFO', 'onOpen 开始');
		
		try {
			const container = this.containerEl;
			if (!container) {
				log('ERROR', 'container 不存在');
				return;
			}
			
			// 清空内容区域
			const contentEl = container.querySelector('.view-content') || container.children[1];
			if (contentEl) {
				contentEl.empty();
			}

			this.mainContentEl = container.createDiv({ cls: 'dt-content' });
			log('INFO', 'mainContentEl 创建成功');

			this.createHeader();
			log('INFO', 'header 创建成功');

			this.createTimeline();
			log('INFO', 'timeline 创建成功');

			this.createInputArea();
			log('INFO', 'inputArea 创建成功');

			await this.loadData();
			log('INFO', 'loadData 完成');
		} catch (error) {
			log('ERROR', 'onOpen 失败', error instanceof Error ? error.message : String(error));
			console.error('onOpen 错误:', error);
		}
	}

	private createHeader() {
		log('INFO', 'createHeader 开始');
		
		if (!this.mainContentEl) {
			log('ERROR', 'createHeader: mainContentEl 为空');
			return;
		}
		
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

		const exportButton = new ButtonComponent(buttonGroup);
		exportButton.setButtonText('导出日志');
		exportButton.buttonEl.addClass('dt-button');
		exportButton.onClick(async () => {
			const filepath = await exportLogsToFile(this.app, this.plugin.settings.diaryFolder);
			if (filepath) {
				log('INFO', `日志已导出到: ${filepath}`);
			}
		});

		const modeButton = new ButtonComponent(buttonGroup);
		modeButton.setButtonText(this.loadAllMode ? '最近30天' : '全部');
		modeButton.buttonEl.addClass('dt-button');
		modeButton.onClick(async () => {
			this.loadAllMode = !this.loadAllMode;
			modeButton.setButtonText(this.loadAllMode ? '最近30天' : '全部');
			await this.loadData();
		});
		
		log('INFO', 'createHeader 完成');
	}

	private createTimeline() {
		log('INFO', 'createTimeline 开始');
		
		if (!this.mainContentEl) {
			log('ERROR', 'createTimeline: mainContentEl 为空');
			return;
		}
		
		this.timelineEl = this.mainContentEl.createDiv({ cls: 'dt-timeline' });
		log('INFO', 'createTimeline 完成');
	}

	private createInputArea() {
		log('INFO', 'createInputArea 开始');
		
		if (!this.mainContentEl) {
			log('ERROR', 'createInputArea: mainContentEl 为空');
			return;
		}
		
		const inputContainer = this.mainContentEl.createDiv({ cls: 'dt-input-container' });

		const addButton = new ButtonComponent(inputContainer);
		addButton.setButtonText('➕');
		addButton.buttonEl.addClass('dt-add-button');

		this.inputEl = new TextComponent(inputContainer);
		this.inputEl.setPlaceholder('添加新日志...');
		this.inputEl.inputEl.addClass('dt-main-input');

		this.inputEl.inputEl.addEventListener('keydown', async (e) => {
			if (e.key === 'Enter' && !e.isComposing) {
				const content = this.inputEl?.getValue().trim();
				if (content) {
					await this.addEntry(content);
					this.inputEl?.setValue('');
				}
			}
		});

		addButton.onClick(async () => {
			const content = this.inputEl?.getValue().trim();
			if (content) {
				await this.addEntry(content);
				this.inputEl?.setValue('');
			}
		});
		
		log('INFO', 'createInputArea 完成');
	}

	async loadData() {
		log('INFO', 'loadData 开始');
		
		if (this.isLoading) {
			log('WARN', 'loadData: 已在加载中，跳过');
			return;
		}
		this.isLoading = true;

		try {
			log('INFO', `加载模式: ${this.loadAllMode ? '全部' : '最近' + this.plugin.settings.daysToLoad + '天'}`);
			log('INFO', `日记文件夹: ${this.plugin.settings.diaryFolder}`);
			
			if (this.loadAllMode) {
				this.days = await loadAllDiaryDays(this.app, this.plugin.settings.diaryFolder);
			} else {
				this.days = await loadDiaryDays(
					this.app,
					this.plugin.settings.diaryFolder,
					this.plugin.settings.daysToLoad
				);
			}
			
			log('INFO', `加载了 ${this.days.length} 天的日志`);

			// 应用筛选
			const filterRegex = this.plugin.settings.filterRegex;
			if (filterRegex) {
				log('INFO', `应用筛选: ${filterRegex}`);
				try {
					const regex = new RegExp(filterRegex, 'gi');
					this.filteredDays = filterEntries(this.days, regex);
					log('INFO', `筛选后剩余 ${this.filteredDays.length} 天`);
				} catch (e) {
					log('ERROR', '正则表达式错误', filterRegex);
					this.filteredDays = [...this.days];
				}
			} else {
				this.filteredDays = [...this.days];
			}

			this.renderTimeline();
			log('INFO', 'loadData 完成');
		} catch (error) {
			log('ERROR', 'loadData 失败', error instanceof Error ? error.message : String(error));
			console.error('加载日志失败:', error);
		} finally {
			this.isLoading = false;
		}
	}

	private renderTimeline() {
		log('INFO', 'renderTimeline 开始');
		
		if (!this.timelineEl) {
			log('ERROR', 'renderTimeline: timelineEl 为空');
			return;
		}
		
		this.timelineEl.empty();

		if (this.filteredDays.length === 0) {
			const emptyEl = this.timelineEl.createDiv({ cls: 'dt-empty' });
			emptyEl.textContent = '暂无日志';
			log('INFO', 'renderTimeline: 无日志');
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
		
		log('INFO', `renderTimeline 完成，渲染了 ${this.filteredDays.length} 天`);
	}

	private async addEntry(content: string) {
		log('INFO', `添加条目: ${content}`);
		await addDiaryEntry(this.app, this.plugin.settings.diaryFolder, content);
		await this.loadData();
	}

	scrollToToday() {
		log('INFO', 'scrollToToday');
		
		if (!this.timelineEl) {
			log('ERROR', 'scrollToToday: timelineEl 为空');
			return;
		}
		
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
		log('INFO', 'onClose');
	}
}