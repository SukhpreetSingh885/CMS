import { describe, it, expect } from 'vitest';
import {
  getDateRangeBoundaries,
  buildPrismaDateFilter,
} from '../src/utils/dateRange.js';

describe('Viralstan CMS — Global Date Filter & Custom Range System Tests', () => {
  // Test simulated state machine for the Custom Date Picker
  interface CustomPickerState {
    isOpen: boolean;
    activePreset: string;
    appliedStartDate: string;
    appliedEndDate: string;
    draftStartDate: string;
    draftEndDate: string;
    validationError: string;
  }

  function createCustomPicker(initialStart = '', initialEnd = '', initialPreset = ''): {
    state: CustomPickerState;
    open: () => void;
    setDraftStart: (val: string) => void;
    setDraftEnd: (val: string) => void;
    cancel: () => void;
    apply: () => boolean;
  } {
    const state: CustomPickerState = {
      isOpen: false,
      activePreset: initialPreset,
      appliedStartDate: initialStart,
      appliedEndDate: initialEnd,
      draftStartDate: initialStart,
      draftEndDate: initialEnd,
      validationError: '',
    };

    return {
      state,
      open: () => {
        state.isOpen = true;
        // On opening, draft values initialize from applied values
        state.draftStartDate = state.appliedStartDate;
        state.draftEndDate = state.appliedEndDate;
        state.validationError = '';
      },
      setDraftStart: (val: string) => {
        state.draftStartDate = val;
        state.validationError = '';
      },
      setDraftEnd: (val: string) => {
        state.draftEndDate = val;
        state.validationError = '';
      },
      cancel: () => {
        // Cancel restores draft values to previously applied values
        state.draftStartDate = state.appliedStartDate;
        state.draftEndDate = state.appliedEndDate;
        state.validationError = '';
        state.isOpen = false;
      },
      apply: () => {
        if (!state.draftStartDate && !state.draftEndDate) {
          state.validationError = 'Please select at least a start or end date.';
          return false;
        }
        if (state.draftStartDate && state.draftEndDate && state.draftStartDate > state.draftEndDate) {
          state.validationError = 'Start date cannot be after end date.';
          return false;
        }

        // Apply commits changes
        state.appliedStartDate = state.draftStartDate;
        state.appliedEndDate = state.draftEndDate;
        state.activePreset = 'custom';
        state.validationError = '';
        state.isOpen = false;
        return true;
      },
    };
  }

  describe('1. Custom Date Picker State & Interaction Lifecycle', () => {
    it('opens the custom picker and initializes draft dates from current applied values', () => {
      const picker = createCustomPicker('2026-10-01', '2026-10-15', 'custom');
      expect(picker.state.isOpen).toBe(false);

      picker.open();
      expect(picker.state.isOpen).toBe(true);
      expect(picker.state.draftStartDate).toBe('2026-10-01');
      expect(picker.state.draftEndDate).toBe('2026-10-15');
      expect(picker.state.validationError).toBe('');
    });

    it('validates: rejects when start date is after end date', () => {
      const picker = createCustomPicker();
      picker.open();

      picker.setDraftStart('2026-10-20');
      picker.setDraftEnd('2026-10-10');

      const applied = picker.apply();
      expect(applied).toBe(false);
      expect(picker.state.isOpen).toBe(true);
      expect(picker.state.validationError).toBe('Start date cannot be after end date.');
      // Applied values must remain unchanged
      expect(picker.state.appliedStartDate).toBe('');
      expect(picker.state.appliedEndDate).toBe('');
    });

    it('validates: rejects when both start and end date are empty', () => {
      const picker = createCustomPicker();
      picker.open();

      picker.setDraftStart('');
      picker.setDraftEnd('');

      const applied = picker.apply();
      expect(applied).toBe(false);
      expect(picker.state.isOpen).toBe(true);
      expect(picker.state.validationError).toBe('Please select at least a start or end date.');
    });

    it('applies valid date range and updates applied state and preset', () => {
      const picker = createCustomPicker();
      picker.open();

      picker.setDraftStart('2026-10-01');
      picker.setDraftEnd('2026-10-31');

      const applied = picker.apply();
      expect(applied).toBe(true);
      expect(picker.state.isOpen).toBe(false);
      expect(picker.state.appliedStartDate).toBe('2026-10-01');
      expect(picker.state.appliedEndDate).toBe('2026-10-31');
      expect(picker.state.activePreset).toBe('custom');
      expect(picker.state.validationError).toBe('');
    });

    it('supports single-bound date filters (start only or end only)', () => {
      const picker = createCustomPicker();
      picker.open();

      picker.setDraftStart('2026-10-15');
      picker.setDraftEnd('');

      const applied = picker.apply();
      expect(applied).toBe(true);
      expect(picker.state.isOpen).toBe(false);
      expect(picker.state.appliedStartDate).toBe('2026-10-15');
      expect(picker.state.appliedEndDate).toBe('');
    });

    it('cancel restores previously applied dates and discards draft modifications', () => {
      const picker = createCustomPicker('2026-09-01', '2026-09-30', 'custom');
      picker.open();

      // User types new dates
      picker.setDraftStart('2026-11-01');
      picker.setDraftEnd('2026-11-15');
      expect(picker.state.draftStartDate).toBe('2026-11-01');

      // User decides to cancel
      picker.cancel();
      expect(picker.state.isOpen).toBe(false);
      expect(picker.state.draftStartDate).toBe('2026-09-01');
      expect(picker.state.draftEndDate).toBe('2026-09-30');
      expect(picker.state.appliedStartDate).toBe('2026-09-01');
      expect(picker.state.appliedEndDate).toBe('2026-09-30');
      expect(picker.state.validationError).toBe('');
    });
  });

  describe('2. Backend Prisma Filter Translation for Custom Ranges & Presets', () => {
    it('correctly translates custom date range into IST boundaries (gte, lte)', () => {
      const boundary = getDateRangeBoundaries('custom', '2026-10-05', '2026-10-25');
      expect(boundary).not.toBeNull();
      expect(boundary?.gte).toBeInstanceOf(Date);
      expect(boundary?.lte).toBeInstanceOf(Date);

      // Verify gte starts at beginning of 2026-10-05 IST (00:00:00.000 IST -> 18:30:00.000 UTC prev day)
      // IST is UTC+5:30 -> 2026-10-05 00:00:00 IST is 2026-10-04 18:30:00.000 UTC
      expect(boundary?.gte?.toISOString()).toBe('2026-10-04T18:30:00.000Z');
      // 2026-10-25 23:59:59.999 IST is 2026-10-25 18:29:59.999 UTC
      expect(boundary?.lte?.toISOString()).toBe('2026-10-25T18:29:59.999Z');
    });

    it('buildPrismaDateFilter maps startDate and endDate query parameters', () => {
      const filter = buildPrismaDateFilter({
        dateRange: 'custom',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });

      expect(filter).toBeDefined();
      expect(filter?.gte).toBeInstanceOf(Date);
      expect(filter?.lte).toBeInstanceOf(Date);
      expect(filter!.gte!.getTime()).toBeLessThan(filter!.lte!.getTime());
    });

    it('buildPrismaDateFilter maps dateFrom and dateTo alias parameters', () => {
      const filter = buildPrismaDateFilter({
        dateFrom: '2026-12-01',
        dateTo: '2026-12-15',
      });

      expect(filter).toBeDefined();
      expect(filter?.gte).toBeInstanceOf(Date);
      expect(filter?.lte).toBeInstanceOf(Date);
    });

    it('handles standard presets: today, yesterday, thisweek, thismonth, thisquarter, thisyear', () => {
      const presets = ['today', 'yesterday', 'thisweek', 'thismonth', 'thisquarter', 'thisyear'];
      for (const preset of presets) {
        const boundary = getDateRangeBoundaries(preset);
        expect(boundary).not.toBeNull();
        expect(boundary?.gte).toBeInstanceOf(Date);
        expect(boundary?.lte).toBeInstanceOf(Date);
        expect(boundary!.gte!.getTime()).toBeLessThan(boundary!.lte!.getTime());
      }
    });

    it('returns null when no preset and no custom dates are specified', () => {
      const boundary = getDateRangeBoundaries('', '', '');
      expect(boundary).toBeNull();
    });
  });
});

