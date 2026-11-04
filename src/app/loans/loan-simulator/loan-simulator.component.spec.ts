/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LoanSimulatorComponent } from './loan-simulator.component';
import { LoansService } from 'app/loans/loans.service';
import { SettingsService } from 'app/settings/settings.service';
import { Dates } from 'app/core/utils/dates';
import { RepaymentSchedule } from '../models/loan-account.model';

const mockSave = jest.fn();
const mockSetFontSize = jest.fn();
const mockText = jest.fn();

jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    setFontSize: mockSetFontSize,
    text: mockText,
    save: mockSave
  }))
}));

const mockAutoTable = jest.fn();
jest.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: (...args: any[]) => mockAutoTable(...args)
}));

describe('LoanSimulatorComponent', () => {
  let component: LoanSimulatorComponent;
  let fixture: ComponentFixture<LoanSimulatorComponent>;
  let loansServiceMock: {
    calculateLoanSchedule: jest.Mock;
    getLoansAccountTemplateResource: jest.Mock;
  };
  let settingsServiceMock: any;
  let datesMock: any;

  function createMockSchedule(
    numPeriods: number,
    emi = 1000,
    startYear = 2026,
    startMonth = 1
  ): RepaymentSchedule {
    const periods: any[] = [
      {
        period: 0,
        dueDate: [startYear, 1, 15],
        principalDisbursed: numPeriods * emi,
        principalLoanBalanceOutstanding: numPeriods * emi,
        totalDueForPeriod: 0
      }
    ];

    for (let i = 1; i <= numPeriods; i++) {
      const totalMonths = startMonth - 1 + (i - 1);
      const year = startYear + Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;
      const dueDate = [year, month, 15];

      periods.push({
        period: i,
        dueDate,
        principalDue: emi * 0.8,
        interestDue: emi * 0.2,
        totalDueForPeriod: emi,
        principalLoanBalanceOutstanding: Math.max(0, (numPeriods - i) * emi * 0.8)
      });
    }

    return {
      totalPrincipalDisbursed: numPeriods * emi,
      totalPrincipalExpected: numPeriods * emi * 0.8,
      totalInterestCharged: numPeriods * emi * 0.2,
      totalRepaymentExpected: numPeriods * emi,
      periods
    } as unknown as RepaymentSchedule;
  }

  beforeEach(() => {
    mockSave.mockClear();
    mockSetFontSize.mockClear();
    mockText.mockClear();
    mockAutoTable.mockClear();

    loansServiceMock = {
      calculateLoanSchedule: jest.fn(),
      getLoansAccountTemplateResource: jest.fn()
    };

    settingsServiceMock = {
      dateFormat: 'yyyy-MM-dd',
      language: { name: 'English', code: 'en' },
      languageCode: 'en-US',
      businessDate: new Date('2026-01-15')
    };

    datesMock = {
      formatDate: jest.fn((date: any, _fmt?: string) => {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }),
      parseDate: jest.fn((val: any) => {
        if (val instanceof Date) return val;
        if (Array.isArray(val)) {
          return new Date(val[0], val[1] - 1, val[2]);
        }
        if (typeof val === 'string' && val.includes('-')) {
          const parts = val.split('-');
          return new Date(+parts[0], +parts[1] - 1, +parts[2]);
        }
        return new Date(val);
      }),
      angularToMomentFormat: jest.fn(() => 'YYYY-MM-DD'),
      getMomentLocale: jest.fn(() => 'en')
    };

    TestBed.configureTestingModule({
      imports: [
        LoanSimulatorComponent,
        NoopAnimationsModule,
        MatNativeDateModule,
        TranslateModule.forRoot()
      ],
      providers: [
        { provide: LoansService, useValue: loansServiceMock },
        { provide: SettingsService, useValue: settingsServiceMock },
        { provide: Dates, useValue: datesMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                loanProductsBasicDetails: [{ id: 10, name: 'Personal Loan' }]
              }
            }
          }
        }
      ]
    });

    fixture = TestBed.createComponent(LoanSimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('1. simulateBaseline() builds payload with loanTermVariations: [], saves baseline state, populates installmentsFormArray and updates tableDataSource', () => {
    const mockSchedule = createMockSchedule(12, 1000);
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(mockSchedule));

    component.simulatorForm.patchValue({
      clientId: 1,
      productId: 10,
      principal: 12000,
      numberOfRepayments: 12,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      loanTermFrequency: 12,
      loanTermFrequencyType: 2,
      interestRatePerPeriod: 1.5,
      expectedDisbursementDate: new Date('2026-01-15'),
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy'
    });

    component.simulateBaseline();

    expect(loansServiceMock.calculateLoanSchedule).toHaveBeenCalledTimes(1);
    const sentPayload = loansServiceMock.calculateLoanSchedule.mock.calls[0][0];

    expect(sentPayload.loanTermVariations).toEqual([]);
    expect(sentPayload.locale).toBe('en');
    expect(sentPayload.dateFormat).toBe('yyyy-MM-dd');
    expect(sentPayload.numberOfRepayments).toBe(12);
    expect(sentPayload.principal).toBe(12000);

    expect(component.baselineSchedule).toBeDefined();
    expect(component.baselineSchedule?.totalInterestCharged).toBe(mockSchedule.totalInterestCharged);
    expect(component.originalNumberOfRepayments).toBe(12);
    expect(component.baselineEmi).toBe(1000);
    expect(component.installmentsFormArray.length).toBe(12);

    // Verify tableDataSource is updated with the same elements
    expect(component.tableDataSource.length).toBe(12);
    expect(component.tableDataSource[0]).toBe(component.installmentsFormArray.at(0));

    const firstRow = component.installmentsFormArray.at(0);
    expect(firstRow.get('period')?.value).toBe(1);
    expect(firstRow.get('proposedEmiAmount')?.value).toBe(1000);
    expect(firstRow.get('calculatedEmiAmount')?.value).toBe(1000);
    expect(firstRow.get('isEmiModified')?.value).toBe(false);
    expect(firstRow.get('isLastPeriod')?.value).toBe(false);

    // Test onInstallmentEmiChange
    component.onInstallmentEmiChange(firstRow);
    expect(firstRow.get('isEmiModified')?.value).toBe(true);

    const lastRow = component.installmentsFormArray.at(11);
    expect(lastRow.get('period')?.value).toBe(12);
    expect(lastRow.get('isLastPeriod')?.value).toBe(true);
  });

  it('2. applyJuneDecemberAssistant() restores baseline periods first, adds juneExtraAmount and decemberExtraAmount, excluding the last installment', () => {
    // 14 periods starting in January 2026:
    // Period 6 -> June 2026 (month 5) -> June extra
    // Period 12 -> December 2026 (month 11) -> December extra
    // Period 14 -> February 2027 (month 1) -> Last installment
    const mockSchedule = createMockSchedule(14, 1000, 2026, 1);
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(mockSchedule));

    component.simulatorForm.patchValue({
      clientId: 1,
      productId: 10,
      principal: 14000,
      numberOfRepayments: 14,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      loanTermFrequency: 14,
      loanTermFrequencyType: 2,
      interestRatePerPeriod: 1.5,
      expectedDisbursementDate: new Date('2026-01-15'),
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      juneExtraAmount: 300,
      decemberExtraAmount: 500
    });

    component.simulateBaseline();

    // Simulate that installmentsFormArray was previously truncated (e.g. from a REDUCE_TERM simulation)
    while (component.installmentsFormArray.length > 10) {
      component.installmentsFormArray.removeAt(component.installmentsFormArray.length - 1);
    }
    expect(component.installmentsFormArray.length).toBe(10);

    // applyJuneDecemberAssistant must restore all 14 baseline periods before applying extras
    component.applyJuneDecemberAssistant();
    expect(component.installmentsFormArray.length).toBe(14);
    expect(component.tableDataSource.length).toBe(14);

    // Period 6 (index 5) is June 2026 (month 5)
    const juneRow = component.installmentsFormArray.at(5);
    expect(new Date(juneRow.get('proposedDueDate')?.value).getMonth()).toBe(5);
    expect(juneRow.get('proposedEmiAmount')?.value).toBe(1300);
    expect(juneRow.get('isEmiModified')?.value).toBe(true);

    // Period 12 (index 11) is December 2026 (month 11)
    const decemberRow = component.installmentsFormArray.at(11);
    expect(new Date(decemberRow.get('proposedDueDate')?.value).getMonth()).toBe(11);
    expect(decemberRow.get('proposedEmiAmount')?.value).toBe(1500);
    expect(decemberRow.get('isEmiModified')?.value).toBe(true);

    // Period 14 (index 13) is the last installment -> must be excluded from assistant modification
    const lastRow = component.installmentsFormArray.at(13);
    expect(lastRow.get('isLastPeriod')?.value).toBe(true);
    expect(lastRow.get('isEmiModified')?.value).toBe(false);

    // Also verify when December IS the last period (e.g., exactly 12 periods Jan-Dec):
    const twelvePeriodSchedule = createMockSchedule(12, 1000, 2026, 1);
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(twelvePeriodSchedule));
    component.simulatorForm.patchValue({ numberOfRepayments: 12, loanTermFrequency: 12 });
    component.simulateBaseline();
    component.applyJuneDecemberAssistant();

    const p12Last = component.installmentsFormArray.at(11);
    expect(p12Last.get('isLastPeriod')?.value).toBe(true);
    expect(new Date(p12Last.get('proposedDueDate')?.value).getMonth()).toBe(11);
    // Period 12 in a 12-month schedule is the last period, so it remains unmodified
    expect(p12Last.get('isEmiModified')?.value).toBe(false);
  });

  it('3. recalculateWithVariations() in REDUCE_EMI mode keeps numberOfRepayments = originalNumberOfRepayments, sends only modified installments in variations, and updates reduced installments and tableDataSource', () => {
    const mockSchedule = createMockSchedule(12, 1000);
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(mockSchedule));

    component.simulatorForm.patchValue({
      clientId: 1,
      productId: 10,
      principal: 12000,
      numberOfRepayments: 12,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      loanTermFrequency: 12,
      loanTermFrequencyType: 2,
      interestRatePerPeriod: 1.5,
      expectedDisbursementDate: new Date('2026-01-15'),
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      extraRepaymentEffect: 'REDUCE_EMI'
    });

    component.simulateBaseline();

    // Modify period 3 with extra payment (proposedEmiAmount = 1500)
    const row3 = component.installmentsFormArray.at(2);
    row3.get('proposedEmiAmount')?.setValue(1500);

    // Backend returns recalculated schedule where periods 4..12 have reduced totalDueForPeriod = 940
    const recalculatedSchedule: RepaymentSchedule = {
      ...mockSchedule,
      periods: mockSchedule.periods.map((p) => {
        if ((p.period ?? 0) === 3) {
          return { ...p, totalDueForPeriod: 1500 };
        } else if ((p.period ?? 0) > 3) {
          return { ...p, totalDueForPeriod: 940 };
        }
        return p;
      })
    };
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(recalculatedSchedule));

    component.recalculateWithVariations();

    const sentPayload = loansServiceMock.calculateLoanSchedule.mock.calls[1][0];
    expect(sentPayload.numberOfRepayments).toBe(12);
    expect(sentPayload.loanTermFrequency).toBe(12);
    // Only period 3 was modified
    expect(sentPayload.loanTermVariations.length).toBe(1);
    expect(sentPayload.loanTermVariations[0]).toEqual({
      termType: 'emiAmount',
      applicableFromDate: '2026-03-15',
      decimalValue: 1500,
      isSpecificToInstallment: true
    });

    // Verify table updates visually with reduced EMIs for unmodified future periods
    const updatedRow3 = component.installmentsFormArray.at(2);
    expect(updatedRow3.get('proposedEmiAmount')?.value).toBe(1500);
    expect(updatedRow3.get('isEmiModified')?.value).toBe(true);

    const updatedRow4 = component.installmentsFormArray.at(3);
    expect(updatedRow4.get('proposedEmiAmount')?.value).toBe(940);
    expect(updatedRow4.get('calculatedEmiAmount')?.value).toBe(940);
    expect(updatedRow4.get('isEmiModified')?.value).toBe(false);

    const updatedRow12 = component.installmentsFormArray.at(11);
    expect(updatedRow12.get('proposedEmiAmount')?.value).toBe(940);
    expect(updatedRow12.get('isEmiModified')?.value).toBe(false);

    // Verify tableDataSource reflects the updated rows
    expect(component.tableDataSource.length).toBe(12);
    expect(component.tableDataSource[3].get('proposedEmiAmount')?.value).toBe(940);
  });

  it('4. recalculateWithVariations() in REDUCE_TERM mode sends originalNumberOfRepayments, anchors ordinary unmodified installments with baselineEmi (excluding targetRepayments), and updates installmentsSaved and tableDataSource', () => {
    const mockSchedule = createMockSchedule(12, 1000);
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(mockSchedule));

    component.simulatorForm.patchValue({
      clientId: 1,
      productId: 10,
      principal: 12000,
      numberOfRepayments: 12,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      loanTermFrequency: 12,
      loanTermFrequencyType: 2,
      interestRatePerPeriod: 1.5,
      expectedDisbursementDate: new Date('2026-01-15'),
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      extraRepaymentEffect: 'REDUCE_TERM'
    });

    component.simulateBaseline();

    // Modify period 3: proposedEmiAmount = 3000
    const row3 = component.installmentsFormArray.at(2);
    row3.get('proposedEmiAmount')?.setValue(3000);

    // Backend terminates loan schedule at period 10 because extra principal amortized loan faster
    const schedule10Periods = createMockSchedule(10, 1000);
    schedule10Periods.periods[3].totalDueForPeriod = 3000;
    schedule10Periods.periods[10].totalDueForPeriod = 750; // final settlement installment
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(schedule10Periods));

    component.recalculateWithVariations();

    const sentPayload = loansServiceMock.calculateLoanSchedule.mock.calls[1][0];
    // Payload retains originalNumberOfRepayments = 12
    expect(sentPayload.numberOfRepayments).toBe(12);
    expect(sentPayload.loanTermFrequency).toBe(12);

    // Variations must contain:
    // periods 1..11 (period < 12)
    // Period 3 is modified with 3000
    // Periods 1, 2, 4..11 are anchored with baselineEmi = 1000
    // Period 12 (originalNumberOfRepayments) MUST NOT be included!
    const variations = sentPayload.loanTermVariations;
    expect(variations.length).toBe(11);
    expect(variations.some((v: any) => v.applicableFromDate === '2026-12-15')).toBe(false); // Period 12 excluded!

    const varPeriod3 = variations.find((v: any) => v.applicableFromDate === '2026-03-15');
    expect(varPeriod3.decimalValue).toBe(3000);

    const varPeriod1 = variations.find((v: any) => v.applicableFromDate === '2026-01-15');
    expect(varPeriod1.decimalValue).toBe(1000);

    // Final schedule has 10 periods returned by Fineract
    expect(component.currentSchedule?.periods.filter((p) => (p.period ?? 0) >= 1).length).toBe(10);
    expect(component.installmentsSaved).toBe(2); // 12 - 10 = 2 installments saved
    expect(component.tableDataSource.length).toBe(10);
  });

  it('5. Changing extraRepaymentEffect automatically triggers recalculateWithVariations() when baselineSchedule exists', () => {
    const mockSchedule = createMockSchedule(12, 1000);
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(mockSchedule));

    component.simulatorForm.patchValue({
      clientId: 1,
      productId: 10,
      principal: 12000,
      numberOfRepayments: 12,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      loanTermFrequency: 12,
      loanTermFrequencyType: 2,
      interestRatePerPeriod: 1.5,
      expectedDisbursementDate: new Date('2026-01-15'),
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      extraRepaymentEffect: 'REDUCE_EMI'
    });

    component.simulateBaseline();
    expect(loansServiceMock.calculateLoanSchedule).toHaveBeenCalledTimes(1);

    // Changing extraRepaymentEffect triggers recalculateWithVariations
    component.simulatorForm.get('extraRepaymentEffect')?.setValue('REDUCE_TERM');
    expect(loansServiceMock.calculateLoanSchedule).toHaveBeenCalledTimes(2);
  });

  it('6. onProductChange() uses fallback principal 10000 when template has no principal', () => {
    loansServiceMock.getLoansAccountTemplateResource.mockReturnValue(
      of({
        currency: { code: 'EUR' },
        numberOfRepayments: 24,
        repaymentEvery: 1,
        interestRatePerPeriod: 2.0
      })
    );

    component.onProductChange(10);

    expect(component.currencyCode).toBe('EUR');
    expect(component.simulatorForm.get('principal')?.value).toBe(10000);
    expect(component.simulatorForm.get('numberOfRepayments')?.value).toBe(24);
  });

  it('7. displayedColumns does not include proposedInterestRate', () => {
    expect(component.displayedColumns).not.toContain('proposedInterestRate');
    expect(component.displayedColumns).toEqual([
      'period',
      'dueDate',
      'proposedDueDate',
      'principalDue',
      'interestDue',
      'proposedEmiAmount',
      'balanceOfLoan'
    ]);
  });

  it('8. exportToPDF() exits early if currentSchedule is null, and generates/saves PDF when currentSchedule exists', () => {
    // 1. Without currentSchedule
    component.currentSchedule = null;
    component.exportToPDF();
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockAutoTable).not.toHaveBeenCalled();

    // 2. With currentSchedule
    const mockSchedule = createMockSchedule(12, 1000);
    loansServiceMock.calculateLoanSchedule.mockReturnValue(of(mockSchedule));
    component.simulatorForm.patchValue({
      clientId: 1,
      productId: 10,
      principal: 12000,
      numberOfRepayments: 12,
      repaymentEvery: 1,
      repaymentFrequencyType: 2,
      loanTermFrequency: 12,
      loanTermFrequencyType: 2,
      interestRatePerPeriod: 1.5,
      expectedDisbursementDate: new Date('2026-01-15'),
      amortizationType: 1,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy'
    });
    component.simulateBaseline();

    component.exportToPDF();

    expect(mockSetFontSize).toHaveBeenCalled();
    expect(mockText).toHaveBeenCalled();
    expect(mockAutoTable).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      expect.stringMatching(/^loan-simulation-\d{4}-\d{2}-\d{2}\.pdf$/)
    );
  });
});
