import { ComponentHarness } from '@angular/cdk/testing';

export class ChatSettingsHarness extends ComponentHarness {
  public static readonly hostSelector = 'app-chat-settings';

  getCreateButton = this.locatorFor('[data-testid="create-chat-button"] button');
  getSaveButton = this.locatorFor('[data-testid="save-chat-button"] button');
  getDeleteButton = this.locatorFor('[data-testid="delete-chat-button"] button');

  async clickCreateButton(): Promise<void> {
    const button = await this.getCreateButton();
    await button.click();
  }

  async clickSaveButton(): Promise<void> {
    const button = await this.getSaveButton();
    await button.click();
  }

  async clickDeleteButton(): Promise<void> {
    const button = await this.getDeleteButton();
    await button.click();
  }
}
