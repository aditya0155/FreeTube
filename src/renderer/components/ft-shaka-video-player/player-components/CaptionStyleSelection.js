import shaka from 'shaka-player'

import i18n from '../../../i18n/index'
import { PlayerIcons } from '../../../../constants'

const CaptionStylePage = {
  ROOT: 'root',
  SIZE: 'size',
  POSITION: 'position'
}

export class CaptionStyleSelection extends shaka.ui.Element {
  /**
   * @param {EventTarget} events
   * @param {!HTMLElement} parent
   * @param {!shaka.ui.Controls} controls
   */
  constructor(events, parent, controls) {
    super(parent, controls)

    /** @private {!HTMLButtonElement} */
    this.button_ = shaka.util.Dom.createButton()
    this.button_.setAttribute('aria-haspopup', 'true')
    this.button_.setAttribute('aria-expanded', 'false')
    this.button_.classList.add('shaka-overflow-button')

    /** @private {!shaka.ui.Icon} */
    this.icon_ = new shaka.ui.Icon(this.button_, PlayerIcons.TUNE_FILLED)

    const label = shaka.util.Dom.createHTMLElement('label')
    label.classList.add('shaka-overflow-button-label')
    label.classList.add('shaka-overflow-menu-only')
    label.classList.add('shaka-overflow-button-label-inline')

    /** @private {!HTMLElement} */
    this.nameSpan_ = shaka.util.Dom.createHTMLElement('span')
    label.appendChild(this.nameSpan_)
    this.button_.appendChild(label)
    this.parent.appendChild(this.button_)

    /** @private {!HTMLElement} */
    this.menu_ = shaka.util.Dom.createHTMLElement('div')
    this.menu_.classList.add('ft-caption-style-menu')
    this.menu_.classList.add('shaka-no-propagation')
    this.menu_.classList.add('shaka-show-controls-on-mouse-over')
    this.menu_.classList.add('shaka-sub-menu')
    this.menu_.classList.add('shaka-hidden')
    this.menu_.setAttribute('role', 'menu')
    this.parent.appendChild(this.menu_)

    /** @private {!HTMLButtonElement} */
    this.backButton_ = shaka.util.Dom.createButton()
    this.backButton_.classList.add('shaka-back-to-overflow-button')
    this.menu_.appendChild(this.backButton_)

    /** @private {!shaka.ui.Icon} */
    this.backIcon_ = new shaka.ui.Icon(this.backButton_,
      shaka.ui.Enums.MaterialDesignSVGIcons.BACK)

    /** @private {!HTMLElement} */
    this.backSpan_ = shaka.util.Dom.createHTMLElement('span')
    this.backButton_.appendChild(this.backSpan_)

    /** @private {!HTMLButtonElement} */
    this.sizePageButton_ = this.createPageButton_(CaptionStylePage.SIZE)

    /** @private {!HTMLElement} */
    this.sizePageSpan_ = shaka.util.Dom.createHTMLElement('span')
    this.sizePageButton_.appendChild(this.sizePageSpan_)

    /** @private {!HTMLButtonElement} */
    this.positionPageButton_ = this.createPageButton_(CaptionStylePage.POSITION)

    /** @private {!HTMLElement} */
    this.positionPageSpan_ = shaka.util.Dom.createHTMLElement('span')
    this.positionPageButton_.appendChild(this.positionPageSpan_)

    /** @private {!Array<{ button: HTMLButtonElement, span: HTMLElement, value: number }>} */
    this.sizeButtons_ = this.createSizeButtons_()

    /** @private {!Array<{ button: HTMLButtonElement, span: HTMLElement, value: shaka.config.PositionArea }>} */
    this.positionButtons_ = this.createPositionButtons_()

    /** @private {string} */
    this.currentPage_ = CaptionStylePage.ROOT

    /** @private {?MutationObserver} */
    this.parentMutationObserver_ = null

    let parentHidden = this.parent.classList.contains('shaka-hidden')
    if (window.MutationObserver) {
      this.parentMutationObserver_ = new MutationObserver(() => {
        const isParentHidden = this.parent.classList.contains('shaka-hidden')
        if (isParentHidden && !parentHidden) {
          this.closeSubMenu_(false)
        }
        parentHidden = isParentHidden
      })
      this.parentMutationObserver_.observe(this.parent, {
        attributes: true,
        attributeFilter: ['class']
      })
    }

    this.eventManager.listen(this.button_, 'click', () => {
      if (this.controls.isOpaque()) {
        this.onButtonClick_()
      }
    })

    this.eventManager.listen(this.backButton_, 'click', event => {
      event.stopPropagation()
      this.onBackButtonClick_()
    })

    this.eventManager.listen(this.sizePageButton_, 'click', () => {
      this.showPage_(CaptionStylePage.SIZE)
    })

    this.eventManager.listen(this.positionPageButton_, 'click', () => {
      this.showPage_(CaptionStylePage.POSITION)
    })

    this.eventManager.listen(events, 'localeChanged', () => {
      this.updateLocalizedStrings()
    })

    this.eventManager.listenMulti(this.player, [
      'loading',
      'unloading',
      'configurationchanged',
      'trackschanged',
      'textchanged'
    ], () => {
      this.updateCurrentSelection_()
      this.checkAvailability()
    })

    this.eventManager.listen(this.controls, 'submenuclose', () => {
      this.button_.setAttribute('aria-expanded', 'false')
      this.controls.hideTextStylePreview()
      this.showPage_(CaptionStylePage.ROOT, false)
    })

    this.updateLocalizedStrings()
    this.updateCurrentSelection_()
    this.showPage_(CaptionStylePage.ROOT, false)
    this.checkAvailability()
  }

