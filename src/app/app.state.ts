import { RouterReducerState } from '@ngrx/router-store'
import { OneCxState } from '@onecx/ngrx-integration-interface'

export interface State {
  router: RouterReducerState
  onecx: OneCxState
}
