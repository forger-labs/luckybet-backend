import { input, rawlist } from '@inquirer/prompts';
import shell from 'shelljs';

const DATASOURCES = {
	app: {
		name: 'App (migraciones de esquema)',
		value: 'app',
		path: './src/shared/database/typeorm.config.ts',
		migrationsDir: './src/shared/database/migrations',
	},
	seeders: {
		name: 'Seeders (datos de prueba/iniciales)',
		value: 'seeders',
		path: './src/shared/database/seeders.config.ts',
		migrationsDir: './src/shared/database/seeders',
	},
};

const TASKS_CONFIG = [
	{ name: 'Run migrations', value: 'run' },
	{ name: 'Revert last migration', value: 'revert' },
	{ name: 'Revert ALL migrations', value: 'revert-all' },
	{ name: 'Show migrations', value: 'show' },
	{ name: 'Generate migration', value: 'generate' },
];

function runTypeorm(command: string, datasourcePath: string, extra = '') {
	return `pnpm typeorm migration:${command} -d ${datasourcePath} ${extra}`;
}

async function selectDatasource() {
	const choices = Object.values(DATASOURCES).map(ds => ({
		name: ds.name,
		value: ds.value,
	}));

	const selectedValue = await rawlist({
		message: '¿Que DataSource quieres usar?',
		choices,
	});

	return Object.values(DATASOURCES).find(ds => ds.value === selectedValue);
}

function selectTask() {
	return rawlist({
		message: '¿Que tarea quieres ejecutar?',
		choices: TASKS_CONFIG,
	});
}

function revertAll(datasourcePath: string) {
	const cmd = runTypeorm('revert', datasourcePath);
	let hasMore = true;

	while (hasMore) {
		const result = shell.exec(cmd, { silent: true });
		const output = (result.stdout || '') + (result.stderr || '');

		if (
			result.code !== 0 ||
			output.includes('No migrations') ||
			output.includes('no migrations')
		) {
			hasMore = false;
		} else {
			console.log(output);
		}
	}

	console.log('Todas las migraciones han sido revertidas.');
}

async function handleTask(
	task: string,
	datasource: (typeof DATASOURCES)[keyof typeof DATASOURCES],
) {
	switch (task) {
		case 'run': {
			shell.exec(runTypeorm('run', datasource.path));
			break;
		}
		case 'revert': {
			shell.exec(runTypeorm('revert', datasource.path));
			break;
		}
		case 'revert-all': {
			revertAll(datasource.path);
			break;
		}
		case 'show': {
			shell.exec(runTypeorm('show', datasource.path));
			break;
		}
		case 'generate': {
			const filename = await input({
				default: 'coreSchema',
				message: 'Nombre de la migracion:',
			});

			const outMigration = `${datasource.migrationsDir}/${filename}`;
			shell.exec(runTypeorm('generate', datasource.path, outMigration));
			break;
		}
		default: {
			console.log('Tarea no soportada');
		}
	}
}

async function main() {
	const datasource = await selectDatasource();

	if (!datasource) {
		throw new Error('No se selecciono ningun datasource');
	}

	const task = await selectTask();

	if (!task) {
		throw new Error('No se selecciono ninguna tarea');
	}

	await handleTask(task, datasource);
}

try {
	void main();
} catch (error: unknown) {
	console.log('Error:', error);
	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(1);
}
