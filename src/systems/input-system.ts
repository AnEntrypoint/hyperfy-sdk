import * as THREE from 'three';
import {
  InputState,
  InputBinding,
  Vector3,
  EventEmitter,
  XRController,
  XRState
} from '../types';

// Utility vectors
const tempVector1 = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempVector3 = new THREE.Vector3();

// Constants
const POINTER_LOCK_CHANGE_EVENT = 'pointerlockchange';
const VISIBILITY_CHANGE_EVENT = 'visibilitychange';

// Key code mappings
const KEY_CODE_MAP: Record<string, string> = {
  'Space': 'space',
  'Enter': 'enter',
  'Escape': 'escape',
  'Tab': 'tab',
  'ShiftLeft': 'shiftLeft',
  'ShiftRight': 'shiftRight',
  'ControlLeft': 'controlLeft',
  'ControlRight': 'controlRight',
  'AltLeft': 'altLeft',
  'AltRight': 'altRight',
  'MetaLeft': 'metaLeft',
  'MetaRight': 'metaRight',
  'ArrowUp': 'arrowUp',
  'ArrowDown': 'arrowDown',
  'ArrowLeft': 'arrowLeft',
  'ArrowRight': 'arrowRight',
  'KeyW': 'keyW',
  'KeyA': 'keyA',
  'KeyS': 'keyS',
  'KeyD': 'keyD',
  'KeyQ': 'keyQ',
  'KeyE': 'keyE',
  'KeyR': 'keyR',
  'KeyF': 'keyF',
  'KeyC': 'keyC',
  'KeyB': 'keyB',
  'KeyG': 'keyG',
  'KeyH': 'keyH',
  'KeyJ': 'keyJ',
  'KeyK': 'keyK',
  'KeyL': 'keyL',
  'KeyM': 'keyM',
  'KeyN': 'keyN',
  'KeyO': 'keyO',
  'KeyP': 'keyP',
  'KeyT': 'keyT',
  'KeyY': 'keyY',
  'KeyU': 'keyU',
  'KeyI': 'keyI',
  'KeyO': 'keyO',
  'KeyP': 'keyP',
  'KeyZ': 'keyZ',
  'KeyX': 'keyX',
  'KeyV': 'keyV',
  'KeyB': 'keyB',
  'KeyN': 'keyN',
  'KeyM': 'keyM',
  'Digit1': 'digit1',
  'Digit2': 'digit2',
  'Digit3': 'digit3',
  'Digit4': 'digit4',
  'Digit5': 'digit5',
  'Digit6': 'digit6',
  'Digit7': 'digit7',
  'Digit8': 'digit8',
  'Digit9': 'digit9',
  'Digit0': 'digit0',
  'F1': 'f1',
  'F2': 'f2',
  'F3': 'f3',
  'F4': 'f4',
  'F5': 'f5',
  'F6': 'f6',
  'F7': 'f7',
  'F8': 'f8',
  'F9': 'f9',
  'F10': 'f10',
  'F11': 'f11',
  'F12': 'f12'
};

// Mouse button mappings
const MOUSE_BUTTON_MAP: Record<number, string> = {
  0: 'left',
  1: 'middle',
  2: 'right',
  3: 'back',
  4: 'forward'
};

export class InputSystem implements EventEmitter {
  public element: HTMLElement;
  public enabled: boolean;
  public state: InputState;

  // Input bindings
  private bindings: Map<string, InputBinding[]> = new Map();
  private activeBindings: Map<string, InputBinding> = new Map();

  // Event tracking
  private events: Map<string, Function[]> = new Map();
  private isPointerLocked: boolean = false;
  private wantsPointerLock: boolean = false;
  private isVisible: boolean = true;

  // Touch tracking
  private touches: Map<number, TouchInfo> = new Map();
  private touchStartPos: THREE.Vector3 = new THREE.Vector3();
  private touchActive: boolean = false;

