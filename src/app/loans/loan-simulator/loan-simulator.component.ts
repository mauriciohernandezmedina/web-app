/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  MatCard,
  MatCardHeader,
  MatCardTitle,
  MatCardContent,
  MatCardActions
} from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatRadioModule } from '@angular/material/radio';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

import { Dates } from 'app/core/utils/dates';
import { LoansService } from 'app/loans/loans.service';
import { SettingsService } from 'app/settings/settings.service';
import { environment } from 'environments/environment';
import {
  ExtraRepaymentEffectMode,
  LoanScheduleSimulationPayload,
  LoanTermVariationItem,
  RepaymentSchedule,
  RepaymentSchedulePeriod
} from '../models/loan-account.model';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { FormatNumberPipe } from 'app/pipes/format-number.pipe';

@Component({
  selector: 'mifosx-loan-simulator',
  templateUrl: './loan-simulator.component.html',
  styleUrls: ['./loan-simulator.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatCardActions,
    MatTableModule,
    MatRadioModule,
    MatIcon,
    MatProgressBar,
    CurrencyPipe,
    DecimalPipe,
    FormatNumberPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoanSimulatorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private loansService = inject(LoansService);
  private settingsService = inject(SettingsService);
  private dateUtils = inject(Dates);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  loanProducts: any[] = [];
  productTemplate: any | null = null;
  currencyCode = 'USD';
  baselineSchedule: RepaymentSchedule | null = null;
  currentSchedule: RepaymentSchedule | null = null;
  originalNumberOfRepayments = 0;
  baselineEmi = 0;
  baselinePeriods: RepaymentSchedulePeriod[] = [];
  isLoading = false;

  simulatorForm!: FormGroup;
  installmentsFormArray: FormArray<FormGroup> = this.fb.array<FormGroup>([]);

  displayedColumns: string[] = [
    'period',
    'dueDate',
    'proposedDueDate',
    'principalDue',
    'interestDue',
    'proposedEmiAmount',
    'proposedInterestRate',
    'balanceOfLoan'
  ];

  ngOnInit(): void {
    this.loanProducts = this.route.snapshot.data['loanProductsBasicDetails'] || [];
    this.initForm();
  }

  resolveDefaultClientId(): number {
    return (environment as any).defaultSimulatorClientId || 1;
  }

  private initForm(): void {
    this.simulatorForm = this.fb.group({
      clientId: [this.resolveDefaultClientId(), [Validators.required]],
      productId: [null, [Validators.required]],
      principal: [null, [Validators.required, Validators.min(1)]],
      numberOfRepayments: [null, [Validators.required, Validators.min(1)]],
      repaymentEvery: [1, [Validators.required, Validators.min(1)]],
      repaymentFrequencyType: [2, [Validators.required]],
      loanTermFrequency: [null, [Validators.required, Validators.min(1)]],
      loanTermFrequencyType: [2, [Validators.required]],
      interestRatePerPeriod: [null, [Validators.required, Validators.min(0)]],
      expectedDisbursementDate: [this.settingsService.businessDate, [Validators.required]],
      amortizationType: [1, [Validators.required]],
      interestType: [0, [Validators.required]],
      interestCalculationPeriodType: [1, [Validators.required]],
      transactionProcessingStrategyCode: ['mifos-standard-strategy', [Validators.required]],
      extraRepaymentEffect: ['REDUCE_EMI' as ExtraRepaymentEffectMode, [Validators.required]],
      juneExtraAmount: [0, [Validators.min(0)]],
      decemberExtraAmount: [0, [Validators.min(0)]]
    });

    this.simulatorForm
      .get('numberOfRepayments')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((num) => {
        const every = this.simulatorForm.get('repaymentEvery')?.value || 1;
        if (num) {
          this.simulatorForm.get('loanTermFrequency')?.setValue(num * every, { emitEvent: false });
        }
      });

    this.simulatorForm
      .get('repaymentEvery')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((every) => {
        const num = this.simulatorForm.get('numberOfRepayments')?.value || 1;
        if (every) {
          this.simulatorForm.get('loanTermFrequency')?.setValue(num * every, { emitEvent: false });
        }
      });
  }

  onProductChange(productId: number): void {
    if (!productId) {
      return;
    }
    const clientId = this.simulatorForm.get('clientId')?.value || this.resolveDefaultClientId();
    this.isLoading = true;
    this.loansService.getLoansAccountTemplateResource(clientId, false, productId).subscribe({
      next: (template: any) => {
        this.productTemplate = template;
        this.currencyCode = template.currency?.code || 'USD';
        const numberOfRepayments = template.numberOfRepayments ?? 12;
        const repaymentEvery = template.repaymentEvery ?? 1;
        const repaymentFrequencyType = template.repaymentFrequencyType?.id ?? 2;
        const loanTermFrequency = (numberOfRepayments * repaymentEvery) || template.termFrequency || 12;
        const loanTermFrequencyType = template.termPeriodFrequencyType?.id ?? repaymentFrequencyType;

        this.simulatorForm.patchValue({
          principal: template.principal ?? null,
          numberOfRepayments,
          repaymentEvery,
          repaymentFrequencyType,
          loanTermFrequency,
          loanTermFrequencyType,
          interestRatePerPeriod: template.interestRatePerPeriod ?? null,
          amortizationType: template.amortizationType?.id ?? 1,
          interestType: template.interestType?.id ?? 0,
          interestCalculationPeriodType: template.interestCalculationPeriodType?.id ?? 1,
          transactionProcessingStrategyCode:
            template.transactionProcessingStrategyCode || 'mifos-standard-strategy'
        });
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  simulateBaseline(): void {
    if (this.simulatorForm.invalid) {
      this.simulatorForm.markAllAsTouched();
      return;
    }
    const formVal = this.simulatorForm.value;
    const dateFormat = this.settingsService.dateFormat;
    const locale = this.settingsService.language?.code || 'en';
    const expectedDisbursementDate = this.dateUtils.formatDate(
      formVal.expectedDisbursementDate,
      dateFormat
    );

    const payload: LoanScheduleSimulationPayload = {
      clientId: +formVal.clientId,
      productId: +formVal.productId,
      loanType: 'individual',
      locale,
      dateFormat,
      principal: +formVal.principal,
      loanTermFrequency: +formVal.loanTermFrequency,
      loanTermFrequencyType: +formVal.loanTermFrequencyType,
      numberOfRepayments: +formVal.numberOfRepayments,
      repaymentEvery: +formVal.repaymentEvery,
      repaymentFrequencyType: +formVal.repaymentFrequencyType,
      interestRatePerPeriod: +formVal.interestRatePerPeriod,
      amortizationType: +formVal.amortizationType,
      interestType: +formVal.interestType,
      interestCalculationPeriodType: +formVal.interestCalculationPeriodType,
      expectedDisbursementDate,
      submittedOnDate: expectedDisbursementDate,
      transactionProcessingStrategyCode: formVal.transactionProcessingStrategyCode,
      loanTermVariations: []
    };

    this.isLoading = true;
    this.loansService.calculateLoanSchedule(payload).subscribe({
      next: (response: RepaymentSchedule) => {
        this.baselineSchedule = JSON.parse(JSON.stringify(response));
        this.currentSchedule = response;
        this.baselinePeriods = (response.periods || []).filter((p) => (p.period ?? 0) >= 1);
        this.originalNumberOfRepayments = this.baselinePeriods.length;
        this.baselineEmi = this.baselinePeriods[0]?.totalDueForPeriod ?? 0;
        this.populateInstallmentsFormArray(this.baselinePeriods);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private populateInstallmentsFormArray(periods: RepaymentSchedulePeriod[]): void {
    this.installmentsFormArray.clear();
    const dateFormat = this.settingsService.dateFormat;
    const total = periods.length;

    periods.forEach((p, idx) => {
      const isLast = idx === total - 1;
      const dateObj = this.dateUtils.parseDate(p.dueDate);
      const originalDueDateStr = this.dateUtils.formatDate(dateObj, dateFormat);

      const group = this.fb.group({
        period: [p.period],
        originalDueDate: [originalDueDateStr],
        proposedDueDate: [dateObj, [Validators.required]],
        proposedEmiAmount: [p.totalDueForPeriod, [Validators.required, Validators.min(0)]],
        calculatedEmiAmount: [p.totalDueForPeriod],
        isEmiModified: [false],
        proposedInterestRate: [null],
        isLastPeriod: [isLast],
        principalDue: [p.principalDue ?? 0],
        interestDue: [p.interestDue ?? 0],
        balanceOfLoan: [p.principalLoanBalanceOutstanding ?? 0]
      });

      this.installmentsFormArray.push(group);
    });
  }

  applyJuneDecemberAssistant(): void {
    const formVal = this.simulatorForm.value;
    const juneExtra = +(formVal.juneExtraAmount || 0);
    const decemberExtra = +(formVal.decemberExtraAmount || 0);
    const total = this.installmentsFormArray.length;

    this.installmentsFormArray.controls.forEach((control, index) => {
      if (index === total - 1) {
        return;
      }
      const proposedDate: Date = control.get('proposedDueDate')?.value;
      if (!proposedDate) {
        return;
      }
      const month = new Date(proposedDate).getMonth();
      if (month === 5 && juneExtra > 0) {
        control.get('proposedEmiAmount')?.setValue(+(this.baselineEmi + juneExtra).toFixed(2));
        control.get('isEmiModified')?.setValue(true);
      } else if (month === 11 && decemberExtra > 0) {
        control.get('proposedEmiAmount')?.setValue(+(this.baselineEmi + decemberExtra).toFixed(2));
        control.get('isEmiModified')?.setValue(true);
      }
    });

    this.recalculateWithVariations();
  }

  isRowEmiModified(control: AbstractControl): boolean {
    return (
      Boolean(control.get('isEmiModified')?.value) ||
      Math.abs(
        +(control.get('proposedEmiAmount')?.value ?? 0) -
          +(control.get('calculatedEmiAmount')?.value ?? this.baselineEmi)
      ) > 0.01
    );
  }

  buildVariationsForTarget(
    targetRepayments: number,
    mode: ExtraRepaymentEffectMode
  ): LoanTermVariationItem[] {
    const variations: LoanTermVariationItem[] = [];
    const dateFormat = this.settingsService.dateFormat;
    const baseRate = +(this.simulatorForm.get('interestRatePerPeriod')?.value ?? 0);

    this.installmentsFormArray.controls.forEach((control, i) => {
      const period = control.get('period')?.value;
      if (period >= targetRepayments) {
        return;
      }

      const baselinePeriod = this.baselinePeriods[i];
      const applicableFromDate = baselinePeriod?.dueDate
        ? this.dateUtils.formatDate(this.dateUtils.parseDate(baselinePeriod.dueDate), dateFormat)
        : control.get('originalDueDate')?.value;

      const proposedDueDate: Date = control.get('proposedDueDate')?.value;
      const formattedProposedDueDate = proposedDueDate
        ? this.dateUtils.formatDate(proposedDueDate, dateFormat)
        : applicableFromDate;

      if (formattedProposedDueDate !== applicableFromDate) {
        variations.push({
          termType: 'dueDate',
          applicableFromDate,
          dateValue: formattedProposedDueDate,
          isSpecificToInstallment: true
        });
      }

      const proposedInterestRate = control.get('proposedInterestRate')?.value;
      if (
        proposedInterestRate !== null &&
        proposedInterestRate !== undefined &&
        proposedInterestRate !== ''
      ) {
        if (Math.abs(+proposedInterestRate - baseRate) > 0.0001) {
          variations.push({
            termType: 'interestRateFromInstallment',
            applicableFromDate,
            decimalValue: +proposedInterestRate,
            isSpecificToInstallment: false
          });
        }
      }

      const proposedEmiAmount = +(control.get('proposedEmiAmount')?.value ?? 0);
      const isEmiModified = this.isRowEmiModified(control);
      if (isEmiModified) {
        variations.push({
          termType: 'emiAmount',
          applicableFromDate,
          decimalValue: +proposedEmiAmount,
          isSpecificToInstallment: true
        });
      } else if (mode === 'REDUCE_TERM') {
        variations.push({
          termType: 'emiAmount',
          applicableFromDate,
          decimalValue: +this.baselineEmi,
          isSpecificToInstallment: true
        });
      }
    });

    return variations;
  }

  recalculateWithVariations(): void {
    if (!this.baselineSchedule) {
      return;
    }
    const formVal = this.simulatorForm.value;
    const mode: ExtraRepaymentEffectMode = formVal.extraRepaymentEffect;
    const dateFormat = this.settingsService.dateFormat;
    const locale = this.settingsService.language?.code || 'en';
    const expectedDisbursementDate = this.dateUtils.formatDate(
      formVal.expectedDisbursementDate,
      dateFormat
    );
    const repaymentEvery = +formVal.repaymentEvery;

    this.isLoading = true;

    if (mode === 'REDUCE_EMI') {
      const payload: LoanScheduleSimulationPayload = {
        clientId: +formVal.clientId,
        productId: +formVal.productId,
        loanType: 'individual',
        locale,
        dateFormat,
        principal: +formVal.principal,
        loanTermFrequency: this.originalNumberOfRepayments * repaymentEvery,
        loanTermFrequencyType: +formVal.loanTermFrequencyType,
        numberOfRepayments: this.originalNumberOfRepayments,
        repaymentEvery,
        repaymentFrequencyType: +formVal.repaymentFrequencyType,
        interestRatePerPeriod: +formVal.interestRatePerPeriod,
        amortizationType: +formVal.amortizationType,
        interestType: +formVal.interestType,
        interestCalculationPeriodType: +formVal.interestCalculationPeriodType,
        expectedDisbursementDate,
        submittedOnDate: expectedDisbursementDate,
        transactionProcessingStrategyCode: formVal.transactionProcessingStrategyCode,
        loanTermVariations: this.buildVariationsForTarget(this.originalNumberOfRepayments, 'REDUCE_EMI')
      };

      this.loansService.calculateLoanSchedule(payload).subscribe({
        next: (response: RepaymentSchedule) => {
          this.updateCurrentSchedule(response);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      let totalExtraPrincipal = 0;
      this.installmentsFormArray.controls.forEach((control) => {
        const period = control.get('period')?.value;
        if (period < this.originalNumberOfRepayments && this.isRowEmiModified(control)) {
          const proposedEmi = +(control.get('proposedEmiAmount')?.value ?? 0);
          totalExtraPrincipal += Math.max(0, proposedEmi - this.baselineEmi);
        }
      });

      const estimatedReducedPeriods = Math.floor(totalExtraPrincipal / (this.baselineEmi || 1));
      let targetRepayments = Math.max(1, this.originalNumberOfRepayments - estimatedReducedPeriods);

      const executeSimulation = (target: number) => {
        const payload: LoanScheduleSimulationPayload = {
          clientId: +formVal.clientId,
          productId: +formVal.productId,
          loanType: 'individual',
          locale,
          dateFormat,
          principal: +formVal.principal,
          loanTermFrequency: target * repaymentEvery,
          loanTermFrequencyType: +formVal.loanTermFrequencyType,
          numberOfRepayments: target,
          repaymentEvery,
          repaymentFrequencyType: +formVal.repaymentFrequencyType,
          interestRatePerPeriod: +formVal.interestRatePerPeriod,
          amortizationType: +formVal.amortizationType,
          interestType: +formVal.interestType,
          interestCalculationPeriodType: +formVal.interestCalculationPeriodType,
          expectedDisbursementDate,
          submittedOnDate: expectedDisbursementDate,
          transactionProcessingStrategyCode: formVal.transactionProcessingStrategyCode,
          loanTermVariations: this.buildVariationsForTarget(target, 'REDUCE_TERM')
        };
        return this.loansService.calculateLoanSchedule(payload);
      };

      executeSimulation(targetRepayments)
        .pipe(
          switchMap((response: RepaymentSchedule) => {
            const periods = (response.periods || []).filter((p) => (p.period ?? 0) >= 1);
            const lastPeriod = periods[periods.length - 1];
            const zeroPeriodsCount = periods.filter((p) => (p.principalDue ?? 0) <= 0).length;

            if (
              lastPeriod &&
              lastPeriod.totalDueForPeriod > this.baselineEmi * 1.05 &&
              targetRepayments < this.originalNumberOfRepayments
            ) {
              targetRepayments += 1;
              return executeSimulation(targetRepayments);
            } else if (zeroPeriodsCount > 0) {
              targetRepayments = Math.max(1, targetRepayments - zeroPeriodsCount);
              return executeSimulation(targetRepayments);
            }
            return of(response);
          })
        )
        .subscribe({
          next: (finalResponse: RepaymentSchedule) => {
            this.updateCurrentSchedule(finalResponse);
            this.isLoading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        });
    }
  }

  private updateCurrentSchedule(schedule: RepaymentSchedule): void {
    this.currentSchedule = schedule;
    const periods = (schedule.periods || []).filter((p) => (p.period ?? 0) >= 1);
    const dateFormat = this.settingsService.dateFormat;

    const existingMap = new Map<number, AbstractControl>();
    this.installmentsFormArray.controls.forEach((control) => {
      existingMap.set(control.get('period')?.value, control);
    });

    this.installmentsFormArray.clear();
    const total = periods.length;

    periods.forEach((p, idx) => {
      const isLast = idx === total - 1;
      const dateObj = this.dateUtils.parseDate(p.dueDate);
      const originalDueDateStr = this.dateUtils.formatDate(dateObj, dateFormat);
      const existing = existingMap.get(p.period);
      const wasEmiModified = existing ? this.isRowEmiModified(existing) : false;

      const proposedEmiAmount =
        wasEmiModified && !isLast
          ? existing!.get('proposedEmiAmount')?.value
          : p.totalDueForPeriod;
      const isEmiModified = wasEmiModified && !isLast;

      const group = this.fb.group({
        period: [p.period],
        originalDueDate: [existing?.get('originalDueDate')?.value ?? originalDueDateStr],
        proposedDueDate: [existing?.get('proposedDueDate')?.value ?? dateObj, [Validators.required]],
        proposedEmiAmount: [proposedEmiAmount, [Validators.required, Validators.min(0)]],
        calculatedEmiAmount: [p.totalDueForPeriod],
        isEmiModified: [isEmiModified],
        proposedInterestRate: [existing?.get('proposedInterestRate')?.value ?? null],
        isLastPeriod: [isLast],
        principalDue: [p.principalDue ?? 0],
        interestDue: [p.interestDue ?? 0],
        balanceOfLoan: [p.principalLoanBalanceOutstanding ?? 0]
      });

      this.installmentsFormArray.push(group);
    });
  }

  restoreBaseline(): void {
    if (!this.baselineSchedule) {
      return;
    }
    this.currentSchedule = JSON.parse(JSON.stringify(this.baselineSchedule));
    this.simulatorForm.patchValue({
      juneExtraAmount: 0,
      decemberExtraAmount: 0
    });
    this.populateInstallmentsFormArray(this.baselinePeriods);
    this.cdr.markForCheck();
  }

  get interestSavings(): number {
    return Math.max(
      0,
      (this.baselineSchedule?.totalInterestCharged ?? 0) -
        (this.currentSchedule?.totalInterestCharged ?? 0)
    );
  }

  get installmentsSaved(): number {
    const currentPeriods = (this.currentSchedule?.periods || []).filter(
      (p) => (p.period ?? 0) >= 1
    ).length;
    return Math.max(0, this.originalNumberOfRepayments - currentPeriods);
  }
}

