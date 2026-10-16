/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Dates } from 'app/core/utils/dates';
import { LoansService } from 'app/loans/loans.service';
import { RepaymentSchedule } from 'app/loans/models/loan-account.model';
import { SettingsService } from 'app/settings/settings.service';
import { environment } from 'environments/environment';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { MatCardHeader, MatCardTitle, MatCardContent } from '@angular/material/card';
import { RepaymentScheduleTabComponent } from '../loans-view/repayment-schedule-tab/repayment-schedule-tab.component';

@Component({
  selector: 'mifosx-loan-simulator',
  templateUrl: './loan-simulator.component.html',
  styleUrls: ['./loan-simulator.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    RepaymentScheduleTabComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoanSimulatorComponent implements OnInit {
  simulatorForm: FormGroup;
  loanProducts: any[] = [];
  loanProductTemplate: any = null;

  termFrequencyTypeOptions: any[] = [];
  amortizationTypeOptions: any[] = [];
  interestTypeOptions: any[] = [];
  interestCalculationPeriodTypeOptions: any[] = [];
  transactionProcessingStrategyOptions: any[] = [];

  repaymentScheduleDetails: RepaymentSchedule | null = null;
  currencyCode = 'USD';
  minDate = new Date(2000, 0, 1);
  maxDate = new Date(2100, 0, 1);

  private formBuilder = inject(FormBuilder);
  private loansService = inject(LoansService);
  private route = inject(ActivatedRoute);
  private settingsService = inject(SettingsService);
  private dateUtils = inject(Dates);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    this.createSimulatorForm();
  }

  ngOnInit(): void {
    this.route.data.subscribe((data: { loanProductsBasicDetails: any[] }) => {
      this.loanProducts = data.loanProductsBasicDetails || [];
    });
  }

  createSimulatorForm(): void {
    this.simulatorForm = this.formBuilder.group({
      clientId: [environment.defaultSimulatorClientId],
      productId: [
        '',
        Validators.required
      ],
      principal: [
        '',
        [
          Validators.required,
          Validators.min(0)
        ]
      ],
      numberOfRepayments: [
        '',
        [
          Validators.required,
          Validators.min(1)
        ]
      ],
      repaymentEvery: [
        '',
        [
          Validators.required,
          Validators.min(1)
        ]
      ],
      repaymentFrequencyType: [
        '',
        Validators.required
      ],
      interestRatePerPeriod: [
        '',
        [
          Validators.required,
          Validators.min(0)
        ]
      ],
      amortizationType: [
        '',
        Validators.required
      ],
      interestType: [
        '',
        Validators.required
      ],
      interestCalculationPeriodType: [
        '',
        Validators.required
      ],
      submittedOnDate: [
        this.settingsService.businessDate,
        Validators.required
      ],
      expectedDisbursementDate: [
        this.settingsService.businessDate,
        Validators.required
      ],
      transactionProcessingStrategyCode: ['']
    });
  }

  onProductChange(productId: number): void {
    if (!productId) {
      return;
    }
    const clientId = this.simulatorForm.get('clientId')?.value || environment.defaultSimulatorClientId;
    this.loansService.getLoansAccountTemplateResource(clientId, false, productId).subscribe((template: any) => {
      this.loanProductTemplate = template;
      this.termFrequencyTypeOptions = template.termFrequencyTypeOptions || [];
      this.amortizationTypeOptions = template.amortizationTypeOptions || [];
      this.interestTypeOptions = template.interestTypeOptions || [];
      this.interestCalculationPeriodTypeOptions = template.interestCalculationPeriodTypeOptions || [];
      this.transactionProcessingStrategyOptions = template.transactionProcessingStrategyOptions || [];
      this.currencyCode = template.currency?.code || 'USD';

      this.simulatorForm.patchValue({
        principal: template.principal,
        numberOfRepayments: template.numberOfRepayments,
        repaymentEvery: template.repaymentEvery,
        repaymentFrequencyType: template.repaymentFrequencyType?.id,
        interestRatePerPeriod: template.interestRatePerPeriod,
        amortizationType: template.amortizationType?.id,
        interestType: template.interestType?.id,
        interestCalculationPeriodType: template.interestCalculationPeriodType?.id,
        transactionProcessingStrategyCode:
          template.transactionProcessingStrategyCode || template.transactionProcessingStrategyId || ''
      });
      this.cdr.markForCheck();
    });
  }

  calculateSchedule(): void {
    if (this.simulatorForm.invalid) {
      this.simulatorForm.markAllAsTouched();
      return;
    }

    const val = this.simulatorForm.getRawValue();
    const effectiveClientId = val.clientId || environment.defaultSimulatorClientId;
    const submittedOnDate = this.dateUtils.formatDate(val.submittedOnDate, this.settingsService.dateFormat);
    const expectedDisbursementDate = this.dateUtils.formatDate(
      val.expectedDisbursementDate,
      this.settingsService.dateFormat
    );

    const payload: any = {
      clientId: Number(effectiveClientId),
      productId: Number(val.productId),
      principal: Number(val.principal),
      loanTermFrequency: Number(val.numberOfRepayments) * Number(val.repaymentEvery),
      loanTermFrequencyType: Number(val.repaymentFrequencyType),
      numberOfRepayments: Number(val.numberOfRepayments),
      repaymentEvery: Number(val.repaymentEvery),
      repaymentFrequencyType: Number(val.repaymentFrequencyType),
      interestRatePerPeriod: Number(val.interestRatePerPeriod),
      amortizationType: Number(val.amortizationType),
      interestType: Number(val.interestType),
      interestCalculationPeriodType: Number(val.interestCalculationPeriodType),
      submittedOnDate,
      expectedDisbursementDate,
      loanType: 'individual',
      dateFormat: this.settingsService.dateFormat,
      locale: this.settingsService.language.code
    };

    const strategy =
      val.transactionProcessingStrategyCode || this.loanProductTemplate?.transactionProcessingStrategyCode;
    if (strategy) {
      payload.transactionProcessingStrategyCode = strategy;
    }

    this.loansService.calculateLoanSchedule(payload).subscribe({
      next: (schedule: RepaymentSchedule) => {
        this.repaymentScheduleDetails = schedule;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error calculating loan schedule:', err);
      }
    });
  }
}
