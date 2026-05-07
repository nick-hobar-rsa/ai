# STAR-API Reference (USB Brick Mk4 — Ground Testing)

Source: STAR-Dundee Application Note SD_TN_002 + STAR-System v6 documentation.
Header: `#include <star-api.h>`

---

## Key Types

| Type | Description |
|------|-------------|
| `STAR_DEVICE_ID` | Handle to a discovered SpaceWire device |
| `STAR_CHANNEL_ID` | Handle to an opened channel on a device |
| `STAR_CHANNEL_MASK` | Bitmask of available channels on a device |
| `STAR_STREAM_ITEM` | A single TX/RX item: packet, chunk, or timecode |
| `STAR_TRANSFER_OPERATION` | A queued TX or RX operation (can hold multiple stream items) |
| `STAR_TRANSFER_STATUS` | Result of a completed transfer operation |
| `STAR_SPACEWIRE_ADDRESS` | Optional routing address prefix (NULL for point-to-point) |
| `U8`, `U16`, `U32` | Unsigned 8/16/32-bit integers used throughout the API |

---

## Device Discovery

```c
STAR_DEVICE_ID *pDeviceList;
U32 deviceCount;

pDeviceList = STAR_getDeviceList(&deviceCount);
if (!pDeviceList || deviceCount == 0) {
    /* No devices found */
}

STAR_DEVICE_ID deviceId = pDeviceList[0];  /* Use first device */
STAR_destroyDeviceList(pDeviceList);        /* Always free the list */

/* Optional: get device type string */
char *deviceType = STAR_getDeviceTypeAsString(deviceId);
if (deviceType) {
    printf("Device: %s\n", deviceType);
    STAR_destroyString(deviceType);
}
```

### Type-Filtered vs. Unfiltered Discovery (Platform Difference)

On the Q8/Yocto flight target, filtering by capability is preferred:

```c
pDeviceList = STAR_getDeviceListForType(TXRX_SUPPORTED, &deviceCount);
```

On Ubuntu/x86 dev machines with the Brick Mk4, `STAR_getDeviceListForType(TXRX_SUPPORTED)`
may return `NULL` or zero devices because the device is not classified under that type.
Use a fallback pattern:

```c
pDeviceList = STAR_getDeviceListForType(TXRX_SUPPORTED, &deviceCount);
if (!pDeviceList || deviceCount == 0) {
    // Fallback: try unfiltered list (required on Ubuntu/x86 with Brick Mk4)
    pDeviceList = STAR_getDeviceList(&deviceCount);
}
if (!pDeviceList || deviceCount == 0) {
    /* Still no devices — fail */
}
```

> **HSI-TBD**: Verify which call succeeds on Q8/Yocto and remove the fallback if
> `STAR_getDeviceListForType` is reliable there. Document the result in the HSI log.

---

## Channel Layout — USB Brick Mk4

The Brick Mk4 has **two channels**: channel 0 (config/Device Configuration APIs) and channel 1
(data). In the default interface mode, all link traffic shares channel 1.

> **Rule**: Always use channel 1 for data. Do not use channel 0 for application traffic.

When in interface mode, transmitted packets must include a routing address byte at the front
(the port number to route out of), because the device internally acts as a router.

**Alternative — port routing**: Configure the Brick via Device Configuration APIs so that
packets received on port 4 (channel 1) are routed directly to port 2 (the physical link), and
received packets on port 2 are routed to port 4. This removes the need to prepend address bytes.

---

## `STAR_CHANNEL_ID` — Handle vs. Channel Index

These are two completely distinct concepts that share similar-sounding names:

| Concept | Type | Description |
|---------|------|-------------|
| **Channel index** | `U8` | 0-based integer argument to `STAR_openChannelToLocalDevice()`. Index 0 = config service (reserved). Index 1 = data. |
| **`STAR_CHANNEL_ID`** | Opaque handle | Return value from `STAR_openChannelToLocalDevice()`. Used for all subsequent TX/RX calls. |

`(STAR_CHANNEL_ID)0` is the **invalid/unset sentinel** for the handle type — equivalent to
`NULL`. It does NOT refer to "channel index 0". Always initialize `STAR_CHANNEL_ID` fields
to `(STAR_CHANNEL_ID)0` and check before use:

```c
STAR_CHANNEL_ID channelId = (STAR_CHANNEL_ID)0;  // invalid/unset sentinel

channelId = STAR_openChannelToLocalDevice(
    deviceId,
    STAR_CHANNEL_DIRECTION_IN,
    1,   /* channel index 1 = data */
    1    /* buffered */
);
if (!channelId) {
    // Failed to open — channelId remains invalid
}
```

---

## Opening and Closing Channels

```c
STAR_CHANNEL_ID channelId;
const unsigned char channelNumber = 1;   /* Always 1 for Brick data */

/* Open bidirectional buffered channel */
channelId = STAR_openChannelToLocalDevice(
    deviceId,
    STAR_CHANNEL_DIRECTION_INOUT,  /* or _IN / _OUT */
    channelNumber,
    1                               /* 1 = buffered (REQUIRED for RX) */
);
if (!channelId) {
    /* Failed to open channel */
}

/* Check channel exists before opening */
STAR_CHANNEL_MASK mask = STAR_getDeviceChannels(deviceId);
if (!(mask & (1 << channelNumber))) {
    /* Channel doesn't exist on this device */
}

/* Close when done */
STAR_closeChannel(channelId);
```

**Direction values:**

| Constant | Use |
|----------|-----|
| `STAR_CHANNEL_DIRECTION_IN` | Receive only |
| `STAR_CHANNEL_DIRECTION_OUT` | Transmit only |
| `STAR_CHANNEL_DIRECTION_INOUT` | Bidirectional (most common) |

> **Important**: A channel cannot be opened more than once in the same direction simultaneously.
> One process can hold _IN, another can hold _OUT on the same channel at the same time.
> Always open RX-capable channels in buffered mode (last arg = 1) — packets will be dropped if
> unbuffered and no receive operation is pending.

---

## Transmitting Packets

### Full API (preferred for production):

```c
STAR_STREAM_ITEM *pTxStreamItem;
STAR_TRANSFER_OPERATION *pTxTransOp;
STAR_SPACEWIRE_ADDRESS *pAddress = NULL;  /* NULL = no routing prefix */

unsigned char txBuf[] = { 0xFE, 0x01, 0x02, 0x03 };  /* 0xFE = dest address if needed */
STAR_TRANSFER_STATUS status;

/* 1. Create stream item (packet) */
pTxStreamItem = STAR_createPacket(
    pAddress,               /* Routing address or NULL */
    txBuf,                  /* Payload bytes */
    sizeof(txBuf),          /* Length */
    STAR_EOP_TYPE_EOP       /* EOP, EEP, or NONE */
);

/* 2. Create TX operation */
pTxTransOp = STAR_createTxOperation(&pTxStreamItem, 1);  /* 1 = one stream item */

/* 3. Submit */
STAR_submitTransferOperation(channelId, pTxTransOp);

/* 4. Wait for completion */
status = STAR_waitOnTransferOperationCompletion(pTxTransOp, 5000);  /* 5s timeout */
if (status != STAR_TRANSFER_STATUS_COMPLETE) {
    /* Handle error */
}

/* 5. Cleanup — always in this order */
STAR_disposeTransferOperation(pTxTransOp);
STAR_destroyStreamItem(pTxStreamItem);
```

### Convenience wrapper (simple cases):

```c
status = STAR_transmitPacket(channelId, txBuf, sizeof(txBuf), STAR_EOP_TYPE_EOP, -1);
/* -1 = wait indefinitely */
```

**EOP type values:**

| Constant | Meaning |
|----------|---------|
| `STAR_EOP_TYPE_EOP` | Normal end of packet (use this by default) |
| `STAR_EOP_TYPE_EEP` | Error end of packet (signal upstream error) |
| `STAR_EOP_TYPE_NONE` | No termination (partial packet — advanced use only) |

---

## Receiving Packets

### Full API (preferred for production):