  /** @override */
  release() {
    if (this.parentMutationObserver_) {
      this.parentMutationObserver_.disconnect()
      this.parentMutationObserver_ = null
    }
    super.release()
  }

  /** @override */
  checkAvailability() {
    const tracks = this.player.getTextTracks() || []
    const hasActiveTrack = tracks.some(track => track.active)
    const available = hasActiveTrack && this.controls.getConfig().captionsStyles

    shaka.ui.Utils.setDisplay(this.button_, available && !this.isSubMenuOpened)
    this.button_.ariaPressed = available ? 'true' : 'false'

    if (!available) {
      this.closeSubMenu_(false)
    }
  }

  /** @override */
  updateLocalizedStrings() {
    const LocIds = shaka.ui.Locales.Ids
    const subtitleStyleText = i18n.global.t('Video.Player.Subtitle Style')

    this.button_.ariaLabel = subtitleStyleText
    this.nameSpan_.textContent = subtitleStyleText
    this.backButton_.ariaLabel = this.localization.resolve(LocIds.BACK)
    const subtitleSizeText = this.localization.resolve(LocIds.SUBTITLE_SIZE)
    this.sizePageButton_.ariaLabel = subtitleSizeText
    this.sizePageSpan_.textContent = `${subtitleSizeText} ›`
    const subtitlePositionText = this.localization.resolve(LocIds.SUBTITLE_POSITION)
    this.positionPageButton_.ariaLabel = subtitlePositionText
    this.positionPageSpan_.textContent = `${subtitlePositionText} ›`

    for (const { span, value } of this.sizeButtons_) {
      span.textContent = this.getFontScaleFactorLabel_(value)
    }

    for (const { span, value } of this.positionButtons_) {
      span.textContent = this.getPositionLabel_(value)
    }

    this.updateBackButtonText_()
    this.updateCurrentSelection_()
  }

  /**
   * @param {string} page
   * @returns {!HTMLButtonElement}
   * @private
   */
  createPageButton_(page) {
    const button = shaka.util.Dom.createButton()
    button.classList.add('shaka-overflow-button')
    button.setAttribute('data-caption-style-page', page)
    button.setAttribute('aria-haspopup', 'true')
    button.setAttribute('aria-expanded', 'false')
    this.menu_.appendChild(button)
    return button
  }