  // Gamepad tracking
  private gamepads: Map<number, GamepadState> = new Map();
  private gamepadPollInterval?: number;

  // XR/VR tracking
  private xrState: XRState = {
    active: false,
    mode: 'vr',
    controllers: {},
    head: {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion()
    }
  };

  // Input context
  private context: string = 'default';
  private contexts: Map<string, Set<string>> = new Map();

  // Event handler references
  private eventHandlers: {
    keydown?: (event: KeyboardEvent) => void;
    keyup?: (event: KeyboardEvent) => void;
    mousedown?: (event: MouseEvent) => void;
    mouseup?: (event: MouseEvent) => void;
    mousemove?: (event: MouseEvent) => void;
    wheel?: (event: WheelEvent) => void;
    touchstart?: (event: TouchEvent) => void;
    touchmove?: (event: TouchEvent) => void;
    touchend?: (event: TouchEvent) => void;
    touchcancel?: (event: TouchEvent) => void;
    pointerlockchange?: () => void;
    visibilitychange?: () => void;
    gamepadconnected?: (event: GamepadEvent) => void;
    gamepaddisconnected?: (event: GamepadEvent) => void;
  } = {};

  constructor(element: HTMLElement) {
    this.element = element;
    this.enabled = true;

    // Initialize input state
    this.state = {
      keyboard: {},
      mouse: {
        left: false,
        right: false,
        middle: false,
        position: new THREE.Vector3(),
        delta: new THREE.Vector3(),
        locked: false
      },
      gamepad: {
        leftStick: new THREE.Vector3(),
        rightStick: new THREE.Vector3(),
        leftTrigger: false,
        rightTrigger: false,
        buttons: {}
      },
      touch: {
        active: false,
        position: new THREE.Vector3(),
        delta: new THREE.Vector3()
      }
    };

    this.setupEventListeners();
    this.startGamepadPolling();
  }

