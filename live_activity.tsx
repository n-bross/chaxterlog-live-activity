import {
  Button,
  HStack,
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
import { CountIntent, UndoIntent } from "./app_intents"
import { ACTIVITY_NAME, type ChaxterState } from "./config"

const PETROL = "#00698c", DEEP = "#004f6a", YELLOW = "#fffd24"
const tile = (color: string) => ({ style: color, shape: { type: "rect", cornerRadius: 14, style: "continuous" } } as const)

function CountButton({ label, value, group }: { label: string; value: number; group: "u15" | "o15" }) {
  return (
    <Button intent={CountIntent({ group })} buttonStyle="plain">
      <VStack spacing={2} padding={10} frame={{ maxWidth: "infinity" }} background={tile(PETROL)}>
        <Text font={12} foregroundStyle="white">{label}</Text>
        <Text font={26} fontWeight="bold" foregroundStyle="white">{String(value)}</Text>
        <Text font={11} fontWeight="bold" foregroundStyle={YELLOW}>+1</Text>
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
      </HStack>
      <HStack spacing={8}>
        <CountButton label="U15" value={state.u15} group="u15" />
        <CountButton label="Ü15" value={state.o15} group="o15" />
        <Button intent={UndoIntent(undefined)} buttonStyle="plain">
          <VStack spacing={2} padding={10} frame={{ width: 64 }} background={tile(DEEP)}>
            <Text font={22} fontWeight="bold" foregroundStyle="white">↶</Text>
            <Text font={11} fontWeight="bold" foregroundStyle={YELLOW}>zurück</Text>
          </VStack>
        </Button>
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
        <Button title="U15 +1" intent={CountIntent({ group: "u15" })} />
        <Button title="Ü15 +1" intent={CountIntent({ group: "o15" })} />
        <Button title="↶" intent={UndoIntent(undefined)} />
      </HStack>
    </LiveActivityUIExpandedBottom>
  </LiveActivityUI>
)

// The only LiveActivity.register call in the project.
export const ChaxterActivity = LiveActivity.register(ACTIVITY_NAME, builder)
