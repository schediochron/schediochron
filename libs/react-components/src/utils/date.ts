/**
 * Generates a 2D array of weeks for a given month.
 * Each week is an array of 7 Date objects starting on Monday.
 * Days from the previous/next month are included to fill the first/last week.
 *
 * @param year  - 4-digit year
 * @param month - 0-indexed month (0 = January, 11 = December)
 * @returns 2D array of Date objects representing weeks (Mon–Sun)
 */
export const getWeekArray = (year: number, month: number): Date[][] => {
  const result: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const numDays = lastDay.getDate();

  // Native JS Date.getDay() returns 0 (Sunday) … 6 (Saturday).
  // Re-map Sunday from 0 to 7 so that the week starts on Monday: Mon=1 … Sun=7.
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 7 : startDay;

  // Fill in the days from the previous month
  for (let i = startDay - 1; i > 0; i--) {
    const prevDate = new Date(year, month, 1 - i);
    result.push(prevDate);
  }

  // Fill in the days of the current month
  for (let i = 1; i <= numDays; i++) {
    result.push(new Date(year, month, i));
  }

  // Fill in the days from the next month to complete the last week
  const remainingCells = 7 - (result.length % 7);
  if (remainingCells < 7) {
    for (let i = 1; i <= remainingCells; i++) {
      result.push(new Date(year, month + 1, i));
    }
  }

  // Convert the flat array into a 2D array representing weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < result.length; i += 7) {
    weeks.push(result.slice(i, i + 7));
  }

  return weeks;
};
