import { App, PluginSettingTab, Setting } from 'obsidian';
import DiaryTimelinePlugin from './main';

export interface DiaryTimelineSettings {
	diaryFolder: string;
	daysToLoad: number;
	dateFormat: string;
	timeFormat: string;
}

export const DEFAULT_SETTINGS: DiaryTimelineSettings = {
	diaryFolder: '/日志/',
	daysToLoad: 30,
	dateFormat: 'YYYY-MM-DD',
	timeFormat: 'HH:mm'
};

export class DiaryTimelineSettingTab extends PluginSettingTab {
	plugin: DiaryTimelinePlugin;

	constructor(app: App, plugin: DiaryTimelinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '日志时间线设置' });

		new Setting(containerEl)
			.setName('日记文件夹')
			.setDesc('存放日记文件的文件夹路径（以 / 结尾）')
			.addText(text => text
				.setPlaceholder('/日志/')
				.setValue(this.plugin.settings.diaryFolder)
				.onChange(async (value) => {
					this.plugin.settings.diaryFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('默认加载天数')
			.setDesc('打开时间线时默认加载多少天的日志')
			.addText(text => text
				.setPlaceholder('30')
				.setValue(String(this.plugin.settings.daysToLoad))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.daysToLoad = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('日期格式')
			.setDesc('日记文件名的日期格式')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.plugin.settings.dateFormat)
				.onChange(async (value) => {
					this.plugin.settings.dateFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('时间格式')
			.setDesc('日志条目中的时间格式')
			.addText(text => text
				.setPlaceholder('HH:mm')
				.setValue(this.plugin.settings.timeFormat)
				.onChange(async (value) => {
					this.plugin.settings.timeFormat = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: '使用说明' });
		
		const helpDiv = containerEl.createDiv();
		helpDiv.createEl('p', { text: '1. 日记文件名格式必须为 YYYY-MM-DD.md' });
		helpDiv.createEl('p', { text: '2. 每条日志以 - HH:mm 开头，例如：- 09:00 开会' });
		helpDiv.createEl('p', { text: '3. 可以使用正则表达式筛选日志内容' });
		helpDiv.createEl('p', { text: '4. 双击日志条目可以编辑，悬停时点击 × 可以删除' });
	}
}