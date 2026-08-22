import { App, Plugin, WorkspaceLeaf } from 'obsidian';
import { DiaryTimelineView, VIEW_TYPE_DIARY_TIMELINE } from './views/TimelineView';
import { DiaryTimelineSettingTab, DiaryTimelineSettings, DEFAULT_SETTINGS } from './settings';
import { log, exportLogsToFile, clearLogs } from './utils/logger';

export default class DiaryTimelinePlugin extends Plugin {
	settings: DiaryTimelineSettings = DEFAULT_SETTINGS;

	async onload() {
		log('INFO', '插件加载开始');
		
		await this.loadSettings();
		log('INFO', '设置加载完成');

		this.registerView(
			VIEW_TYPE_DIARY_TIMELINE,
			(leaf) => new DiaryTimelineView(leaf, this)
		);
		log('INFO', '视图注册完成');

		this.addRibbonIcon('calendar-days', '打开日志时间线', () => {
			this.activateView();
		});
		log('INFO', 'Ribbon 图标添加完成');

		this.addCommand({
			id: 'open-diary-timeline',
			name: '打开日志时间线',
			callback: () => {
				this.activateView();
			}
		});

		this.addCommand({
			id: 'add-diary-entry',
			name: '添加日志条目',
			callback: () => {
				this.addQuickEntry();
			}
		});

		this.addCommand({
			id: 'export-debug-logs',
			name: '导出调试日志',
			callback: async () => {
				const filepath = await exportLogsToFile(this.app, this.settings.diaryFolder);
				if (filepath) {
					log('INFO', `日志已导出到: ${filepath}`);
				}
			}
		});

		this.addCommand({
			id: 'clear-debug-logs',
			name: '清除调试日志',
			callback: () => {
				clearLogs();
				log('INFO', '日志已清除');
			}
		});

		this.addSettingTab(new DiaryTimelineSettingTab(this.app, this));
		log('INFO', '设置标签页添加完成');
		
		log('INFO', '插件加载完成');
	}

	async onunload() {
		log('INFO', '插件卸载');
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_DIARY_TIMELINE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		log('INFO', 'activateView');
		
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DIARY_TIMELINE);
		if (existing.length > 0) {
			log('INFO', '视图已存在，显示它');
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		// 在主标签页打开
		log('INFO', '在主标签页创建新视图');
		const leaf = this.app.workspace.getLeaf('tab');
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_DIARY_TIMELINE,
				active: true,
			});
			log('INFO', '视图创建成功');
		} else {
			log('ERROR', '无法获取 leaf');
		}
	}

	async addQuickEntry() {
		log('INFO', 'addQuickEntry');
		const view = this.app.workspace.getActiveViewOfType(DiaryTimelineView);
		if (view) {
			view.focusInput();
		} else {
			await this.activateView();
		}
	}
}