import { App, TFile, moment } from 'obsidian';

export interface DiaryEntry {
	time: string;
	content: string;
	filePath: string;
	lineNumber: number;
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

export function parseDiaryContent(content: string, filePath: string): DiaryEntry[] {
	const lines = content.split('\n');
	const entries: DiaryEntry[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const match = line.match(/^-\s+(\d{1,2}:\d{2})\s+(.+)$/);
		if (match) {
			entries.push({
				time: match[1],
				content: match[2],
				filePath: filePath,
				lineNumber: i
			});
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

	const diaryFiles = files.filter(file => {
		const date = getFileDate(file.name);
		if (!date) return false;
		const fileDate = moment(date, 'YYYY-MM-DD');
		return fileDate.isBetween(start, end, 'days', '[]') &&
			file.path.startsWith(folder);
	});

	for (let d = end.clone(); d.isAfter(start) || d.isSame(start, 'day'); d.subtract(1, 'day')) {
		const dateStr = d.format('YYYY-MM-DD');
		const file = diaryFiles.find(f => getFileDate(f.name) === dateStr);
		
		if (file) {
			const content = await app.vault.read(file);
			const entries = parseDiaryContent(content, file.path);
			
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
	const diaryFiles = files.filter(file => {
		const date = getFileDate(file.name);
		return date && file.path.startsWith(folder);
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
		const entries = parseDiaryContent(content, file.path);

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
		const match = line.match(/^(\s*-\s+\d{1,2}:\d{2}\s+)/);
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
		const matchedEntries = day.entries.filter(entry => 
			regex.test(entry.content) || regex.test(entry.time)
		);

		if (matchedEntries.length > 0) {
			filteredDays.push({
				...day,
				entries: matchedEntries
			});
		}
	}

	return filteredDays;
}