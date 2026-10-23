import {
  Button,
  HStack,
  Image,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedBottom,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
  Spacer,
  Text,
  VStack,
} from "scripting"
import { CountIntent, RefreshIntent, UndoIntent } from "./app_intents"
import { ACTIVITY_NAME, type ChaxterState } from "./config"

// The website's counter colours: U15 petrol, Ü15 yellow, Undo a white key with the undo arrow.
const PETROL = "#007ca5", YELLOW = "#fffd24", YELLOW_INK = "#10222b", INK = "#151515"
const STYLE = {
  u15: { background: PETROL, text: "white", accent: YELLOW },
  o15: { background: YELLOW, text: YELLOW_INK, accent: PETROL },
} as const
const tile = (color: string) => ({ style: color, shape: { type: "rect", cornerRadius: 14, style: "continuous" } } as const)

function CountButton({ label, value, group }: { label: string; value: number; group: "u15" | "o15" }) {
  const style = STYLE[group]
  return (
    <Button intent={CountIntent({ group })} buttonStyle="plain">
      <VStack spacing={2} padding={10} frame={{ maxWidth: "infinity" }} background={tile(style.background)}>
        <Text font={12} fontWeight="semibold" foregroundStyle={style.text}>{label}</Text>
        <Text font={26} fontWeight="bold" foregroundStyle={style.text}>{String(value)}</Text>
        <Text font={11} fontWeight="bold" foregroundStyle={style.accent}>+1</Text>
      </VStack>
    </Button>
  )
}

function UndoButton() {
  return (
    <Button intent={UndoIntent(undefined)} buttonStyle="plain">
      <VStack padding={10} frame={{ minWidth: 58, maxWidth: 58, maxHeight: "infinity" }} background={tile("white")}>
        <Spacer />
        <Image systemName="arrow.uturn.backward" font={22} fontWeight="semibold" foregroundStyle={INK} />
        <Spacer />
      </VStack>
    </Button>
  )
}

function Content({ state }: { state: ChaxterState }) {
  return (
    <VStack spacing={8} padding={14} activityBackgroundTint="#f7f7f6">
      <HStack>
        <Text font={14} fontWeight="bold" foregroundStyle="#151515">ChaxterLog</Text>
        <Spacer />
        <Text font={11} foregroundStyle="#6f6f6f">{`Gesamt ${state.total} · geändert ${state.changedAt}`}</Text>
        <Button intent={RefreshIntent(undefined)} buttonStyle="plain">
          <Image systemName="arrow.clockwise" font={14} fontWeight="semibold" foregroundStyle={PETROL} />
        </Button>
      </HStack>
      <HStack spacing={8}>
        <UndoButton />
        <CountButton label="U15" value={state.u15} group="u15" />
        <CountButton label="Ü15" value={state.o15} group="o15" />
      </HStack>
      <Text font={10} foregroundStyle={state.message ? "#c4372b" : "#6f6f6f"}>
        {state.message || `Stand ${state.refreshedAt}`}
      </Text>
    </VStack>
  )
}

const builder: LiveActivityUIBuilder<ChaxterState> = (state) => (
  <LiveActivityUI
    content={<Content state={state} />}
    compactLeading={<Text font={12} fontWeight="bold">{`U ${state.u15}`}</Text>}
    compactTrailing={<Text font={12} fontWeight="bold">{`Ü ${state.o15}`}</Text>}
    minimal={<Text font={12} fontWeight="bold">{String(state.total)}</Text>}
  >
    <LiveActivityUIExpandedLeading>
      <Text font={14} fontWeight="bold">{`U15: ${state.u15}`}</Text>
    </LiveActivityUIExpandedLeading>
    <LiveActivityUIExpandedTrailing>
      <Text font={14} fontWeight="bold">{`Ü15: ${state.o15}`}</Text>
    </LiveActivityUIExpandedTrailing>
    <LiveActivityUIExpandedBottom>
      <HStack spacing={8}>
        <Button title="" systemImage="arrow.uturn.backward" intent={UndoIntent(undefined)} />
        <Button title="U15 +1" intent={CountIntent({ group: "u15" })} />
        <Button title="Ü15 +1" intent={CountIntent({ group: "o15" })} />
        <Button title="↻" intent={RefreshIntent(undefined)} />
      </HStack>
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

// The only LiveActivity.register call in the project.
export const ChaxterActivity = LiveActivity.register(ACTIVITY_NAME, builder)