```c
STAR_TRANSFER_OPERATION *pRxTransOp;
STAR_STREAM_ITEM *pRxStreamItem;
unsigned char *pRxBuf;
unsigned int rxLen;
STAR_TRANSFER_STATUS status;

/* 1. Create RX operation for 1 packet */
pRxTransOp = STAR_createRxOperation(1, STAR_RECEIVE_PACKETS);
/* Pass -1 as count for unlimited — use with caution, can cause OOM */

/* 2. Submit */
STAR_submitTransferOperation(channelId, pRxTransOp);

/* 3. Wait */
status = STAR_waitOnTransferOperationCompletion(pRxTransOp, 5000);
if (status != STAR_TRANSFER_STATUS_COMPLETE) {
    STAR_disposeTransferOperation(pRxTransOp);
    return -1;
}

/* 4. Extract packet data */
pRxStreamItem = STAR_getTransferItem(pRxTransOp, 0);
if (pRxStreamItem->itemType != STAR_STREAM_ITEM_TYPE_SPACEWIRE_PACKET) {
    /* Unexpected item type */
}

pRxBuf = STAR_getPacketData(
    (STAR_SPACEWIRE_PACKET *)pRxStreamItem->item, &rxLen
);

/* 5. Use the data, then destroy in order */
STAR_destroyPacketData(pRxBuf);
STAR_disposeTransferOperation(pRxTransOp);
```

### Convenience wrapper:

```c
unsigned char rxBuf[4096];
unsigned int rxLen = sizeof(rxBuf);
STAR_EOP_TYPE eopType;

status = STAR_receivePacket(channelId, rxBuf, &rxLen, &eopType, -1);
if (status == STAR_TRANSFER_STATUS_COMPLETE) {
    if (eopType == STAR_EOP_TYPE_EEP) {
        /* Received with error — handle EEP */
    }
}
```

> **Note**: `STAR_receivePacket()` truncates packets larger than the buffer. For large or
> variable-length packets, use the full API.

---

## Timecodes

```c
/* --- Send a timecode --- */
/* Timecodes require a raw SPW_RAW socket — not a data channel */
/* On STAR-API, use the Device Configuration API or STAR_sendTimecode() */
/* Refer to STAR-System documentation for STAR_sendTimecode() signature */

/* --- Receive timecodes alongside packets --- */
/* Create RX operation for BOTH packets AND timecodes */
pRxTransOp = STAR_createRxOperation(
    -1,
    STAR_RECEIVE_PACKETS | STAR_RECEIVE_TIMECODES
);
/* Timecodes received mid-packet appear BEFORE the completed packet in the item list */
/* Check itemType == STAR_STREAM_ITEM_TYPE_TIMECODE for timecode items */
```

---

## Transfer Status Values

| Status | Meaning |
|--------|---------|
| `STAR_TRANSFER_STATUS_COMPLETE` | Success |
| `STAR_TRANSFER_STATUS_CANCELLED` | Operation was cancelled |
| `STAR_TRANSFER_STATUS_FAILED` | General failure |
| `STAR_TRANSFER_STATUS_TIMEDOUT` | Timeout expired |

---

## Memory Management Rules

| Object | Create | Destroy |
|--------|--------|---------|
| Device list | `STAR_getDeviceList()` | `STAR_destroyDeviceList()` |
| String | `STAR_getDeviceTypeAsString()` | `STAR_destroyString()` |
| Stream item | `STAR_createPacket()` | `STAR_destroyStreamItem()` |
| Transfer operation | `STAR_createTxOperation()` / `STAR_createRxOperation()` | `STAR_disposeTransferOperation()` |
| Packet data (RX) | `STAR_getPacketData()` | `STAR_destroyPacketData()` |

> Stream items owned by a receive operation are freed automatically when the operation is
> disposed — do NOT call `STAR_destroyStreamItem()` on them.

---

## Operation Reuse Pattern

Operations can be resubmitted after completion without recreating them. Useful for
high-throughput loops:

```c
/* Create once */
pTxTransOp = STAR_createTxOperation(&pTxStreamItem, 1);

while (running) {
    prepare_data(txBuf);
    STAR_submitTransferOperation(channelId, pTxTransOp);
    STAR_waitOnTransferOperationCompletion(pTxTransOp, -1);
    /* Resubmit next iteration — no need to recreate */
}

STAR_disposeTransferOperation(pTxTransOp);
```