/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/** Angular Imports */
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

/** Custom Components */
import { DepositProductIncentiveFormDialogComponent } from 'app/products/deposit-product-incentive-form-dialog/deposit-product-incentive-form-dialog.component';
import { DeleteDialogComponent } from 'app/shared/delete-dialog/delete-dialog.component';
import { FormDialogComponent } from 'app/shared/form-dialog/form-dialog.component';

/** Dialog Components */
import { FormfieldBase } from 'app/shared/form-dialog/formfield/model/formfield-base';
import { InputBase } from 'app/shared/form-dialog/formfield/model/input-base';
import { SelectBase } from 'app/shared/form-dialog/formfield/model/select-base';

/** Custom Services */
import { TranslateService } from '@ngx-translate/core';
import { Dates } from 'app/core/utils/dates';
import { SettingsService } from 'app/settings/settings.service';
import { MatTooltip } from '@angular/material/tooltip';
import { MatButton, MatIconButton } from '@angular/material/button';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { MatDivider } from '@angular/material/divider';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow
} from '@angular/material/table';
import { MatStepperPrevious, MatStepperNext } from '@angular/material/stepper';
import { FindPipe } from '../../../../pipes/find.pipe';
import { FormatNumberPipe } from '../../../../pipes/format-number.pipe';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import {
  depositProductChartSlabsValidator,
  getDepositProductChartSlabsErrorKey,
  normalizeDepositProductInterestRateCharts
} from 'app/products/deposit-product-interest-rate-chart.util';

