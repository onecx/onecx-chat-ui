import { ComponentHarness } from '@angular/cdk/testing';

export class ChatHeaderHarness extends ComponentHarness {
    public static readonly hostSelector = 'app-chat-header';

    getBackButton = this.locatorFor('#back-button');
    getCloseButton = this.locatorFor('#close-button');
    getTitle = this.locatorFor('.chat-title');
    getSettingsButton = this.locatorFor('#settings-button');

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