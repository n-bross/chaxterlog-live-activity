import { chaxterActivity, ChaxterState, BASE_URL, TOKEN } from "./live_activity";

async function main() {
  const response = await fetch(`${BASE_URL}/today`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await response.json();

  const currentState: ChaxterState = {
    u15: data.u15 ?? 0,
    o15: data.o15 ?? 0,
    total: data.total ?? 0,
    lastUpdate: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
  };

  const controller = chaxterActivity();
  await controller.start(currentState);
  console.log("ChaxterLog Live Activity gestartet:", currentState);
}

main();