  /**
   * @returns {!Array<{ button: HTMLButtonElement, span: HTMLElement, value: number }>}
   * @private
   */
  createSizeButtons_() {
    const buttons = []
    const scaleFactors = this.controls.getConfig().captionsFontScaleFactors

    for (const fontScaleFactor of scaleFactors) {
      const { button, span } = this.createChoiceButton_(CaptionStylePage.SIZE)
      this.eventManager.listen(button, 'click', () => {
        this.player.configure('textDisplayer.fontScaleFactor', fontScaleFactor)
        this.updateCurrentSelection_()
        this.showPage_(CaptionStylePage.ROOT, false)
        this.sizePageButton_.focus()
      })
      shaka.ui.Utils.addHoverAndFocusListeners(
        this.eventManager,
        button,
        () => this.controls.updateTextStylePreview({ fontScaleFactor }),
        () => this.controls.resetTextStylePreview()
      )
      buttons.push({ button, span, value: fontScaleFactor })
    }

    return buttons
  }

  /**
   * @returns {!Array<{ button: HTMLButtonElement, span: HTMLElement, value: shaka.config.PositionArea }>}
   * @private
   */
  createPositionButtons_() {
    const buttons = []

    for (const positionArea of Object.values(shaka.config.PositionArea)) {
      const { button, span } = this.createChoiceButton_(CaptionStylePage.POSITION)
      this.eventManager.listen(button, 'click', () => {
        this.player.configure('textDisplayer.positionArea', positionArea)
        this.updateCurrentSelection_()
        this.showPage_(CaptionStylePage.ROOT, false)
        this.positionPageButton_.focus()
      })
      shaka.ui.Utils.addHoverAndFocusListeners(
        this.eventManager,
        button,
        () => this.controls.updateTextStylePreview({ positionArea }),
        () => this.controls.resetTextStylePreview()
      )
      buttons.push({ button, span, value: positionArea })
    }

    return buttons
  }

  /**
   * @param {string} page
   * @returns {{ button: HTMLButtonElement, span: HTMLElement }}
   * @private
   */
  createChoiceButton_(page) {
    const button = shaka.util.Dom.createButton()
    button.setAttribute('data-caption-style-page', page)
    button.setAttribute('role', 'menuitemradio')
    button.setAttribute('aria-checked', 'false')

    const span = shaka.util.Dom.createHTMLElement('span')
    button.appendChild(span)
    this.menu_.appendChild(button)

    return { button, span }
  }

  /** @private */
  onButtonClick_() {
    if (!this.menu_.classList.contains('shaka-hidden')) {
      this.closeSubMenu_(true)
      this.button_.focus()
      return
    }

    if (!this.parent.classList.contains('shaka-context-menu')) {
      this.controls.hideContextMenus()
    }

    this.controls.dispatchEvent(new shaka.util.FakeEvent('submenuopen'))
    this.showPage_(CaptionStylePage.ROOT, false)
    shaka.ui.Utils.setDisplay(this.menu_, true)
    this.button_.setAttribute('aria-expanded', 'true')
    this.sizePageButton_.focus()
  }

  /** @private */
  onBackButtonClick_() {
    if (this.currentPage_ === CaptionStylePage.ROOT) {
      this.closeSubMenu_(true)
      this.button_.focus()
      return
    }

    const previousPage = this.currentPage_
    this.showPage_(CaptionStylePage.ROOT)
    if (previousPage === CaptionStylePage.SIZE) {
      this.sizePageButton_.focus()
    } else {
      this.positionPageButton_.focus()
    }
  }

  /**
   * @param {boolean} showParent
   * @private
   */
  closeSubMenu_(showParent) {
    if (this.menu_.classList.contains('shaka-hidden')) {
      return
    }

    shaka.ui.Utils.setDisplay(this.menu_, false)
    this.button_.setAttribute('aria-expanded', 'false')
    this.controls.hideTextStylePreview()
    this.controls.dispatchEvent(new shaka.util.FakeEvent('submenuclose'))

    if (showParent) {
      shaka.ui.Utils.setDisplay(this.parent, true)
    }
  }

