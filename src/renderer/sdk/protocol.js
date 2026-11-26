export const MARK = 'biomashine-bridge';

export const MessageType = Object.freeze({
    HELLO: 'hello',
    INIT: 'init',
    THEME: 'theme',
    DESIGN: 'design',
    STATE_REQUEST: 'stateRequest',
    CANVAS_COMMAND: 'canvasCommand',
    CANVAS_STATE: 'canvasState',
    CANVAS_REQUEST: 'canvasRequest',
    CANVAS_LOG: 'canvasLog',
    SNAPSHOT_REQUEST: 'snapshotRequest',
    SNAPSHOT_RESPONSE: 'snapshotResponse',
    CANVAS_INIT: 'canvasInit',
    LAYOUT_CHANGE: 'layoutChange',
    STATE_RESPONSE: 'stateResponse',
    INVOKE: 'invoke',
    CONFIG: 'config',
    CONFIRM: 'confirm',
    PILLS: 'pills',
    CRASH: 'crash',
    RESPONSE: 'response'
});
