import { render, screen, fireEvent } from '@testing-library/react';
import type { TimeEntry } from '@schediochron/core';
import Calendar from './Calendar';

describe('Calendar', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Calendar />);
    expect(baseElement).toBeTruthy();
  });

  it('should display the current month and year by default', () => {
    const today = new Date();
    render(<Calendar />);
    const monthName = today.toLocaleString('default', { month: 'long' });
    const year = today.toLocaleString('default', { year: 'numeric' });
    expect(screen.getByText(monthName)).toBeTruthy();
    expect(screen.getByText(year)).toBeTruthy();
  });

  it('should display the provided month and year', () => {
    render(<Calendar month={0} year={2024} />);
    expect(screen.getByText('January')).toBeTruthy();
    expect(screen.getByText('2024')).toBeTruthy();
  });

  it('should navigate to the previous month when the back button is clicked', () => {
    render(<Calendar month={5} year={2024} />);
    expect(screen.getByText('June')).toBeTruthy();
    fireEvent.click(screen.getByText('<'));
    expect(screen.getByText('May')).toBeTruthy();
  });

  it('should navigate to the next month when the forward button is clicked', () => {
    render(<Calendar month={5} year={2024} />);
    expect(screen.getByText('June')).toBeTruthy();
    fireEvent.click(screen.getByText('>'));
    expect(screen.getByText('July')).toBeTruthy();
  });

  it('should navigate to the current month when the Today button is clicked', () => {
    const today = new Date();
    render(<Calendar month={0} year={2020} />);
    expect(screen.getByText('January')).toBeTruthy();
    fireEvent.click(screen.getByText('Today'));
    const currentMonthName = today.toLocaleString('default', { month: 'long' });
    expect(screen.getByText(currentMonthName)).toBeTruthy();
  });

  it('should wrap from January to December when navigating backwards', () => {
    render(<Calendar month={0} year={2024} />);
    fireEvent.click(screen.getByText('<'));
    expect(screen.getByText('December')).toBeTruthy();
    expect(screen.getByText('2023')).toBeTruthy();
  });

  it('should wrap from December to January when navigating forward', () => {
    render(<Calendar month={11} year={2024} />);
    fireEvent.click(screen.getByText('>'));
    expect(screen.getByText('January')).toBeTruthy();
    expect(screen.getByText('2025')).toBeTruthy();
  });

  it('should display time entries on the correct date', () => {
    const entries: TimeEntry[] = [
      {
        id: 'entry-1',
        userId: 'user-1',
        startTime: '2024-06-15T07:30:00Z',
        endTime: '2024-06-15T11:30:00Z',
        status: 'completed',
        note: null,
        createdAt: '2024-06-15T07:30:00Z',
        updatedAt: '2024-06-15T11:30:00Z',
      },
    ];
    render(<Calendar month={5} year={2024} timeEntries={entries} />);
    // The entry time-log div should be rendered
    const timeLogs = document.querySelectorAll(
      '.time-log, [class*="time-log"]',
    );
    expect(timeLogs.length).toBeGreaterThan(0);
  });

  it('should call onDateSelect when a date cell is clicked', () => {
    const handleSelect = vi.fn();
    render(<Calendar month={5} year={2024} onDateSelect={handleSelect} />);
    // Click on the 15th cell (June 15, 2024)
    const cells = document.querySelectorAll('td');
    const june15 = Array.from(cells).find(
      (td) => td.querySelector('span')?.textContent === '15',
    );
    if (!june15) throw new Error('Could not find the June 15 cell');
    fireEvent.click(june15);
    expect(handleSelect).toHaveBeenCalledTimes(1);
    const calledWith: Date = handleSelect.mock.calls[0][0];
    expect(calledWith.getMonth()).toBe(5);
    expect(calledWith.getDate()).toBe(15);
  });
});
