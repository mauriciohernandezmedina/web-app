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
import { RepaymentSchedule, RepaymentSchedulePeriod } from '../models/loan-account.model';

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

  it('1. simulateBaseline() builds payload with loanTermVariations: [], saves baseline state and populates installmentsFormArray', () => {
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

    const firstRow = component.installmentsFormArray.at(0);
    expect(firstRow.get('period')?.value).toBe(1);
    expect(firstRow.get('proposedEmiAmount')?.value).toBe(1000);
    expect(firstRow.get('calculatedEmiAmount')?.value).toBe(1000);
    expect(firstRow.get('isEmiModified')?.value).toBe(false);
    expect(firstRow.get('isLastPeriod')?.value).toBe(false);

    const lastRow = component.installmentsFormArray.at(11);
    expect(lastRow.get('period')?.value).toBe(12);
    expect(lastRow.get('isLastPeriod')?.value).toBe(true);
  });

  it('2. applyJuneDecemberAssistant() adds juneExtraAmount (month 5) and decemberExtraAmount (month 11) to baselineEmi, excluding the last installment', () => {
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

    // Now test applyJuneDecemberAssistant
    component.applyJuneDecemberAssistant();

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

  it('3. recalculateWithVariations() in REDUCE_EMI mode keeps numberOfRepayments, sends only modified installments in variations, and updates reduced installments from backend', () => {
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
  });

  it('4. recalculateWithVariations() in REDUCE_TERM mode reduces numberOfRepayments = targetRepayments, anchors ordinary installments with emiAmount = baselineEmi (excluding targetRepayments), and executes RxJS convergence loop', () => {
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

    // Modify period 3: proposedEmiAmount = 3000 (extra principal = 2000)
    // estimatedReducedPeriods = floor(2000 / 1000) = 2
    // targetRepayments = 12 - 2 = 10
    const row3 = component.installmentsFormArray.at(2);
    row3.get('proposedEmiAmount')?.setValue(3000);

    // First call returns target = 10 schedule where the last period totalDueForPeriod = 1150 (> 1000 * 1.05 = 1050)
    const scheduleTarget10 = createMockSchedule(10, 1000);
    scheduleTarget10.periods[10].totalDueForPeriod = 1150; // exceeds 1.05 * baselineEmi

    // Second call for target = 11 returns convergent schedule
    const scheduleTarget11 = createMockSchedule(11, 1000);
    scheduleTarget11.periods[11].totalDueForPeriod = 980;

    loansServiceMock.calculateLoanSchedule
      .mockReturnValueOnce(of(scheduleTarget10))
      .mockReturnValueOnce(of(scheduleTarget11));

    component.recalculateWithVariations();

    // Verify 2 recalculation calls were made due to convergence (> 1.05 * baselineEmi)
    expect(loansServiceMock.calculateLoanSchedule).toHaveBeenCalledTimes(3); // 1 baseline + 2 recalculations

    // Call 1 of recalculate (target = 10):
    const firstRecalcPayload = loansServiceMock.calculateLoanSchedule.mock.calls[1][0];
    expect(firstRecalcPayload.numberOfRepayments).toBe(10);
    expect(firstRecalcPayload.loanTermFrequency).toBe(10);

    // Variations must contain:
    // periods 1..9 (period < 10)
    // Period 3 is modified with 3000
    // Periods 1, 2, 4..9 are anchored with 1000
    // Period 10 (targetRepayments) MUST NOT be included!
    const variationsTarget10 = firstRecalcPayload.loanTermVariations;
    expect(variationsTarget10.length).toBe(9);
    expect(variationsTarget10.some((v: any) => v.applicableFromDate === '2026-10-15')).toBe(false); // Period 10 excluded!

    const varPeriod3 = variationsTarget10.find((v: any) => v.applicableFromDate === '2026-03-15');
    expect(varPeriod3.decimalValue).toBe(3000);

    const varPeriod1 = variationsTarget10.find((v: any) => v.applicableFromDate === '2026-01-15');
    expect(varPeriod1.decimalValue).toBe(1000);

    // Call 2 of recalculate (converged to target = 11):
    const secondRecalcPayload = loansServiceMock.calculateLoanSchedule.mock.calls[2][0];
    expect(secondRecalcPayload.numberOfRepayments).toBe(11);
    expect(secondRecalcPayload.loanTermFrequency).toBe(11);

    // Final schedule in component has 11 periods
    expect(component.currentSchedule?.periods.filter((p) => (p.period ?? 0) >= 1).length).toBe(11);
    expect(component.installmentsSaved).toBe(1); // 12 - 11 = 1 installment saved
  });

  it('5. recalculateWithVariations() in REDUCE_TERM mode retries with targetRepayments - zeroPeriodsCount when response has periods with principalDue <= 0', () => {
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

    // Modify period 2 with extra payment: 2000 (totalExtraPrincipal = 1000, estimatedReduced = 1, target = 11)
    const row2 = component.installmentsFormArray.at(1);
    row2.get('proposedEmiAmount')?.setValue(2000);

    // First call returns target = 11, but period 11 has principalDue = 0 (1 zero period)
    const scheduleWithZeroPeriod = createMockSchedule(11, 1000);
    scheduleWithZeroPeriod.periods[11].principalDue = 0;
    scheduleWithZeroPeriod.periods[11].totalDueForPeriod = 50;

    // Second call for target = 10 returns cleanly
    const scheduleTarget10 = createMockSchedule(10, 1000);

    loansServiceMock.calculateLoanSchedule
      .mockReturnValueOnce(of(scheduleWithZeroPeriod))
      .mockReturnValueOnce(of(scheduleTarget10));

    component.recalculateWithVariations();

    // Verifies retry with targetRepayments - 1 = 10
    const retryPayload = loansServiceMock.calculateLoanSchedule.mock.calls[2][0];
    expect(retryPayload.numberOfRepayments).toBe(10);
    expect(component.installmentsSaved).toBe(2); // 12 - 10 = 2 installments saved
  });
});

