import { App, TFile, moment } from 'obsidian';

export interface DiaryEntry {
	app: App;
	time: string;
	content: string;
	filePath: string;
	lineNumber: number;
	section?: string; // 所属章节，如 "重点事件"、"思考与感悟"
}

export interface DiaryDay {
	date: string;
	dateDisplay: string;
	weekday: string;
	entries: DiaryEntry[];
	filePath: string;
}

export function getFileDate(filename: string): string | null {
	const match = filename.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
	return match ? match[1] : null;
}

export function parseDiaryContent(app: App, content: string, filePath: string): DiaryEntry[] {
	const lines = content.split('\n');
	const entries: DiaryEntry[] = [];
	
	let currentSection = '';
	
	// 支持多种时间格式的正则
	const timePatterns = [
		/^-\s+(\d{1,2}:\d{2})\s+(.+)$/,  // - 09:00 开会
		/^-\s+\*\*时间\*\*[：:]\s*(\d{1,2}:\d{2})/,  // - **时间**：09:00
		/^[-*]\s+(\d{1,2}:\d{2})\s+(.+)$/,  // * 09:00 开会 或 - 09:00 开会
	];

	// 检测章节标题
	const sectionPatterns = [
		/\*\*📝\s*(.+?)\*\*/,  // **📝 重点事件**
		/\*\*💡\s*(.+?)\*\*/,  // **💡 思考与感悟**
		/^#+\s*(.+)$/,  // # 标题
		/^>\s*\[!(\w+)\]/,  // > [!note] 标题
	];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();
		
		// 检测章节
		for (const pattern of sectionPatterns) {
			const match = trimmedLine.match(pattern);
			if (match) {
				currentSection = match[1] || match[0];
				break;
			}
		}
		
		// 检测时间格式的条目
		for (const pattern of timePatterns) {
			const match = trimmedLine.match(pattern);
			if (match) {
				let time = match[1];
				let content = match[2] || trimmedLine;
				
				// 如果是 "时间" 格式，提取实际时间
				if (trimmedLine.includes('**时间**')) {
					const timeMatch = trimmedLine.match(/\*\*时间\*\*[：:]\s*(\d{1,2}:\d{2})/);
					if (timeMatch) {
						time = timeMatch[1];
						// 获取整行内容作为事件描述
						content = trimmedLine.replace(/^[-*]\s*\*\*时间\*\*[：:]\s*\d{1,2}:\d{2}\s*/, '');
					}
				}
				
				entries.push({
					app: app,
					time: time,
					content: content,
					filePath: filePath,
					lineNumber: i,
					section: currentSection
				});
				break;
			}
		}
		
		// 如果没有时间但有内容，也作为条目（使用默认时间 00:00）
		if (entries.length === 0 || entries[entries.length - 1].lineNumber !== i) {
			// 检查是否是有内容的行（不是标题、不是空行）
			if (trimmedLine && 
				!trimmedLine.startsWith('#') && 
				!trimmedLine.startsWith('>') &&
				!trimmedLine.startsWith('---') &&
				!trimmedLine.startsWith('```') &&
				trimmedLine.includes('：') || trimmedLine.includes(':')) {
				
				// 提取键值对
				const kvMatch = trimmedLine.match(/^[-*]\s*\*\*(.+?)\*\*[：:]\s*(.+)$/);
				if (kvMatch) {
					entries.push({
						app: app,
						time: '00:00',
						content: `${kvMatch[1]}: ${kvMatch[2]}`,
						filePath: filePath,
						lineNumber: i,
						section: currentSection
					});
				}
			}
		}
	}

	return entries;
}

export function getWeekday(dateStr: string): string {
	const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
	const date = moment(dateStr, 'YYYY-MM-DD');
	return weekdays[date.day()];
}

export function formatDateDisplay(dateStr: string): string {
	return `📆 ${dateStr} ${getWeekday(dateStr)}`;
}

