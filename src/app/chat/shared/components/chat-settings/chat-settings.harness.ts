import { ComponentHarness } from '@angular/cdk/testing';

export class ChatSettingsHarness extends ComponentHarness {
  public static readonly hostSelector = 'app-chat-settings';

  getSubmitButton = this.locatorFor('[data-testid="submit-chat-button"] button');
  getDeleteButton = this.locatorFor('[data-testid="delete-chat-button"] button');

  async clickSubmitButton(): Promise<void> {
    const button = await this.getSubmitButton();
    await button.click();
  }

  async clickDeleteButton(): Promise<void> {
    const button = await this.getDeleteButton();
    await button.click();
  }
}
