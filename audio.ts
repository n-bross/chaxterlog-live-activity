// AVPlayer, FileManager, MediaPlayer, Path and SharedAudioSession are Scripting globals.
import { AUDIO_MODE } from "./config"

// iOS suspends an app in the background after a short while, which stops the 15-second polling loop.
// An app that is playing audio keeps running. So while the polling loop runs, the Scripting app
// plays one second of silence on repeat; BackgroundKeeper alone is not enough to keep it awake.
// "mix" plays alongside other audio (music keeps playing). "nowPlaying" takes over playback and
// shows ChaxterLog in the Now Playing controls, for when "mix" turns out not to be enough.

// One second of 8 kHz, 16-bit mono PCM silence as a WAV file.
function silentWav() {
  const samples = 8000
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  text(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); text(8, "WAVE")
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, "data"); view.setUint32(40, samples * 2, true)
  return bytes
}

export async function startSilentAudio(): Promise<(() => Promise<void>) | null> {
  if (AUDIO_MODE === "off") return null
  const path = Path.join(FileManager.temporaryDirectory, "chaxterlog-silence.wav")
  await FileManager.writeAsBytes(path, silentWav())
  await SharedAudioSession.setCategory("playback", AUDIO_MODE === "mix" ? ["mixWithOthers"] : [])
  await SharedAudioSession.setActive(true)
  const player = new AVPlayer()
  if (!player.setSource(path)) return null
  player.numberOfLoops = -1
  player.onReadyToPlay = () => player.play()
  // A phone call pauses the session; playback resumes afterwards.
  const onInterruption = (type: string) => { if (type === "ended") player.play() }
  SharedAudioSession.addInterruptionListener(onInterruption)
  if (AUDIO_MODE === "nowPlaying") {
    MediaPlayer.nowPlayingInfo = { title: "ChaxterLog", artist: "Live Activity aktualisiert sich", isLiveStream: true, playbackRate: 1 }
  }
  return async () => {
    SharedAudioSession.removeInterruptionListener(onInterruption)
    player.stop()
    player.dispose()
    if (AUDIO_MODE === "nowPlaying") MediaPlayer.nowPlayingInfo = null
    await SharedAudioSession.setActive(false, ["notifyOthersOnDeactivation"])
  }
}
