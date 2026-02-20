import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { environment } from 'src/environments/environment';
import { ChatHeaderComponent } from '../chat-header/chat-header.component';
import { ChatOptionButtonComponent } from '../chat-option-button/chat-option-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { AppStateService } from '@onecx/portal-integration-angular';
import { map } from 'rxjs/operators';
import { ChatType } from 'src/app/shared/generated';

@Component({
  selector: 'app-chat-initial-screen',
  standalone: true,
  imports: [CommonModule, ChatHeaderComponent, ChatOptionButtonComponent, TranslateModule, CardModule],
  templateUrl: './chat-initial-screen.component.html',
  styleUrls: ['./chat-initial-screen.component.scss']
})
export class ChatInitialScreenComponent {
  @Output() selectMode = new EventEmitter<ChatType | 'close'>();
  readonly ChatType = ChatType;
  logoUrl = '';

  constructor(private readonly appState: AppStateService) {
    this.appState.currentMfe$
      .pipe(
        map((mfe) => {
          const baseUrl = mfe.remoteBaseUrl.replace('workspace', 'onecx-chat');
          this.logoUrl = Location.joinWithSlash(baseUrl, environment.DEFAULT_LOGO_PATH);
        })
      )
      .subscribe();
  }
}
