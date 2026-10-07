import { DateTime } from 'luxon';

import {
	DEFAULT_TIMEZONE,
	endOfDayInTz,
	endOfMonthInTz,
	endOfWeekInTz,
	formatInTz,
	getMonthlyPeriodKey,
	getPeriodRange,
	getWeeklyPeriodKey,
	parseDateInTz,
	startOfDayInTz,
	startOfMonthInTz,
	startOfWeekInTz,
	toDateTime,
} from './date.util';

describe('date.util (Argentina Timezone UTC-3)', () => {
	const TZ = 'America/Argentina/Buenos_Aires';

	describe('toDateTime', () => {
		it('should convert Date object to DateTime in Argentina zone', () => {
			const jsDate = new Date('2026-05-18T15:00:00.000Z');
			const dt = toDateTime(jsDate, TZ);
			expect(dt.zoneName).toBe(TZ);
			expect(dt.hour).toBe(12);
			expect(dt.day).toBe(18);
		});

		it('should parse YYYY-MM-DD in Argentina zone', () => {
			const dt = toDateTime('2026-05-18', TZ);
			expect(dt.zoneName).toBe(TZ);
			expect(dt.year).toBe(2026);
			expect(dt.month).toBe(5);
			expect(dt.day).toBe(18);
			expect(dt.hour).toBe(0);
		});

		it('should parse YYYY-MM-DD HH:mm:ss in Argentina zone', () => {
			const dt = toDateTime('2026-05-18 14:30:00', TZ);
			expect(dt.zoneName).toBe(TZ);
			expect(dt.hour).toBe(14);
			expect(dt.minute).toBe(30);
			expect(dt.toUTC().hour).toBe(17);
		});
	});

	describe('startOfDayInTz and endOfDayInTz', () => {
		it('should calculate 00:00:00.000 ART (which is 03:00:00.000Z)', () => {
			const date = new Date('2026-05-18T12:00:00.000Z');
			const start = startOfDayInTz(date, TZ);
			expect(start.toISOString()).toBe('2026-05-18T03:00:00.000Z');
		});

		it('should calculate 23:59:59.999 ART (which is 02:59:59.999Z next day)', () => {
			const date = new Date('2026-05-18T12:00:00.000Z');
			const end = endOfDayInTz(date, TZ);
			expect(end.toISOString()).toBe('2026-05-19T02:59:59.999Z');
		});
	});

	describe('startOfWeekInTz and endOfWeekInTz', () => {
		it('should calculate Monday 00:00:00 ART and Sunday 23:59:59.999 ART', () => {
			const sundayNightUtc = new Date('2026-05-25T01:00:00.000Z');
			const start = startOfWeekInTz(sundayNightUtc, TZ);
			const end = endOfWeekInTz(sundayNightUtc, TZ);

			expect(start.toISOString()).toBe('2026-05-18T03:00:00.000Z');
			expect(end.toISOString()).toBe('2026-05-25T02:59:59.999Z');
		});
	});

	describe('startOfMonthInTz and endOfMonthInTz', () => {
		it('should calculate 1st 00:00:00 ART and last day 23:59:59.999 ART', () => {
			const date = new Date('2026-05-15T12:00:00.000Z');
			const start = startOfMonthInTz(date, TZ);
			const end = endOfMonthInTz(date, TZ);

			expect(start.toISOString()).toBe('2026-05-01T03:00:00.000Z');
			expect(end.toISOString()).toBe('2026-06-01T02:59:59.999Z');
		});
	});

	describe('getPeriodRange and period keys', () => {
		it('should return correct weekly period range and ISO period key', () => {
			const date = new Date('2026-05-18T15:00:00.000Z');
			const result = getPeriodRange('WEEKLY', date, TZ);

			expect(result.periodKey).toBe('2026-W21');
			expect(result.startDate.toISOString()).toBe('2026-05-18T03:00:00.000Z');
			expect(result.endDate.toISOString()).toBe('2026-05-25T02:59:59.999Z');
		});

		it('should return correct monthly period range and period key', () => {
			const date = new Date('2026-05-18T15:00:00.000Z');
			const result = getPeriodRange('MONTHLY', date, TZ);

			expect(result.periodKey).toBe('2026-05');
			expect(result.startDate.toISOString()).toBe('2026-05-01T03:00:00.000Z');
			expect(result.endDate.toISOString()).toBe('2026-06-01T02:59:59.999Z');
		});

		it('getWeeklyPeriodKey and getMonthlyPeriodKey helpers', () => {
			const date = new Date('2026-05-18T15:00:00.000Z');
			expect(getWeeklyPeriodKey(date, TZ)).toBe('2026-W21');
			expect(getMonthlyPeriodKey(date, TZ)).toBe('2026-05');
		});
	});

	describe('formatInTz', () => {
		it('should format date in Argentina timezone', () => {
			const date = new Date('2026-05-18T01:30:00.000Z');
			expect(formatInTz(date, 'yyyy-MM-dd', TZ)).toBe('2026-05-17');
			expect(formatInTz(date, 'yyyy-MM-dd HH:mm:ss', TZ)).toBe('2026-05-17 22:30:00');
		});
	});

	describe('parseDateInTz', () => {
		it('should parse YYYY-MM-DD as start of day by default', () => {
			const date = parseDateInTz('2026-05-18', TZ, false);
			expect(date.toISOString()).toBe('2026-05-18T03:00:00.000Z');
		});

		it('should parse YYYY-MM-DD as end of day when isEndOfDay=true', () => {
			const date = parseDateInTz('2026-05-18', TZ, true);
			expect(date.toISOString()).toBe('2026-05-19T02:59:59.999Z');
		});

		it('should parse YYYY-MM-DD HH:mm:ss with timezone', () => {
			const date = parseDateInTz('2026-05-18 10:00:00', TZ);
			expect(date.toISOString()).toBe('2026-05-18T13:00:00.000Z');
		});
	});
});
