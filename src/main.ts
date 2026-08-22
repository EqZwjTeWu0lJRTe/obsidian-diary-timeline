import { App, Plugin, WorkspaceLeaf } from 'obsidian';
import { DiaryTimelineView, VIEW_TYPE_DIARY_TIMELINE } from './views/TimelineView';
import { DiaryTimelineSettingTab, DiaryTimelineSettings, DEFAULT_SETTINGS } from './settings';

export default class DiaryTimelinePlugin extends Plugin {
	settings: DiaryTimelineSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_DIARY_TIMELINE,
			(leaf) => new DiaryTimelineView(leaf, this)
		);

		this.addRibbonIcon('calendar-days', '打开日志时间线', () => {
			this.activateView();
		});

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

		this.addSettingTab(new DiaryTimelineSettingTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_DIARY_TIMELINE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DIARY_TIMELINE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		// 在主标签页打开
		const leaf = this.app.workspace.getLeaf('tab');
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_DIARY_TIMELINE,
				active: true,
			});
		}
	}

	async addQuickEntry() {
		const view = this.app.workspace.getActiveViewOfType(DiaryTimelineView);
		if (view) {
			view.focusInput();
		} else {
			await this.activateView();
		}
	}
}