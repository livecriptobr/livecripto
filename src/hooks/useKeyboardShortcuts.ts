import { useEffect, useCallback, useState } from 'react'
import type { ControlSection, ControlAction } from '@/lib/control-commands'

export interface ShortcutBinding {
  key: string
  section: ControlSection
  action: ControlAction
  label: string
}

const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  // Alerts: bare keys
  { key: '1', section: 'alerts', action: 'toggle_autoplay', label: 'Autoplay' },
  { key: 'q', section: 'alerts', action: 'pause', label: 'Pausar' },
  { key: 'w', section: 'alerts', action: 'resume', label: 'Retomar' },
  { key: 'e', section: 'alerts', action: 'skip', label: 'Pular' },
  { key: 'r', section: 'alerts', action: 'replay', label: 'Replay' },
  { key: 'm', section: 'alerts', action: 'mute', label: 'Mudo' },
  { key: 'u', section: 'alerts', action: 'unmute', label: 'Demutar' },
  { key: '=', section: 'alerts', action: 'volume_up', label: 'Vol +' },
  { key: '-', section: 'alerts', action: 'volume_down', label: 'Vol -' },
  { key: 'c', section: 'alerts', action: 'clear_queue', label: 'Limpar' },
  // Video: Shift+key
  { key: 'Shift+1', section: 'video', action: 'toggle_autoplay', label: 'Autoplay' },
  { key: 'Shift+q', section: 'video', action: 'pause', label: 'Pausar' },
  { key: 'Shift+w', section: 'video', action: 'resume', label: 'Retomar' },
  { key: 'Shift+e', section: 'video', action: 'skip', label: 'Pular' },
  { key: 'Shift+r', section: 'video', action: 'replay', label: 'Replay' },
  { key: 'Shift+m', section: 'video', action: 'mute', label: 'Mudo' },
  { key: 'Shift+u', section: 'video', action: 'unmute', label: 'Demutar' },
  { key: 'Shift+=', section: 'video', action: 'volume_up', label: 'Vol +' },
  { key: 'Shift+-', section: 'video', action: 'volume_down', label: 'Vol -' },
  { key: 'Shift+c', section: 'video', action: 'clear_queue', label: 'Limpar' },
  // Music: Ctrl+key
  { key: 'Ctrl+1', section: 'music', action: 'toggle_autoplay', label: 'Autoplay' },
  { key: 'Ctrl+q', section: 'music', action: 'pause', label: 'Pausar' },
  { key: 'Ctrl+w', section: 'music', action: 'resume', label: 'Retomar' },
  { key: 'Ctrl+e', section: 'music', action: 'skip', label: 'Pular' },
  { key: 'Ctrl+r', section: 'music', action: 'replay', label: 'Replay' },
  { key: 'Ctrl+m', section: 'music', action: 'mute', label: 'Mudo' },
  { key: 'Ctrl+u', section: 'music', action: 'unmute', label: 'Demutar' },
  { key: 'Ctrl+=', section: 'music', action: 'volume_up', label: 'Vol +' },
  { key: 'Ctrl+-', section: 'music', action: 'volume_down', label: 'Vol -' },
  { key: 'Ctrl+c', section: 'music', action: 'clear_queue', label: 'Limpar' },
]

const STORAGE_KEY = 'livecripto_keyboard_shortcuts'

function loadShortcuts(): ShortcutBinding[] {
  if (typeof window === 'undefined') return DEFAULT_SHORTCUTS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as ShortcutBinding[]
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHORTCUTS
}

function buildKeyString(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

export function getShortcutForAction(
  shortcuts: ShortcutBinding[],
  section: ControlSection,
  action: ControlAction
): string | undefined {
  const binding = shortcuts.find(s => s.section === section && s.action === action)
  return binding?.key
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  onCommand?: (section: ControlSection, action: ControlAction) => void
}

export function useKeyboardShortcuts({ enabled = true, onCommand }: UseKeyboardShortcutsOptions) {
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>(() => loadShortcuts())

  const saveShortcuts = useCallback((newShortcuts: ShortcutBinding[]) => {
    setShortcuts(newShortcuts)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newShortcuts))
  }, [])

  const resetShortcuts = useCallback(() => {
    saveShortcuts(DEFAULT_SHORTCUTS)
  }, [saveShortcuts])

  useEffect(() => {
    if (!enabled || !onCommand) return

    const handler = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const keyString = buildKeyString(e)
      const match = shortcuts.find(s => s.key.toLowerCase() === keyString)
      if (match) {
        e.preventDefault()
        onCommand(match.section, match.action)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, onCommand, shortcuts])

  return { shortcuts, saveShortcuts, resetShortcuts }
}
