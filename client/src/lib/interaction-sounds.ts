import { STORAGE_KEYS } from '@/config/constants'

export type SoundActivity = 'button' | 'navigation' | 'selection'
export type SoundPreset = 'soft-click' | 'bright-chime' | 'low-pop' | 'off'
export type InteractionSoundPreferences = Record<SoundActivity, SoundPreset>

export const INTERACTION_SOUND_OPTIONS: Array<{ value: SoundPreset; label: string }> = [
  { value: 'soft-click', label: 'Soft click' },
  { value: 'bright-chime', label: 'Bright chime' },
  { value: 'low-pop', label: 'Low pop' },
  { value: 'off', label: 'Off' },
]

const defaultPreferences: InteractionSoundPreferences = {
  button: 'soft-click',
  navigation: 'bright-chime',
  selection: 'low-pop',
}
export const DEFAULT_INTERACTION_SOUND_VOLUME = 60
const validPresets = new Set<string>(INTERACTION_SOUND_OPTIONS.map(({ value }) => value))
let audioContext: AudioContext | undefined

export function readInteractionSoundVolume(): number {
  const stored = localStorage.getItem(STORAGE_KEYS.INTERACTION_SOUND_VOLUME)
  if (stored === null) return DEFAULT_INTERACTION_SOUND_VOLUME

  const volume = Number(stored)
  return Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) : DEFAULT_INTERACTION_SOUND_VOLUME
}

export function readInteractionSoundPreferences(): InteractionSoundPreferences {
  const stored = localStorage.getItem(STORAGE_KEYS.INTERACTION_SOUND_PREFERENCES)
  if (!stored) return { ...defaultPreferences }

  try {
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new TypeError('Saved sound preferences must be an object.')
    }

    const preferences = parsed as Partial<Record<SoundActivity, unknown>>
    return {
      button: isSoundPreset(preferences.button) ? preferences.button : defaultPreferences.button,
      navigation: isSoundPreset(preferences.navigation) ? preferences.navigation : defaultPreferences.navigation,
      selection: isSoundPreset(preferences.selection) ? preferences.selection : defaultPreferences.selection,
    }
  } catch (error) {
    console.warn('Unable to read saved interaction sound preferences:', error)
    return { ...defaultPreferences }
  }
}

export function isSoundPreset(value: unknown): value is SoundPreset {
  return typeof value === 'string' && validPresets.has(value)
}

function playTone(
  context: AudioContext,
  {
    frequency,
    endFrequency = frequency,
    start,
    duration,
    volume,
    type,
  }: {
    frequency: number
    endFrequency?: number
    start: number
    duration: number
    volume: number
    type: OscillatorType
  },
) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.linearRampToValueAtTime(endFrequency, start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

function playPreset(preset: SoundPreset, volume: number) {
  if (preset === 'off' || volume === 0) return

  if (typeof window === 'undefined') return
  const AudioContextConstructor = window.AudioContext
  if (!AudioContextConstructor) return

  audioContext ??= new AudioContextConstructor()
  const context = audioContext
  if (context.state === 'suspended') {
    void context.resume().catch((error: unknown) => {
      console.warn('Unable to resume interaction sounds:', error)
    })
  }
  const now = context.currentTime
  const volumeScale = (volume / 100) ** 1.5 * 6

  if (preset === 'soft-click') {
    playTone(context, {
      frequency: 740,
      endFrequency: 440,
      start: now,
      duration: 0.035,
      volume: 0.026 * volumeScale,
      type: 'triangle',
    })
  } else if (preset === 'bright-chime') {
    playTone(context, {
      frequency: 523,
      start: now,
      duration: 0.09,
      volume: 0.016 * volumeScale,
      type: 'sine',
    })
    playTone(context, {
      frequency: 784,
      start: now + 0.045,
      duration: 0.09,
      volume: 0.015 * volumeScale,
      type: 'sine',
    })
    playTone(context, {
      frequency: 1047,
      start: now + 0.09,
      duration: 0.12,
      volume: 0.013 * volumeScale,
      type: 'sine',
    })
  } else {
    playTone(context, {
      frequency: 260,
      endFrequency: 90,
      start: now,
      duration: 0.1,
      volume: 0.035 * volumeScale,
      type: 'sine',
    })
    playTone(context, {
      frequency: 650,
      endFrequency: 350,
      start: now,
      duration: 0.025,
      volume: 0.012 * volumeScale,
      type: 'triangle',
    })
  }
}

export function playInteractionSound(activity: SoundActivity) {
  if (localStorage.getItem(STORAGE_KEYS.INTERACTION_SOUND) !== 'true') return
  playPreset(readInteractionSoundPreferences()[activity], readInteractionSoundVolume())
}

export function previewInteractionSound(preset: SoundPreset) {
  playPreset(preset, readInteractionSoundVolume())
}

export function previewSavedInteractionSound(activity: SoundActivity) {
  playPreset(readInteractionSoundPreferences()[activity], readInteractionSoundVolume())
}
