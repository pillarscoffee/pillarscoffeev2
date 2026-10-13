// Pillars self-pickup locations (server-side source of truth).
//
// Multi-outlet ready: to add an outlet later (Labrador, Jewel, etc), add one
// entry here and it appears everywhere (checkout dropdown, order records,
// notifications). No other code changes needed.
//
// `id` is stored on the order; keep it short and stable. `label` is what the
// customer sees. `note` shows under the picker (collection instructions).

export const PICKUP_LOCATIONS = {
  "solaris": {
    label: "Solaris, One-North",
    address: "1 Fusionopolis Walk, #01-K1, Singapore 138628",
    note: "Collect at our kiosk counter, Monday to Friday, 8am to 4pm.",
  },
  // Example for later:
  // "labrador": { label: "Labrador", address: "...", note: "..." },
};

export function getLocation(id) {
  if (typeof id !== "string") return null;
  return Object.prototype.hasOwnProperty.call(PICKUP_LOCATIONS, id) ? PICKUP_LOCATIONS[id] : null;
}

// For the checkout dropdown: [{ id, label, note }, ...] in insertion order.
export function locationList() {
  return Object.keys(PICKUP_LOCATIONS).map(function (id) {
    const l = PICKUP_LOCATIONS[id];
    return { id: id, label: l.label, address: l.address, note: l.note };
  });
}
