import {
  LiveActivity,
  LiveActivityUI,
  AppIntentManager,
  AppIntentProtocol,
  HStack,
  VStack,
  Text,
  Button,
  Spacer,
} from "scripting";

// KONFIGURATION
export const BASE_URL = "https://chaxterlog.jufo-grafing.de/api/v1";
export const TOKEN = "chx_3a00c90b55c8faa679d2b8db0bef7d7e49ce1a150646c075253fa43940c61858";

export interface ChaxterState {
  u15: number;
  o15: number;
  total: number;
  lastUpdate: string;
}

export async function apiCall(endpoint: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return await response.json();
}

export const CountIntent = AppIntentManager.register({
  name: "ChaxterCountIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (params: { group: "u15" | "o15" }) => {
    if (!params?.group) return;
    const res = await apiCall("/visit", "POST", { group: params.group });
    if (!res.error) {
      const controller = chaxterActivity();
      await controller.update({
        u15: res.u15 ?? 0,
        o15: res.o15 ?? 0,
        total: res.total ?? 0,
        lastUpdate: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      });
    }
  },
});

export const UndoIntent = AppIntentManager.register({
  name: "ChaxterUndoIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: Record<string, unknown>) => {
    const res = await apiCall("/undo", "POST", {});
    if (!res.error) {
      const controller = chaxterActivity();
      await controller.update({
        u15: res.u15 ?? 0,
        o15: res.o15 ?? 0,
        total: res.total ?? 0,
        lastUpdate: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      });
    }
  },
});

export const chaxterActivity = LiveActivity.register<ChaxterState>(
  "ChaxterLogActivity",
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
        children={
          <HStack alignment="center">
            <Text font={{ name: "system-bold", size: 12 }}>ChaxterLog</Text>
          </HStack>
        }
      />
    );
  }
);
