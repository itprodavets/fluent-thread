# Profile blocked by another open tab

The previous client held `nit-rechi-profile:<owner>` for the entire tab lifetime. A second production tab reproduced the indefinite “Открываем профиль…” state even though cloud sync itself supported multiple devices.

The client now opens without acquiring a lifetime lock. Each local operation uses a short compatibility lock and an IndexedDB read/write transaction, applying the operation to the latest durable document. BroadcastChannel invalidates other tabs using the same owner; focus, online and periodic refresh are fallbacks. Network requests hold no browser lock. Different accounts and project URLs remain isolated.

Outbox acknowledgements check mutation identity before clearing a batch; batch creation also reads the latest shared document atomically. The existing cloud RPC remains idempotent. Closing a store drains accepted local writes; “Сохранить перед закрытием” awaits an already-running cloud sync and reports whether cloud completion succeeded. Hidden tabs start a best-effort sync, but terminating a browser offline cannot guarantee a network delivery.

An old version still holding its lifetime lock must be refreshed once. Compatibility writes time out with an explanation rather than overwriting the old client's in-memory state. Ordinary new tabs never hold the lock while idle.

Verification covers concurrent additions/deletions and practice counts, a late acknowledgement after another tab created a newer outbox, waiting for in-flight sync, draining accepted writes on close and a closed notification channel. Local production-build Chrome check opened two tabs, observed the first tab's new result in the second, and retained it after closing/reopening the first tab.