@Component({
  selector: 'mifosx-saving-product-interest-rate-chart-step',
  templateUrl: './saving-product-interest-rate-chart-step.component.html',
  styleUrls: ['./saving-product-interest-rate-chart-step.component.scss'],
  animations: [
    trigger('expandChartSlab', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ])
  ],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatTooltip,
    FaIconComponent,
    MatDivider,
    MatIconButton,
    MatCheckbox,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatStepperPrevious,
    MatStepperNext,
    FindPipe,
    FormatNumberPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SavingProductInterestRateChartStepComponent implements OnInit {
  private formBuilder = inject(UntypedFormBuilder);
  dialog = inject(MatDialog);
  private dateUtils = inject(Dates);
  private settingsService = inject(SettingsService);
  private translateService = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  @Input() savingProductsTemplate: any;

  savingProductInterestRateChartForm: UntypedFormGroup;

  periodTypeData: any;
  entityTypeData: any;
  attributeNameData: any;
  conditionTypeData: any;
  genderData: any;
  clientTypeData: any;
  clientClassificationData: any;
  incentiveTypeData: any;

  chartSlabsDisplayedColumns: any[] = [];
  chartSlabsIncentivesDisplayedColumns: string[] = ['incentives'];
  incentivesDisplayedColumns: string[] = [
    'entityType',
    'attributeName',
    'conditionType',
    'attributeValue',
    'incentiveType',
    'amount',
    'actions'
  ];

  minDate = new Date(2000, 0, 1);
  maxDate = new Date(new Date().setFullYear(new Date().getFullYear() + 10));

  expandChartSlabIndex: number[] = [];
  chartDetailData: any = [];
  chartsDetail: any[] = [];

  constructor() {
    this.createSavingProductInterestRateChartForm();
  }

  ngOnInit() {
    this.periodTypeData = this.savingProductsTemplate?.chartTemplate?.periodTypes || [];
    this.entityTypeData = this.savingProductsTemplate?.chartTemplate?.entityTypeOptions || [];
    this.attributeNameData = this.savingProductsTemplate?.chartTemplate?.attributeNameOptions || [];
    this.conditionTypeData = this.savingProductsTemplate?.chartTemplate?.conditionTypeOptions || [];
    this.genderData = this.savingProductsTemplate?.chartTemplate?.genderOptions || [];
    this.clientTypeData = this.savingProductsTemplate?.chartTemplate?.clientTypeOptions || [];
    this.clientClassificationData = this.savingProductsTemplate?.chartTemplate?.clientClassificationOptions || [];
    this.incentiveTypeData = this.savingProductsTemplate?.chartTemplate?.incentiveTypeOptions || [];

    if (this.savingProductsTemplate) {
      this.assignFormData();
    }
  }

  assignFormData() {
    if (this.savingProductsTemplate.activeChart) {
      const isChartArray = Array.isArray(this.savingProductsTemplate.activeChart);
      if (!isChartArray) {
        this.chartDetailData.push(this.savingProductsTemplate.activeChart);
      } else {
        this.chartDetailData = [...this.savingProductsTemplate.activeChart];
      }
    } else if (this.savingProductsTemplate.charts && this.savingProductsTemplate.charts.length > 0) {
      this.chartDetailData = [...this.savingProductsTemplate.charts];
    }

    if (this.chartDetailData.length === 0) {
      return;
    }

    for (let i = 0; i < this.chartDetailData.length; i++) {
      this.addChart();
    }

    this.getChartsDetailsData();

    this.charts.controls.forEach((chartDetailControl: UntypedFormGroup, i: number) => {
      if (!this.chartsDetail[i]) {
        return;
      }
      const isPrimaryGrouping = this.chartsDetail[i].isPrimaryGroupingByAmount;

      this.chartsDetail[i].chartSlabs.forEach((chartSlabDetail: any, j: number) => {
        const chartSlabInfo = this.formBuilder.group({
          id: [chartSlabDetail.id],
          amountRangeFrom: [
            chartSlabDetail.amountRangeFrom !== undefined && chartSlabDetail.amountRangeFrom !== null
              ? chartSlabDetail.amountRangeFrom
              : '',
            isPrimaryGrouping ? Validators.required : []
          ],
          amountRangeTo: [
            chartSlabDetail.amountRangeTo !== undefined && chartSlabDetail.amountRangeTo !== null
              ? chartSlabDetail.amountRangeTo
              : ''
          ],
          annualInterestRate: [chartSlabDetail.annualInterestRate, Validators.required],
          description: [chartSlabDetail.description || '', Validators.required],
          fromPeriod: [
            chartSlabDetail.fromPeriod !== undefined && chartSlabDetail.fromPeriod !== null
              ? chartSlabDetail.fromPeriod
              : '',
            !isPrimaryGrouping ? Validators.required : []
          ],
          toPeriod: [
            chartSlabDetail.toPeriod !== undefined && chartSlabDetail.toPeriod !== null
              ? chartSlabDetail.toPeriod
              : ''
          ],
          periodType: [chartSlabDetail.periodType || '', !isPrimaryGrouping ? Validators.required : []],
          incentives: this.formBuilder.array([])
        });
        const formArray = chartDetailControl.controls['chartSlabs'] as UntypedFormArray;
        formArray.push(chartSlabInfo);

        const chartIncentiveControl = (chartDetailControl.controls['chartSlabs'] as UntypedFormArray).controls[j];

        if (this.chartsDetail[i].chartSlabs[j].incentives) {
          this.chartsDetail[i].chartSlabs[j].incentives.forEach((chartIncentiveDetail: any) => {
            const incentiveInfo = this.formBuilder.group({
              amount: [chartIncentiveDetail.amount, Validators.required],
              attributeName: [chartIncentiveDetail.attributeName, Validators.required],
              attributeValue: [chartIncentiveDetail.attributeValue, Validators.required],
              conditionType: [chartIncentiveDetail.conditionType, Validators.required],
              entityType: [chartIncentiveDetail.entityType, Validators.required],
              incentiveType: [chartIncentiveDetail.incentiveType, Validators.required]
            });
            const newFormArray = (chartIncentiveControl as UntypedFormGroup).controls['incentives'] as UntypedFormArray;
            newFormArray.push(incentiveInfo);
          });
        }
      });
    });
    this.savingProductInterestRateChartForm.markAsPristine();
  }

  getChartsDetailsData() {
    this.chartDetailData.forEach((chartData: ChartData) => {
      const chart: Chart = {
        endDate: chartData.endDate ? new Date(chartData.endDate) : '',
        fromDate: chartData.fromDate ? new Date(chartData.fromDate) : '',
        isPrimaryGroupingByAmount: chartData.isPrimaryGroupingByAmount ?? true,
        name: chartData.name,
        description: chartData.description,
        chartSlabs: this.getChartSlabsData(chartData)
      };
      if (chartData.id) {
        chart.id = chartData.id;
      }
      this.chartsDetail.push(chart);
    });
    this.savingProductInterestRateChartForm.patchValue({
      charts: this.chartsDetail
    });
  }

  getChartSlabsData(chartData: any) {
    const chartSlabs: any[] = [];
    let chartSlabData: any[] = [];
    const isChartSlabArray = Array.isArray(chartData.chartSlabs);
    if (!isChartSlabArray) {
      chartSlabData.push(chartData.chartSlabs);
    } else {
      chartSlabData = chartData.chartSlabs;
    }

    chartSlabData.forEach((eachChartSlabData: any) => {
      let periodType: any = '';
      if (eachChartSlabData.periodType) {
        if (typeof eachChartSlabData.periodType === 'object') {
          periodType = eachChartSlabData.periodType.id === 5 ? '' : eachChartSlabData.periodType.id;
        } else {
          periodType = Number(eachChartSlabData.periodType) === 5 ? '' : eachChartSlabData.periodType;
        }
      }
      const chartSlab: {
        id?: any;
        periodType: any;
        amountRangeFrom: any;
        amountRangeTo: any;
        annualInterestRate: any;
        description: any;
        fromPeriod: any;
        toPeriod: any;
        incentives: any[];
      } = {
        periodType,
        amountRangeFrom: eachChartSlabData.amountRangeFrom,
        amountRangeTo: eachChartSlabData.amountRangeTo,
        annualInterestRate: eachChartSlabData.annualInterestRate,
        description: eachChartSlabData.description ? eachChartSlabData.description : '',
        fromPeriod: eachChartSlabData.fromPeriod,
        toPeriod: eachChartSlabData.toPeriod,
        incentives: this.getIncentivesData(eachChartSlabData)
      };
      if (eachChartSlabData.id) {
        chartSlab['id'] = eachChartSlabData.id;
      }
      chartSlabs.push(chartSlab);
    });
    return chartSlabs;
  }

  getIncentivesData(chartSlabData: any) {
    const incentives: any[] = [];
    let incentiveDatas: any[] = [];
    if (chartSlabData.incentives) {
      const isChartIncentiveArray = Array.isArray(chartSlabData.incentives);
      if (!isChartIncentiveArray) {
        incentiveDatas.push(chartSlabData.incentives);
      } else {
        incentiveDatas = chartSlabData.incentives;
      }
      incentiveDatas.forEach((incentiveData: any) => {
        const incentive = {
          amount: incentiveData.amount,
          attributeName: incentiveData.attributeName,
          attributeValue: incentiveData.attributeValue,
          conditionType: incentiveData.conditionType,
          entityType: incentiveData.entityType,
          incentiveType: incentiveData.incentiveType
        };
        incentives.push(incentive);
      });
    }
    return incentives;
  }

  createSavingProductInterestRateChartForm() {
    this.savingProductInterestRateChartForm = this.formBuilder.group({
      charts: this.formBuilder.array([])
    });
  }

  get charts(): UntypedFormArray {
    return this.savingProductInterestRateChartForm.get('charts') as UntypedFormArray;
  }

  createChartForm(): UntypedFormGroup {
    const chartForm = this.formBuilder.group({
      id: [null],
      name: [''],
      description: [''],
      fromDate: ['', Validators.required],
      endDate: [''],
      isPrimaryGroupingByAmount: [true],
      chartSlabs: this.formBuilder.array([], Validators.required)
    });
    const chartSlabs = chartForm.get('chartSlabs') as UntypedFormArray;
    chartSlabs.setValidators([
      Validators.required,
      depositProductChartSlabsValidator(() => chartForm.get('isPrimaryGroupingByAmount')?.value)
    ]);
    return chartForm;
  }

  addChart() {
    this.charts.push(this.createChartForm());
    this.setConditionalControls(this.charts.length - 1);
    this.savingProductInterestRateChartForm.markAsDirty();
    this.cdr.markForCheck();
  }

  setConditionalControls(chartIndex: number) {
    const isPrimaryGrouping = this.charts.at(chartIndex).get('isPrimaryGroupingByAmount')?.value;
    this.chartSlabsDisplayedColumns[chartIndex] = isPrimaryGrouping
      ? ['amountRange', 'period', 'annualInterestRate', 'description', 'actions']
      : ['period', 'amountRange', 'annualInterestRate', 'description', 'actions'];

    this.charts
      .at(chartIndex)
      .get('isPrimaryGroupingByAmount')
      .valueChanges.subscribe((isPrimaryGroupingByAmount: boolean) => {
        this.chartSlabsDisplayedColumns[chartIndex] = isPrimaryGroupingByAmount
          ? ['amountRange', 'period']
          : ['period', 'amountRange'];
        this.chartSlabsDisplayedColumns[chartIndex].push('annualInterestRate', 'description', 'actions');
        (this.charts.at(chartIndex).get('chartSlabs') as UntypedFormArray).updateValueAndValidity();
        this.cdr.markForCheck();
      });
  }

  getIncentives(chartSlabs: UntypedFormArray, chartSlabIndex: number): UntypedFormArray {
    return chartSlabs.at(chartSlabIndex).get('incentives') as UntypedFormArray;
  }

  addChartSlab(chartSlabs: UntypedFormArray, isPrimaryGroupingByAmount = true) {
    const data = { ...this.getData('Range', undefined, isPrimaryGroupingByAmount) };
    const dialogRef = this.dialog.open(FormDialogComponent, { data });
    dialogRef.afterClosed().subscribe((response: any) => {
      if (response && response.data) {
        response.data.addControl('incentives', this.formBuilder.array([]));
        chartSlabs.push(response.data);
        chartSlabs.updateValueAndValidity();
        this.savingProductInterestRateChartForm.markAsDirty();
        this.cdr.markForCheck();
      }
    });
  }

  addIncentive(incentives: UntypedFormArray) {
    const data = { ...this.getData('Incentive'), entityType: this.entityTypeData[0]?.id };
    const dialogRef = this.dialog.open(DepositProductIncentiveFormDialogComponent, { data });
    dialogRef.afterClosed().subscribe((response: any) => {
      if (response && response.data) {
        incentives.push(response.data);
        incentives.updateValueAndValidity();
        this.savingProductInterestRateChartForm.markAsDirty();
        this.cdr.markForCheck();
      }
    });
  }

  editChartSlab(chartSlabs: UntypedFormArray, chartSlabIndex: number, isPrimaryGroupingByAmount = true) {
    const data = {
      ...this.getData('Range', chartSlabs.at(chartSlabIndex).value, isPrimaryGroupingByAmount),
      layout: { addButtonText: 'Submit' }
    };
    const dialogRef = this.dialog.open(FormDialogComponent, { data });
    dialogRef.afterClosed().subscribe((response: any) => {
      if (response && response.data) {
        chartSlabs.at(chartSlabIndex).patchValue(response.data.value);
        chartSlabs.updateValueAndValidity();
        this.savingProductInterestRateChartForm.markAsDirty();
        this.cdr.markForCheck();
      }
    });
  }

  editIncentive(incentives: UntypedFormArray, incentiveIndex: number) {
    const data = {
      ...this.getData('Incentive', incentives.at(incentiveIndex).value),
      layout: { addButtonText: 'Submit' }
    };
    const dialogRef = this.dialog.open(DepositProductIncentiveFormDialogComponent, { data });
    dialogRef.afterClosed().subscribe((response: any) => {
      if (response && response.data) {
        incentives.at(incentiveIndex).patchValue(response.data.value);
        incentives.updateValueAndValidity();
        this.savingProductInterestRateChartForm.markAsDirty();
        this.cdr.markForCheck();
      }
    });
  }

  delete(formArray: UntypedFormArray, index: number) {
    const dialogRef = this.dialog.open(DeleteDialogComponent, {
      data: { deleteContext: this.translateService.instant('labels.text.this') }
    });
    dialogRef.afterClosed().subscribe((response: any) => {
      if (response && response.delete) {
        formArray.removeAt(index);
        formArray.updateValueAndValidity();
        this.savingProductInterestRateChartForm.markAsDirty();
        this.cdr.markForCheck();
      }
    });
  }

  getChartSlabsErrorKey(chartSlabs: UntypedFormArray): string | null {
    return getDepositProductChartSlabsErrorKey(chartSlabs.errors, 'fixeddeposit');
  }

  getData(formType: string, values?: any, isPrimaryGroupingByAmount = true) {
    switch (formType) {
      case 'Range':
        return {
          title: this.translateService.instant('labels.inputs.Range'),
          formfields: this.getSlabFormfields(values, isPrimaryGroupingByAmount)
        };
      case 'Incentive':
        return { values, chartTemplate: this.savingProductsTemplate?.chartTemplate };
    }
  }

  getSlabFormfields(values?: any, isPrimaryGroupingByAmount = true) {
    if (isPrimaryGroupingByAmount) {
      const formfields: FormfieldBase[] = [
        new InputBase({
          controlName: 'amountRangeFrom',
          label: this.translateService.instant('labels.inputs.Amount Range From'),
          value: values ? values.amountRangeFrom : undefined,
          type: 'number',
          required: true,
          order: 1,
          min: 0
        }),
        new InputBase({
          controlName: 'amountRangeTo',
          label: this.translateService.instant('labels.inputs.Amount Range To'),
          value: values ? values.amountRangeTo : undefined,
          type: 'number',
          required: false,
          order: 2,
          min: 0
        }),
        new SelectBase({
          controlName: 'periodType',
          label: this.translateService.instant('labels.inputs.Period Type'),
          value: values?.periodType && Number(values.periodType) !== 5 ? values.periodType : '',
          options: { label: 'value', value: 'id', data: this.periodTypeData },
          required: false,
          order: 3
        }),
        new InputBase({
          controlName: 'fromPeriod',
          label: this.translateService.instant('labels.inputs.Period From'),
          value: values ? values.fromPeriod : undefined,
          type: 'number',
          required: false,
          order: 4,
          min: 0
        }),
        new InputBase({
          controlName: 'toPeriod',
          label: this.translateService.instant('labels.inputs.Period To'),
          value: values ? values.toPeriod : undefined,
          type: 'number',
          required: false,
          order: 5,
          min: 0
        }),
        new InputBase({
          controlName: 'annualInterestRate',
          label: this.translateService.instant('labels.inputs.Interest'),
          value: values ? values.annualInterestRate : undefined,
          type: 'number',
          required: true,
          order: 6,
          min: 0
        }),
        new InputBase({
          controlName: 'description',
          label: this.translateService.instant('labels.inputs.Description'),
          value: values ? values.description : undefined,
          required: true,
          order: 7
        })
      ];
      return formfields;
    } else {
      const formfields: FormfieldBase[] = [
        new SelectBase({
          controlName: 'periodType',
          label: this.translateService.instant('labels.inputs.Period Type'),
          value: values ? values.periodType : this.periodTypeData[0]?.id,
          options: { label: 'value', value: 'id', data: this.periodTypeData },
          required: true,
          order: 1
        }),
        new InputBase({
          controlName: 'fromPeriod',
          label: this.translateService.instant('labels.inputs.Period From'),
          value: values ? values.fromPeriod : undefined,
          type: 'number',
          required: true,
          order: 2,
          min: 0
        }),
        new InputBase({
          controlName: 'toPeriod',
          label: this.translateService.instant('labels.inputs.Period To'),
          value: values ? values.toPeriod : undefined,
          type: 'number',
          required: false,
          order: 3,
          min: 0
        }),
        new InputBase({
          controlName: 'amountRangeFrom',
          label: this.translateService.instant('labels.inputs.Amount Range From'),
          value: values ? values.amountRangeFrom : undefined,
          type: 'number',
          required: false,
          order: 4,
          min: 0
        }),
        new InputBase({
          controlName: 'amountRangeTo',
          label: this.translateService.instant('labels.inputs.Amount Range To'),
          value: values ? values.amountRangeTo : undefined,
          type: 'number',
          required: false,
          order: 5,
          min: 0
        }),
        new InputBase({
          controlName: 'annualInterestRate',
          label: this.translateService.instant('labels.inputs.Interest'),
          value: values ? values.annualInterestRate : undefined,
          type: 'number',
          required: true,
          order: 6,
          min: 0
        }),
        new InputBase({
          controlName: 'description',
          label: this.translateService.instant('labels.inputs.Description'),
          value: values ? values.description : undefined,
          required: true,
          order: 7
        })
      ];
      return formfields;
    }
  }

  get savingProductInterestRateChart() {
    const rawVal = this.savingProductInterestRateChartForm.value;
    if (!rawVal.charts || rawVal.charts.length === 0) {
      return {};
    }
    const dateFormat = this.settingsService.dateFormat;
    const locale = this.settingsService.language.code;
    const savingProductInterestRateChart = JSON.parse(JSON.stringify(rawVal));
    for (const chart of savingProductInterestRateChart.charts) {
      chart.locale = locale;
      chart.dateFormat = dateFormat;
      if (chart.fromDate) {
        chart.fromDate = this.dateUtils.formatDate(chart.fromDate, dateFormat);
      }
      if (chart.endDate) {
        chart.endDate = this.dateUtils.formatDate(chart.endDate, dateFormat);
      } else {
        delete chart.endDate;
      }
      if (chart.id === null || chart.id === undefined) {
        delete chart.id;
      }
    }
    return normalizeDepositProductInterestRateCharts(savingProductInterestRateChart);
  }
}

interface ChartData {
  id?: number;
  endDate?: string;
  fromDate?: string;
  isPrimaryGroupingByAmount: boolean;
  name: string;
  description: string;
  chartSlabs: ChartSlab[];
}

interface ChartSlab {
  periodType?: string;
  fromPeriod?: number;
  toPeriod?: number;
  amountRangeFrom?: number;
  amountRangeTo?: number;
  annualInterestRate?: number;
  description?: string;
}

interface Chart extends Omit<ChartData, 'endDate' | 'fromDate'> {
  endDate: Date | string;
  fromDate: Date | string;
}

