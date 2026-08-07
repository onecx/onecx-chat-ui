import { DestroyRef, Injectable, inject } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

/**
 * Manages scroll position detection and smooth scrolling for chat containers.
 *
 * Extracted from ChatComponent to keep scroll state management separate
 * from chat display logic. Tracks whether the user is near the bottom of
 * a scrollable container and provides methods to scroll smoothly to the
 * latest content.
 */
@Injectable({ providedIn: 'root' })
export class ChatScrollService {
  private readonly destroyRef = inject(DestroyRef)

  private readonly isAtBottomSubject = new BehaviorSubject<boolean>(true)
  private scrollContainer: HTMLElement | null = null
  private scrollListener: ((event: Event) => void) | null = null

  /** Pixel threshold: user is considered "at bottom" when within this many pixels */
  private readonly defaultNearBottomThresholdPx = 24

  /**
   * Observable that emits the current "at bottom" state.
   * True means the user is viewing the latest content;
   * false means the user has scrolled up to read older content.
   */
  public isAtBottom$: Observable<boolean> = this.isAtBottomSubject.asObservable()

  /**
   * Initializes the service with a scrollable container element.
   * Call this after the view has rendered so the DOM element is available.
   */
  public init(container: HTMLElement, nearBottomThresholdPx = this.defaultNearBottomThresholdPx): void {
    this.scrollContainer = container

    // Remove any existing listener to prevent duplicates on re-init
    this.removeScrollListener()

    // Run initial evaluation so the BehaviorSubject reflects actual position
    this.evaluateScrollPosition(container, nearBottomThresholdPx)

    // Store the listener reference so we can remove it later
    this.scrollListener = (_event: Event): void => {
      if (!this.scrollContainer) return
      this.evaluateScrollPosition(this.scrollContainer, nearBottomThresholdPx)
    }
    container.addEventListener('scroll', this.scrollListener)

    // Clean up when the consuming component is destroyed
    this.destroyRef.onDestroy(() => {
      this.removeScrollListener()
      this.scrollContainer = null
    })
  }

  /**
   * Resets the isAtBottom state to true without checking the actual DOM.
   * Call this after a programmatic scroll so consumers know the view is at bottom.
   */
  public resetToBottom(): void {
    this.isAtBottomSubject.next(true)
  }

  /**
   * Forces an evaluation of the current scroll position.
   * Call this after content changes (new messages, loading state, etc.).
   */
  public checkPosition(): void {
    if (!this.scrollContainer) return
    this.evaluateScrollPosition(this.scrollContainer)
  }

  /**
   * Scrolls the container to the bottom smoothly.
   */
  public scrollToBottom(): void {
    const container = this.scrollContainer
    if (!container) return

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }

  /**
   * Disposes all listeners and clears internal state.
   * Normally handled automatically via DestroyRef, but available for manual cleanup.
   */
  public dispose(): void {
    this.removeScrollListener()
    this.scrollContainer = null
  }

  private removeScrollListener(): void {
    if (this.scrollContainer && this.scrollListener) {
      this.scrollContainer.removeEventListener('scroll', this.scrollListener)
      this.scrollListener = null
    }
  }

  private evaluateScrollPosition(
    container: HTMLElement,
    threshold: number = this.defaultNearBottomThresholdPx,
  ): void {
    const distanceToBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight)
    const wasAtBottom = this.isAtBottomSubject.value
    const isAtBottom = distanceToBottom <= threshold

    // Only emit if the state actually changed
    if (isAtBottom !== wasAtBottom) {
      this.isAtBottomSubject.next(isAtBottom)
    }
  }
}
