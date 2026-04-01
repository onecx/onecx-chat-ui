import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { LetDirective } from '@ngrx/component';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Action,
  AngularAcceleratorModule,
  BreadcrumbService,
  ObjectDetailItem,
} from '@onecx/angular-accelerator';
import { PortalPageComponent } from '@onecx/angular-utils';
import { Observable, firstValueFrom, map } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { PrimeIcons } from 'primeng/api';
import { ChatDetailsActions } from './chat-details.actions';
import { selectChatDetailsViewModel } from './chat-details.selectors';
import { ChatDetailsViewModel } from './chat-details.viewmodel';
import { Message, MessageType } from 'src/app/shared/generated';

@Component({
  selector: 'app-chat-details',
  templateUrl: './chat-details.component.html',
  styleUrls: ['./chat-details.component.scss'],
  imports: [
    CommonModule,
    AngularAcceleratorModule,
    PortalPageComponent,
    LetDirective,
    TranslateModule,
    AvatarModule,
  ],
})
export class ChatDetailsComponent implements OnInit {
  viewModel$: Observable<ChatDetailsViewModel> = this.store.select(
    selectChatDetailsViewModel,
  );

  headerLabels$: Observable<ObjectDetailItem[]> = this.viewModel$.pipe(
    map((vm) => {
      const labels: ObjectDetailItem[] = [
        {
          label: 'CHAT_DETAILS.FORM.ID',
          labelPipe: TranslatePipe,
          value: vm.details?.id,
        },
        {
          label: 'CHAT_DETAILS.FORM.TOPIC',
          labelPipe: TranslatePipe,
          value: vm.details?.topic,
        }
      ];
      return labels;
    }),
  );

  headerActions$: Observable<Action[]> = this.viewModel$.pipe(
    map((vm) => {
      const actions: Action[] = [
        {
          titleKey: 'CHAT_DETAILS.GENERAL.BACK',
          labelKey: 'CHAT_DETAILS.GENERAL.BACK',
          show: 'always',
          disabled: !vm.backNavigationPossible,
          permission: 'CHAT#BACK',
          actionCallback: () => {
            this.store.dispatch(ChatDetailsActions.navigateBackButtonClicked());
          },
        },
        {
          titleKey: 'CHAT_DETAILS.GENERAL.DELETE',
          labelKey: 'CHAT_DETAILS.GENERAL.DELETE',
          icon: PrimeIcons.TRASH,
          show: 'asOverflow',
          btnClass: '',
          actionCallback: () => {
            this.delete();
          },
        }
      ];
      return actions;
    }),
  );

  constructor(
    private readonly store: Store,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly translateService: TranslateService
  ) { }

  ngOnInit(): void {
    const baseItems = [{
      titleKey: 'CHAT_SEARCH.BREADCRUMB',
      labelKey: 'CHAT_SEARCH.BREADCRUMB',
      routerLink: '../../',
    },
    ]
    this.breadcrumbService.setItems(baseItems);
    this.viewModel$.pipe().subscribe((vm) => {
      this.breadcrumbService.setItems([
        ...baseItems,
        {
          titleKey: 'CHAT_DETAILS.BREADCRUMB',
          labelKey: 'CHAT_DETAILS.BREADCRUMB',
          routerLink: `./`,
        },
      ])
    });
  }

  async userName(message: Message): Promise<string> {
    if (message.type === MessageType.Assistant) {
      return firstValueFrom(this.translateService.get('CHAT_DETAILS.USER_TYPE.ASSISTANT'))
    }
    if (message.type === MessageType.System) {
      return firstValueFrom(this.translateService.get('CHAT_DETAILS.USER_TYPE.SYSTEM'))
    }
    const participantName = await firstValueFrom(this.viewModel$.pipe(
      map(vm => vm.details?.participants?.find(p => p.userId === message.userId)?.userName)
    ));
    return participantName ?? firstValueFrom(this.translateService.get('CHAT_DETAILS.USER_TYPE.UNKNOWN'));
  }

  delete() {
    this.store.dispatch(ChatDetailsActions.deleteButtonClicked());
  }
}
