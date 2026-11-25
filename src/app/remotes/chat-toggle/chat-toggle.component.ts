import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { ButtonModule } from 'primeng/button'
import { TooltipModule } from 'primeng/tooltip'
import { ReplaySubject } from 'rxjs'

import { UserService } from '@onecx/angular-integration-interface'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'
import { ocxRemoteComponent, ocxRemoteWebcomponent } from '@onecx/angular-remote-components'

import { ChatPanelVisibilityTopic } from 'src/app/shared/topics/chat-panel-visibility.topic'

@Component({
  selector: 'app-chat-toggle',
  imports: [ButtonModule, TooltipModule, TranslateModule],
  templateUrl: './chat-toggle.component.html',
  styleUrl: './chat-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OneCXChatToggleComponent implements ocxRemoteComponent, ocxRemoteWebcomponent {
  private readonly remoteComponentConfig = inject<ReplaySubject<RemoteComponentConfig>>(REMOTE_COMPONENT_CONFIG)
  private readonly userService = inject(UserService)
  private readonly translateService = inject(TranslateService)
  private readonly cdr = inject(ChangeDetectorRef)

  private readonly destroyRef = inject(DestroyRef)
  private readonly visibilityTopic = new ChatPanelVisibilityTopic()
  visible = false

  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }

  constructor() {
    this.translateService.use(this.userService.lang$.getValue())
    this.visibilityTopic.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((visible) => {
      this.visible = visible
      this.cdr.markForCheck()
    })
    this.destroyRef.onDestroy(() => this.visibilityTopic.destroy())
  }

  ocxInitRemoteComponent(config: RemoteComponentConfig): void {
    this.remoteComponentConfig.next(config)
  }

  toggle() {
    this.visibilityTopic.publish(!this.visible).catch((err) => console.error(err))
  }
}
