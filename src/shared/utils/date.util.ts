import { DateTime } from 'luxon';

export const DEFAULT_TIMEZONE =
	process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires';

export type SupportedPeriodType = 'WEEKLY' | 'MONTHLY';

/**
 * Normaliza cualquier entrada (Date, string, number, DateTime) a un objeto Luxon DateTime
 * en la zona horaria objetivo (por defecto America/Argentina/Buenos_Aires).
 */
export function toDateTime(
	input?: Date | string | number | DateTime | null,
	tz = DEFAULT_TIMEZONE,
): DateTime {
	if (!input) {
		return DateTime.now().setZone(tz);
	}
	if (DateTime.isDateTime(input)) {
		return input.setZone(tz);
	}
	if (input instanceof Date) {
		return DateTime.fromJSDate(input, { zone: tz });
	}
	if (typeof input === 'number') {
		return DateTime.fromMillis(input, { zone: tz });
	}
	if (typeof input === 'string') {
		const trimmed = input.trim();
		// Si es solo YYYY-MM-DD
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			const dt = DateTime.fromISO(trimmed, { zone: tz });
			if (dt.isValid) return dt;
		}
		// Si contiene espacio (e.g. YYYY-MM-DD HH:mm:ss)
		if (trimmed.includes(' ') && !trimmed.includes('T')) {
			const sqlDt = DateTime.fromSQL(trimmed, { zone: tz });
			if (sqlDt.isValid) return sqlDt;
			const isoLike = trimmed.replace(' ', 'T');
			const parsed = DateTime.fromISO(isoLike, { zone: tz });
			if (parsed.isValid) return parsed;
		}
		// ISO standard (puede traer offset o no)
		const isoDt = DateTime.fromISO(trimmed, { setZone: true });
		if (isoDt.isValid) {
			return isoDt.setZone(tz);
		}
		// Fallback RFC2822 o JS Date parse
		const jsDate = new Date(trimmed);
		if (!Number.isNaN(jsDate.getTime())) {
			return DateTime.fromJSDate(jsDate, { zone: tz });
		}
	}
	return DateTime.now().setZone(tz);
}

/**
 * Retorna la fecha y hora actual en la zona horaria indicada como objeto Date (UTC instant).
 */
export function nowInTz(tz: string = DEFAULT_TIMEZONE): DateTime {
	return DateTime.now().setZone(tz);
}

/**
 * Retorna el inicio del día (00:00:00.000) en el huso horario configurado.
 */
export function startOfDayInTz(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return toDateTime(date, tz).startOf('day').toJSDate();
}

/**
 * Retorna el fin del día (23:59:59.999) en el huso horario configurado.
 */
export function endOfDayInTz(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return toDateTime(date, tz).endOf('day').toJSDate();
}

/**
 * Retorna el inicio de la semana ISO (Lunes 00:00:00.000) en el huso horario configurado.
 */
export function startOfWeekInTz(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return toDateTime(date, tz).startOf('week').toJSDate();
}

/**
 * Retorna el fin de la semana ISO (Domingo 23:59:59.999) en el huso horario configurado.
 */
export function endOfWeekInTz(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return toDateTime(date, tz).endOf('week').toJSDate();
}

/**
 * Retorna el inicio de mes (Día 1 00:00:00.000) en el huso horario configurado.
 */
export function startOfMonthInTz(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return toDateTime(date, tz).startOf('month').toJSDate();
}

/**
 * Retorna el fin de mes (Último día 23:59:59.999) en el huso horario configurado.
 */
export function endOfMonthInTz(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): Date {
	return toDateTime(date, tz).endOf('month').toJSDate();
}

/**
 * Genera la clave de semana ISO (YYYY-Www) según el huso horario configurado.
 */
export function getWeeklyPeriodKey(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): string {
	const dt = toDateTime(date, tz);
	const weekStr = String(dt.weekNumber).padStart(2, '0');
	return `${dt.weekYear}-W${weekStr}`;
}

/**
 * Genera la clave de mes (YYYY-MM) según el huso horario configurado.
 */
export function getMonthlyPeriodKey(
	date?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): string {
	const dt = toDateTime(date, tz);
	const monthStr = String(dt.month).padStart(2, '0');
	return `${dt.year}-${monthStr}`;
}

/**
 * Calcula el rango de fechas (startDate, endDate) y la clave única (periodKey)
 * para periodos WEEKLY (Lunes 00:00 a Domingo 23:59:59.999) o MONTHLY (1ro 00:00 al último día 23:59:59.999)
 * en el huso horario de Argentina.
 */
export function getPeriodRange(
	periodType: SupportedPeriodType,
	refDate?: Date | string | number | DateTime | null,
	tz: string = DEFAULT_TIMEZONE,
): {
	startDate: Date;
	endDate: Date;
	periodKey: string;
} {
	const dt = toDateTime(refDate, tz);

	if (periodType === 'MONTHLY') {
		const startDate = dt.startOf('month').toJSDate();
		const endDate = dt.endOf('month').toJSDate();
		const monthStr = String(dt.month).padStart(2, '0');
		const periodKey = `${dt.year}-${monthStr}`;
		return { startDate, endDate, periodKey };
	}

	// Default WEEKLY (Semana ISO: Lunes a Domingo)
	const startDate = dt.startOf('week').toJSDate();
	const endDate = dt.endOf('week').toJSDate();
	const weekStr = String(dt.weekNumber).padStart(2, '0');
	const periodKey = `${dt.weekYear}-W${weekStr}`;

	return { startDate, endDate, periodKey };
}

/**
 * Formatea una fecha en el huso horario especificado.
 */
export function formatInTz(
	date: Date | string | number | DateTime | null,
	format = 'yyyy-MM-dd',
	tz: string = DEFAULT_TIMEZONE,
): string {
	if (!date) return '';
	return toDateTime(date, tz).toFormat(format);
}

/**
 * Parsea un string de fecha u hora recibido desde filtros o APIs externas respetando el huso horario.
 * Si es solo fecha (YYYY-MM-DD):
 *   - isEndOfDay = true -> 23:59:59.999 en el TZ
 *   - isEndOfDay = false -> 00:00:00.000 en el TZ
 * Si incluye hora (YYYY-MM-DD HH:mm:ss o ISO), respeta la hora dada asignándole el TZ si no traía offset.
 */
export function parseDateInTz(
	dateInput: string | Date | number,
	tz: string = DEFAULT_TIMEZONE,
	isEndOfDay = false,
): Date {
	if (dateInput instanceof Date) return dateInput;
	if (typeof dateInput === 'number') return new Date(dateInput);

	const trimmed = dateInput.trim();
	// Caso solo fecha YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		const dt = DateTime.fromISO(trimmed, { zone: tz });
		return isEndOfDay ? dt.endOf('day').toJSDate() : dt.startOf('day').toJSDate();
	}

	// Si trae indicador de timezone explícito al final (ej: Z o +03:00 o -0300)
	const hasExplicitTz = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed);
	if (hasExplicitTz) {
		const iso = DateTime.fromISO(trimmed, { setZone: true });
		if (iso.isValid) return iso.toJSDate();
	}

	// Caso con hora sin offset explícito (e.g. YYYY-MM-DD HH:mm:ss o YYYY-MM-DDTHH:mm:ss)
	const isoLike = trimmed.replace(' ', 'T');
	const dt = DateTime.fromISO(isoLike, { zone: tz });
	if (dt.isValid) return dt.toJSDate();

	const sqlDt = DateTime.fromSQL(trimmed, { zone: tz });
	if (sqlDt.isValid) return sqlDt.toJSDate();

	return new Date(trimmed);
}
