# Analysis Script Template: Alarm Event Threshold

Template ini membuat event `ALARM` saat nilai tag > `50`, dan menutup event saat nilai turun <= `50`.

## Required Variable Bindings

- `tagValue` (source: `attribute`)
  - nilai tag yang dipantau
- `currentEvent` (source: `query` / `body` / `constant`)
  - id event aktif untuk asset/tag ini (boleh kosong/null)
- `timestamp` (source: `attribute` / `query` / `body` / `constant`)
  - timestamp event (ISO string/Date/epoch). Jika kosong, fallback ke waktu sekarang.

## Script (Simple)

```js
const ts = Attribute.get("Jasuindo.Timestamp")?.value;

const threshold = 50;
const value = Number(tagValue.value);
const activeId = currentEvent.value;
const activeEvent = activeId ? Event.get(activeId) : null;

if (value > threshold) {
  if (!activeEvent || activeEvent.status !== "open") {
    const newEventId = Event.generate({
      timestamp: ts,
      parentEventId: null,
      asset: { id: tagValue.assetId },
      eventCode: "ALARM",
      context: {
        message: `tag ${tagValue.path} value is above 50. current value: ${value}`,
      },
    });
    Attribute.set(currentEvent.path, newEventId);

    return { action: "opened", eventId: newEventId };
  }

  return { action: "already-open", eventId: activeId };
}

if (activeEvent && activeEvent.status === "open") {
  Event.end({ id: activeId, timestamp: ts });
  Attribute.set(currentEvent.path, null);
  return { action: "closed", eventId: activeId };
}

return { action: "noop" };
```
