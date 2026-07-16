import { useState } from 'react';
import type { TimeEntry } from '@schediochron/core';
import { getWeekArray } from '../../utils/date';
import styles from './Calendar.module.css';

export interface CalendarProps {
  /** 0-indexed month to display (0 = January). Defaults to the current month. */
  month?: number;
  /** 4-digit year to display. Defaults to the current year. */
  year?: number;
  /** Time entries to render on the calendar. */
  timeEntries?: TimeEntry[];
  /** Called when the user clicks on a calendar date cell. */
  onDateSelect?: (date: Date) => void;
}

/** Formats an ISO 8601 UTC timestamp to a local HH:MM string. */
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('default', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Returns true if the ISO 8601 UTC timestamp falls on the given local date. */
function isSameLocalDate(isoString: string, date: Date): boolean {
  const entryDate = new Date(isoString);
  return (
    entryDate.getFullYear() === date.getFullYear() &&
    entryDate.getMonth() === date.getMonth() &&
    entryDate.getDate() === date.getDate()
  );
}

/** Formats a duration in milliseconds to a human-readable string (e.g. "8h 45min"). */
function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

export function Calendar({
  month: initialMonth,
  year: initialYear,
  timeEntries = [],
  onDateSelect,
}: CalendarProps) {
  const today = new Date();
  const [displayYear, setDisplayYear] = useState(
    initialYear ?? today.getFullYear(),
  );
  const [displayMonth, setDisplayMonth] = useState(
    initialMonth ?? today.getMonth(),
  );

  const daysArray = getWeekArray(displayYear, displayMonth);

  const handlePrev = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear((y) => y - 1);
    } else {
      setDisplayMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear((y) => y + 1);
    } else {
      setDisplayMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setDisplayYear(today.getFullYear());
    setDisplayMonth(today.getMonth());
  };

  const displayDate = new Date(displayYear, displayMonth, 1);

  return (
    <table className={styles['calendar']}>
      <thead>
        <tr>
          <th colSpan={7}>
            <div className={styles['calendar-header']}>
              <h2 className={styles['month-year']}>
                <b>
                  {displayDate.toLocaleString('default', {
                    month: 'long',
                  })}
                </b>{' '}
                {displayDate.toLocaleString('default', {
                  year: 'numeric',
                })}
              </h2>
              <nav className={styles['view-nav']}>
                <label>
                  <input type="radio" name="view" />
                  Day
                </label>
                <label>
                  <input type="radio" name="view" />
                  Week
                </label>
                <label>
                  <input type="radio" name="view" />
                  Month
                </label>
                <label>
                  <input type="radio" name="view" />
                  Year
                </label>
              </nav>
              <nav className={styles['seq-nav']}>
                <button onClick={handlePrev}>&lt;</button>
                <button onClick={handleToday}>Today</button>
                <button onClick={handleNext}>&gt;</button>
              </nav>
            </div>
          </th>
        </tr>
        <tr>
          <th>
            <span>Mon</span>
          </th>
          <th>
            <span>Tue</span>
          </th>
          <th>
            <span>Wed</span>
          </th>
          <th>
            <span>Thu</span>
          </th>
          <th>
            <span>Fri</span>
          </th>
          <th>
            <span>Sat</span>
          </th>
          <th>
            <span>Sun</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {daysArray.map((week, weekIndex) => (
          <tr key={weekIndex}>
            {week.map((date, dayIndex) => {
              const isCurrentMonth = date.getMonth() === displayMonth;
              const isToday =
                date.getFullYear() === today.getFullYear() &&
                date.getMonth() === today.getMonth() &&
                date.getDate() === today.getDate();
              const isWeekend = dayIndex === 5 || dayIndex === 6;
              const dayNumber = date.getDate();

              const dayEntries = timeEntries.filter((e) =>
                isSameLocalDate(e.startTime, date),
              );
              const completedEntries = dayEntries.filter(
                (e) => e.status === 'completed' && e.endTime !== null,
              );
              const totalMs = completedEntries.reduce((sum, e) => {
                const end = e.endTime;
                if (end === null) return sum;
                return (
                  sum +
                  (new Date(end).getTime() - new Date(e.startTime).getTime())
                );
              }, 0);

              return (
                <td
                  key={`${date.getFullYear()}-${date.getMonth()}-${dayNumber}`}
                  className={`${!isCurrentMonth ? styles['other-month'] : ''} ${
                    isWeekend ? styles['weekend'] : ''
                  }`.trim()}
                  onClick={onDateSelect ? () => onDateSelect(date) : undefined}
                >
                  <span
                    className={`${
                      isToday && isCurrentMonth ? styles['today'] : ''
                    }`}
                    aria-current={
                      isToday && isCurrentMonth ? 'date' : undefined
                    }
                  >
                    {dayNumber}
                  </span>
                  {dayEntries.length > 0 && (
                    <div className={styles['time-log']}>
                      {dayEntries.map((entry) => (
                        <div key={entry.id} className={styles['entry']}>
                          {formatTime(entry.startTime)}
                          {entry.endTime
                            ? ` – ${formatTime(entry.endTime)}`
                            : ' – …'}
                        </div>
                      ))}
                      {completedEntries.length > 0 && (
                        <div
                          className={`${styles['summary']} ${styles['positive']}`}
                        >
                          {formatDuration(totalMs)}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default Calendar;
