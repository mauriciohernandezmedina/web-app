/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { jest } from '@jest/globals';

jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    save: jest.fn()
  }))
}));

jest.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: jest.fn()
}));
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { Dates } from 'app/core/utils/dates';
import { LoansService } from 'app/loans/loans.service';
import { SettingsService } from 'app/settings/settings.service';
import { LoanSimulatorComponent } from './loan-simulator.component';

describe('LoanSimulatorComponent', () => {
  const businessDate = new Date(2025, 0, 15);
  const mockProducts = [
    { id: 10, name: 'Standard Loan' },
    { id: 20, name: 'Micro Loan' }
  ];

  const mockProductTemplate = {
    principal: 10000,
    numberOfRepayments: 12,
    repaymentEvery: 1,
    repaymentFrequencyType: { id: 2, value: 'Months' },
    interestRatePerPeriod: 12,
    amortizationType: { id: 1, value: 'Equal installments' },
    interestType: { id: 0, value: 'Declining Balance' },
    interestCalculationPeriodType: { id: 1, value: 'Same as repayment period' },
    transactionProcessingStrategyCode: 'mifos-standard-strategy',
    termFrequencyTypeOptions: [{ id: 2, value: 'Months' }],
    amortizationTypeOptions: [{ id: 1, value: 'Equal installments' }],
    interestTypeOptions: [{ id: 0, value: 'Declining Balance' }],
    interestCalculationPeriodTypeOptions: [{ id: 1, value: 'Same as repayment period' }],
    currency: { code: 'USD' }
  };

  const mockScheduleResponse = {
    totalPrincipalDisbursed: 10000,
    totalInterestCharged: 650,
    totalFeeChargesCharged: 0,
    totalRepaymentExpected: 10650,
    periods: [] as any[]
  };

  let loansServiceStub: any;

  function createComponent(): LoanSimulatorComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: ChangeDetectorRef, useValue: { markForCheck: jest.fn() } },
        { provide: ActivatedRoute, useValue: { data: of({ loanProductsBasicDetails: mockProducts }) } },
        { provide: LoansService, useValue: loansServiceStub },
        { provide: SettingsService, useValue: { businessDate, dateFormat: 'yyyy-MM-dd', language: { code: 'en' } } },
        {
          provide: Dates,
          useValue: {
            formatDate: (date: any) => (date instanceof Date ? '2025-01-15' : String(date))
          }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new LoanSimulatorComponent());
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    loansServiceStub = {
      getLoansAccountTemplateResource: jest.fn().mockReturnValue(of(mockProductTemplate)),
      calculateLoanSchedule: jest.fn().mockReturnValue(of(mockScheduleResponse))
    };
  });

  it('should initialize form and load loan products from route resolver', () => {
    const component = createComponent();

    expect(component.simulatorForm).toBeDefined();
    expect(component.simulatorForm.get('clientId')?.value).toBe(1);
    expect(component.loanProducts).toEqual(mockProducts);
  });

  it('should update form controls with template defaults when a product is selected', () => {
    const component = createComponent();

    component.onProductChange(10);

    expect(loansServiceStub.getLoansAccountTemplateResource).toHaveBeenCalledWith(1, false, 10);
    expect(component.simulatorForm.get('principal')?.value).toBe(10000);
    expect(component.simulatorForm.get('numberOfRepayments')?.value).toBe(12);
    expect(component.simulatorForm.get('interestRatePerPeriod')?.value).toBe(12);
    expect(component.currencyCode).toBe('USD');
  });

  it('should build payload and call calculateLoanSchedule when form is submitted', () => {
    const component = createComponent();
    component.simulatorForm.patchValue({ productId: 10 });
    component.onProductChange(10);

    component.calculateSchedule();

    expect(loansServiceStub.calculateLoanSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 1,
        productId: 10,
        principal: 10000,
        numberOfRepayments: 12,
        repaymentEvery: 1,
        loanTermFrequency: 12,
        interestRatePerPeriod: 12,
        submittedOnDate: '2025-01-15',
        expectedDisbursementDate: '2025-01-15',
        transactionProcessingStrategyCode: 'mifos-standard-strategy'
      })
    );
    expect(component.repaymentScheduleDetails).toEqual(mockScheduleResponse);
  });

  it('should not call calculateLoanSchedule when form is invalid', () => {
    const component = createComponent();

    component.calculateSchedule();

    expect(loansServiceStub.calculateLoanSchedule).not.toHaveBeenCalled();
  });
});
