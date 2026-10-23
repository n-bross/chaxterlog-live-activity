import {
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
  LiveActivityUIExpandedBottom,
  HStack,
  VStack,
  Text,
  Button,
  Spacer,
} from "scripting";
import { CountIntent, UndoIntent } from "./app_intents";

// KONFIGURATION
export const BASE_URL = "https://chaxterlog.jufo-grafing.de/api/v1";
export const TOKEN = "chx_3a00c90b55c8faa679d2b8db0bef7d7e49ce1a150646c075253fa43940c61858";
export const ACTIVITY_NAME = "ChaxterLogActivity";

export interface ChaxterState {
  u15: number;
  o15: number;
  total: number;
  lastUpdate: string;
}

export const chaxterActivity = LiveActivity.register<ChaxterState>(
  ACTIVITY_NAME,
  (state: ChaxterState) => {
    return (
      <LiveActivityUI
        content={
          <VStack padding={12} spacing={8}>
            <HStack alignment="center">
              <Text font={{ name: "system-bold", size: 14 }}>ChaxterLog</Text>
              <Spacer />
              <Text font={{ name: "system", size: 12 }} opacity={0.7}>
                Stand {state.lastUpdate} · Gesamt {state.total}
              </Text>
            </HStack>

            <HStack spacing={10}>
              <Button intent={CountIntent({ group: "u15" })} padding={10} background="#00698c">
                <VStack alignment="center" spacing={2}>
                  <Text font={{ name: "system", size: 12 }} foregroundStyle="white" opacity={0.8}>U15</Text>
                  <Text font={{ name: "system-bold", size: 24 }} foregroundStyle="white">{String(state.u15)}</Text>
                  <Text font={{ name: "system-bold", size: 10 }} foregroundStyle="#fffd24">+1</Text>
                </VStack>
              </Button>

              <Button intent={CountIntent({ group: "o15" })} padding={10} background="#00698c">
                <VStack alignment="center" spacing={2}>
                  <Text font={{ name: "system", size: 12 }} foregroundStyle="white" opacity={0.8}>Ü15</Text>
                  <Text font={{ name: "system-bold", size: 24 }} foregroundStyle="white">{String(state.o15)}</Text>
                  <Text font={{ name: "system-bold", size: 10 }} foregroundStyle="#fffd24">+1</Text>
                </VStack>
              </Button>

              <Button intent={UndoIntent({})} padding={10} background="#004f6a">
                <VStack alignment="center" spacing={2}>
                  <Text font={{ name: "system-bold", size: 18 }} foregroundStyle="white">↶</Text>
                  <Spacer />
                  <Text font={{ name: "system-bold", size: 10 }} foregroundStyle="#fffd24">zurück</Text>
                </VStack>
              </Button>
            </HStack>
          </VStack>
        }
        compactLeading={<Text font={{ name: "system-bold", size: 12 }}>U15: {state.u15}</Text>}
        compactTrailing={<Text font={{ name: "system-bold", size: 12 }}>Ü15: {state.o15}</Text>}
        minimal={<Text font={{ name: "system-bold", size: 12 }}>{state.total}</Text>}
      >
        <LiveActivityUIExpandedLeading>
          <Text font={{ name: "system-bold", size: 12 }}>U15: {state.u15}</Text>
        </LiveActivityUIExpandedLeading>

        <LiveActivityUIExpandedTrailing>
          <Text font={{ name: "system-bold", size: 12 }}>Ü15: {state.o15}</Text>
        </LiveActivityUIExpandedTrailing>

        <LiveActivityUIExpandedBottom>
          <HStack spacing={12} padding={4}>
            <Text font={{ name: "system-bold", size: 12 }}>ChaxterLog</Text>
            <Spacer />
            <Text font={{ name: "system", size: 12 }} opacity={0.7}>Gesamt: {state.total}</Text>
          </HStack>
        </LiveActivityUIExpandedBottom>
      </LiveActivityUI>
    );
  }
);