  // Event emitter implementation
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in input system event listener for ${event}:`, error);
        }
      });
    }
  }

  once(event: string, listener: (...args: any[]) => void): void {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    this.on(event, onceWrapper);
  }

  // Input binding system
  addBinding(binding: InputBinding): void {
    if (!this.bindings.has(binding.id)) {
      this.bindings.set(binding.id, []);
    }
    this.bindings.get(binding.id)!.push(binding);

    // Sort by priority (higher priority first)
    this.bindings.get(binding.id)!.sort((a, b) => b.priority - a.priority);
  }

  removeBinding(id: string): void {
    this.bindings.delete(id);
    this.activeBindings.delete(id);
  }

  setContext(context: string): void {
    this.context = context;
    this.updateActiveBindings();
  }

  addContextBinding(context: string, bindingId: string): void {
    if (!this.contexts.has(context)) {
      this.contexts.set(context, new Set());
    }
    this.contexts.get(context)!.add(bindingId);
    this.updateActiveBindings();
  }

  removeContextBinding(context: string, bindingId: string): void {
    const contextBindings = this.contexts.get(context);
    if (contextBindings) {
      contextBindings.delete(bindingId);
    }
    this.updateActiveBindings();
  }

  private updateActiveBindings(): void {
    this.activeBindings.clear();

    // Add default context bindings
    const contextBindings = this.contexts.get(this.context);
    if (contextBindings) {
      for (const bindingId of contextBindings) {
        const bindings = this.bindings.get(bindingId);
        if (bindings && bindings.length > 0) {
          this.activeBindings.set(bindingId, bindings[0]);
        }
      }
    }

    // Add default bindings (those not in any specific context)
    for (const [bindingId, bindings] of this.bindings) {
      if (!this.activeBindings.has(bindingId) && bindings.length > 0) {
        let inOtherContext = false;
        for (const [context, bindingSet] of this.contexts) {
          if (context !== this.context && bindingSet.has(bindingId)) {
            inOtherContext = true;
            break;
          }
        }
        if (!inOtherContext) {
          this.activeBindings.set(bindingId, bindings[0]);
        }
      }
    }
  }

  // Main update loop
  update(delta: number): void {
    if (!this.enabled || !this.isVisible) return;

    this.updateMouse(delta);
    this.updateTouch(delta);
    this.updateGamepad(delta);
    this.updateXR(delta);
    this.processBindings(delta);
  }

  private updateMouse(delta: number): void {
    // Clear mouse delta
    this.state.mouse.delta.set(0, 0, 0);

    // Update pointer lock state
    this.state.mouse.locked = this.isPointerLocked;
  }

  private updateTouch(delta: number): void {
    // Clear touch delta
    this.state.touch.delta.set(0, 0, 0);

    // Update active touch state
    this.state.touch.active = this.touchActive;
  }

  private updateGamepad(delta: number): void {
    // Reset gamepad sticks
    this.state.gamepad.leftStick.set(0, 0, 0);
    this.state.gamepad.rightStick.set(0, 0, 0);

    // Update connected gamepads
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (gamepad && gamepad.connected) {
        this.updateGamepadState(gamepad);
      }
    }
  }

  private updateGamepadState(gamepad: Gamepad): void {
    const state = this.gamepads.get(gamepad.index) || { buttons: {}, axes: [] };

    // Update axes
    for (let i = 0; i < gamepad.axes.length; i++) {
      const axis = gamepad.axes[i];
      const prevAxis = state.axes[i] || 0;

      // Dead zone
      const deadZone = 0.1;
      if (Math.abs(axis) < deadZone) {
        state.axes[i] = 0;
      } else {
        state.axes[i] = axis;
      }

      // Map axes to standard controls
      if (i === 0) this.state.gamepad.leftStick.x = state.axes[i];
      if (i === 1) this.state.gamepad.leftStick.z = -state.axes[i];
      if (i === 2) this.state.gamepad.rightStick.x = state.axes[i];
      if (i === 3) this.state.gamepad.rightStick.z = -state.axes[i];
    }

    // Update buttons
    for (let i = 0; i < gamepad.buttons.length; i++) {
      const button = gamepad.buttons[i];
      const prevButton = state.buttons[i] || { pressed: false };

      state.buttons[i] = {
        pressed: button.pressed,
        value: button.value,
        touched: button.touched
      };

      // Map buttons to standard controls
      if (i === 0) this.state.gamepad.buttons['faceDown'] = button.pressed; // A on Xbox, Cross on PlayStation
      if (i === 1) this.state.gamepad.buttons['faceRight'] = button.pressed; // B on Xbox, Circle on PlayStation
      if (i === 2) this.state.gamepad.buttons['faceLeft'] = button.pressed; // X on Xbox, Square on PlayStation
      if (i === 3) this.state.gamepad.buttons['faceUp'] = button.pressed; // Y on Xbox, Triangle on PlayStation
      if (i === 4) this.state.gamepad.leftTrigger = button.value > 0.5;
      if (i === 5) this.state.gamepad.rightTrigger = button.value > 0.5;
      if (i === 8) this.state.gamepad.buttons['select'] = button.pressed;
      if (i === 9) this.state.gamepad.buttons['start'] = button.pressed;
      if (i === 10) this.state.gamepad.buttons['leftStick'] = button.pressed;
      if (i === 11) this.state.gamepad.buttons['rightStick'] = button.pressed;
      if (i === 12) this.state.gamepad.buttons['dpadUp'] = button.pressed;
      if (i === 13) this.state.gamepad.buttons['dpadDown'] = button.pressed;
      if (i === 14) this.state.gamepad.buttons['dpadLeft'] = button.pressed;
      if (i === 15) this.state.gamepad.buttons['dpadRight'] = button.pressed;
    }

    this.gamepads.set(gamepad.index, state);
  }

  private updateXR(delta: number): void {
    if (!this.xrState.active) return;

    // Update XR controllers
    for (const [hand, controller] of Object.entries(this.xrState.controllers)) {
      if (controller) {
        // Update controller state
        this.updateXRController(hand as 'left' | 'right', controller);
      }
    }
  }

  private updateXRController(hand: 'left' | 'right', controller: XRController): void {
    // This would interface with the actual WebXR API
    // For now, we'll just track the basic structure
  }

  private processBindings(delta: number): void {
    // Process all active bindings
    for (const [bindingId, binding] of this.activeBindings) {
      if (!binding.active) continue;

      let isPressed = false;
      let value = 0;

      switch (binding.type) {
        case 'keyboard':
          if (binding.code) {
            isPressed = this.state.keyboard[binding.code] || false;
          }
          break;
        case 'mouse':
          if (binding.button) {
            isPressed = this.state.mouse[binding.button as keyof typeof this.state.mouse] || false;
          }
          break;
        case 'gamepad':
          if (binding.button) {
            isPressed = this.state.gamepad.buttons[binding.button] || false;
          }
          if (binding.axis) {
            if (binding.axis === 'leftStickX') value = this.state.gamepad.leftStick.x;
            if (binding.axis === 'leftStickY') value = this.state.gamepad.leftStick.z;
            if (binding.axis === 'rightStickX') value = this.state.gamepad.rightStick.x;
            if (binding.axis === 'rightStickY') value = this.state.gamepad.rightStick.z;
          }
          break;
        case 'touch':
          isPressed = this.state.touch.active;
          break;
      }

      // Emit input events
      this.emit('input', {
        bindingId,
        type: binding.type,
        pressed: isPressed,
        value,
        delta
      });
    }
  }

  // Pointer lock management
  async requestPointerLock(): Promise<boolean> {
    if (this.isPointerLocked) return true;
    this.wantsPointerLock = true;

    try {
      await this.element.requestPointerLock();
      return true;
    } catch (error) {
      console.error('Failed to request pointer lock:', error);
      this.wantsPointerLock = false;
      return false;
    }
  }

  exitPointerLock(): void {
    this.wantsPointerLock = false;
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
  }

  // XR/VR management
  async requestXRSession(mode: 'vr' | 'ar' = 'vr'): Promise<boolean> {
    if (!navigator.xr) {
      console.error('WebXR not supported');
      return false;
    }

    try {
      const session = await navigator.xr.requestSession(mode, {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking']
      });

      this.xrState.active = true;
      this.xrState.mode = mode;

      this.emit('xrSessionStart', { session, mode });
      return true;
    } catch (error) {
      console.error('Failed to request XR session:', error);
      return false;
    }
  }

  exitXRSession(): void {
    if (this.xrState.active) {
      this.xrState.active = false;
      this.emit('xrSessionEnd', {});
    }
  }

  // Event listener setup
  private setupEventListeners(): void {
    // Keyboard events
    this.eventHandlers.keydown = this.onKeyDown.bind(this);
    this.eventHandlers.keyup = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.eventHandlers.keydown);
    window.addEventListener('keyup', this.eventHandlers.keyup);

    // Mouse events
    this.eventHandlers.mousedown = this.onMouseDown.bind(this);
    this.eventHandlers.mouseup = this.onMouseUp.bind(this);
    this.eventHandlers.mousemove = this.onMouseMove.bind(this);
    this.eventHandlers.wheel = this.onWheel.bind(this);
    this.element.addEventListener('mousedown', this.eventHandlers.mousedown);
    window.addEventListener('mouseup', this.eventHandlers.mouseup);
    window.addEventListener('mousemove', this.eventHandlers.mousemove);
    this.element.addEventListener('wheel', this.eventHandlers.wheel);

    // Touch events
    this.eventHandlers.touchstart = this.onTouchStart.bind(this);
    this.eventHandlers.touchmove = this.onTouchMove.bind(this);
    this.eventHandlers.touchend = this.onTouchEnd.bind(this);
    this.eventHandlers.touchcancel = this.onTouchCancel.bind(this);
    this.element.addEventListener('touchstart', this.eventHandlers.touchstart);
    this.element.addEventListener('touchmove', this.eventHandlers.touchmove);
    this.element.addEventListener('touchend', this.eventHandlers.touchend);
    this.element.addEventListener('touchcancel', this.eventHandlers.touchcancel);

    // Pointer lock and visibility events
    this.eventHandlers.pointerlockchange = this.onPointerLockChange.bind(this);
    this.eventHandlers.visibilitychange = this.onVisibilityChange.bind(this);
    document.addEventListener(POINTER_LOCK_CHANGE_EVENT, this.eventHandlers.pointerlockchange);
    document.addEventListener(VISIBILITY_CHANGE_EVENT, this.eventHandlers.visibilitychange);

    // Gamepad events
    this.eventHandlers.gamepadconnected = this.onGamepadConnected.bind(this);
    this.eventHandlers.gamepaddisconnected = this.onGamepadDisconnected.bind(this);
    window.addEventListener('gamepadconnected', this.eventHandlers.gamepadconnected);
    window.addEventListener('gamepaddisconnected', this.eventHandlers.gamepaddisconnected);
  }

  // Keyboard event handlers
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.enabled || this.isInputFocused()) return;

    const key = KEY_CODE_MAP[event.code];
    if (!key) return;

    const wasPressed = this.state.keyboard[key] || false;
    this.state.keyboard[key] = true;

    this.emit('keyDown', { key, code: event.code, event });

    if (!wasPressed) {
      this.emit('keyPress', { key, code: event.code, event });
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (!this.enabled || this.isInputFocused()) return;

    const key = KEY_CODE_MAP[event.code];
    if (!key) return;

    this.state.keyboard[key] = false;
    this.emit('keyUp', { key, code: event.code, event });
  }

  // Mouse event handlers
  private onMouseDown(event: MouseEvent): void {
    if (!this.enabled) return;

    const button = MOUSE_BUTTON_MAP[event.button];
    if (!button) return;

    this.state.mouse[button as keyof typeof this.state.mouse] = true;
    this.state.mouse.position.set(event.clientX, event.clientY, 0);

    this.emit('mouseDown', { button, position: this.state.mouse.position.clone(), event });
  }

  private onMouseUp(event: MouseEvent): void {
    if (!this.enabled) return;

    const button = MOUSE_BUTTON_MAP[event.button];
    if (!button) return;

    this.state.mouse[button as keyof typeof this.state.mouse] = false;
    this.state.mouse.position.set(event.clientX, event.clientY, 0);

    this.emit('mouseUp', { button, position: this.state.mouse.position.clone(), event });
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;

    const deltaX = event.movementX || 0;
    const deltaY = event.movementY || 0;

    this.state.mouse.position.set(event.clientX, event.clientY, 0);
    this.state.mouse.delta.x += deltaX;
    this.state.mouse.delta.y += deltaY;

    this.emit('mouseMove', {
      position: this.state.mouse.position.clone(),
      delta: new THREE.Vector3(deltaX, deltaY, 0),
      locked: this.isPointerLocked,
      event
    });
  }

  private onWheel(event: WheelEvent): void {
    if (!this.enabled) return;

    event.preventDefault();
    const delta = event.deltaY;
    this.emit('wheel', { delta, event });
  }

  // Touch event handlers
  private onTouchStart(event: TouchEvent): void {
    if (!this.enabled) return;

    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchInfo = {
        id: touch.identifier,
        startPosition: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        position: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        delta: new THREE.Vector3(),
        startTime: Date.now()
      };

      this.touches.set(touch.identifier, touchInfo);
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.state.touch.active = true;
      this.state.touch.position.set(touch.clientX, touch.clientY, 0);
      this.touchStartPos.copy(this.state.touch.position);
      this.touchActive = true;
    }

    this.emit('touchStart', { touches: this.getTouchData(), event });
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.enabled) return;

    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchInfo = this.touches.get(touch.identifier);

      if (touchInfo) {
        const prevPosition = touchInfo.position.clone();
        touchInfo.position.set(touch.clientX, touch.clientY, 0);
        touchInfo.delta.subVectors(touchInfo.position, prevPosition);
      }
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.state.touch.position.set(touch.clientX, touch.clientY, 0);
      this.state.touch.delta.subVectors(this.state.touch.position, this.touchStartPos);
    }

    this.emit('touchMove', { touches: this.getTouchData(), event });
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.enabled) return;

    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.touches.delete(touch.identifier);
    }

    if (event.touches.length === 0) {
      this.state.touch.active = false;
      this.state.touch.delta.set(0, 0, 0);
      this.touchActive = false;
    }

    this.emit('touchEnd', { touches: this.getTouchData(), event });
  }

  private onTouchCancel(event: TouchEvent): void {
    if (!this.enabled) return;

    event.preventDefault();
    this.onTouchEnd(event);
    this.emit('touchCancel', { touches: this.getTouchData(), event });
  }

  // Pointer lock and visibility handlers
  private onPointerLockChange(): void {
    const wasLocked = this.isPointerLocked;
    this.isPointerLocked = document.pointerLockElement === this.element;

    if (wasLocked !== this.isPointerLocked) {
      this.emit('pointerLockChange', { locked: this.isPointerLocked });
    }

    // If pointer lock was lost but we still want it, try to reacquire
    if (!this.isPointerLocked && this.wantsPointerLock) {
      setTimeout(() => this.requestPointerLock(), 100);
    }
  }

  private onVisibilityChange(): void {
    this.isVisible = !document.hidden;
    if (!this.isVisible) {
      // Release all keys when page becomes hidden
      for (const key in this.state.keyboard) {
        this.state.keyboard[key] = false;
      }
    }
    this.emit('visibilityChange', { visible: this.isVisible });
  }

  // Gamepad handlers
  private onGamepadConnected(event: GamepadEvent): void {
    this.emit('gamepadConnected', { gamepad: event.gamepad });
  }

  private onGamepadDisconnected(event: GamepadEvent): void {
    this.gamepads.delete(event.gamepad.index);
    this.emit('gamepadDisconnected', { gamepad: event.gamepad });
  }

  // Utility methods
  private isInputFocused(): boolean {
    const activeElement = document.activeElement;
    return activeElement?.tagName === 'INPUT' ||
           activeElement?.tagName === 'TEXTAREA' ||
           activeElement?.tagName === 'SELECT' ||
           activeElement?.hasAttribute('contenteditable');
  }

  private getTouchData(): TouchData[] {
    const touches: TouchData[] = [];
    for (const [id, info] of this.touches) {
      touches.push({
        id,
        position: info.position.clone(),
        delta: info.delta.clone(),
        startTime: info.startTime
      });
    }
    return touches;
  }

  private startGamepadPolling(): void {
    this.gamepadPollInterval = window.setInterval(() => {
      if (this.enabled) {
        this.updateGamepad(1 / 60); // 60 FPS polling
      }
    }, 1000 / 60);
  }

  // Public API methods
  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    this.releaseAllInputs();
  }

  releaseAllInputs(): void {
    // Clear keyboard state
    for (const key in this.state.keyboard) {
      this.state.keyboard[key] = false;
    }

    // Clear mouse state
    this.state.mouse.left = false;
    this.state.mouse.right = false;
    this.state.mouse.middle = false;
    this.state.mouse.delta.set(0, 0, 0);

    // Clear touch state
    this.state.touch.active = false;
    this.state.touch.delta.set(0, 0, 0);
    this.touchActive = false;

    // Clear gamepad state
    this.state.gamepad.leftStick.set(0, 0, 0);
    this.state.gamepad.rightStick.set(0, 0, 0);
    for (const button in this.state.gamepad.buttons) {
      this.state.gamepad.buttons[button] = false;
    }
  }

  getInputState(): InputState {
    return JSON.parse(JSON.stringify(this.state));
  }

  isKeyPressed(key: string): boolean {
    return this.state.keyboard[key] || false;
  }

  isMouseButtonPressed(button: string): boolean {
    return this.state.mouse[button as keyof typeof this.state.mouse] || false;
  }

  isGamepadButtonPressed(button: string): boolean {
    return this.state.gamepad.buttons[button] || false;
  }

  getMousePosition(): THREE.Vector3 {
    return this.state.mouse.position.clone();
  }

  getMouseDelta(): THREE.Vector3 {
    return this.state.mouse.delta.clone();
  }

  getTouchPosition(): THREE.Vector3 {
    return this.state.touch.position.clone();
  }

  getTouchDelta(): THREE.Vector3 {
    return this.state.touch.delta.clone();
  }

  getLeftStick(): THREE.Vector3 {
    return this.state.gamepad.leftStick.clone();
  }

  getRightStick(): THREE.Vector3 {
    return this.state.gamepad.rightStick.clone();
  }

  // Cleanup
  destroy(): void {
    this.disable();

    // Remove event listeners
    if (this.eventHandlers.keydown) {
      window.removeEventListener('keydown', this.eventHandlers.keydown);
    }
    if (this.eventHandlers.keyup) {
      window.removeEventListener('keyup', this.eventHandlers.keyup);
    }
    if (this.eventHandlers.mousedown) {
      this.element.removeEventListener('mousedown', this.eventHandlers.mousedown);
    }
    if (this.eventHandlers.mouseup) {
      window.removeEventListener('mouseup', this.eventHandlers.mouseup);
    }
    if (this.eventHandlers.mousemove) {
      window.removeEventListener('mousemove', this.eventHandlers.mousemove);
    }
    if (this.eventHandlers.wheel) {
      this.element.removeEventListener('wheel', this.eventHandlers.wheel);
    }
    if (this.eventHandlers.touchstart) {
      this.element.removeEventListener('touchstart', this.eventHandlers.touchstart);
    }
    if (this.eventHandlers.touchmove) {
      this.element.removeEventListener('touchmove', this.eventHandlers.touchmove);
    }
    if (this.eventHandlers.touchend) {
      this.element.removeEventListener('touchend', this.eventHandlers.touchend);
    }
    if (this.eventHandlers.touchcancel) {
      this.element.removeEventListener('touchcancel', this.eventHandlers.touchcancel);
    }
    if (this.eventHandlers.pointerlockchange) {
      document.removeEventListener(POINTER_LOCK_CHANGE_EVENT, this.eventHandlers.pointerlockchange);
    }
    if (this.eventHandlers.visibilitychange) {
      document.removeEventListener(VISIBILITY_CHANGE_EVENT, this.eventHandlers.visibilitychange);
    }
    if (this.eventHandlers.gamepadconnected) {
      window.removeEventListener('gamepadconnected', this.eventHandlers.gamepadconnected);
    }
    if (this.eventHandlers.gamepaddisconnected) {
      window.removeEventListener('gamepaddisconnected', this.eventHandlers.gamepaddisconnected);
    }

    // Clear intervals
    if (this.gamepadPollInterval) {
      clearInterval(this.gamepadPollInterval);
    }

    // Clear state
    this.bindings.clear();
    this.activeBindings.clear();
    this.contexts.clear();
    this.touches.clear();
    this.gamepads.clear();
    this.events.clear();
  }
}

// Supporting types
interface TouchInfo {
  id: number;
  startPosition: THREE.Vector3;
  position: THREE.Vector3;
  delta: THREE.Vector3;
  startTime: number;
}

interface TouchData {
  id: number;
  position: THREE.Vector3;
  delta: THREE.Vector3;
  startTime: number;
}

interface GamepadState {
  buttons: Record<string, { pressed: boolean; value: number; touched: boolean }>;
  axes: number[];
}