import { ComponentHarness } from '@angular/cdk/testing';
import {
  PageHeaderHarness,
  DataTableHarness,
} from '@onecx/angular-accelerator/testing';

export class ChatDetailsHarness extends ComponentHarness {
  static readonly hostSelector = 'app-chat-details';

  getHeader = this.locatorFor(PageHeaderHarness);
  getDataTable = this.locatorFor(DataTableHarness);
}