export async function loadDiaryDays(
	app: App,
	folder: string,
	daysToLoad: number,
	startDate?: string
): Promise<DiaryDay[]> {
	const days: DiaryDay[] = [];
	const files = app.vault.getMarkdownFiles();
	
	const end = startDate ? moment(startDate, 'YYYY-MM-DD') : moment();
	const start = end.clone().subtract(daysToLoad - 1, 'days');

	// 支持子文件夹搜索
	const diaryFiles = files.filter(file => {
		const date = getFileDate(file.name);
		if (!date) return false;
		const fileDate = moment(date, 'YYYY-MM-DD');
		return fileDate.isBetween(start, end, 'days', '[]') &&
			file.path.includes(folder);
	});

	for (let d = end.clone(); d.isAfter(start) || d.isSame(start, 'day'); d.subtract(1, 'day')) {
		const dateStr = d.format('YYYY-MM-DD');
		const file = diaryFiles.find(f => getFileDate(f.name) === dateStr);
		
		if (file) {
			const content = await app.vault.read(file);
			const entries = parseDiaryContent(app, content, file.path);
			
			days.push({
				date: dateStr,
				dateDisplay: formatDateDisplay(dateStr),
				weekday: getWeekday(dateStr),
				entries: entries.sort((a, b) => a.time.localeCompare(b.time)),
				filePath: file.path
			});
		} else {
			days.push({
				date: dateStr,
				dateDisplay: formatDateDisplay(dateStr),
				weekday: getWeekday(dateStr),
				entries: [],
				filePath: `${folder}${dateStr}.md`
			});
		}
	}

	return days;
}

export async function loadAllDiaryDays(
	app: App,
	folder: string
): Promise<DiaryDay[]> {
	const files = app.vault.getMarkdownFiles();
	// 支持子文件夹搜索
	const diaryFiles = files.filter(file => {
		const date = getFileDate(file.name);
		return date && file.path.includes(folder);
	}).sort((a, b) => {
		const dateA = getFileDate(a.name) || '';
		const dateB = getFileDate(b.name) || '';
		return dateB.localeCompare(dateA);
	});

	const days: DiaryDay[] = [];

	for (const file of diaryFiles) {
		const date = getFileDate(file.name);
		if (!date) continue;

		const content = await app.vault.read(file);
		const entries = parseDiaryContent(app, content, file.path);

		days.push({
			date: date,
			dateDisplay: formatDateDisplay(date),
			weekday: getWeekday(date),
			entries: entries.sort((a, b) => a.time.localeCompare(b.time)),
			filePath: file.path
		});
	}

	return days;
}

export async function addDiaryEntry(
	app: App,
	folder: string,
	content: string
): Promise<void> {
	const today = moment().format('YYYY-MM-DD');
	const filePath = `${folder}${today}.md`;
	
	const existingFile = app.vault.getAbstractFileByPath(filePath);
	
	if (existingFile instanceof TFile) {
		const existingContent = await app.vault.read(existingFile);
		const time = moment().format('HH:mm');
		const newEntry = `\n- ${time} ${content}`;
		await app.vault.modify(existingFile, existingContent + newEntry);
	} else {
		const time = moment().format('HH:mm');
		const newContent = `# ${today}\n\n- ${time} ${content}`;
		
		const folderObj = app.vault.getAbstractFileByPath(folder);
		if (!folderObj) {
			await app.vault.createFolder(folder);
		}
		
		await app.vault.create(filePath, newContent);
	}
}

export async function editDiaryEntry(
	app: App,
	filePath: string,
	lineNumber: number,
	newContent: string
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const content = await app.vault.read(file);
	const lines = content.split('\n');
	
	if (lineNumber >= 0 && lineNumber < lines.length) {
		const line = lines[lineNumber];
		const match = line.match(/^(\s*[-*]\s+(?:\*\*时间\*\*[：:]\s*)?(?:\d{1,2}:\d{2}\s+)?)/);
		if (match) {
			lines[lineNumber] = match[1] + newContent;
			await app.vault.modify(file, lines.join('\n'));
		}
	}
}

export async function deleteDiaryEntry(
	app: App,
	filePath: string,
	lineNumber: number
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const content = await app.vault.read(file);
	const lines = content.split('\n');
	
	if (lineNumber >= 0 && lineNumber < lines.length) {
		lines.splice(lineNumber, 1);
		await app.vault.modify(file, lines.join('\n'));
	}
}

export function filterEntries(
	days: DiaryDay[],
	regex: RegExp
): DiaryDay[] {
	const filteredDays: DiaryDay[] = [];

	for (const day of days) {
		const matchedEntries = day.entries.filter(entry => {
			// 搜索内容、时间、章节
			return regex.test(entry.content) || 
				   regex.test(entry.time) || 
				   (entry.section && regex.test(entry.section));
		});

		if (matchedEntries.length > 0) {
			filteredDays.push({
				...day,
				entries: matchedEntries
			});
		}
	}

	return filteredDays;
}