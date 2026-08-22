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
	log('INFO', '开始导出日志');
	
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
		// 确保文件夹存在（忽略已存在的错误）
		try {
			const folderObj = app.vault.getAbstractFileByPath(folder);
			if (!folderObj) {
				log('INFO', `创建文件夹: ${folder}`);
				await app.vault.createFolder(folder);
			} else {
				log('INFO', `文件夹已存在: ${folder}`);
			}
		} catch (folderError) {
			// 文件夹已存在，忽略错误
			log('WARN', '文件夹创建错误（可忽略）', String(folderError));
		}
		
		// 检查文件是否已存在
		const existingFile = app.vault.getAbstractFileByPath(filepath);
		if (existingFile instanceof TFile) {
			log('INFO', `修改现有文件: ${filepath}`);
			await app.vault.modify(existingFile, content);
		} else {
			log('INFO', `创建新文件: ${filepath}`);
			await app.vault.create(filepath, content);
		}
		
		log('INFO', `日志导出成功: ${filepath}`);
		return filepath;
	} catch (error) {
		log('ERROR', '导出日志失败', error instanceof Error ? error.message : String(error));
		console.error('导出日志失败:', error);
		return '';
	}
}

export function clearLogs() {
	logBuffer = [];
}