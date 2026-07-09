import { ComponentHarness } from '@angular/cdk/testing';

export class GroupChatSettingsHarness extends ComponentHarness {
  public static readonly hostSelector = 'app-group-chat-settings';

  getRecipientInput = this.locatorFor('input#chat_group_settings_recipient_input');
  getAddButton = this.locatorFor('[data-testid="add-recipient-button"]');
  getAllRecipientRows = this.locatorForAll('[data-testid="recipient-row"]');
  getRemoveButtons = this.locatorForAll('[data-testid="remove-recipient-button"] button');

  async getRecipientInputValue(): Promise<string> {
    const input = await this.getRecipientInput();
    return await input.getProperty<string>('value');
  }

  async setRecipientInputValue(value: string): Promise<void> {
    const input = await this.getRecipientInput();
    await input.clear();
    await input.sendKeys(value);
  }

  async clickAddButton(): Promise<void> {
    const button = await this.getAddButton();
    await button.click();
  }

  async getRecipientsCount(): Promise<number> {
    const rows = await this.getAllRecipientRows();
    return rows.length;
  }

  async removeRecipientAtIndex(index: number): Promise<void> {
    const buttons = await this.getRemoveButtons();
    if (buttons[index]) {
      await buttons[index].click();
    }
  }
}