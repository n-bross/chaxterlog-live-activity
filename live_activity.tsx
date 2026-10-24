import {
  Button,
  HStack,
  Image,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedBottom,
  Link,
  Spacer,
  Text,
  VStack,
} from "scripting"
import { CountIntent, UndoIntent } from "./app_intents"
import { ACTIVITY_NAME, type ChaxterState } from "./config"

// The website's counter colours: U15 petrol, Ü15 yellow.
const PETROL = "#007ca5", YELLOW = "#fffd24", YELLOW_INK = "#10222b"
// Confirmation colours: green for a counted visit, red for an undo (as the website's −1 badge).
const SUCCESS = "#22a065", MINUS = "#e5484d"
// The clock-in reminder uses the system's attention colour.
const REMINDER = "systemOrange"
// Undo sits on the wallpaper like the Lock Screen's own controls: a dark translucent circle.
const CONTROL = "rgba(0, 0, 0, 0.35)"
const STYLE = {
  u15: { background: PETROL, text: "white" },
  o15: { background: YELLOW, text: YELLOW_INK },
} as const

function CountButton({ label, value, group, flash, height }: { label: string; value: number; group: "u15" | "o15"; flash: boolean; height: number }) {
  // While flashing, the button turns green and the plus becomes a check mark; the number rolls on.
  const style = flash ? { background: SUCCESS, text: "white" } as const : STYLE[group]
  return (
    <Button intent={CountIntent({ group })} buttonStyle="plain">
      <HStack spacing={6} padding={{ leading: 18, trailing: 14 }} frame={{ maxWidth: "infinity", minHeight: height, maxHeight: height }} background={{ style: style.background, shape: "capsule" }}>
        <VStack alignment="leading" spacing={0}>
          <Text font={12} fontWeight="semibold" foregroundStyle={style.text} opacity={0.8}>{label}</Text>
          <Text font={height > 54 ? 26 : 22} fontWeight="bold" fontDesign="rounded" monospacedDigit foregroundStyle={style.text} contentTransition="numericText">{String(value)}</Text>
        </VStack>
        <Spacer />
        <Image systemName={flash ? "checkmark.circle.fill" : "plus.circle.fill"} font={height > 54 ? 26 : 22} foregroundStyle={style.text} />
      </HStack>
    </Button>
  )
}

function UndoButton({ flash, size }: { flash: boolean; size: number }) {
  return (
    <Button intent={UndoIntent(undefined)} buttonStyle="plain">
      <Image systemName="arrow.uturn.backward" font={size / 3} fontWeight="semibold" foregroundStyle="white" frame={{ width: size, height: size }} background={{ style: flash ? MINUS : CONTROL, shape: "circle" }} />
    </Button>
  )
}

function Buttons({ state, height }: { state: ChaxterState; height: number }) {
  return (
    <HStack spacing={10}>
      <UndoButton flash={state.flash === "undo"} size={height} />
      <CountButton label="U15" value={state.u15} group="u15" flash={state.flash === "u15"} height={height} />
      <CountButton label="Ü15" value={state.o15} group="o15" flash={state.flash === "o15"} height={height} />
    </HStack>
  )
}

// Shown from arriving at work until it is tapped; the link opens Scripting, which marks the day as
// clocked in and opens the time tracking login.
function ClockInButton({ url, height }: { url: string; height: number }) {
  return (
    <Link url={url}>
      <HStack spacing={8} frame={{ maxWidth: "infinity", minHeight: height, maxHeight: height }} background={{ style: REMINDER, shape: "capsule" }}>
        <Image systemName="clock.badge.exclamationmark.fill" font={18} foregroundStyle="white" />
        <Text font={16} fontWeight="semibold" foregroundStyle="white">Einstempeln</Text>
      </HStack>
    </Link>
  )
}

// After clocking in: a quieter button in the Undo style that stays until clocked out.
function ClockOutButton({ url, height }: { url: string; height: number }) {
  return (
    <Link url={url}>
      <HStack spacing={6} frame={{ maxWidth: "infinity", minHeight: height, maxHeight: height }} background={{ style: CONTROL, shape: "capsule" }}>
        <Image systemName="rectangle.portrait.and.arrow.right" font={14} foregroundStyle="white" />
        <Text font={14} fontWeight="semibold" foregroundStyle="white">Ausstempeln</Text>
      </HStack>
    </Link>
  )
}

// A plain function, not a component, so "no button" is a null child rather than an empty view.
const clockButton = (state: ChaxterState, large: boolean) =>
  state.clockIn ? <ClockInButton url={state.clockIn} height={large ? 44 : 40} />
    : state.clockOut ? <ClockOutButton url={state.clockOut} height={large ? 34 : 32} /> : null

// Only errors get a line; when everything works the activity is just the three buttons.
function ErrorLine({ message }: { message: string }) {
  return (
    <Text font={11} fontWeight="semibold" foregroundStyle="white" lineLimit={1} padding={{ horizontal: 10, vertical: 3 }} background={{ style: MINUS, shape: "capsule" }}>
      {message}
    </Text>
  )
}

function Content({ state }: { state: ChaxterState }) {
  return (
    <VStack spacing={8} padding={12} activityBackgroundTint={{ light: "clear", dark: "clear" }}>
      {clockButton(state, true)}
      <Buttons state={state} height={60} />
      {state.message ? <ErrorLine message={state.message} /> : null}
    </VStack>
  )
}

const builder: LiveActivityUIBuilder<ChaxterState> = (state) => (
  <LiveActivityUI
    content={<Content state={state} />}
    compactLeading={<Text font={12} fontWeight="bold" foregroundStyle={state.flash === "u15" ? SUCCESS : undefined} contentTransition="numericText">{`U ${state.u15}`}</Text>}
    compactTrailing={<Text font={12} fontWeight="bold" foregroundStyle={state.flash === "o15" ? SUCCESS : undefined} contentTransition="numericText">{`Ü ${state.o15}`}</Text>}
    minimal={<Text font={12} fontWeight="bold">{String(state.total)}</Text>}
  >
    <LiveActivityUIExpandedBottom>
      <VStack spacing={6}>
        {clockButton(state, false)}
        <Buttons state={state} height={52} />
        {state.message ? <ErrorLine message={state.message} /> : null}
      </VStack>
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

// The only LiveActivity.register call in the project.
export const ChaxterActivity = LiveActivity.register(ACTIVITY_NAME, builder)
