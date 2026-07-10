import { ComponentHarness } from '@angular/cdk/testing';

export class ChatHeaderHarness extends ComponentHarness {
    public static readonly hostSelector = 'app-chat-header';

    getBackButton = this.locatorFor('#chat_header_back_button button');
    getCloseButton = this.locatorFor('#chat_header_close_button button');
    getTitle = this.locatorFor('.chat-title');
    getSettingsButton = this.locatorFor('#chat_header_settings_button button');

    async clickBackButton(): Promise<void> {
        const button = await this.getBackButton();
        await button.click();
    }

    async clickCloseButton(): Promise<void> {
        const button = await this.getCloseButton();
        await button.click();
    }

    async clickSettingsButton(): Promise<void> {
        const button = await this.getSettingsButton();
        await button.click();
    }

    async getTitleText(): Promise<string> {
        const titleEl = await this.getTitle();
        return titleEl.text();
    }
}