  /**
   * @param {string} page
   * @param {boolean=} focusChosenItem
   * @private
   */
  showPage_(page, focusChosenItem = true) {
    this.currentPage_ = page
    this.sizePageButton_.setAttribute(
      'aria-expanded',
      page === CaptionStylePage.SIZE ? 'true' : 'false'
    )
    this.positionPageButton_.setAttribute(
      'aria-expanded',
      page === CaptionStylePage.POSITION ? 'true' : 'false'
    )

    for (const child of this.menu_.children) {
      if (child === this.backButton_) {
        continue
      }
      shaka.ui.Utils.setDisplay(
        child,
        child.getAttribute('data-caption-style-page') === page
      )
    }

    if (page === CaptionStylePage.ROOT) {
      this.controls.hideTextStylePreview()
    } else {
      this.controls.showTextStylePreview()
    }

    this.updateBackButtonText_()
    this.updateCurrentSelection_()

    if (focusChosenItem && page !== CaptionStylePage.ROOT) {
      const chosenItem = this.menu_.querySelector(
        `[data-caption-style-page="${page}"] .shaka-chosen-item`
      )
      chosenItem?.parentElement.focus()
    }
  }

  /** @private */
  updateCurrentSelection_() {
    if (!this.player) {
      return
    }

    const textDisplayer = this.player.getConfiguration().textDisplayer
    this.updateChosenItem_(this.sizeButtons_, textDisplayer.fontScaleFactor)
    this.updateChosenItem_(this.positionButtons_, textDisplayer.positionArea)
  }

  /**
   * @template T
   * @param {!Array<{ button: HTMLButtonElement, span: HTMLElement, value: T }>} choices
   * @param {T} currentValue
   * @private
   */
  updateChosenItem_(choices, currentValue) {
    for (const { button, span, value } of choices) {
      const isChosen = value === currentValue
      const checkmark = button.querySelector('.shaka-ui-icon.shaka-chosen-item')

      button.setAttribute('aria-checked', isChosen ? 'true' : 'false')
      span.classList.toggle('shaka-chosen-item', isChosen)

      if (isChosen && !checkmark) {
        button.appendChild(shaka.ui.Utils.checkmarkIcon())
      } else if (!isChosen && checkmark) {
        checkmark.remove()
      }
    }
  }

  /** @private */
  updateBackButtonText_() {
    const LocIds = shaka.ui.Locales.Ids
    if (this.currentPage_ === CaptionStylePage.SIZE) {
      this.backSpan_.textContent = this.localization.resolve(LocIds.SUBTITLE_SIZE)
    } else if (this.currentPage_ === CaptionStylePage.POSITION) {
      this.backSpan_.textContent = this.localization.resolve(LocIds.SUBTITLE_POSITION)
    } else {
      this.backSpan_.textContent = i18n.global.t('Video.Player.Subtitle Style')
    }
  }

  /**
   * @param {number} fontScaleFactor
   * @returns {string}
   * @private
   */
  getFontScaleFactorLabel_(fontScaleFactor) {
    return fontScaleFactor * 100 + '%'
  }

  /**
   * @param {shaka.config.PositionArea} positionArea
   * @returns {string}
   * @private
   */
  getPositionLabel_(positionArea) {
    const LocIds = shaka.ui.Locales.Ids
    switch (positionArea) {
      case shaka.config.PositionArea.DEFAULT:
        return this.localization.resolve(LocIds.DEFAULT)
      case shaka.config.PositionArea.TOP_LEFT:
        return this.localization.resolve(LocIds.TOP_LEFT)
      case shaka.config.PositionArea.TOP_CENTER:
        return this.localization.resolve(LocIds.TOP_CENTER)
      case shaka.config.PositionArea.TOP_RIGHT:
        return this.localization.resolve(LocIds.TOP_RIGHT)
      case shaka.config.PositionArea.CENTER_LEFT:
        return this.localization.resolve(LocIds.CENTER_LEFT)
      case shaka.config.PositionArea.CENTER:
        return this.localization.resolve(LocIds.CENTER)
      case shaka.config.PositionArea.CENTER_RIGHT:
        return this.localization.resolve(LocIds.CENTER_RIGHT)
      case shaka.config.PositionArea.BOTTOM_LEFT:
        return this.localization.resolve(LocIds.BOTTOM_LEFT)
      case shaka.config.PositionArea.BOTTOM_CENTER:
        return this.localization.resolve(LocIds.BOTTOM_CENTER)
      case shaka.config.PositionArea.BOTTOM_RIGHT:
        return this.localization.resolve(LocIds.BOTTOM_RIGHT)
      default:
        return ''
    }
  }
}
