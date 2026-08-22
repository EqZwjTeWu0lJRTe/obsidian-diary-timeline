import { TFile, moment } from 'obsidian';

export interface LogEntry {
	timestamp: string;
	level: 'INFO' | 'WARN' | 'ERROR';
	message: string;
	details?: string;
}

let logBuffer: LogEntry[] = [];
const MAX_LOG_SIZE = 100;

export function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: string) {
	const entry: LogEntry = {
		timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
		level,
		message,
		details
	};
	
	logBuffer.push(entry);
	
	// 保持日志大小
	if (logBuffer.length > MAX_LOG_SIZE) {
		logBuffer = logBuffer.slice(-MAX_LOG_SIZE);
	}
	
	// 同时输出到控制台
	console.log(`[DiaryTimeline ${level}] ${message}`, details || '');
}

export function getLogs(): LogEntry[] {
	return [...logBuffer];
}

export function getLogsAsString(): string {
	return logBuffer.map(entry => 
		`[${entry.timestamp}] [${entry.level}] ${entry.message}${entry.details ? '\n  详情: ' + entry.details : ''}`
	).join('\n\n');
}

export async function exportLogsToFile(app: any, folder: string): Promise<string> {
	const filename = `diary-timeline-debug-${moment().format('YYYY-MM-DD-HHmmss')}.md`;
	const filepath = `${folder}${filename}`;
	
	const content = `# Diary Timeline Debug Log

## 导出时间
${moment().format('YYYY-MM-DD HH:mm:ss')}

## 日志条目 (${logBuffer.length} 条)

${getLogsAsString()}

## 最近错误

${logBuffer.filter(e => e.level === 'ERROR').slice(-10).map(e => 
	`### ${e.timestamp}
${e.message}
\`\`\`
${e.details || '无详情'}
\`\`\`
`).join('\n')}
`;

	try {
		// 确保文件夹存在
		const folderObj = app.vault.getAbstractFileByPath(folder);
		if (!folderObj) {
			await app.vault.createFolder(folder);
		}
		
		// 检查文件是否已存在
		const existingFile = app.vault.getAbstractFileByPath(filepath);
		if (existingFile instanceof TFile) {
			await app.vault.modify(existingFile, content);
		} else {
			await app.vault.create(filepath, content);
		}
		
		return filepath;
	} catch (error) {
		console.error('导出日志失败:', error);
		return '';
	}
}

export function clearLogs() {
	logBuffer = [];
}