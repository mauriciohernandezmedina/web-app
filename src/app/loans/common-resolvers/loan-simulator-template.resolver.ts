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

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProductsService } from 'app/products/products.service';

/**
 * Loan Simulator Template Resolver. Preloads basic loan products list.
 */
@Injectable({
  providedIn: 'root'
})
export class LoanSimulatorTemplateResolver {
  private productsService = inject(ProductsService);

  resolve(): Observable<any> {
    return this.productsService.getLoanProductsBasicDetails();
  }
}
