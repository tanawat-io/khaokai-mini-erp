/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBanner } from '../ErrorBanner';

afterEach(cleanup);

describe('ErrorBanner', () => {
  it('renders Thai heading and message', () => {
    render(<ErrorBanner message="เครือข่ายล้มเหลว" onDismiss={() => {}} />);
    expect(screen.getByText('เกิดข้อผิดพลาดในการเชื่อมต่อ')).toBeTruthy();
    expect(screen.getByText('เครือข่ายล้มเหลว')).toBeTruthy();
    expect(screen.getByText('กรุณาตรวจสอบการเชื่อมต่อหรือลองรีเฟรชหน้า')).toBeTruthy();
  });

  it('calls onDismiss when close button clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="x" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('ปิดข้อความแจ้งเตือน'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('has role alert for accessibility', () => {
    render(<ErrorBanner message="x" onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
