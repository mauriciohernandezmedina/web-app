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
import { CurrencyPipe } from '@angular/common';

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
import { TranslateService } from '@ngx-translate/core';
import { jsPDF, jsPDFOptions } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  private translateService = inject(TranslateService);

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
  tableDataSource: FormGroup[] = [];

  displayedColumns: string[] = [
    'period',
    'dueDate',
    'proposedDueDate',
    'principalDue',
    'interestDue',
    'proposedEmiAmount',
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
    const bd = this.settingsService.businessDate;
    const validDate = bd instanceof Date && !isNaN(bd.getTime()) ? bd : new Date();

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
      expectedDisbursementDate: [validDate, [Validators.required]],
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

    this.simulatorForm
      .get('extraRepaymentEffect')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.baselineSchedule) {
          this.recalculateWithVariations();
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
          principal: template.principal ?? template.approvedPrincipal ?? 10000,
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

    this.tableDataSource = [...this.installmentsFormArray.controls];
  }

  onInstallmentEmiChange(row: FormGroup): void {
    row.get('isEmiModified')?.setValue(true, { emitEvent: false });
  }

  applyJuneDecemberAssistant(): void {
    if (!this.baselineSchedule || !this.baselinePeriods.length) {
      return;
    }
    this.populateInstallmentsFormArray(this.baselinePeriods);

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

    const controlsMap = new Map<number, FormGroup>();
    this.installmentsFormArray.controls.forEach((c) => {
      const p = c.get('period')?.value;
      if (p !== null && p !== undefined) {
        controlsMap.set(p, c);
      }
    });

    this.baselinePeriods.forEach((bp) => {
      const period = bp.period ?? 0;
      if (period < 1 || period >= targetRepayments) {
        return;
      }

      const applicableFromDate = this.dateUtils.formatDate(
        this.dateUtils.parseDate(bp.dueDate),
        dateFormat
      );
      const control = controlsMap.get(period);

      if (control) {
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

        const isEmiModified = this.isRowEmiModified(control);
        if (isEmiModified) {
          variations.push({
            termType: 'emiAmount',
            applicableFromDate,
            decimalValue: +(control.get('proposedEmiAmount')?.value ?? 0),
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
      loanTermVariations: this.buildVariationsForTarget(this.originalNumberOfRepayments, mode)
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

    this.tableDataSource = [...this.installmentsFormArray.controls];
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

  exportToPDF(): void {
    if (!this.currentSchedule) {
      return;
    }

    const options: jsPDFOptions = {
      orientation: 'l',
      unit: 'pt',
      format: 'letter',
      precision: 2,
      compress: true
    };
    const pdf = new jsPDF(options);

    const formVal = this.simulatorForm.value;
    const productName =
      this.loanProducts.find((p) => p.id === formVal.productId)?.name || '';

    const title = this.translateService.instant('labels.heading.Loan Simulator');
    const genDate = this.dateUtils.formatDate(
      new Date(),
      this.settingsService.dateFormat
    );

    pdf.setFontSize(14);
    pdf.text(title, 40, 40);

    pdf.setFontSize(9);
    pdf.text(
      `${this.translateService.instant('labels.inputs.Date')}: ${genDate}`,
      40,
      55
    );

    const principalStr = `${formVal.principal} ${this.currencyCode}`;
    const termStr = `${this.originalNumberOfRepayments} -> ${this.installmentsFormArray.length}`;
    const rateStr = `${formVal.interestRatePerPeriod}%`;

    pdf.text(
      `${this.translateService.instant('labels.inputs.Select Loan Product')}: ${productName}   |   ` +
        `${this.translateService.instant('labels.inputs.Principal')}: ${principalStr}   |   ` +
        `${this.translateService.instant('labels.inputs.Loan Term')}: ${termStr}   |   ` +
        `${this.translateService.instant('labels.inputs.Nominal interest rate')}: ${rateStr}`,
      40,
      72
    );

    const origInterest = (this.baselineSchedule?.totalInterestCharged ?? 0).toFixed(2);
    const projInterest = (this.currentSchedule?.totalInterestCharged ?? 0).toFixed(2);
    const intSavings = this.interestSavings.toFixed(2);
    const instSaved = this.installmentsSaved;

    pdf.text(
      `${this.translateService.instant('labels.inputs.Original Interest')}: ${origInterest}   |   ` +
        `${this.translateService.instant('labels.inputs.Projected Interest')}: ${projInterest}   |   ` +
        `${this.translateService.instant('labels.inputs.Total Interest Savings')}: ${intSavings}   |   ` +
        `${this.translateService.instant('labels.inputs.Installments Reduced')}: ${instSaved}`,
      40,
      87
    );

    const head = [
      [
        '#',
        this.translateService.instant('labels.inputs.Date'),
        this.translateService.instant('labels.inputs.Proposed Due Date'),
        this.translateService.instant('labels.inputs.Principal'),
        this.translateService.instant('labels.inputs.Interest'),
        this.translateService.instant('labels.inputs.Proposed Installment'),
        this.translateService.instant('labels.inputs.Balance of loan')
      ]
    ];

    const body = this.installmentsFormArray.controls.map((row) => [
      row.get('period')?.value,
      row.get('originalDueDate')?.value ?? '',
      this.dateUtils.formatDate(
        row.get('proposedDueDate')?.value,
        this.settingsService.dateFormat
      ),
      (+row.get('principalDue')?.value || 0).toFixed(2),
      (+row.get('interestDue')?.value || 0).toFixed(2),
      (+row.get('proposedEmiAmount')?.value || 0).toFixed(2),
      (+row.get('balanceOfLoan')?.value || 0).toFixed(2)
    ]);

    autoTable(pdf, {
      startY: 102,
      head,
      body,
      styles: { fontSize: 9, halign: 'right' },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'center' }
      }
    });

    const fileNameDate = this.dateUtils.formatDate(
      new Date(),
      Dates.DEFAULT_DATEFORMAT
    );
    pdf.save(`loan-simulation-${fileNameDate}.pdf`);
  }
}

