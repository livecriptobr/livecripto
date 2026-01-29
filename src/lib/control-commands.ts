export type ControlSection = 'alerts' | 'video' | 'music'

export type ControlAction =
  | 'toggle_autoplay'
  | 'pause'
  | 'resume'
  | 'skip'
  | 'replay'
  | 'mute'
  | 'unmute'
  | 'volume_up'
  | 'volume_down'
  | 'clear_queue'

export interface ControlCommand {
  section: ControlSection
  action: ControlAction
  timestamp: number
}

export interface SectionState {
  autoplay: boolean
  paused: boolean
  muted: boolean
  volume: number
  queueSize: number
}

export interface ControlState {
  alerts: SectionState
  video: SectionState
  music: SectionState
}

export const DEFAULT_STATE: ControlState = {
  alerts: { autoplay: true, paused: false, muted: false, volume: 80, queueSize: 0 },
  video: { autoplay: true, paused: false, muted: false, volume: 80, queueSize: 0 },
  music: { autoplay: true, paused: false, muted: false, volume: 80, queueSize: 0 },
}

export const VALID_SECTIONS: ControlSection[] = ['alerts', 'video', 'music']

export const VALID_ACTIONS: ControlAction[] = [
  'toggle_autoplay',
  'pause',
  'resume',
  'skip',
  'replay',
  'mute',
  'unmute',
  'volume_up',
  'volume_down',
  'clear_queue',
]
